"""
Standalone reproducible evaluation runner for ScholarMind.
Usage (from knowflow-ai/backend with venv activated):
    python ../evaluation/run_evaluation.py
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.config import get_settings  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import User  # noqa: E402
from app.services.evaluation import run_evaluation_suite  # noqa: E402


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    settings = get_settings()
    try:
        eval_user = db.query(User).filter(User.email == "eval@knowflow.local").first()
        if not eval_user:
            eval_user = User(
                email="eval@knowflow.local",
                full_name="Benchmark Runner",
                password_hash="benchmark-only",
            )
            db.add(eval_user)
            db.commit()
            db.refresh(eval_user)

        runs = run_evaluation_suite(
            db=db,
            user_id=eval_user.id,
            versions=["V1", "V2", "V3", "V4", "V5"],
        )

        results_dir = Path(__file__).resolve().parent / "results"
        results_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        out_path = results_dir / f"eval_{stamp}.json"
        payload = {
            "timestamp_utc": stamp,
            "benchmark_version": "v1.0-30q",
            "config": {
                "llm_model": settings.LLM_MODEL,
                "embedding_model": settings.EMBEDDING_MODEL,
                "reranker_model": settings.RERANKER_MODEL,
                "use_local_transformers": settings.USE_LOCAL_TRANSFORMERS,
            },
            "runs": runs,
        }
        out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"Saved evaluation results to: {out_path}")
        for r in runs:
            print(
                f"  {r['version_name']}: Recall@5={r['recall_at_5']}, "
                f"Precision@5={r['precision_at_5']}, MRR={r['mrr']}, "
                f"AvgLatency={r['avg_latency_ms']}ms"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
