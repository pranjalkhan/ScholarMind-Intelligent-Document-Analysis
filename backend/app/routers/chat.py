import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Citation, Conversation, Document, Message, User
from app.schemas import (
    ChatRequest,
    ChatResponse,
    ClaimCitationOut,
    ConflictItem,
    ConversationDetailOut,
    ConversationSummaryOut,
    MessageFeedbackRequest,
    MessageOut,
)
from app.services.rag_pipeline import run_rag_pipeline

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def ask_question(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify requested document_ids belong to current user
    if payload.document_ids:
        owned_count = (
            db.query(Document)
            .filter(Document.user_id == current_user.id, Document.id.in_(payload.document_ids))
            .count()
        )
        if owned_count != len(set(payload.document_ids)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="One or more selected documents are not accessible.",
            )

    # Load or create conversation
    if payload.conversation_id:
        conv = (
            db.query(Conversation)
            .filter(
                Conversation.id == payload.conversation_id,
                Conversation.user_id == current_user.id,
            )
            .first()
        )
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    else:
        conv = Conversation(
            user_id=current_user.id,
            title=payload.question[:60].strip(),
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    recent_msgs = [
        {"role": m.role, "content": m.content}
        for m in conv.messages[-6:]
    ]

    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=payload.question,
        status="answered",
    )
    db.add(user_msg)
    db.commit()

    rag_result = run_rag_pipeline(
        db=db,
        user_id=current_user.id,
        question=payload.question,
        document_ids=payload.document_ids,
        recent_messages=recent_msgs,
        language=payload.language,
        use_reranker=payload.use_reranker,
        use_query_rewrite=payload.use_query_rewrite,
    )

    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=rag_result["answer"],
        status=rag_result["status"],
        metadata_json=json.dumps({"rewritten_query": rag_result["rewritten_query"]}),
        latency_ms=rag_result["latency_ms"],
        estimated_cost_usd=rag_result["estimated_cost_usd"],
    )
    db.add(assistant_msg)
    db.flush()

    for claim in rag_result["claims"]:
        for cit in claim.get("citations", []):
            db.add(
                Citation(
                    message_id=assistant_msg.id,
                    document_id=cit["document_id"],
                    chunk_id=cit["chunk_id"],
                    filename=cit["filename"],
                    page_number=cit["page_number"],
                    claim_text=claim["claim_text"],
                    quote=cit["quote"],
                    verification_status=claim["verification_status"],
                )
            )
    db.commit()

    return ChatResponse(
        conversation_id=conv.id,
        message_id=assistant_msg.id,
        status=rag_result["status"],
        answer=rag_result["answer"],
        rewritten_query=rag_result["rewritten_query"],
        insufficient_evidence=rag_result["insufficient_evidence"],
        claims=[ClaimCitationOut(**c) for c in rag_result["claims"]],
        conflicts=[ConflictItem(**cf) for cf in rag_result["conflicts"]],
        latency_ms=rag_result["latency_ms"],
        estimated_cost_usd=rag_result["estimated_cost_usd"],
    )


@router.get("/conversations", response_model=list[ConversationSummaryOut])
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    convs = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(Conversation.created_at.desc())
        .all()
    )
    return [ConversationSummaryOut.model_validate(c) for c in convs]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailOut)
def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    messages_out = []
    for m in conv.messages:
        messages_out.append(
            MessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                status=m.status,
                feedback=m.feedback,
                latency_ms=m.latency_ms,
                estimated_cost_usd=m.estimated_cost_usd,
                citations=[
                    {
                        "document_id": c.document_id,
                        "chunk_id": c.chunk_id,
                        "filename": c.filename,
                        "page_number": c.page_number,
                        "claim_text": c.claim_text,
                        "quote": c.quote,
                        "verification_status": c.verification_status,
                    }
                    for c in m.citations
                ],
                created_at=m.created_at,
            )
        )

    return ConversationDetailOut(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        messages=messages_out,
    )


@router.post("/messages/{message_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
def submit_feedback(
    message_id: str,
    payload: MessageFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = (
        db.query(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .filter(Message.id == message_id, Conversation.user_id == current_user.id)
        .first()
    )
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")
    msg.feedback = payload.feedback
    db.commit()
