# QueryFlow — Internal Project Reference

---

## Tech Stack (Full Detail)

### Frontend

| Package | Version / Notes |
|---|---|
| React | 18, with TypeScript |
| Vite | Build tool and dev server |
| @xyflow/react | v12 — pipeline canvas, node/edge rendering |
| Zustand | Client-side state (pipeline canvas state, auth) |
| TanStack Query | Server state, data fetching, caching |
| CodeMirror 6 | SQL editor; `@codemirror/lang-sql` + `@uiw/codemirror-theme-one-dark` |
| Tailwind CSS | Utility-first styling |
| AG Grid Community | Data preview table (free tier) |
| Lucide React | Icon set |
| Axios | HTTP client; base URL configured from `VITE_API_URL` |
| Supabase JS SDK | Auth session management only — all data goes through FastAPI |

### Backend

| Package | Notes |
|---|---|
| Python 3.12 | Runtime |
| FastAPI | Async web framework |
| Uvicorn | ASGI server |
| SQLAlchemy 2.0 async | ORM with `Mapped`/`mapped_column` style |
| asyncpg | Async PostgreSQL driver used by FastAPI |
| psycopg2-binary | Sync PostgreSQL driver — used only by Celery workers |
| Alembic | Schema migrations |
| Celery | Distributed task queue |
| Redis | Celery broker and result backend |
| DuckDB | In-process SQL execution engine — no persistent DuckDB file |
| anthropic SDK | Claude API client |
| supabase-py | Storage upload/download only |
| PyArrow | Parquet read/write |
| Pandas | DataFrame manipulation |
| python-slugify | SQL-safe slug generation from user-provided names |
| pydantic-settings | Config/env loading |
| openpyxl | XLSX export in download endpoint |

### Infrastructure

| Component | Detail |
|---|---|
| Railway backend service | `python:3.12-slim` Docker image; starts via `start.sh` |
| Railway frontend service | `node:20-alpine` multi-stage build + `nginx:alpine` serve |
| Railway Redis service | Managed Redis; `REDIS_URL` injected automatically |
| Supabase PostgreSQL | Connected via connection pooler (pgbouncer, port 6543) |
| Supabase Auth | Email/password; JWT verified in FastAPI via `SUPABASE_JWT_SECRET` |
| Supabase Storage | Private bucket `queryflow-files`; accessed with service role key |
| GitHub | Source control; Railway auto-deploys on push to `main` |

---

## File and Folder Structure

