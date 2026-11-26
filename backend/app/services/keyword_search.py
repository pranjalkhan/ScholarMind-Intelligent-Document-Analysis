import re
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import Chunk, Document


def keyword_search_chunks(
    db: Session,
    query: str,
    user_id: str,
    document_ids: list[str] | None = None,
    top_k: int = 15,
) -> list[dict]:
    """
    Exact & full-text keyword search over user-owned chunks.
    Uses PostgreSQL `ts_rank` + `plainto_tsquery` when on PostgreSQL,
    and Unicode-safe term-frequency scoring on SQLite.
    """
    dialect = db.bind.dialect.name if db.bind else "sqlite"

    if dialect == "postgresql":
        sql = """
            SELECT c.id AS chunk_id, c.document_id, d.filename, c.page_number,
                   c.section_title, c.text,
                   ts_rank(to_tsvector('simple', c.text), plainto_tsquery('simple', :q)) AS score
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            WHERE c.user_id = :uid
              AND to_tsvector('simple', c.text) @@ plainto_tsquery('simple', :q)
        """
        params: dict = {"q": query, "uid": user_id, "lim": top_k}
        if document_ids:
            sql += " AND c.document_id = ANY(:doc_ids)"
            params["doc_ids"] = document_ids
        sql += " ORDER BY score DESC LIMIT :lim"
        rows = db.execute(text(sql), params).mappings().all()
        return [
            {
                "chunk_id": r["chunk_id"],
                "document_id": r["document_id"],
                "filename": r["filename"],
                "page_number": r["page_number"],
                "section_title": r["section_title"],
                "text": r["text"],
                "keyword_score": float(r["score"]),
            }
            for r in rows
        ]

    # SQLite / generic fallback: fetch user's chunks and score by exact keyword overlap
    q_tokens = [t.lower() for t in re.findall(r"\w+", query, flags=re.UNICODE) if len(t) >= 2]
    if not q_tokens:
        return []

    q_obj = (
        db.query(Chunk, Document.filename)
        .join(Document, Document.id == Chunk.document_id)
        .filter(Chunk.user_id == user_id)
    )
    if document_ids:
        q_obj = q_obj.filter(Chunk.document_id.in_(document_ids))

    scored: list[dict] = []
    q_lower = query.lower().strip()
    for chunk, filename in q_obj.all():
        text_lower = chunk.text.lower()
        hits = sum(text_lower.count(tok) for tok in q_tokens)
        if hits == 0:
            continue
        distinct_hits = sum(1 for tok in set(q_tokens) if tok in text_lower)
        phrase_bonus = 3.0 if q_lower in text_lower else 0.0
        score = distinct_hits * 2.0 + min(hits, 10) * 0.25 + phrase_bonus
        scored.append(
            {
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "filename": filename,
                "page_number": chunk.page_number,
                "section_title": chunk.section_title,
                "text": chunk.text,
                "keyword_score": float(score),
            }
        )

    scored.sort(key=lambda item: item["keyword_score"], reverse=True)
    return scored[:top_k]
