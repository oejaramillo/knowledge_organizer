# knowledge_organizer

A personal "second brain" on top of a Zotero library: Zotero collections are used
as projects, items (papers, books, chapters, reports…) are synced into Postgres,
enriched with an LLM, and read back through a dashboard.

---

## Architecture

```
Zotero Desktop / Zotero Web API
        │  (HTTP, Zotero API v3)
        ▼
zotero_sync/            ← incremental sync CLI
  zotero_client.py        API client: paging, retries, library-version tracking
  sync.py                 orchestrator (projects → papers → authors → attachments → annotations)
  sync_projects.py        Zotero collections  → projects (+ parent tree)
  sync_papers.py          top-level items     → papers (+ paper_projects links)
  sync_authors.py         creators            → authors (+ paper_authors, ordered by position)
  sync_attachments.py     child attachments   → attachments (+ papers.pdf_path)
  sync_annotations.py     highlights/notes    → annotations
  db.py                   psycopg3 connection + sync_state bookkeeping
        │
        ▼
Neon / PostgreSQL   ← schema_v2.sql + migrations/*.sql
        │
        ├──────────────────────────────────────────────┐
        ▼                                              ▼
ai_enrichments/                                  board/backend/  (FastAPI)
  enrich.py       CLI orchestrator                 api/*.py      CRUD routers
  extractor.py    reads papers/annotations,        routers/*.py  stats, tracker, tools
                  extracts PDF text                models/       SQLAlchemy 1.4 ORM
  prompts.py      system/user prompts              schemas/      Pydantic v2 models
  parser.py       validates the model's JSON
  writer.py       idempotent writes (claims, concepts, methods, variables)
  providers/      deepseek | openai
        │                                              │
        ▼                                              ▼
  papers.discipline / theoretical_framework /     board/frontend/  (React 19 + Vite)
  citation_intent / abstract, claims, concepts,     layouts/MainLayout.jsx  app shell
  methods, variables                                pages/                  Summary, Tracker
                                                    components/             projects, papers,
                                                                            tasks, ideas, meetings,
                                                                            binnacle
```

**Data model highlights**

* `papers` ↔ `projects` is many-to-many through `paper_projects`, so one item can
  belong to several Zotero collections. `sync_papers` rebuilds those links for
  every item it touches, so moving an item between collections is reflected.
* `papers.zotero_key` / `projects.zotero_collection_key` / `attachments.zotero_attachment_key`
  / `annotations.zotero_annotation_key` are the sync anchors (all UNIQUE).
* `papers.document_type` stores **Zotero's own item type verbatim** (camelCase:
  `journalArticle`, `bookSection`, `dataset`, …). The dashboard labels and colours
  are keyed on that vocabulary.
* **Two independent concepts that used to be conflated:**
  * *Reading* — `papers.is_read`, `papers.date_read`, `papers.pages_read` and
    `paper_parts`. A database trigger (`trg_sync_paper_is_read`) keeps
    `papers.is_read` in sync when a paper has parts: read ⇔ every part is read.
  * *Enrichment* — `papers.status` (`pending` | `processed`) plus the AI metadata
    columns. Only the enrichment pipeline writes it; the API does not expose it.
* `sync_state(source, last_library_version, last_sync)` drives incremental syncs.
* `n_claims` / `n_annotations` are read-only counters derived by the API
  (`column_property` in `models/core.py`) so the paper list can show which items
  already have extracted claims without an extra request per row.

**Dates.** Every date shown or entered in the dashboard is `DD/MM/YYYY`
(`src/utils/date.js` + the `DateField` component). The API exchanges calendar
dates as `YYYY-MM-DD` and timestamps as ISO-8601 UTC, so nothing depends on the
browser locale.

---

## Schema and migrations

`schema_v2.sql` is the original base schema; everything added since lives in
`migrations/` and is applied in filename order:

```bash
python app.py                      # base schema + all migrations
python tools/verify_schema.py      # diff a fresh build against the live DB
```

`tools/verify_schema.py` builds the repo's SQL in a throwaway Postgres schema and
compares columns, constraints, indexes, enums, views, triggers and functions
against the live database. It exits non-zero on any drift, so schema and code
cannot silently diverge again. **Run it after changing any `.sql` file or after
touching the database by hand.**

`migrations/` is append-only — never edit a migration that has already been
applied; add a new one.


---

## Setup

```bash
python -m venv amb && source amb/bin/activate
pip install -r requirements.txt

cp .env.example .env      # then fill in DATABASE_URL and your AI provider key
python app.py             # base schema + migrations/*
```

Frontend dependencies:

```bash
cd board/frontend && npm install
```

---

## Zotero sync

Runs against the Zotero **local API** by default (`ZOTERO_URL=http://localhost:23119/api`),
so Zotero Desktop must be running. Point `ZOTERO_URL` at `https://api.zotero.org`
to use the web API instead.

```bash
cd zotero_sync

python sync.py                       # incremental (library version, or timestamp fallback)
python sync.py --force               # reset sync state and re-sync everything
python sync.py --full                # ignore the version check, keep sync state
python sync.py --only projects papers  # re-run selected steps only
```

