# QueryFlow — Internal Project Reference

---

## Tech Stack (Full Detail)

### Frontend

| Package | Version / Notes |
|---|---|
| React | 18, with TypeScript |
| Vite | Build tool and dev server |
| Zustand | Client-side state (pipeline canvas state, auth) |
| TanStack Query | Server state, data fetching, caching |
| CodeMirror 6 | SQL editor; `@codemirror/lang-sql` + `@uiw/codemirror-theme-one-dark` |
| sql-formatter | SQL auto-indentation (applied on generate and via Format button) |
| Tailwind CSS | Utility-first styling |
| AG Grid Community | Data preview table (free tier) |
| Lucide React | Icon set |
| Axios | HTTP client; base URL configured from `VITE_API_URL` |
| Supabase JS SDK | Auth session management only — all data goes through FastAPI |
| uuid | Client-side UUID generation for new nodes |

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
│       │   └── sources.py           # Data source upload, list, get, rename, preview, delete
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
│       │   ├── api.ts               # Axios instance + all API call functions (incl. getSourcePreview)
│       │   └── supabase.ts          # Supabase client (auth only)
│       ├── store/
│       │   ├── useAuthStore.ts      # Zustand auth store + useAuthInit hook
│       │   └── usePipelineStore.ts  # Zustand pipeline store (nodes, edges, run state, slug rename)
│       ├── pages/
│       │   ├── LoginPage.tsx        # Split-pane sign-in/sign-up; brand panel + form; QueryFlow logo
│       │   ├── DashboardPage.tsx    # Pipeline list with search; create/delete; QueryFlow logo in header
│       │   ├── PipelinePage.tsx     # Main pipeline editor; logo in header; run summary dialog
│       │   └── SourcesPage.tsx      # Data source management (upload, rename, delete)
│       └── components/
│           ├── QueryFlowLogo.tsx    # SVG logo mark + QueryFlowWordmark composite component
│           ├── canvas/
│           │   └── LinearPipelineCanvas.tsx  # Workato-style vertical step list; dot connectors;
│           │                                  #   data source chips; add/delete dialogs
│           └── panels/
│               ├── NodeConfigPanel.tsx  # Right panel: label/slug/prompt/SQL editing; generate SQL;
│               │                        #   Format button (sql-formatter); auto-format on generate
│               ├── RunStatusPanel.tsx   # Bottom log tab: per-node status list
│               └── DataPreviewPanel.tsx # Bottom preview tab: AG Grid for node output OR source preview
```

---

## Key Architectural Decisions

### Linear Canvas vs. Free-Form DAG

The original design used @xyflow/react for a free-form drag-and-drop canvas. This was replaced with a simpler vertical list (Workato-style). The reason: accountants think in sequential steps, not graphs. A top-to-bottom linear editor is far more intuitive for the target audience. Pipeline order is encoded as `position_y = index × 120` on save, and restored by sorting on `position_y` on load. Edges are automatically recomputed from array order — no manual edge management is needed.

### Why DuckDB

DuckDB is an in-process analytical SQL engine. No separate database server is needed for query execution — it runs entirely in the Python process (or Celery worker process). This makes it trivial to:
- Register a Pandas DataFrame as a named view (`conn.register(slug, df)`)
- Execute arbitrary SELECT queries against those views
- Return the result as a DataFrame

This allows upstream node outputs to be wired directly to downstream nodes during a single run without round-tripping through any storage system until the node completes.

DuckDB also supports the full range of SQL features accountants need: CTEs, window functions, PIVOT/UNPIVOT, REGEXP, and Postgres-compatible syntax.

### Why Celery

Pipeline execution is long-running and must not block the FastAPI event loop. Celery with Redis allows the API to accept a run request, create a database record, enqueue a task, and return immediately (HTTP 202). The Celery worker picks up the task and updates the database directly as each node completes. The frontend polls for status every 1.5 seconds.

### Slug Cascade Rename

When a node label or data source slug is renamed, all downstream SQL in the same pipeline that references the old slug is automatically updated using a word-boundary regex (`(?<![a-z0-9_])old_slug(?![a-z0-9_])`). This happens:
- Client-side in `usePipelineStore.renameSlugInAllNodes` (for node renames — immediate, no round-trip)
- Server-side in `sources.py PATCH` (for data source renames — persisted across all pipeline nodes in the DB)

### SQL Auto-Formatting

All SQL is formatted using `sql-formatter` with DuckDB-compatible settings (standard SQL dialect, 2-space indent, UPPERCASE keywords). This is applied:
- Automatically when Generate SQL returns a result
- On demand via the Format button in the node config panel
- On every load from the database (via the `handleSqlChange` pathway when the component mounts with existing SQL)

### Source Data Preview

Uploaded data source files (stored as Parquet in Supabase Storage) can be previewed directly without running a pipeline. `GET /api/sources/{id}/preview` downloads the Parquet from storage, reads it with Pandas, and returns the first 200 rows + column schema as JSON. NaN and numpy scalar types are sanitised before serialisation.

### Why psycopg2 in Celery

SQLAlchemy async with asyncpg cannot be used in a synchronous Celery task without running an event loop manually. Using the sync psycopg2 driver inside Celery tasks is the standard pattern. The connection URL is rewritten at task startup: `postgresql+asyncpg://` is replaced with `postgresql://` and asyncpg-specific query params (e.g. `statement_cache_size`) are stripped.

