import logging
import uuid
from pathlib import Path

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.database import SessionLocal, get_db
from app.models import Chunk, Document, User
from app.schemas import DocumentOut, DocumentStatusOut
from app.services.chunking import create_chunks
from app.services.embedding_service import generate_embeddings_batch
from app.services.pdf_processor import extract_pdf_pages
from app.services.vector_store import delete_document_vectors, upsert_chunks

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["documents"])


def _set_doc_status(db: Session, doc_id: str, new_status: str, error_msg: str | None = None) -> None:
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if doc:
        doc.status = new_status
        doc.error_message = error_msg
        db.commit()


def process_document_pipeline(doc_id: str) -> None:
    """Background ingestion: extracting -> chunking -> embedding -> indexing -> completed."""
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return

        _set_doc_status(db, doc_id, "extracting")
        pages = extract_pdf_pages(doc.file_path)
        if not pages or all(not p["text"].strip() for p in pages):
            _set_doc_status(
                db,
                doc_id,
                "failed",
                "No extractable text found in PDF (empty or unreadable).",
            )
            return

        ocr_pages = sum(1 for p in pages if p["extraction_method"] == "ocr")

        _set_doc_status(db, doc_id, "chunking")
        chunk_dicts = create_chunks(pages, max_tokens=450, overlap_tokens=75)
        if not chunk_dicts:
            _set_doc_status(db, doc_id, "failed", "PDF produced zero text chunks.")
            return

        # Clear any old chunks on retry
        db.query(Chunk).filter(Chunk.document_id == doc_id).delete()
        db.commit()

        chunk_records: list[Chunk] = []
        for ch in chunk_dicts:
            # Deterministic UUID5 per (doc_id, page, index) for idempotent Qdrant upserts
            stable_id = str(
                uuid.uuid5(uuid.NAMESPACE_DNS, f"{doc_id}:{ch['page_number']}:{ch['chunk_index']}")
            )
            rec = Chunk(
                id=stable_id,
                document_id=doc_id,
                user_id=doc.user_id,
                page_number=ch["page_number"],
                chunk_index=ch["chunk_index"],
                section_title=ch["section_title"],
                extraction_method=ch["extraction_method"],
                text=ch["text"],
                token_count=ch["token_count"],
            )
            db.add(rec)
            chunk_records.append(rec)
        db.commit()

        _set_doc_status(db, doc_id, "embedding")
        vectors = generate_embeddings_batch([c.text for c in chunk_records], is_query=False)

        _set_doc_status(db, doc_id, "indexing")
        payloads = [
            {
                "chunk_id": rec.id,
                "document_id": doc_id,
                "user_id": doc.user_id,
                "filename": doc.filename,
                "page_number": rec.page_number,
                "section_title": rec.section_title,
                "text": rec.text,
                "vector": vec,
            }
            for rec, vec in zip(chunk_records, vectors)
        ]
        upsert_chunks(payloads)

        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.page_count = len(pages)
            doc.chunk_count = len(chunk_records)
            doc.ocr_pages = ocr_pages
            doc.status = "completed"
            doc.error_message = None
            db.commit()
    except Exception as exc:
        logger.exception("Ingestion failed for document %s", doc_id)
        _set_doc_status(db, doc_id, "failed", f"Processing error: {exc}")
    finally:
        db.close()


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    category: str = Form("general"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    filename = Path(file.filename or "document.pdf").name
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported.",
        )

    raw_bytes = await file.read()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(raw_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    if len(raw_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.MAX_UPLOAD_MB} MB limit.",
        )
    if not raw_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid PDF file: missing %PDF- header.",
        )

    doc_id = str(uuid.uuid4())
    user_dir = settings.upload_path / current_user.id
    user_dir.mkdir(parents=True, exist_ok=True)
    safe_path = user_dir / f"{doc_id}.pdf"
    safe_path.write_bytes(raw_bytes)

    doc = Document(
        id=doc_id,
        user_id=current_user.id,
        filename=filename,
        file_path=str(safe_path),
        file_size_bytes=len(raw_bytes),
        status="pending",
        category=category.strip() or "general",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    background_tasks.add_task(process_document_pipeline, doc.id)
    return DocumentOut.model_validate(doc)


@router.get("", response_model=list[DocumentOut])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return [DocumentOut.model_validate(d) for d in docs]


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return DocumentOut.model_validate(doc)


@router.get("/{document_id}/status", response_model=DocumentStatusOut)
def get_document_status(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return DocumentStatusOut(
        id=doc.id,
        status=doc.status,
        page_count=doc.page_count,
        chunk_count=doc.chunk_count,
        ocr_pages=doc.ocr_pages,
        error_message=doc.error_message,
    )


@router.get("/{document_id}/file")
def view_document_file(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc or not Path(doc.file_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found.")
    return FileResponse(
        path=doc.file_path,
        media_type="application/pdf",
        filename=doc.filename,
        headers={"Content-Disposition": f'inline; filename="{doc.filename}"'},
    )


@router.post("/{document_id}/retry", response_model=DocumentStatusOut)
def retry_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    doc.status = "pending"
    doc.error_message = None
    db.commit()
    background_tasks.add_task(process_document_pipeline, doc.id)
    return DocumentStatusOut(
        id=doc.id,
        status=doc.status,
        page_count=doc.page_count,
        chunk_count=doc.chunk_count,
        ocr_pages=doc.ocr_pages,
        error_message=None,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    delete_document_vectors(document_id=doc.id, user_id=current_user.id)
    file_path = Path(doc.file_path)
    if file_path.exists():
        file_path.unlink(missing_ok=True)

    db.delete(doc)
    db.commit()
