import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Quiz, User
from app.schemas import CompareRequest, QuizRequest, SummaryRequest
from app.services.research_service import (
    compare_documents,
    generate_quiz,
    generate_summary,
)

router = APIRouter(tags=["research"])


@router.post("/research/compare")
def compare_papers(
    payload: CompareRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return compare_documents(
            db=db,
            user_id=current_user.id,
            document_ids=payload.document_ids,
            topic=payload.topic,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/summaries/generate")
def create_summary(
    payload: SummaryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return generate_summary(
            db=db,
            user_id=current_user.id,
            document_id=payload.document_id,
            summary_type=payload.summary_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/quizzes/generate")
def create_quiz(
    payload: QuizRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        quiz_data = generate_quiz(
            db=db,
            user_id=current_user.id,
            document_id=payload.document_id,
            num_questions=payload.num_questions,
            question_types=payload.question_types,
        )
        rec = Quiz(
            user_id=current_user.id,
            document_id=payload.document_id,
            title=f"Study Quiz — {quiz_data['filename']}",
            questions_json=json.dumps(quiz_data["items"]),
        )
        db.add(rec)
        db.commit()
        return quiz_data
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