Steps run in order: `projects → papers → authors → attachments → annotations`.
`--only` always fetches the full item list for the selected steps and does not
advance the sync state.

## AI enrichment

```bash
# Annotation-driven mode (default) — fast and cheap
python -m ai_enrichments.enrich

# Full-text mode — thorough, uses more tokens (requires readable PDFs)
python -m ai_enrichments.enrich --full-text

# Force re-process already processed papers
python -m ai_enrichments.enrich --force

# Process a single paper by zotero_key
python -m ai_enrichments.enrich --key ABCD1234

# Use a different provider
python -m ai_enrichments.enrich --provider openai

# Dry run — shows what would be processed, writes nothing
python -m ai_enrichments.enrich --dry-run
```

Only papers with `is_read = true` are picked up; reading is tracked independently
of enrichment. `papers.status` starts as `pending` and becomes `processed` once a
paper has been enriched, and papers already in `processed` are skipped unless
`--force` is used.

## Dashboard

```bash
# Backend  → http://127.0.0.1:8000  (docs at /docs)
cd board/backend && uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Frontend → http://127.0.0.1:5173
cd board/frontend && npm run dev
```

Both at once:

```bash
just        # or: just start
```

The sidebar's **Sync Zotero** and **AI Enrichment** buttons call
`POST /api/tools/zotero-sync` and `POST /api/tools/ai-enrichment`, which shell out
to the two CLIs above. The AI button opens a small options modal (full-text,
force, single zotero key, provider).

### Security model

This is a single-user tool, and the trust boundary is the loopback interface, not
the API itself. That means:

| Layer | Setting | Why |
|---|---|---|
| API binding | `uvicorn --host 127.0.0.1` | Nothing outside the machine can reach it. Never use `0.0.0.0` for this app. |
| Database | Neon `sslmode=require` | The only network hop that leaves the machine is the encrypted Postgres connection. |
| CORS | explicit origin list in `CORS_ORIGINS` | Stops other websites you visit from calling the local API. Avoid `*`. |
| Auth | `API_AUTH_ENABLED=false` (default) | Unnecessary while bound to loopback. |

If you ever expose the API (LAN, tunnel, reverse proxy), set
`API_AUTH_ENABLED=true` and `API_TOKEN=<random>`, then give the frontend the same
value as `VITE_API_TOKEN`. Only state-changing requests are checked; reads stay
open. `python -c "import secrets; print(secrets.token_urlsafe(32))"` generates a
token.

### Dates

All dates in the UI are `DD/MM/YYYY`, entered through the shared `DateField`
(D / M / Y numeric fields) rather than the locale-dependent native date picker.

### Styling

The dashboard is styled with plain CSS (`src/index.css`) plus inline styles —
there is no Tailwind in the build. `postcss.config.js` runs Autoprefixer only.
If you want Tailwind, add `@tailwindcss/postcss` and `@import "tailwindcss";` to
`src/index.css`; do not leave it half-installed as it was before.


### Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | all | Postgres/Neon connection string (`sslmode=require`) |
| `ZOTERO_URL` | sync | local API by default |
| `DEEPSEEK_API_KEY` / `_BASE_URL` / `_MODEL` | enrichment | default provider |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | enrichment | alternative provider |
| `CORS_ORIGINS` | backend | comma-separated origins; defaults to the dev servers |
| `API_AUTH_ENABLED` / `API_TOKEN` | backend | opt-in token on write endpoints |
| `VITE_API_URL` | frontend | overrides the default API base URL |
| `VITE_API_TOKEN` | frontend | sent as `X-API-Token` when auth is enabled |

---

## Repository layout

```
app.py                  schema bootstrap (schema_v2.sql + migrations/)
schema_v2.sql           base schema
migrations/             idempotent, append-only schema updates
tools/verify_schema.py  drift detector: repo SQL vs live database
zotero_sync/            Zotero → Postgres
ai_enrichments/         LLM enrichment
board/backend/          FastAPI dashboard API
board/frontend/         React dashboard
Justfile                dev shortcut (backend + frontend)
```

---

## Known gaps / open questions

These are pre-existing and were deliberately **not** changed, because the fix
would alter behaviour or is a product decision rather than a bug:

1. **`annotations.claim_id` has an FK without `ON DELETE`.** Deleting a claim
   that an annotation points at will fail. No annotation currently sets
   `claim_id`, so it is latent — but linking annotations to claims will hit it.
2. **Enrichment retries forever.** A paper whose AI call keeps failing stays
   `pending` and is retried on every run (burning tokens). A `failed` state with
   a retry counter would fix that.
3. **Deleting every part of a paper marks it unread**, because the trigger's rule
   is "read ⇔ at least one part and all parts read".
4. **`contributors.role` uses its own vocabulary** (`lead`/`coauthor`/`ra`/`advisor`)
   while `project_contributors.project_role` is free text.
5. **`board/frontend/src/pages/ProjectsPage.jsx`, `components/projects/ProjectList.jsx`
   and `ProjectCard.jsx` are not routed** — they are dead code kept for reference.

