from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables or .env."""

    APP_NAME: str = "ScholarMind: Intelligent Document Analysis"
    APP_VERSION: str = "1.0.0"

    # Database: PostgreSQL in production, SQLite for zero-config local dev
    DATABASE_URL: str = "sqlite:///./knowflow.db"

    # Security / JWT
    SECRET_KEY: str = "knowflow-dev-secret-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Vector Store (Qdrant)
    QDRANT_URL: str = "./qdrant_local"
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION: str = "knowflow_chunks"
    EMBEDDING_DIM: int = 384

    # LLM API (OpenAI-compatible: Groq, OpenRouter, Together, OpenAI, etc.)
    LLM_BASE_URL: str = "https://api.groq.com/openai/v1"
    LLM_MODEL: str = "openai/gpt-oss-120b"
    LLM_API_KEY: str = ""
    LLM_TIMEOUT_SECONDS: float = 45.0

    # Embeddings & Reranker
    USE_LOCAL_TRANSFORMERS: bool = False
    EMBEDDING_MODEL: str = "intfloat/multilingual-e5-base"
    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_MB: int = 25

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def upload_path(self) -> Path:
        path = Path(self.UPLOAD_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
