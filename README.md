# Mining Intelligence Data Pipeline

An automated research pipeline that ingests a list of company names, searches the web, crawls relevant pages, extracts structured data via LLM, and stores the results in a Postgres database — all surfaced through a React dashboard.

---

## Architecture Overview

```
Input (company names)
        │
        ▼
  Pipeline Orchestrator  ──────────────────────────────────────────┐
        │                                                           │
   ┌────▼─────┐    ┌──────────────┐    ┌─────────────────┐         │
   │  Search  │───▶│  Web Crawl   │───▶│  LLM Extraction │         │
   │ Provider │    │  (Jina AI)   │    │ (Gemini / Groq) │         │
   └──────────┘    └──────────────┘    └────────┬────────┘         │
   DuckDuckGo /                                 │                  │
   Serper / Brave                               ▼                  │
                                        ┌──────────────┐           │
                                        │  Neon Postgres│◀─────────┘
                                        └──────┬───────┘
                                               │
                                        ┌──────▼───────┐
                                        │  Express API  │
                                        └──────┬───────┘
                                               │
                                        ┌──────▼───────┐
                                        │  React + Vite │
                                        │   Dashboard   │
                                        └──────────────┘
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18 + |
| npm | 9 + |
| PostgreSQL | Neon serverless (or any Postgres 14+) |

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/anuragasawa20/research-pipelines.git
cd research-pipelines
```

### 2. Set up the database

