# ScholarMind: Intelligent Document Analysis — Requirements Specification

## 1. Overview
ScholarMind is an intelligent personal research workspace designed for high-accuracy, evidence-grounded document understanding, claim-level citations, conflict detection, research comparison, study tools, and quantitative RAG evaluation.

## 2. Functional Requirements
1. **User Authentication**: Users can register and log in using email and password.
2. **Document Management**: Users can upload PDF documents, view uploaded documents and their processing status, view original PDF pages, and delete documents.
3. **Intelligent Processing**: Extract text and page numbers via PyMuPDF, detect scanned pages and apply Tesseract OCR, clean text while preserving structure (headings, lists, tables, math), and split into structure-aware chunks.
4. **Knowledge Retrieval**: Hybrid search combining semantic vector search (Qdrant) and keyword full-text search (PostgreSQL/SQLite) fused via Reciprocal Rank Fusion (RRF), followed by Cross-Encoder reranking and context-aware query rewriting.
5. **Evidence-Grounded Q&A**: Answer questions in English and Bangla using retrieved evidence, with structured JSON output, claim-level citations pointing to real source passages and pages, evidence verification, automatic abstention when evidence is insufficient, and conflict detection across disagreeing documents.
6. **Research & Study Tools**: Multi-document research comparison tables with per-cell citations, hierarchical document summarization (short, detailed, section-by-section), and AI study mode (MCQs, true/false, short-answer, flashcards with source page references).
7. **Evaluation Dashboard**: Benchmark dataset and automated metrics (Recall@5, Precision@5, MRR, Faithfulness, Citation Precision, Abstention Quality, Latency, Cost) comparing V1–V5 RAG configurations.

## 3. Non-Functional Requirements
- **Tenant Isolation**: A user must never access, search, or delete another user's documents or conversations.
- **Safe Ingestion**: Validate PDF extension, magic bytes (`%PDF-`), and file size limits; handle corrupted/empty PDFs gracefully.
- **Prompt-Injection Resistance**: Uploaded document text is treated strictly as untrusted data, never as system instructions.
- **Verifiability**: Every citation ID returned by the LLM must be validated against the retrieved candidate set; page numbers are always sourced from database metadata, never LLM generation.
- **Observability & Deployability**: Track token usage, latency, and errors; support Docker Compose and free-tier cloud hosting (Render/Railway + Vercel + Neon + Qdrant Cloud + Groq).
