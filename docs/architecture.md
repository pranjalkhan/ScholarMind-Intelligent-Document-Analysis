# ScholarMind: Intelligent Document Analysis — System Architecture

## High-Level Architecture

```
React + TypeScript + Tailwind Frontend (Vercel / Vite)
   │  Upload • Chat • Compare • Study • Evaluation Dashboard
   ▼
FastAPI Backend (Render / Railway / Docker)
   ├── Auth & Permissions (JWT + per-user ownership checks)
   ├── Ingestion Pipeline:
   │     PDF Validation → PyMuPDF → OCR (if scanned) → Cleaning → Chunking → Embeddings → PostgreSQL + Qdrant
   ├── Question-Answering Pipeline:
   │     Query Rewriting → Hybrid Search (Qdrant + Keyword RRF) → Cross-Encoder Reranking
   │     → Structured LLM Generation → Citation Validation → Claim Verification & Conflict/Abstention
   ├── Research & Study Services:
   │     Multi-Paper Comparison • Hierarchical Summaries • Cited Quizzes & Flashcards
   └── Evaluation Engine:
         Benchmark Runner (V1–V5) • Recall@K • Precision@K • Faithfulness • Latency & Cost
```

## Storage
- **PostgreSQL** (or SQLite in local dev): `users`, `documents`, `chunks`, `conversations`, `messages`, `citations`, `quizzes`, `evaluation_runs`, `evaluation_results`.
- **Qdrant**: Dense embeddings with `user_id`, `document_id`, `page_number`, `section_title` payload for server-side filtered vector search.
