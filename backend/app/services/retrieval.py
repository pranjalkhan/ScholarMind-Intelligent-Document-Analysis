from sqlalchemy.orm import Session

from app.services.embedding_service import generate_embedding
from app.services.keyword_search import keyword_search_chunks
from app.services.vector_store import search_vectors


def reciprocal_rank_fusion(
    ranked_lists: list[list[dict]],
    k: int = 60,
) -> list[dict]:
    """
    Combine multiple ranked candidate lists using Reciprocal Rank Fusion:
        RRF(d) = sum_r 1 / (k + rank_r(d))
    """
    scores: dict[str, float] = {}
    items_by_id: dict[str, dict] = {}

    for ranked in ranked_lists:
        for rank_idx, item in enumerate(ranked, start=1):
            cid = item["chunk_id"]
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank_idx)
            if cid not in items_by_id:
                items_by_id[cid] = dict(item)
            else:
                # Merge any extra score fields
                for key in ("semantic_score", "keyword_score"):
                    if key in item:
                        items_by_id[cid][key] = item[key]

    fused: list[dict] = []
    for cid, rrf_score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
        entry = items_by_id[cid]
        entry["rrf_score"] = rrf_score
        fused.append(entry)
    return fused


def hybrid_retrieve(
    db: Session,
    query: str,
    user_id: str,
    document_ids: list[str] | None = None,
    semantic_k: int = 15,
    keyword_k: int = 15,
    final_k: int = 12,
    mode: str = "hybrid",
) -> list[dict]:
    """
    Retrieve candidate chunks using semantic, keyword, or hybrid (RRF) search.
    Always enforces user_id isolation.
    """
    semantic_hits: list[dict] = []
    keyword_hits: list[dict] = []

    if mode in ("semantic", "hybrid"):
        q_vec = generate_embedding(query, is_query=True)
        semantic_hits = search_vectors(
            query_vector=q_vec,
            user_id=user_id,
            document_ids=document_ids,
            top_k=semantic_k,
        )

    if mode in ("keyword", "hybrid"):
        keyword_hits = keyword_search_chunks(
            db=db,
            query=query,
            user_id=user_id,
            document_ids=document_ids,
            top_k=keyword_k,
        )

    if mode == "semantic":
        return semantic_hits[:final_k]
    if mode == "keyword":
        return keyword_hits[:final_k]

    fused = reciprocal_rank_fusion([semantic_hits, keyword_hits])
    return fused[:final_k]