Create a free Postgres database on [Neon](https://neon.tech) (or use any Postgres instance), then run the schema:

```bash
psql $DATABASE_URL -f database/init.sql
```

> The script is idempotent — safe to re-run. It creates the `companies`, `leaders`, `assets`, `pipeline_runs`, and `pipeline_company_status` tables plus auto-update triggers.

### 3. Configure the backend

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in your values:

```env
DATABASE_URL=postgres://...            # Neon / Postgres connection string
LLM_PROVIDER=groq                      # groq | gemini
GROQ_API_KEY=YOUR_GROQ_KEY_HERE
# GEMINI_API_KEY=AIza...               # if LLM_PROVIDER=gemini

SEARCH_PROVIDER=serper                 # serper | duckduckgo | brave
SERPER_API_KEY=YOUR_SERPER_KEY_HERE
# BRAVE_SEARCH_API_KEY=BSA...          # if SEARCH_PROVIDER=brave

CRAWL_PROVIDER=jina                    # currently only jina supported
PORT=3001
FRONTEND_URL=http://localhost:5173

# Pipeline tuning (optional)
CONCURRENT_COMPANIES=2
LLM_REQUESTS_PER_MINUTE=4
LLM_RETRY_ON_429=true
```

### 4. Install backend dependencies and start

```bash
# still inside /backend
npm install
npm run dev          # development (nodemon)
# or
npm start            # production
```

The API will be available at `http://localhost:3001`.

### 5. Configure the frontend

```bash
cd ../frontend
cp .env.example .env
```

`.env` contains a single variable — update it if your backend runs on a different port:

```env
VITE_API_BASE_URL=http://localhost:3001
```

### 6. Install frontend dependencies and start

```bash
npm install
npm run dev          # Vite dev server at http://localhost:5173
# or
npm run build && npm run preview   # production preview
```

---

## Running the Pipeline

1. Open the dashboard at `http://localhost:5173`.
2. On the **Home** page, paste or type a list of mining company names (one per line or comma-separated).
3. Click **Start Pipeline** — a run is created and progress is tracked per company in real time.
4. Browse results via the **Companies** tab, drill into individual company profiles, and view mine locations on the **Assets Map**.

---

## Project Structure

```
mining-project/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment config
│   │   ├── db/              # Pool, migrations, queries
│   │   ├── pipeline/        # Orchestrator (search → crawl → extract → store)
│   │   ├── providers/
│   │   │   ├── crawl/       # Jina AI crawler
│   │   │   ├── llm/         # Gemini & Groq providers + prompts
│   │   │   └── search/      # Brave, DuckDuckGo, Serper adapters
│   │   └── routes/          # Express REST endpoints
│   └── .env.example
├── frontend/
│   └── src/
│       ├── components/      # AssetCard, LeaderCard, CompanyProfile, etc.
│       └── pages/           # Home, Companies, CompanyDetail, AssetsMap, Debug
├── database/
│   ├── init.sql             # Schema definition
│   ├── reset.sql            # Drop & recreate (dev utility)
│   └── cost-analysis.xlsx   # Cost estimate spreadsheet
└── prompts.txt              # All LLM prompts used by the pipeline
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/pipeline/run` | Start a new pipeline run |
| `GET` | `/api/pipeline/runs` | List all pipeline runs |
| `GET` | `/api/pipeline/runs/:id` | Get run details & per-company status |
| `GET` | `/api/companies` | List all companies |
| `GET` | `/api/companies/:id` | Get company profile (leaders + assets) |

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | Postgres connection string (required) |
| `LLM_PROVIDER` | `gemini` | `gemini` or `groq` |
| `GEMINI_API_KEY` | — | Required if `LLM_PROVIDER=gemini` |
| `GROQ_API_KEY` | — | Required if `LLM_PROVIDER=groq` |
| `SEARCH_PROVIDER` | `duckduckgo` | `duckduckgo`, `serper`, or `brave` |
| `SERPER_API_KEY` | — | Required if `SEARCH_PROVIDER=serper` |
| `BRAVE_SEARCH_API_KEY` | — | Required if `SEARCH_PROVIDER=brave` |
| `CRAWL_PROVIDER` | `jina` | Web crawl provider (jina only) |
| `PORT` | `3001` | Backend server port |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allowed origin |
| `CONCURRENT_COMPANIES` | `2` | Parallel company processing limit |
| `LLM_REQUESTS_PER_MINUTE` | `4` | Rate-limit for LLM calls (free tier safe) |
| `LLM_RETRY_ON_429` | `true` | Auto-retry on rate-limit responses |

---

## Bonus Points Implemented

Two of the three extra-credit features were implemented:

### Bonus 1 — Geospatial Visualization (Interactive Map)

Mining assets extracted by the pipeline include GPS coordinates (latitude / longitude). These are rendered on a fully interactive **Leaflet map** inside the React UI.

- Navigate to any company → click **Assets Map**
- Each mine / project appears as a pin with a popup showing name, commodities, status, and location
- Built with `react-leaflet` v5 + `leaflet` v1.9

**Relevant files:**
- [`frontend/src/pages/AssetsMapPage.jsx`](frontend/src/pages/AssetsMapPage.jsx)
- [`frontend/src/components/AssetsMapView.jsx`](frontend/src/components/AssetsMapView.jsx)
- [`frontend/src/components/AssetCard.jsx`](frontend/src/components/AssetCard.jsx)

---

### Bonus 2 — Concurrent Processing

The pipeline orchestrator processes multiple companies in parallel rather than sequentially, controlled by the `CONCURRENT_COMPANIES` environment variable.

- Uses a custom `runWithConcurrency` helper (semaphore-style promise pool)
- Defaults to **2 simultaneous companies**; increase via `CONCURRENT_COMPANIES=N` in `.env`
- Each company still tracks granular per-step status (`searching → crawling → extracting → storing`) independently in the database

**Relevant files:**
- [`backend/src/pipeline/orchestrator.js`](backend/src/pipeline/orchestrator.js) — `runWithConcurrency()` + `runPipeline()`
- [`backend/src/config/index.js`](backend/src/config/index.js) — `CONCURRENT_COMPANIES` config

---

## Required Resources

### 1. GitHub Repository — Clean, Well-Documented Code
**[https://github.com/anuragasawa20/research-pipelines](https://github.com/anuragasawa20/research-pipelines)**

The repo follows a clear monorepo layout (`backend/`, `frontend/`, `database/`). Provider adapters (search, crawl, LLM) are each in their own module making them easy to swap.

---

### 2. Schema Definition — `init.sql`
**Location:** [`database/init.sql`](database/init.sql)

Defines five tables:

| Table | Purpose |
|-------|---------|
| `companies` | Canonical company records with normalized name deduplication |
| `leaders` | Executives / board members with expertise tags and summary bullets |
| `assets` | Mines / projects with commodity, status, and GPS coordinates |
| `pipeline_runs` | One record per batch submission; tracks overall run status |
| `pipeline_company_status` | Per-company step progress within a run |

Run with:
```bash
psql $DATABASE_URL -f database/init.sql
```

---

### 3. Prompts — `prompts.txt`
**Location:** [`prompts.txt`](prompts.txt)

Documents every LLM prompt used in the pipeline:

- **Prompt 1 — Leadership Extraction:** Extracts executives and board members with roles, expertise tags, and three-bullet technical summaries.
- **Prompt 2 — Asset/Mine Extraction:** Extracts mining assets with commodity, development status, location, and GPS coordinates.
- **Search Query Templates:** The structured web-search queries used to find relevant pages before crawling.

Model configuration: Gemini 1.5 Flash / Groq Llama-3, temperature 0.1, JSON-enforced output.

---

### 4. Cost Estimate — Excel Spreadsheet
**Location:** [`database/cost-analysis.xlsx`](database/cost-analysis.xlsx)

Estimates the monthly cost to process **10,000 mining companies** including:
- **Infrastructure (production):** Neon Postgres compute & storage, hosting/server costs
- **API costs:** LLM tokens (Gemini / Groq), Search API calls (Serper), Web crawl calls (Jina AI)
- **Assumptions:** paid tiers for all providers, realistic token counts per company based on observed pipeline usage

---

### 5. Technical Walkthrough — Screen-Recorded Video
**[https://www.loom.com/share/43bd348213f0439aac763240e438ab95](https://www.loom.com/share/43bd348213f0439aac763240e438ab95)**

A 3–5 minute walkthrough covering:
- Architecture overview and data flow
- Live pipeline run demonstration
- Populated database inspection
- UI tour (company list, company detail, assets map)

---

### 6. Architecture Diagram
**[https://excalidraw.com/#json=vQ1si-xt6Bb8Memc5QBkF,wgoNQthYY70IT0UovT0OJg](https://excalidraw.com/#json=vQ1si-xt6Bb8Memc5QBkF,wgoNQthYY70IT0UovT0OJg)**

Visual diagram of the full system architecture drawn in Excalidraw — covers the pipeline data flow, provider layers, database schema relationships, and frontend routing.
