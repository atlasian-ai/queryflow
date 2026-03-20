# QueryFlow

**Visual SQL pipeline builder for accountants**

QueryFlow lets you build multi-step data transformation pipelines in a clean, linear step-by-step editor. Upload a spreadsheet, describe what you want in plain English, and get DuckDB SQL generated automatically. Chain steps together, run the pipeline, and download your results — no coding required.

---

## Overview

QueryFlow is a web application that brings a Workato-style vertical pipeline editor to finance and accounting workflows. Each step in the pipeline represents one SQL transformation. You write a natural language prompt describing what you want — QueryFlow uses Claude AI to generate the DuckDB SQL for you. When you run the pipeline, steps execute top-to-bottom, with each step's output automatically available as an input to the next.

Uploaded CSV and XLSX files are converted to Parquet and stored in Supabase Storage. Node results are also stored as Parquet, meaning large result sets are held in object storage rather than the database.

---

## Tech Stack

### Frontend
- React 18 + TypeScript (Vite)
- Zustand — client state management
- TanStack Query — server state / data fetching
- CodeMirror 6 — SQL editor with syntax highlighting
- sql-formatter — SQL auto-indentation
- AG Grid Community — data preview table
- Tailwind CSS
- Lucide React — icons
- Axios — HTTP client

### Backend
- Python 3.12 + FastAPI
- SQLAlchemy 2.0 async + asyncpg (async ORM + PostgreSQL driver)
- Alembic (database migrations)
- Celery + Redis (async task queue for pipeline execution)
- DuckDB (in-process SQL execution engine)
- Anthropic Claude API — `claude-haiku-4-5` for natural language to SQL
- Supabase Python SDK (object storage)
- PyArrow + Pandas (Parquet serialisation)
- psycopg2-binary (synchronous driver used by Celery workers)

### Infrastructure
- Railway — 3 services: backend API + Celery worker, frontend static site, Redis
- Supabase — PostgreSQL database, Auth (email/password), Storage (private bucket)
- Docker — backend: `python:3.12-slim`, frontend: `node:20-alpine` build + `nginx:alpine` serve
- GitHub — source control, auto-deploy to Railway on push

---

## Architecture Overview

```
Browser
  │
  ├─ Supabase Auth (JWT)
  │
  └─ FastAPI (Railway)
       ├─ /api/auth       — user sync
       ├─ /api/sources    — CSV/XLSX upload → Parquet → Supabase Storage
       ├─ /api/pipelines  — pipeline + node + edge CRUD, SQL generation
       └─ /api/pipelines  — run trigger, run status polling, result download
            │
            ├─ PostgreSQL (Supabase)   — metadata, run status, schemas
            ├─ Redis (Railway)         — Celery broker + result backend
            └─ Celery Worker           — DuckDB execution, Parquet I/O
                   │
                   └─ Supabase Storage — Parquet files (sources + node results)
```

The FastAPI server and Celery worker run in the same Docker container on Railway, started via `start.sh`. Alembic migrations run automatically on container start.

---

## How It Works

### Linear Pipeline Canvas

Pipelines are built as a vertical, ordered list of transform steps — top to bottom. Each step has:

- **Label** — a human-readable display name
- **SQL name (slug)** — auto-generated, SQL-safe identifier used as the DuckDB view name
- **Natural language prompt** — plain English description of what this step should do
- **DuckDB SQL** — the actual query that runs (write manually, generate via AI, or auto-format)

Steps execute in order from top to bottom. You can add steps between any existing steps using the `+` button, reorder by inserting at any position, and delete steps with the trash icon.

### Data Sources

Uploaded CSV/XLSX files appear as clickable chips at the top of the canvas. Clicking a chip shows a live preview of the source data in the bottom panel. Source names (slugs) can be renamed on the Data Sources page — renaming cascades automatically into any downstream SQL that references the old name.

### Natural Language to SQL

