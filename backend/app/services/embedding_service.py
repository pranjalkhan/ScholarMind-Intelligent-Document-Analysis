import hashlib
import logging
import re
from functools import lru_cache
import numpy as np

from app.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _load_sentence_transformer():
    settings = get_settings()
    if not settings.USE_LOCAL_TRANSFORMERS:
        return None
    try:
        from sentence_transformers import SentenceTransformer

        logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
        return SentenceTransformer(settings.EMBEDDING_MODEL)
    except Exception as exc:
        logger.warning("Falling back to lightweight embeddings (%s)", exc)
        return None


def _lightweight_multilingual_embedding(text: str, dim: int = 384) -> list[float]:
    """
    Zero-dependency, Unicode/Bangla-aware hashed n-gram embedding fallback.
    Ideal for 512MB RAM free-tier hosting or offline unit tests.
    """
    vec = np.zeros(dim, dtype=np.float32)
    normalized = text.lower().strip()
    if not normalized:
        return vec.tolist()

    tokens = re.findall(r"\w+", normalized, flags=re.UNICODE)
    features: list[str] = list(tokens)
    # Add character 3-grams for morphological & Bangla/English partial matching
    for tok in tokens:
        if len(tok) >= 3:
            for i in range(len(tok) - 2):
                features.append(tok[i : i + 3])

    for feat in features:
        digest = hashlib.blake2b(feat.encode("utf-8"), digest_size=8).digest()
        idx = int.from_bytes(digest[:4], "little") % dim
        sign = 1.0 if (digest[4] & 1) == 0 else -1.0
        vec[idx] += sign

    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec /= norm
    return vec.tolist()


def generate_embedding(text: str, is_query: bool = False) -> list[float]:
    """Generate a normalized embedding vector for a passage or query."""
    settings = get_settings()
    model = _load_sentence_transformer()
    if model is not None:
        prefix = "query: " if is_query else "passage: "
        input_text = f"{prefix}{text}" if "e5" in settings.EMBEDDING_MODEL.lower() else text
        vec = model.encode(input_text, normalize_embeddings=True)
        return vec.tolist()

    return _lightweight_multilingual_embedding(text, dim=settings.EMBEDDING_DIM)


def generate_embeddings_batch(texts: list[str], is_query: bool = False) -> list[list[float]]:
    if not texts:
        return []
    settings = get_settings()
    model = _load_sentence_transformer()
    if model is not None:
        prefix = "query: " if is_query else "passage: "
        inputs = [
            f"{prefix}{t}" if "e5" in settings.EMBEDDING_MODEL.lower() else t for t in texts
        ]
        vecs = model.encode(inputs, normalize_embeddings=True)
        return [v.tolist() for v in vecs]

    return [_lightweight_multilingual_embedding(t, dim=settings.EMBEDDING_DIM) for t in texts]
