from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.routers import auth, chat, documents, evaluation, research

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(research.router)
app.include_router(evaluation.router)


@app.get("/")
def home():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    from sqlalchemy import text
    from app.database import engine
    from app.services.vector_store import get_qdrant_client

    db_ok = False
    qdrant_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        db_ok = False

    try:
        get_qdrant_client().get_collections()
        qdrant_ok = True
    except Exception:
        qdrant_ok = False

    return {
        "status": "healthy" if (db_ok and qdrant_ok) else "degraded",
        "database": "connected" if db_ok else "unavailable",
        "qdrant": "connected" if qdrant_ok else "unavailable",
    }