```
queryflow/
├── backend/
│   ├── Dockerfile                   # python:3.12-slim, installs requirements, runs start.sh
│   ├── start.sh                     # runs alembic upgrade, starts celery worker (bg), then uvicorn
│   ├── railway.toml                 # Railway build/start config for backend service
│   ├── alembic.ini                  # Alembic configuration; script_location = alembic
│   ├── requirements.txt             # All Python dependencies
│   ├── .env.example                 # Template for local .env
│   ├── alembic/
│   │   ├── env.py                   # Async Alembic env; reads DATABASE_URL from settings
│   │   └── versions/
│   │       └── 001_initial.py       # Full initial schema migration (all 7 tables)
│   └── app/
│       ├── main.py                  # FastAPI app factory; registers routers, CORS, lifespan
│       ├── config.py                # pydantic-settings Settings class; all env vars
│       ├── database.py              # Async SQLAlchemy engine + session factory; Base declarative
│       ├── auth.py                  # JWT verification using SUPABASE_JWT_SECRET; returns sub claim
│       ├── deps.py                  # FastAPI dependency: get_current_user (validates JWT, loads User)
│       ├── models/
│       │   ├── __init__.py
│       │   ├── user.py              # User ORM model (id, supabase_id, email, role)
│       │   └── pipeline.py          # DataSource, Pipeline, PipelineNode, PipelineEdge,
│       │                            #   PipelineRun, NodeResult ORM models
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── user.py              # UserOut, UserSyncRequest Pydantic schemas
│       │   └── pipeline.py          # All pipeline-related Pydantic schemas (in/out)
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── auth.py              # POST /auth/sync, GET /auth/me
│       │   ├── pipelines.py         # Pipeline + node + edge CRUD; POST generate-sql
│       │   ├── runs.py              # Run trigger, cancel, status poll, data fetch, download
│       │   └── sources.py           # Data source upload, list, get, rename, delete
│       ├── services/
│       │   ├── __init__.py
│       │   ├── execution.py         # DuckDB execution engine: topological_sort, execute_node,
│       │   │                        #   build_available_tables, get_paginated_rows, _infer_schema
│       │   ├── sql_gen.py           # Claude API call: generate_sql(prompt, available_tables)
│       │   └── storage.py           # Supabase Storage helpers: upload_file, download_file, delete_file
│       └── workers/
│           ├── __init__.py
│           ├── celery_app.py        # Celery app instance; broker/backend from REDIS_URL
│           └── tasks.py             # execute_pipeline Celery task (sync, uses psycopg2)
├── frontend/
│   ├── Dockerfile                   # node:20-alpine build stage + nginx:alpine serve stage
│   ├── nginx.conf                   # nginx config; try_files for SPA routing; proxy /api/ → backend
│   ├── railway.toml                 # Railway config for frontend service
│   ├── vite.config.ts               # Vite config; path aliases (@/ → src/)
│   ├── tailwind.config.js           # Tailwind config
│   ├── tsconfig.json                # TypeScript config
│   ├── package.json                 # Dependencies and scripts
│   ├── index.html                   # HTML entry point
│   ├── .env.example                 # Template: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
│   └── src/
│       ├── main.tsx                 # React root; QueryClient provider, Router
│       ├── App.tsx                  # Route definitions; auth guard; useAuthInit
│       ├── index.css                # Global styles; Tailwind directives; custom scrollbar
│       ├── vite-env.d.ts            # Vite env type declarations
│       ├── types/
│       │   └── index.ts             # All TypeScript types mirroring backend schemas
│       ├── lib/
│       │   ├── api.ts               # Axios instance + all API call functions
│       │   └── supabase.ts          # Supabase client (auth only)
│       ├── store/
│       │   ├── useAuthStore.ts      # Zustand auth store + useAuthInit hook
│       │   └── usePipelineStore.ts  # Zustand pipeline canvas store
│       ├── pages/
│       │   ├── LoginPage.tsx        # Supabase email/password login form
│       │   ├── DashboardPage.tsx    # Pipeline list; create/delete pipelines
│       │   ├── PipelinePage.tsx     # Main pipeline editor page; orchestrates all panels
│       │   └── SourcesPage.tsx      # Data source management (upload, rename, delete)
│       └── components/
│           ├── canvas/
│           │   ├── PipelineCanvas.tsx  # @xyflow/react ReactFlow wrapper; dot grid; controls
│           │   └── TransformNode.tsx   # Custom node component; status badge; row count
│           └── panels/
│               ├── NodeConfigPanel.tsx  # Right panel: label/slug/prompt/SQL editing; generate SQL button
│               ├── RunStatusPanel.tsx   # Bottom panel: run button, stop button, per-node status list
│               └── DataPreviewPanel.tsx # Bottom panel: AG Grid table showing node result rows
```

---

## Key Architectural Decisions

### Why DuckDB

DuckDB is an in-process analytical SQL engine. No separate database server is needed for query execution — it runs entirely in the Python process (or Celery worker process). This makes it trivial to:
- Register a Pandas DataFrame as a named view (`conn.register(slug, df)`)
- Execute arbitrary SELECT queries against those views
- Return the result as a DataFrame

This allows upstream node outputs to be wired directly to downstream nodes during a single run without round-tripping through any storage system until the node completes. The alternative (shipping data through PostgreSQL or a dedicated warehouse) would require schema management per-pipeline and per-run, which is impractical for a dynamic user-defined pipeline system.

DuckDB also supports the full range of SQL features accountants need: CTEs, window functions, PIVOT/UNPIVOT, REGEXP, and Postgres-compatible syntax.

### Why Celery

Pipeline execution is long-running and must not block the FastAPI event loop. Celery with Redis allows the API to accept a run request, create a database record, enqueue a task, and return immediately (HTTP 202). The Celery worker picks up the task and updates the database directly as each node completes. The frontend polls for status.

A synchronous Celery task is intentional: DuckDB and the Supabase Storage SDK are synchronous libraries, and managing async context in a Celery task adds complexity with no benefit.

### Why a Single Node Type

Early designs had separate "source" and "transform" node types. This was collapsed into a single node type where every node can optionally reference an uploaded data source (via `data_source_id`) or write arbitrary SQL. Having one node component to maintain reduces complexity. The node's behaviour is determined by whether it has upstream edges and whether a `data_source_id` is set, not by a hard-coded type enum (though `node_type` still exists in the DB for potential future use).

### Why the Backend Serves Storage Reads

