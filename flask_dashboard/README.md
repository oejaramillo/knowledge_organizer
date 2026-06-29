# Research Knowledge Dashboard

A Flask JSON API **+** static single-page-app (SPA) dashboard for a pluralist
Research Knowledge Management System (papers, projects, authors, claims,
concepts, methods, annotations, ideas).

Project-first, two-pane UI: browse/filter on the left, detail/edit on the right.

---

## Features

- **REST/JSON API** under `/api/*` with token-protected writes.
- **Static SPA** (no build step) served from `/static`.
- Full-text + trigram search across papers, claims, authors, concepts, methods.
- Pagination (`?page=1&per_page=25`, max 250).
- Audit trail: every write logged to `change_log` with JSONB `changed_fields`.
- Uses the `v_paper_full` and `v_project_progress` SQL views.
- Mock-data mode in the frontend for previewing without a database.

---

## Project layout

```
flask_dashboard/
├── app.py                 # Flask app factory + static serving + error handlers
├── config.py              # env-driven configuration
├── db.py                  # get_db_connection() context manager (psycopg, dict_row)
├── api/                   # blueprints: projects, papers, claims, stats, ideas
├── queries/               # parameterized SQL helpers
├── migrations/            # 001_add_star_notes.sql
├── static/                # index.html, css, js (SPA), mock-data
├── schema_v2.sql          # base schema (copied from upload)
├── seed_demo_data.py      # demo data loader
├── requirements.txt
└── .env.example
```

---

## Setup

### 1. Install dependencies

```bash
cd flask_dashboard
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# edit .env and set DATABASE_URL and a strong API_TOKEN
python -c "import secrets; print(secrets.token_urlsafe(32))"   # generate a token
```

`.env` keys:

| Key                      | Purpose                                             |
|--------------------------|-----------------------------------------------------|
| `DATABASE_URL`           | PostgreSQL DSN used by `db.py`                       |
| `API_TOKEN`              | Required bearer token for POST/PATCH/DELETE          |
| `DEFAULT_CONTRIBUTOR_ID` | (optional) UUID recorded in `change_log`            |
| `CORS_ORIGINS`           | `*` or comma-separated origins                       |
| `HOST` / `PORT`          | bind address / port (default `0.0.0.0:3000`)        |

### 3. Run migrations

The base schema plus the dashboard migration (adds `papers.star`, `papers.notes`
and trigram indexes):

```bash
psql "$DATABASE_URL" -f schema_v2.sql
psql "$DATABASE_URL" -f migrations/001_add_star_notes.sql
```

> `schema_v2.sql` requires the `uuid-ossp`, `vector` (pgvector) and `pg_trgm`
> extensions. If `vector` is unavailable, comment out the `paper_embeddings`
> block in `schema_v2.sql` — the dashboard does not depend on it.

### 4. Seed demo data (optional)

```bash
python seed_demo_data.py          # insert demo rows
python seed_demo_data.py --reset  # wipe demo tables first, then insert
```

### 5. Run the server

```bash
python app.py
# open http://localhost:3000
```

> **Note:** any localhost URL here refers to the machine running the server,
> not necessarily your laptop. On the Abacus VM use the preview URL provided.

---

## API reference

All write endpoints require `Authorization: Bearer <API_TOKEN>` (or `X-API-Token`).
Errors are returned as `{ "error": "message", "details": null }` with proper
HTTP status codes.

| Method | Path                              | Auth | Description                                    |
|--------|-----------------------------------|------|------------------------------------------------|
| GET    | `/api/projects`                   | no   | List projects (`q`, `status`, pagination)      |
| GET    | `/api/project/<id>`               | no   | Project detail + papers + progress stats       |
| POST   | `/api/project`                    | yes  | Create project (idempotent on name)            |
| GET    | `/api/papers`                     | no   | List papers (`project_id`,`author_id`,`method_id`,`concept_id`,`is_read`,`star`,`status`,`q`) |
| GET    | `/api/paper/<id>`                 | no   | Full paper detail (authors, projects, attachments, annotations, claims, concepts, methods, variables) |
| POST   | `/api/paper/<id>`                 | yes  | Update `is_read`,`status`,`star`,`notes`,`project_ids` |
| POST   | `/api/paper/<id>/re_enrich`       | yes  | Placeholder — queue AI re-enrichment           |
| POST   | `/api/claim`                      | yes  | Create claim                                   |
| PATCH  | `/api/claim/<id>`                 | yes  | Update claim                                   |
| GET    | `/api/stats`                      | no   | Library statistics (`?project_id=`)            |
| GET    | `/api/search`                     | no   | Global search (`?q=`)                          |
| GET    | `/api/ideas`                      | no   | List ideas                                     |
| POST   | `/api/idea`                       | yes  | Create idea                                    |
| GET    | `/api/health`                     | no   | Health check                                   |

### Examples

```bash
# list papers in a project, page 2
curl "http://localhost:3000/api/papers?project_id=<uuid>&page=2&per_page=25"

# star a paper (write → needs token)
curl -X POST http://localhost:3000/api/paper/<uuid> \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"star": true, "is_read": true}'

# create a claim
curl -X POST http://localhost:3000/api/claim \
  -H "Authorization: Bearer $API_TOKEN" -H "Content-Type: application/json" \
  -d '{"paper_id":"<uuid>","claim":"X causes Y.","claim_type":"empirical"}'
```

---

## Frontend

Pure HTML/CSS/JS, no build tooling. Open the dashboard and use the header buttons:

- **Token** — store your `API_TOKEN` in `localStorage` so writes work from the UI.
- **Mock** — toggle mock-data mode (serves `static/mock-data/*.json`) to preview
  the UI without a backend/database.
- **Stats** — library statistics with inline-SVG charts.
- **☾** — light/dark theme toggle.

---

## Security notes

- **Token auth:** writes require a bearer token compared against `API_TOKEN`.
  Use a long random value and keep `.env` out of version control (it is in
  `.gitignore`). This is a single shared token meant for a local/single-user
  deployment — front it with a reverse proxy + TLS for any networked use.
- **SQL injection:** every query is parameterized (psycopg `%s` placeholders);
  no string interpolation of user input into SQL values.
- **PDF privacy:** attachment endpoints return `file_path` metadata only — PDF
  contents are never streamed by the API.
- **CORS:** restrict `CORS_ORIGINS` to known origins in production instead of `*`.
- **Local tokens:** the SPA stores the API token in the browser's
  `localStorage`; only enter it on trusted machines.
- **Idempotency:** project creation is idempotent on `name`; paper↔project links
  are fully replaced on update; `re_enrich` only logs intent.
```
