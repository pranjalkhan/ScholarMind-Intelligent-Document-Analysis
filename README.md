# ScholarMind: Intelligent Document Analysis

ScholarMind is a personal research workspace for asking evidence-based questions about PDF documents. It extracts and indexes document text, searches for relevant passages, and returns answers with page-level citations. It also includes summaries, quizzes, paper comparisons, and a retrieval evaluation dashboard.

## Contents

- [Features](#features)
- [Technology](#technology)
- [How the system works](#how-the-system-works)
- [Run locally](#run-locally)
- [Configuration](#configuration)
- [Use the app](#use-the-app)
- [API routes](#api-routes)
- [Docker Compose](#docker-compose)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Evaluation notes](#evaluation-notes)

## Features

- Account registration and login with password hashing and signed access tokens.
- PDF upload, text extraction, OCR fallback for scanned pages, and background indexing.
- English and Bangla text handling in extraction, search, and chat prompts.
- Hybrid retrieval that combines vector similarity and keyword search.
- Optional query rewriting and reranking.
- Evidence-grounded answers with validated page citations, abstention when evidence is weak, and conflict detection.
- Quick, detailed, and section-by-section summaries, plus quizzes and flashcards.
- Side-by-side comparison of at least two papers.
- A dashboard for retrieval benchmark runs.

## Technology

| Area | Technology | Purpose |
| --- | --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 4, lucide-react | Single-page web application and interface components |
| Backend API | Python 3.11, FastAPI, Pydantic | HTTP API, request validation, background document processing |
| Relational data | SQLAlchemy with SQLite by default; PostgreSQL supported | Users, documents, chunks, conversations, citations, quizzes, and evaluation runs |
| Vector search | Qdrant | Store and search document chunk embeddings |
| PDF extraction | PyMuPDF | Extract page text and render pages for OCR |
| OCR | pytesseract, Pillow, Tesseract OCR | Read scanned PDF pages when native text extraction is insufficient |
| LLM calls | OpenAI-compatible chat completions API over HTTPX | Optional summaries, quizzes, comparisons, and grounded chat responses |
| Local embedding fallback | NumPy and hashed Unicode word/character n-grams | Lightweight 384-dimensional embeddings when local transformer models are disabled |

The default local setup uses SQLite, embedded local Qdrant storage, lightweight hashed embeddings, and a lexical reranker. The default LLM provider URL is Groq. `LLM_API_KEY` is optional: without a key, the app uses extractive fallbacks for supported features.

## How the system works

### PDF upload and indexing

1. The signed-in user uploads a PDF and may assign a category.
2. The API checks the `.pdf` extension, non-empty file content, the `%PDF-` header, and the configured size limit (25 MB by default).
3. The file is stored under a user-specific upload directory. A document record is created, then processing continues as a FastAPI background task.
4. PyMuPDF extracts text page by page. If a page has fewer than 30 extracted characters, the page is rendered and sent to Tesseract OCR. OCR tries English and Bangla; if Bangla trained data is unavailable, it falls back to English.
5. Text is cleaned and split into overlapping chunks (450 estimated tokens with a 75-token overlap). Page number, detected section title, and extraction method are retained.
6. Chunk text and metadata are written to the relational database. The backend creates an embedding for each chunk and upserts it to Qdrant.
7. The document status moves through stages such as `pending`, `extracting`, `chunking`, `embedding`, `indexing`, and `completed`. If processing fails, the status and error are available in the Documents view.

### Chat and evidence verification

1. The user enters a question, optionally selects documents, chooses a response language, and can toggle query rewriting and reranking.
2. The backend optionally adds context from recent turns when a follow-up uses a pronoun such as "it" or "that".
3. Hybrid retrieval searches Qdrant for semantically similar chunks and the relational database for keyword matches. The results are combined with Reciprocal Rank Fusion (RRF), while filtering by the current user and selected documents.
4. The top candidates are reranked. A Cross-Encoder can be used when local transformer models are enabled and installed; otherwise, a lightweight lexical score is used.
5. If an LLM key is configured, the backend asks the model to answer using only the retrieved passages and return structured JSON. Without a key or after an API failure, it selects relevant source sentences instead.
6. Citation IDs from the model are checked against retrieved chunks. Filenames, page numbers, and quotes are resolved from stored evidence rather than trusted from model output.
7. Claims are checked against cited text. The backend may abstain when it cannot verify claims and may flag conflicts between sources.
8. The conversation, messages, citations, latency, and estimated model cost are stored for the user's account.

### Summaries, quizzes, and comparisons

- **Summaries:** Quick overview summarizes the whole document; Detailed and Section-by-Section split it into page/section bands. With a working LLM configuration the text is synthesized from source passages. Otherwise, the app selects representative source sentences and marks the result as extractive.
- **Quizzes:** The LLM can create multiple choice, true/false, short-answer, or flashcard items from document excerpts. A deterministic source-based fallback is used if the LLM is unavailable. Questions include a source page and evidence excerpt.
- **Paper comparison:** The backend retrieves evidence separately for each selected paper, then compares problem, method, dataset, results, and limitations. It uses an LLM when available and an evidence-snippet fallback otherwise.

## Run locally

### Prerequisites

- Python 3.11 recommended (the backend Docker image uses Python 3.11).
- Node.js 20 recommended (the frontend Docker image uses Node 20).
- Tesseract OCR installed and available on `PATH` if you need OCR for scanned PDFs. The Python package alone does not install the Tesseract executable.
- An LLM API key is optional. Without one, the app still runs and uses its extractive fallbacks.

### 1. Configure and start the backend

Open a terminal in the repository and run:

```powershell
cd backend
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Open `backend/.env` and set `LLM_API_KEY` if you want LLM-generated responses. The template uses the default Groq endpoint and model. Keep the key private; `.env` files are ignored by Git. The Groq free tier is rate-limited, and provider availability and limits can change.

Then start the API:

```powershell
uvicorn app.main:app --reload
```

The API is at <http://127.0.0.1:8000>. Interactive API documentation is at <http://127.0.0.1:8000/docs>.

### 2. Install and start the frontend

Open a second terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1
```

Open <http://127.0.0.1:5173>. In PowerShell, `npm.cmd` avoids execution-policy errors that can occur when launching `npm.ps1`.

The Vite development server proxies requests from `/api` to the backend at `http://127.0.0.1:8000`.

### 3. Create an account and add a document

1. Register an account or sign in.
2. Open **Documents** and upload a PDF. The default maximum upload size is 25 MB.
3. Wait until its status is **completed** before asking questions or generating study materials.
4. Open **AI Chat** to query the indexed document. Use **Study Mode** for summaries and quizzes.

## Configuration

Local backend settings are read from environment variables and `backend/.env` when the backend is launched from the `backend` directory. Docker Compose reads variables from a repository-root `.env` file.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./knowflow.db` | SQL database connection. Use PostgreSQL for a shared deployment. |
| `SECRET_KEY` | Development-only value | Signs access tokens. Set a unique, long secret outside local development. |
| `QDRANT_URL` | `./qdrant_local` | Local Qdrant data path, `:memory:`, or a Qdrant server URL. |
| `QDRANT_API_KEY` | Empty | API key for a secured remote Qdrant instance. |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` | OpenAI-compatible provider endpoint. |
| `LLM_MODEL` | `openai/gpt-oss-120b` | Model ID sent to the configured provider. |
| `LLM_API_KEY` | Empty | Provider key. Leave empty to use extractive fallbacks. |
| `LLM_TIMEOUT_SECONDS` | `45` | LLM request timeout. |
| `USE_LOCAL_TRANSFORMERS` | `false` | Enables optional Sentence Transformers embeddings and Cross-Encoder reranking. Extra model dependencies and model downloads are required. |
| `EMBEDDING_MODEL` | `intfloat/multilingual-e5-base` | Embedding model name when local transformers are enabled. |
| `RERANKER_MODEL` | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Cross-Encoder model name when local transformers are enabled. |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded PDFs. |
| `MAX_UPLOAD_MB` | `25` | Maximum PDF upload size. |
| `CORS_ORIGINS` | Local frontend origins | Comma-separated list of allowed frontend origins. |

For local defaults, Sentence Transformers are not required: the backend falls back to hashed multilingual n-gram embeddings and a lexical reranker. Setting `USE_LOCAL_TRANSFORMERS=true` requires installing `sentence-transformers` separately and may use substantial memory and disk space to download model weights.

## Use the app

- **Dashboard:** Overview of indexed documents, conversations, and evaluation runs.
- **Documents:** Upload PDFs, check indexing status, retry failed processing, open a source PDF, or delete a document.
- **AI Chat:** Ask about selected documents, inspect citations and source passages, and provide helpful/not-helpful feedback.
- **Compare Papers:** Select at least two indexed papers and enter a comparison focus.
- **Study Mode:** Select a completed document, choose Quick Overview, Detailed Summary, or Section-by-Section, and generate a quiz.
- **Evaluation:** Run retrieval variants V1 through V5 and review stored benchmark results.

## API routes

Protected routes require `Authorization: Bearer <access-token>` after registering or logging in.

| Route | Purpose |
| --- | --- |
| `GET /` | API service information |
| `GET /health` | Database and Qdrant health |
| `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Account and token operations |
| `POST /documents/upload`, `GET /documents` | Upload and list the current user's PDFs |
| `GET /documents/{id}`, `GET /documents/{id}/status`, `GET /documents/{id}/file` | Inspect status or open a PDF |
| `POST /documents/{id}/retry`, `DELETE /documents/{id}` | Retry processing or delete a PDF |
| `POST /chat` | Ask an evidence-grounded question |
| `GET /conversations`, `GET /conversations/{id}` | List and load chat history |
| `POST /messages/{id}/feedback` | Save answer feedback |
| `POST /research/compare` | Compare selected papers |
| `POST /summaries/generate` | Generate a summary |
| `POST /quizzes/generate` | Generate quiz items |
| `GET /evaluation/summary`, `POST /evaluation/run` | Read or run benchmark evaluations |

The full interactive schema is available at `/docs` while the backend is running.

## Docker Compose

Docker Compose starts PostgreSQL, Qdrant, the backend API, and the built frontend. From the repository root:

```powershell
Copy-Item .env.example .env
```

Add `LLM_API_KEY` to the root `.env` if using an LLM, then run:

```powershell
docker compose up --build
```

Open the frontend at <http://localhost:3000>, the API at <http://localhost:8000>, and the API docs at <http://localhost:8000/docs>. Compose uses named volumes for PostgreSQL, Qdrant, and uploaded files. Stop the stack with `Ctrl+C` or `docker compose down`.

## Project structure

```text
backend/
  app/
    routers/       HTTP routes for auth, documents, chat, research, evaluation
    services/      PDF/OCR, chunking, embeddings, search, LLM, citations, verification
    config.py      Environment-based settings
    database.py    SQLAlchemy engine and sessions
    models.py      Relational data models
  tests/           Backend unit and integration tests
  .env.example     Local backend environment template
  Dockerfile
frontend/
  src/
    components/    Shared UI, auth, library, and dashboard components
    hooks/         Reusable React hooks
    App.tsx        Main screens and application state
    StudyMode.tsx  Summaries and quiz interface
    api.ts         Frontend API client
    index.css      Tailwind import and design-system styles
  Dockerfile
evaluation/
  benchmark.json   Questions used by the evaluation suite
  run_evaluation.py
docker-compose.yml
render.yaml
```

## Troubleshooting

- **The summary says it is showing key source sentences:** the backend has no usable LLM response. Check that `LLM_API_KEY` is set in `backend/.env`, that the model ID is available to your provider, and that the backend was restarted after editing `.env`. API errors are logged by the backend; extractive summaries remain available without a key.
- **A document stays failed:** check the document's error in the Documents view and the backend terminal. Scanned PDFs need Tesseract installed. The default file size limit is 25 MB.
- **Health says `degraded`:** open `/health` and check whether the database or Qdrant is unavailable. Local development uses SQLite and a local Qdrant data directory; Docker uses PostgreSQL and the Qdrant service.
- **The frontend cannot reach the API:** make sure the backend is running on port 8000. For a different frontend origin, add it to `CORS_ORIGINS`.
- **PowerShell says scripts are disabled for npm:** use `npm.cmd` commands as shown above.

## Evaluation notes

The evaluation suite runs the bundled benchmark questions across five labeled configurations: vector search, keyword search, hybrid search, hybrid plus reranking, and a V5 label that also says verification. In the current evaluator, the loop actually varies retrieval mode and reranking; it does not run chat answers or claim verification for each question. Recall@5, precision@5, MRR, and latency are calculated from retrieval results and the benchmark's expected keywords. Faithfulness, citation precision, abstention accuracy, and cost are assigned fixed illustrative values; treat those columns as placeholders rather than measured results.

To run the backend tests:

```powershell
cd backend
pytest -v
```

## Deployment notes

`render.yaml` describes a backend web service. A deployed setup also needs a reachable relational database and Qdrant instance, plus a frontend deployment configured with the public backend URL (`VITE_API_URL`). Provider plans, quotas, and prices change; check each provider's current terms before relying on a free tier. Set production secrets such as `SECRET_KEY` and `LLM_API_KEY` in the deployment platform's secret settings rather than committing them to the repository.