Supabase Storage is configured as a private bucket. Presigned URLs were considered but dropped: they expire, they require an extra round-trip to generate, and they expose Supabase internals to the frontend. Instead, the backend streams file bytes directly to the download endpoint, which keeps the auth boundary clear (all access goes through the FastAPI JWT check).

### Why psycopg2 in Celery

SQLAlchemy async with asyncpg cannot be used in a synchronous Celery task without running an event loop manually. Using the sync psycopg2 driver inside Celery tasks is the standard pattern. The connection URL is rewritten at task startup: `postgresql+asyncpg://` is replaced with `postgresql://` and asyncpg-specific query params (e.g. `statement_cache_size`) are stripped.

### Canvas State Storage

The `@xyflow/react` viewport (zoom, pan position) is persisted in the `pipelines.canvas_state` JSONB column. Nodes and edges are stored in their own tables for relational integrity. When the pipeline loads, `usePipelineStore.loadFromDB` reconstructs the `@xyflow/react` node/edge format from the database rows.

---

## Database Schema

All tables use UUIDs as primary keys. All timestamps are timezone-aware.

### `users`
Internal user record. Created on first login via `POST /auth/sync`. `supabase_id` links to the Supabase Auth `auth.users` table. `role` is `admin` for the first user ever created, `member` for all subsequent users.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| supabase_id | UUID UNIQUE | FK to Supabase auth.users |
| email | VARCHAR(255) UNIQUE | |
| full_name | VARCHAR(255) | nullable |
| role | VARCHAR(50) | `admin` or `member` |
| is_active | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | |

### `data_sources`
Represents an uploaded CSV or XLSX file. The raw file is converted to Parquet on upload and stored in Supabase Storage. `column_schema` is a JSONB array of `{name, dtype}` objects used to provide context to Claude.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| name | VARCHAR(255) | original filename |
| slug | VARCHAR(255) | SQL-safe name (auto-generated, unique per user) |
| storage_path | TEXT | path in Supabase Storage bucket |
| file_type | VARCHAR(20) | `csv` or `xlsx` |
| row_count | INTEGER | nullable |
| column_schema | JSONB | `[{name, dtype}]` |
| size_bytes | INTEGER | original file size |
| created_at | TIMESTAMPTZ | |

### `pipelines`
Top-level pipeline container. `canvas_state` stores the @xyflow/react viewport JSON so pan/zoom is restored on reload.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| name | VARCHAR(255) | |
| description | TEXT | nullable |
| canvas_state | JSONB | @xyflow/react viewport state |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `pipeline_nodes`
A single transform step on the canvas. `slug` is the DuckDB view name for this node's output. `node_type` is always `transform` currently but was kept for extensibility.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| pipeline_id | UUID FK → pipelines (CASCADE DELETE) | |
| label | VARCHAR(255) | display name |
| slug | VARCHAR(255) | DuckDB view alias |
| node_type | VARCHAR(50) | `source` or `transform` |
| data_source_id | UUID FK → data_sources | nullable; set for source-type nodes |
| prompt | TEXT | natural language prompt |
| sql | TEXT | DuckDB SQL |
| position_x | FLOAT | canvas X coordinate |
| position_y | FLOAT | canvas Y coordinate |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `pipeline_edges`
Directed edge between two nodes in the same pipeline. CASCADE DELETE from both the pipeline and either node.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| pipeline_id | UUID FK → pipelines (CASCADE DELETE) | |
| source_node_id | UUID FK → pipeline_nodes (CASCADE DELETE) | upstream node |
| target_node_id | UUID FK → pipeline_nodes (CASCADE DELETE) | downstream node |
| created_at | TIMESTAMPTZ | |

### `pipeline_runs`
One execution of a full pipeline. Celery worker updates `status`, `started_at`, `completed_at`, and `error_message` directly.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| pipeline_id | UUID FK → pipelines (CASCADE DELETE) | |
| triggered_by | UUID FK → users | |
| status | VARCHAR(50) | `pending`, `running`, `success`, `failed`, `cancelled` |
| error_message | TEXT | nullable; set on failure |
| started_at | TIMESTAMPTZ | nullable |
| completed_at | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | |

### `node_results`
Per-node outcome for a specific run. `preview_rows` stores the first 200 result rows as JSONB to avoid a Storage round-trip for the data preview panel. `storage_path` points to the full Parquet file in Supabase Storage.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| run_id | UUID FK → pipeline_runs (CASCADE DELETE) | |
| node_id | UUID FK → pipeline_nodes (CASCADE DELETE) | |
| status | VARCHAR(50) | `pending`, `running`, `success`, `failed`, `skipped` |
| storage_path | TEXT | `runs/{run_id}/{node_id}.parquet` |
| row_count | INTEGER | nullable |
| column_schema | JSONB | `[{name, dtype}]` |
| preview_rows | JSONB | first 200 rows as list of dicts |
| error_message | TEXT | nullable |
| execution_ms | INTEGER | DuckDB query wall time |
| created_at | TIMESTAMPTZ | |

