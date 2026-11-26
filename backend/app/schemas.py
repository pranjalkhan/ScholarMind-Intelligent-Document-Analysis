from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field


# --- Auth ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(default="", max_length=120)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- Documents ---
class DocumentOut(BaseModel):
    id: str
    filename: str
    file_size_bytes: int
    status: str
    error_message: str | None = None
    page_count: int
    chunk_count: int
    ocr_pages: int
    category: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentStatusOut(BaseModel):
    id: str
    status: str
    page_count: int
    chunk_count: int
    ocr_pages: int
    error_message: str | None = None


# --- Chat & Citations ---
class ClaimCitationOut(BaseModel):
    claim_text: str
    evidence_ids: list[str]
    verification_status: Literal["supported", "partially_supported", "unsupported", "contradicted"]
    citations: list[dict]


class ConflictItem(BaseModel):
    subject: str
    source_a: str
    statement_a: str
    source_b: str
    statement_b: str


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    document_ids: list[str] | None = None
    language: str = "auto"  # auto | en | bn
    use_reranker: bool = True
    use_query_rewrite: bool = True


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    status: Literal["answered", "abstained", "conflict"]
    answer: str
    rewritten_query: str
    insufficient_evidence: bool
    claims: list[ClaimCitationOut]
    conflicts: list[ConflictItem] = []
    latency_ms: float
    estimated_cost_usd: float


class MessageFeedbackRequest(BaseModel):
    feedback: Literal["helpful", "not_helpful"]


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    status: str
    feedback: str | None = None
    latency_ms: float
    estimated_cost_usd: float
    citations: list[dict] = []
    created_at: datetime


class ConversationSummaryOut(BaseModel):
    id: str
    title: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetailOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    messages: list[MessageOut]


# --- Research & Study ---
class CompareRequest(BaseModel):
    document_ids: list[str] = Field(min_length=2, max_length=5)
    topic: str = Field(default="methodology, dataset, results, and limitations", max_length=500)


class SummaryRequest(BaseModel):
    document_id: str
    summary_type: Literal["short", "detailed", "section_by_section"] = "short"


class QuizRequest(BaseModel):
    document_id: str
    num_questions: int = Field(default=5, ge=1, le=15)
    question_types: list[Literal["mcq", "true_false", "short_answer", "flashcard"]] = [
        "mcq",
        "true_false",
        "flashcard",
    ]


# --- Evaluation ---
class EvaluationRunRequest(BaseModel):
    versions: list[str] = ["V1", "V2", "V3", "V4", "V5"]
