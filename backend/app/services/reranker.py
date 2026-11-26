import logging
import re
from functools import lru_cache

from app.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _load_cross_encoder():
    settings = get_settings()
    if not settings.USE_LOCAL_TRANSFORMERS:
        return None
    try:
        from sentence_transformers import CrossEncoder

        logger.info("Loading cross-encoder reranker: %s", settings.RERANKER_MODEL)
        return CrossEncoder(settings.RERANKER_MODEL)
    except Exception as exc:
        logger.warning("CrossEncoder unavailable, using lexical reranker (%s)", exc)
        return None


def _lexical_cross_score(query: str, passage: str, base_rrf: float = 0.0) -> float:
    """Fast, zero-RAM cross-signal scorer combining term coverage, bigram overlap, and RRF."""
    q_tokens = [t.lower() for t in re.findall(r"\w+", query, flags=re.UNICODE) if len(t) >= 2]
    p_lower = passage.lower()
    if not q_tokens or not p_lower:
        return base_rrf

    matched = sum(1 for t in set(q_tokens) if t in p_lower)
    coverage = matched / max(1, len(set(q_tokens)))

    # Bigram proximity bonus
    q_bigrams = [f"{q_tokens[i]} {q_tokens[i+1]}" for i in range(len(q_tokens) - 1)]
    bigram_hits = sum(1 for bg in q_bigrams if bg in p_lower)
    bigram_score = bigram_hits / max(1, len(q_bigrams)) if q_bigrams else 0.0

    return coverage * 0.65 + bigram_score * 0.25 + min(base_rrf * 10.0, 0.3)


def rerank_chunks(query: str, chunks: list[dict], top_k: int = 5) -> list[dict]:
    """Reorder candidate chunks by relevance to the query."""
    if not chunks:
        return []

    model = _load_cross_encoder()
    if model is not None:
        pairs = [[query, c["text"]] for c in chunks]
        scores = model.predict(pairs)
        ranked = sorted(
            zip(chunks, scores),
            key=lambda item: float(item[1]),
            reverse=True,
        )
        results = []
        for chunk, score in ranked[:top_k]:
            copy = dict(chunk)
            copy["rerank_score"] = float(score)
            results.append(copy)
        return results

    scored = []
    for c in chunks:
        score = _lexical_cross_score(query, c["text"], base_rrf=c.get("rrf_score", 0.0))
        copy = dict(c)
        copy["rerank_score"] = float(score)
        scored.append(copy)

    scored.sort(key=lambda x: x["rerank_score"], reverse=True)
    return scored[:top_k]