Clicking "Generate SQL" on a step sends the prompt to the backend. The backend identifies all upstream steps and uploaded data sources accessible to that node, builds a schema context (table names + column types), and sends a prompt to Claude Haiku. The model returns a single DuckDB SELECT statement. Generated SQL is automatically formatted (indented). You can also click **Format** in the SQL editor at any time.

### Execution and Storage

At run time:

1. The API creates a `pipeline_run` record and enqueues a Celery task.
2. The Celery worker downloads all uploaded data sources from Supabase Storage and registers them as DuckDB views.
3. Steps execute in order. Each step's result DataFrame is:
   - Uploaded to Supabase Storage as a Snappy-compressed Parquet file
   - Stored inline (first 200 rows) in the `node_results` table for fast preview
   - Registered as a DuckDB view for downstream steps in the same run
4. The frontend polls the run status endpoint every 1.5 seconds until the run completes.
5. On completion, a summary dialog shows total steps passed, steps failed, and total wall-clock time.

---

## Features

- **Workato-style linear canvas** — vertical step list with dot connectors, step numbers, and status icons
- **QueryFlow logo** — SVG brand mark shown on sign-in, pipeline list, and pipeline editor pages
- **Split-pane sign-in page** — brand panel with feature highlights on the left, login form on the right
- **Data source chips** — clickable at the top of the canvas; clicking shows a raw data preview
- **Pipeline search** — search bar on the dashboard filters pipelines by name in real time
- **Node delete** — hover any step to reveal a trash icon; deletion requires confirmation
- **Add step anywhere** — `+` button between every pair of steps and at the top/bottom
- Claude AI generates DuckDB SQL from plain English prompts
- **SQL auto-format** — generated SQL is auto-indented; a Format button formats existing SQL on demand
- Inline CodeMirror SQL editor with SQL syntax highlighting and oneDark theme
- **Slug cascade rename** — renaming a node or data source slug updates all downstream SQL automatically
- Upstream step outputs automatically available as named views in downstream SQL
- Per-step run status badges: pending / running / success / failed
- Row count displayed on each step card after a successful run
- **Run completion summary dialog** — shows steps passed, steps failed, and total duration
- File upload: CSV and XLSX (up to 50 MB), converted to Parquet on upload
- Data preview panel powered by AG Grid (paginated, supports large result sets)
- **Source data preview** — click any data source chip to preview its raw rows in the bottom panel
- Download step results as CSV or XLSX
- Inline renaming of pipelines, steps, and data sources
- Resizable node configuration panel and SQL editor
- Stop / cancel run button
- Run log tab alongside the data preview panel
- Supabase email/password authentication

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.12+
- A Supabase project (free tier works)
- A Redis instance (local or hosted)
- An Anthropic API key

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env with your values (see Environment Variables below)

alembic upgrade head
uvicorn app.main:app --reload --port 8000

# In a separate terminal, start the Celery worker
celery -A app.workers.celery_app worker --loglevel=info
```

### Frontend

```bash
cd frontend
npm install

cp .env.example .env
# Edit .env with your values

npm run dev
```

### Environment Variables

**Backend (`backend/.env`)**

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase project settings |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (for Storage access) |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name (default: `queryflow-files`) |
| `REDIS_URL` | Redis connection URL |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `FRONTEND_URL` | Frontend origin for CORS |

**Frontend (`frontend/.env`)**

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `VITE_API_URL` | Backend API base URL |

### Supabase Setup

1. Create a new Supabase project.
2. In Storage, create a private bucket named `queryflow-files`.
3. Enable email/password auth under Authentication > Providers.
4. Use the connection pooler URL (port 6543, `?pgbouncer=true`) for `DATABASE_URL` when deploying to Railway.

### Deploying to Railway

The project ships with `railway.toml` files in both `backend/` and `frontend/`. Connect your GitHub repository to Railway, create three services (backend, frontend, Redis), and set the environment variables listed above. Railway injects `REDIS_URL` automatically for the Redis service.