---

## Database Schema

All tables use UUIDs as primary keys. All timestamps are timezone-aware.

### `users`
Internal user record. Created on first login via `POST /auth/sync`. `supabase_id` links to the Supabase Auth `auth.users` table.

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

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| name | VARCHAR(255) | |
| description | TEXT | nullable |
| canvas_state | JSONB | reserved; linear order encoded in position_y instead |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `pipeline_nodes`
A single transform step. `slug` is the DuckDB view name for this node's output. `position_y = index × 120` encodes the step's order in the linear sequence.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| pipeline_id | UUID FK → pipelines (CASCADE DELETE) | |
| label | VARCHAR(255) | display name |
| slug | VARCHAR(255) | DuckDB view alias |
| node_type | VARCHAR(50) | `source` or `transform` |
| data_source_id | UUID FK → data_sources | nullable |
| prompt | TEXT | natural language prompt |
| sql | TEXT | DuckDB SQL |
| position_x | FLOAT | always 0 (linear layout) |
| position_y | FLOAT | index × 120; encodes step order |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `pipeline_edges`
Directed edge between two adjacent nodes. Recomputed from array order on every save.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| pipeline_id | UUID FK → pipelines (CASCADE DELETE) | |
| source_node_id | UUID FK → pipeline_nodes (CASCADE DELETE) | upstream node |
| target_node_id | UUID FK → pipeline_nodes (CASCADE DELETE) | downstream node |
| created_at | TIMESTAMPTZ | |

### `pipeline_runs`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| pipeline_id | UUID FK → pipelines (CASCADE DELETE) | |
| triggered_by | UUID FK → users | |
| status | VARCHAR(50) | `pending`, `running`, `success`, `failed`, `cancelled` |
| error_message | TEXT | nullable |
| started_at | TIMESTAMPTZ | nullable |
| completed_at | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | |

### `node_results`

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

All endpoints require a Supabase JWT in the `Authorization: Bearer <token>` header.

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/sync` | Upsert user record from Supabase session |
| GET | `/auth/me` | Return current user profile |

### Data Sources

| Method | Path | Description |
|---|---|---|
| POST | `/api/sources` | Upload CSV or XLSX file (multipart); converts to Parquet |
| GET | `/api/sources` | List all data sources for current user |
| GET | `/api/sources/{source_id}` | Get a single data source |
| GET | `/api/sources/{source_id}/preview` | Preview first 200 rows of a source (reads Parquet from Storage) |
| PATCH | `/api/sources/{source_id}` | Rename source (name and/or slug); cascades slug to all pipeline node SQL |
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
| POST | `/api/pipelines/{pipeline_id}/run` | Trigger a new run (202, enqueues Celery task) |
| GET | `/api/pipelines/{pipeline_id}/runs` | List last 50 runs for a pipeline |
| GET | `/api/pipelines/runs/{run_id}` | Get run with per-node results |
| POST | `/api/pipelines/runs/{run_id}/cancel` | Cancel a pending or running run |
| GET | `/api/pipelines/runs/{run_id}/nodes/{node_id}/data` | Get paginated node result rows |
| GET | `/api/pipelines/runs/{run_id}/nodes/{node_id}/download` | Download result as CSV or XLSX |

---

## Frontend State Management

### Zustand Stores

**`useAuthStore`** (`src/store/useAuthStore.ts`)
- Holds `user: User | null` and `loading: boolean`
- `useAuthInit()` hook wires up `supabase.auth.getSession()` and `onAuthStateChange`; on each auth event it calls `POST /auth/sync` and stores the backend user record

**`usePipelineStore`** (`src/store/usePipelineStore.ts`)
- Holds active pipeline canvas state: `nodes`, `edges`, `selectedNodeId`, `isDirty`
- Holds active run state: `activeRunId`, `runStatus`, `nodeResults`
- `loadFromDB(dbNodes, dbEdges)` — sorts nodes by `position_y`, maps to internal format, auto-computes linear edges
- `insertNodeAfterIndex(node, afterIndex)` — splices a new node into the array at a specific position and recomputes edges
- `removeNode(nodeId)` — removes a node and recomputes edges; clears `selectedNodeId` if the removed node was selected
- `applyRunResult(run)` — merges `NodeResult` data (status, rowCount, errorMessage) into node data
- `updateNodeData(nodeId, partial)` — real-time node field updates; sets `isDirty = true`
- `renameSlugInAllNodes(exceptNodeId, oldSlug, newSlug)` — word-boundary regex replace of slug references in all other nodes' SQL

### TanStack Query Keys

| Query Key | Fetched By | Used In |
|---|---|---|
| `['pipeline', id]` | `getPipeline` | PipelinePage |
| `['pipelines']` | `listPipelines` | DashboardPage |
| `['sources']` | `listSources` | PipelinePage, SourcesPage |
| `['source-preview', id]` | `getSourcePreview` | DataPreviewPanel |
| `['node-data', runId, nodeId]` | `getNodeData` | DataPreviewPanel |

---

## Deployment Setup

### Railway Services

**Backend service**
- Root: `backend/`
- Dockerfile: `python:3.12-slim`; installs `requirements.txt`; entrypoint `start.sh`
- `start.sh` runs: `alembic upgrade head` → `celery worker --concurrency=2 &` → `uvicorn` (foreground)
- Both the FastAPI server and the Celery worker run in the same container
- Required env vars: `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_KEY`, `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `FRONTEND_URL`

