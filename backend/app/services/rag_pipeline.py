import time
from sqlalchemy.orm import Session

from app.services.citation_service import validate_and_resolve_citations
from app.services.llm_service import generate_grounded_qa
from app.services.query_rewriter import rewrite_query
from app.services.reranker import rerank_chunks
from app.services.retrieval import hybrid_retrieve
from app.services.verification import verify_claims_and_detect_conflicts


def run_rag_pipeline(
    db: Session,
    user_id: str,
    question: str,
    document_ids: list[str] | None = None,
    recent_messages: list[dict] | None = None,
    language: str = "auto",
    use_reranker: bool = True,
    use_query_rewrite: bool = True,
) -> dict:
    """
    End-to-end ScholarMind QA pipeline:
    1. Query rewriting (optional)
    2. Hybrid retrieval (Qdrant semantic + DB keyword via RRF)
    3. Cross-encoder reranking (optional)
    4. Structured LLM answer generation
    5. Citation validation against retrieved chunks
    6. Claim verification, abstention, and conflict detection
    """
    t0 = time.perf_counter()

    rewritten_query = (
        rewrite_query(question, recent_messages) if use_query_rewrite else question.strip()
    )

    candidates = hybrid_retrieve(
        db=db,
        query=rewritten_query,
        user_id=user_id,
        document_ids=document_ids,
        semantic_k=15,
        keyword_k=15,
        final_k=12,
        mode="hybrid",
    )

    if use_reranker and candidates:
        top_chunks = rerank_chunks(rewritten_query, candidates, top_k=5)
    else:
        top_chunks = candidates[:5]

    llm_out = generate_grounded_qa(
        question=question,
        evidence_chunks=top_chunks,
        language=language,
    )

    raw_claims = llm_out.get("claims", [])
    validated_claims = validate_and_resolve_citations(raw_claims, top_chunks)
    verified_claims, verifier_abstain, conflicts = verify_claims_and_detect_conflicts(
        validated_claims=validated_claims,
        retrieved_chunks=top_chunks,
        llm_conflicts=llm_out.get("conflicts"),
    )

    insufficient = bool(llm_out.get("insufficient_evidence")) or verifier_abstain or not top_chunks
    if insufficient:
        status = "abstained"
        answer = (
            llm_out.get("answer")
            if llm_out.get("insufficient_evidence")
            else "I couldn't find sufficient verified evidence in your uploaded documents to answer this question."
        )
        verified_claims = []
    elif conflicts:
        status = "conflict"
        answer = llm_out.get("answer", "")
    else:
        status = "answered"
        answer = llm_out.get("answer", "")

    latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    usage = llm_out.get("usage", {})

    return {
        "status": status,
        "answer": answer,
        "rewritten_query": rewritten_query,
        "insufficient_evidence": insufficient,
        "claims": verified_claims,
        "conflicts": conflicts,
        "retrieved_chunks": top_chunks,
        "latency_ms": latency_ms,
        "estimated_cost_usd": float(usage.get("cost_usd", 0.0)),
    }