---

## API Endpoints

All endpoints require a Supabase JWT in the `Authorization: Bearer <token>` header, except where noted.

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/sync` | Upsert user record from Supabase session (no auth required — JWT not yet issued at first call) |
| GET | `/auth/me` | Return current user profile |

### Data Sources

| Method | Path | Description |
|---|---|---|
| POST | `/api/sources` | Upload CSV or XLSX file (multipart); converts to Parquet; returns DataSourceOut |
| GET | `/api/sources` | List all data sources for current user |
| GET | `/api/sources/{source_id}` | Get a single data source |
| PATCH | `/api/sources/{source_id}` | Rename source (name and/or slug) |
| DELETE | `/api/sources/{source_id}` | Delete source record and Supabase Storage file |

### Pipelines

| Method | Path | Description |
|---|---|---|
| GET | `/api/pipelines` | List all pipelines for current user |
| POST | `/api/pipelines` | Create a new pipeline |
| GET | `/api/pipelines/{pipeline_id}` | Get pipeline with full node and edge detail |
| PUT | `/api/pipelines/{pipeline_id}` | Save pipeline (replaces all nodes and edges) |
| DELETE | `/api/pipelines/{pipeline_id}` | Delete pipeline |
| POST | `/api/pipelines/{pipeline_id}/generate-sql` | Generate DuckDB SQL from a node's NL prompt via Claude |

### Runs

| Method | Path | Description |
|---|---|---|
| POST | `/api/pipelines/{pipeline_id}/run` | Trigger a new run (returns 202, enqueues Celery task) |
| GET | `/api/pipelines/{pipeline_id}/runs` | List last 50 runs for a pipeline |
| GET | `/api/pipelines/runs/{run_id}` | Get run with per-node results |
| POST | `/api/pipelines/runs/{run_id}/cancel` | Cancel a pending or running run |
| GET | `/api/pipelines/runs/{run_id}/nodes/{node_id}/data` | Get paginated node result rows |
| GET | `/api/pipelines/runs/{run_id}/nodes/{node_id}/download` | Download result as CSV or XLSX (`?format=csv\|xlsx`) |

---

## Frontend State Management

### Zustand Stores

**`useAuthStore`** (`src/store/useAuthStore.ts`)
- Holds `user: User | null` and `loading: boolean`
- `useAuthInit()` hook wires up `supabase.auth.getSession()` and `onAuthStateChange`; on each auth event it calls `POST /auth/sync` to get the backend user record and stores it
- No TanStack Query involvement for auth — pure Zustand + Supabase SDK

**`usePipelineStore`** (`src/store/usePipelineStore.ts`)
- Holds the active pipeline's canvas state: `nodes`, `edges`, `selectedNodeId`, `isDirty`
- Also holds active run state: `activeRunId`, `runStatus`, `nodeResults`
- `loadFromDB(dbNodes, dbEdges)` — transforms backend node/edge rows into @xyflow/react format
- `applyRunResult(run)` — merges `NodeResult` data (status, rowCount, errorMessage) into node data so the `TransformNode` component renders the correct badge
- `updateNodeData(nodeId, partial)` — used by `NodeConfigPanel` to update label, slug, prompt, SQL in real time; sets `isDirty = true`
- `onNodesChange` / `onEdgesChange` — wired directly to @xyflow/react change handlers; sets `isDirty = true`

### TanStack Query

Used for all server data that is not canvas state:
- Pipeline list (DashboardPage)
- Data sources list (SourcesPage, NodeConfigPanel)
- Run list and run detail (RunStatusPanel — polls every 2 seconds while run is active)
- Node result data for preview (DataPreviewPanel)

TanStack Query handles caching, background refetch, and loading/error states. Mutations (save pipeline, trigger run, upload source) use `useMutation` with `onSuccess` callbacks to invalidate relevant query keys.

---

## Deployment Setup

### Railway Services

**Backend service**
- Root: `backend/`
- Dockerfile: `python:3.12-slim`; installs `requirements.txt`; entrypoint `start.sh`
- `start.sh` runs: `alembic upgrade head` → `celery worker --concurrency=2 &` → `uvicorn` (foreground)
- Both the FastAPI server and the Celery worker run in the same container
- Port: Railway-injected `PORT` env var (default 8000)
- Required env vars: `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_KEY`, `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `FRONTEND_URL`