**Frontend service**
- Root: `frontend/`
- Multi-stage Dockerfile: stage 1 `node:20-alpine` runs `npm run build`; stage 2 `nginx:alpine` serves `dist/`
- Required env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`

**Redis service**
- Railway managed Redis; `REDIS_URL` is injected into the backend service automatically when linked

### Supabase

- **Auth**: Email/password provider enabled. JWT secret from Project Settings > JWT used as `SUPABASE_JWT_SECRET`.
- **Database**: PostgreSQL connected via the Session Mode connection pooler URL (port 6543). The `?pgbouncer=true` parameter is included in `DATABASE_URL`. Alembic runs on every deploy.
- **Storage**: Private bucket `queryflow-files`. Layout:
  - `sources/{user_id}/{source_id}.parquet` — uploaded data sources
  - `runs/{run_id}/{node_id}.parquet` — node execution results

---

## Known Issues and Fixes Applied

**asyncpg URL in Celery worker**
Celery workers cannot use the asyncpg driver. The `_get_db_session()` function in `tasks.py` rewrites the URL from `postgresql+asyncpg://` to `postgresql://` and strips asyncpg-specific params like `statement_cache_size` before creating a synchronous SQLAlchemy engine.

**Timestamp serialisation in preview rows**
Pandas `datetime64` columns cause JSON serialisation errors when stored as JSONB. Fixed in `execute_node`: all datetime columns in the preview DataFrame are cast to `str` before calling `.to_dict(orient="records")`.

**Slug uniqueness on upload**
If a user uploads two files with the same name, `_unique_slug(base, existing)` in `sources.py` appends `_1`, `_2`, etc.

**Pipeline save replacing nodes**
The `PUT /api/pipelines/{id}` endpoint deletes all existing nodes and re-inserts them. Node UUIDs are generated client-side and sent in the payload so they survive round-trips.

**NaN/numpy types in source preview**
`pd.read_parquet().to_dict()` can produce `float('nan')` and numpy scalar types that JSON cannot serialise. Fixed in `GET /api/sources/{id}/preview` with a `_clean(v)` helper that replaces NaN with `None` and calls `.item()` on numpy scalars.

---

## Future Improvements

- **Incremental execution**: Only re-run steps whose SQL or upstream data has changed since the last successful run.
- **Scheduled runs**: Cron-triggered pipeline execution using Celery Beat.
- **Column picker UI**: Show available column names as autocomplete in the SQL editor, sourced from upstream `column_schema`.
- **Multi-branch pipelines**: Allow a step to fan out to multiple downstream branches (currently linear only).
- **Row limit increase / streaming**: Currently capped at 500,000 rows. Streaming Parquet reads via PyArrow would support larger files.
- **Shareable pipelines**: Read-only sharing via a public URL.
- **Node templates**: Pre-built step templates for common accounting tasks (trial balance, variance analysis, ageing report).
- **Celery revoke on cancel**: Currently cancel only sets DB status; does not revoke an already-running Celery task.
- **Preview row pagination**: Add next/prev page controls in DataPreviewPanel hitting the `?offset=N` endpoint.
- **Audit log**: Track who ran what pipeline and when, for compliance.
