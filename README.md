# Datopia 🚀

**Imagine and build data pipelines effortlessly.**

Datopia is a visual, AI-assisted data pipeline builder for anyone who wants to explore, transform, and understand data — no SQL expertise required. Describe what you want in plain English, and Datopia writes the SQL, runs it step-by-step, and keeps your data flowing.

---

## What is Datopia?

Datopia turns the complexity of data pipelines into a simple, visual experience. Whether you're a data analyst, business user, engineer, or just curious — if you have data and a question, Datopia helps you find the answer.

- **Describe** what you want in plain English → AI generates the SQL
- **Visualise** your pipeline as a clean, step-by-step flow
- **Run** it end-to-end with one click and preview results at every step
- **Organise** pipelines into folders for any project or team
- **Download** results as CSV or Excel

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript (Vite), Tailwind CSS, Zustand, TanStack Query, AG Grid |
| Backend | FastAPI (Python), SQLAlchemy async, Pydantic v2 |
| AI | Anthropic Claude (SQL generation from natural language) |
| Query Engine | DuckDB (in-process, fast columnar SQL) |
| Auth | Supabase Auth (JWT) |
| Database | PostgreSQL via Supabase |
| Storage | Supabase Storage (Parquet files) |
| Task Queue | Celery + Redis |
| Hosting | Railway (frontend + backend + Redis) |

---

## Key Features

### Visual Pipeline Builder
- Linear, top-to-bottom step flow (Workato-inspired)
- Drag-and-drop node reordering
- Add / delete / rename steps inline
- Dotted-grid canvas with zoom controls

### AI-Powered SQL
- Describe your transformation in plain English
- Claude generates DuckDB-compatible SQL
- SQL is auto-formatted and shown inline
- Edit freely after generation

### Data Sources
- Upload CSV or Excel files
- Preview data at any step in the pipeline
- Sources appear as named views available to all pipeline steps

### Pipeline Organisation
- Create folders with custom emoji
- Move pipelines between folders
- Search and sort the pipeline grid
- Tile-based dashboard (emoji, name, description, last updated)

### Run & Export
- One-click pipeline execution
- Live status per step (pending → running → success / failed)
- Row count badges after each step completes
- Run completion summary (steps passed, steps failed, total duration)
- Download results as CSV or Excel

---

## Project Structure

```
datopia/
├── frontend/               # React + Vite SPA
│   └── src/
│       ├── components/     # Canvas, panels, logo
│       ├── pages/          # Dashboard, Pipeline editor, Login, Sources
│       ├── store/          # Zustand pipeline store
│       ├── lib/            # Axios API client
│       └── types/          # TypeScript interfaces
└── backend/                # FastAPI application
    └── app/
        ├── routers/        # auth, pipelines, folders, sources, runs
        ├── models/         # SQLAlchemy ORM models
        ├── schemas/        # Pydantic request/response schemas
        ├── services/       # SQL generation, storage, execution
        └── workers/        # Celery task definitions
```

---

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/sync` | Sync Supabase user to app DB |
| GET | `/pipelines` | List all pipelines |
| POST | `/pipelines` | Create pipeline |
| PUT | `/pipelines/{id}` | Save pipeline (nodes, edges, metadata) |
| DELETE | `/pipelines/{id}` | Delete pipeline |
| POST | `/pipelines/{id}/generate-sql` | Generate SQL from natural language |
| POST | `/pipelines/{id}/run` | Trigger pipeline run |
| GET | `/pipelines/runs/{id}` | Poll run status + node results |
| GET | `/folders` | List folders |
| POST | `/folders` | Create folder |
| PUT | `/folders/{id}` | Rename / re-emoji folder |
| DELETE | `/folders/{id}` | Delete folder |
| GET | `/sources` | List data sources |
| POST | `/sources` | Upload CSV / Excel |
| GET | `/sources/{id}/preview` | Preview source data (first 200 rows) |
| GET | `/pipelines/runs/{id}/nodes/{nodeId}/download` | Download result as CSV or Excel |

---

## Getting Started (Local)

### Prerequisites
- Node.js 18+
- Python 3.11+
- Redis (for Celery)
- Supabase project (Auth + Storage + PostgreSQL)

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # set VITE_API_URL and VITE_SUPABASE_*
npm run dev
```

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set DATABASE_URL, SUPABASE_*, ANTHROPIC_API_KEY
alembic upgrade head
uvicorn app.main:app --reload
```

---

## License

MIT
