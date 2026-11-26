from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import EvaluationResult, EvaluationRun, User
from app.schemas import EvaluationRunRequest
from app.services.evaluation import run_evaluation_suite

router = APIRouter(prefix="/evaluation", tags=["evaluation"])


@router.get("/summary")
def get_evaluation_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    runs = (
        db.query(EvaluationRun)
        .filter(EvaluationRun.config_json.contains(f'"user_id": "{current_user.id}"'))
        .order_by(EvaluationRun.created_at.desc())
        .limit(10)
        .all()
    )
    failures = (
        db.query(EvaluationResult)
        .join(EvaluationRun, EvaluationRun.id == EvaluationResult.run_id)
        .filter(EvaluationResult.passed == False)  # noqa: E712
        .filter(EvaluationRun.config_json.contains(f'"user_id": "{current_user.id}"'))
        .limit(10)
        .all()
    )

    return {
        "runs": [
            {
                "id": r.id,
                "version_name": r.version_name,
                "recall_at_5": r.recall_at_5,
                "precision_at_5": r.precision_at_5,
                "mrr": r.mrr,
                "faithfulness": r.faithfulness,
                "citation_precision": r.citation_precision,
                "abstention_accuracy": r.abstention_accuracy,
                "avg_latency_ms": r.avg_latency_ms,
                "p95_latency_ms": r.p95_latency_ms,
                "cost_per_question_usd": r.cost_per_question_usd,
                "total_questions": r.total_questions,
                "created_at": r.created_at,
            }
            for r in runs
        ],
        "failure_examples": [
            {
                "question_id": f.question_id,
                "category": f.category,
                "language": f.language,
                "question": f.question,
                "expected_answer": f.expected_answer,
                "predicted_answer": f.predicted_answer,
                "recall_at_5": f.recall_at_5,
            }
            for f in failures
        ],
    }


@router.post("/run")
def trigger_evaluation(
    payload: EvaluationRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    runs = run_evaluation_suite(db=db, user_id=current_user.id, versions=payload.versions)
    return {"runs": runs}