**Frontend service**
- Root: `frontend/`
- Multi-stage Dockerfile: stage 1 `node:20-alpine` runs `npm run build`; stage 2 `nginx:alpine` serves `dist/`
- `nginx.conf`: `try_files $uri $uri/ /index.html` for SPA routing; `/api/` proxied to backend (if using Railway internal networking)
- Required env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`

**Redis service**
- Railway managed Redis
- `REDIS_URL` is injected into the backend service automatically by Railway when linked

### Supabase

- **Auth**: Email/password provider enabled. JWT secret from Project Settings > JWT used as `SUPABASE_JWT_SECRET`.
- **Database**: PostgreSQL connected via the Session Mode connection pooler URL (port 6543). The `?pgbouncer=true` parameter is included in `DATABASE_URL`. Alembic runs against this URL on every deploy.
- **Storage**: Private bucket `queryflow-files`. Layout:
  - `sources/{user_id}/{source_id}.parquet` — uploaded data sources
  - `runs/{run_id}/{node_id}.parquet` — node execution results
  - Accessed exclusively via the service role key in the backend; never exposed to the frontend directly.

---

## Known Issues and Fixes Applied

**asyncpg URL in Celery worker**
Celery workers cannot use the asyncpg driver. The `_get_db_session()` function in `tasks.py` rewrites the URL from `postgresql+asyncpg://` to `postgresql://` and strips asyncpg-specific params like `statement_cache_size` before creating a synchronous SQLAlchemy engine.

**Timestamp serialisation in preview rows**
Pandas `datetime64` columns cause JSON serialisation errors when stored as JSONB. Fixed in `execute_node`: all datetime columns in the preview DataFrame are cast to `str` before calling `.to_dict(orient="records")`.

**Slug uniqueness on upload**
If a user uploads two files with the same name (or names that slugify to the same string), the second slug collides. Fixed with `_unique_slug(base, existing)` in `sources.py` which appends `_1`, `_2`, etc.

**Pipeline save replacing nodes**
The `PUT /api/pipelines/{id}` endpoint deletes all existing nodes and re-inserts them. This is intentional (the frontend sends the full canvas state on every save), but it means node UUIDs must be stable — the frontend generates UUIDs client-side and sends them in `payload.nodes[].id` so the IDs survive round-trips.

**DuckDB view naming collision**
Data source slugs and node slugs share the same DuckDB connection namespace within a run. Naming conflicts are prevented by enforcing unique slugs per user at upload time and auto-slugifying node labels. No runtime collision detection exists currently — duplicate slugs would silently overwrite views.

**CORS on Railway**
The FastAPI CORS middleware allows `FRONTEND_URL` (from env) plus any comma-separated URLs in `EXTRA_ORIGINS`. During development, `http://localhost:5173` needs to be added to `EXTRA_ORIGINS` or set as `FRONTEND_URL`.

---

## Future Improvements

- **Incremental execution**: Only re-run nodes whose SQL or upstream data has changed since the last successful run, rather than always running the full pipeline.
- **Scheduled runs**: Cron-triggered pipeline execution (e.g. daily at 9 AM) using Celery Beat.
- **Column picker UI**: Show available column names as autocomplete when writing SQL, sourced from `column_schema` of upstream nodes.
- **Multi-output nodes**: Allow a node to expose multiple named outputs (e.g. filtered vs. full dataset) for different downstream branches.
- **Row limit increase / streaming**: Currently capped at 500,000 rows. Streaming Parquet reads via PyArrow would allow larger result sets without loading the full DataFrame into memory.
- **Shareable pipelines**: Read-only pipeline sharing via a public URL, with view-only access to run results.
- **Node templates**: Pre-built node templates for common accounting tasks (e.g. trial balance, variance analysis, ageing report).
- **DuckDB view name collision detection**: Validate at save time that no two nodes in the same pipeline share a slug.
- **Celery revoke on cancel**: Currently cancel only sets the DB status to `cancelled` — it does not revoke the Celery task if it is already running. A true stop would require storing the Celery task ID and calling `celery_app.control.revoke(task_id, terminate=True)`.
- **Preview row pagination in UI**: The DataPreviewPanel currently fetches the first 200 rows (inline). Add next/prev page controls that hit the paginated `GET .../data?offset=N` endpoint for larger result sets.
- **Audit log**: Track who ran what pipeline and when, for compliance in accounting contexts.
