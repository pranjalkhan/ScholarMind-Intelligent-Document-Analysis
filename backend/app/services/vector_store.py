import logging
from functools import lru_cache
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    FilterSelector,
    MatchAny,
    MatchValue,
    PointStruct,
    VectorParams,
)

from app.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_qdrant_client() -> QdrantClient:
    settings = get_settings()
    url = settings.QDRANT_URL.strip()
    if url == ":memory:":
        client = QdrantClient(":memory:")
    elif url.startswith("http://") or url.startswith("https://"):
        client = QdrantClient(
            url=url,
            api_key=settings.QDRANT_API_KEY or None,
            timeout=15.0,
        )
    else:
        # Local persistent disk Qdrant
        client = QdrantClient(path=url)
    return client


def ensure_collection(vector_size: int | None = None) -> None:
    settings = get_settings()
    client = get_qdrant_client()
    dim = vector_size or settings.EMBEDDING_DIM
    collections = [c.name for c in client.get_collections().collections]
    if settings.QDRANT_COLLECTION not in collections:
        client.create_collection(
            collection_name=settings.QDRANT_COLLECTION,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )


def upsert_chunks(chunks_with_vectors: list[dict]) -> None:
    if not chunks_with_vectors:
        return
    settings = get_settings()
    dim = len(chunks_with_vectors[0]["vector"])
    ensure_collection(vector_size=dim)
    client = get_qdrant_client()

    points = [
        PointStruct(
            id=item["chunk_id"],
            vector=item["vector"],
            payload={
                "chunk_id": item["chunk_id"],
                "document_id": item["document_id"],
                "user_id": item["user_id"],
                "filename": item.get("filename", ""),
                "page_number": item["page_number"],
                "section_title": item.get("section_title", ""),
                "text": item["text"],
            },
        )
        for item in chunks_with_vectors
    ]
    client.upsert(collection_name=settings.QDRANT_COLLECTION, points=points)


def search_vectors(
    query_vector: list[float],
    user_id: str,
    document_ids: list[str] | None = None,
    top_k: int = 15,
) -> list[dict]:
    settings = get_settings()
    client = get_qdrant_client()
    collections = [c.name for c in client.get_collections().collections]
    if settings.QDRANT_COLLECTION not in collections:
        return []

    must_conditions = [FieldCondition(key="user_id", match=MatchValue(value=user_id))]
    if document_ids:
        must_conditions.append(
            FieldCondition(key="document_id", match=MatchAny(any=document_ids))
        )

    response = client.query_points(
        collection_name=settings.QDRANT_COLLECTION,
        query=query_vector,
        query_filter=Filter(must=must_conditions),
        limit=top_k,
        with_payload=True,
    )

    results: list[dict] = []
    for hit in response.points:
        payload = hit.payload or {}
        results.append(
            {
                "chunk_id": payload.get("chunk_id", str(hit.id)),
                "document_id": payload.get("document_id", ""),
                "filename": payload.get("filename", ""),
                "page_number": payload.get("page_number", 1),
                "section_title": payload.get("section_title", ""),
                "text": payload.get("text", ""),
                "semantic_score": float(hit.score),
            }
        )
    return results


def delete_document_vectors(document_id: str, user_id: str) -> None:
    settings = get_settings()
    client = get_qdrant_client()
    collections = [c.name for c in client.get_collections().collections]
    if settings.QDRANT_COLLECTION not in collections:
        return
    try:
        client.delete(
            collection_name=settings.QDRANT_COLLECTION,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[
                        FieldCondition(key="document_id", match=MatchValue(value=document_id)),
                        FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                    ]
                )
            ),
        )
    except Exception as exc:
        logger.warning("Failed deleting vectors for doc %s: %s", document_id, exc)
