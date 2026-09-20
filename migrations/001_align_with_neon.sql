-- ============================================================================
-- 001 — Align the base schema with the live Neon database
-- ============================================================================
-- `schema_v2.sql` only describes the original research tables. The Neon database
-- has since grown the columns, tables, indexes, constraints, views and trigger
-- that the dashboard, the Zotero sync and the AI enrichment rely on.
--
-- This migration reproduces Neon exactly as it was at audit time. It is
-- idempotent, so it is safe both for a fresh database (applied right after
-- schema_v2.sql) and for the already-provisioned Neon database.
--
-- Migration 002 then applies the agreed semantic changes on top.
--
-- Verification:
--   python tools/verify_schema.py
-- builds the schema in a throwaway Postgres schema and diffs it against the
-- public schema, so drift is detected instead of assumed.
-- ============================================================================


-- ── 1. papers ───────────────────────────────────────────────────────────────
-- `document_type` stores Zotero's own item type verbatim ("journalArticle",
-- "bookSection", ...). The original CHECK constraint only allowed a closed
-- snake_case list that the sync tool never produces.
ALTER TABLE papers DROP CONSTRAINT IF EXISTS papers_document_type_check;

ALTER TABLE papers
    ADD COLUMN IF NOT EXISTS notes      TEXT,
    ADD COLUMN IF NOT EXISTS is_read    BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS date_read  DATE,
    ADD COLUMN IF NOT EXISTS rating     SMALLINT,
    ADD COLUMN IF NOT EXISTS is_digital BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_print   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS pages_read INTEGER DEFAULT 0;

-- NULL passes a CHECK constraint, so no explicit IS NULL guard is needed.
ALTER TABLE papers DROP CONSTRAINT IF EXISTS papers_rating_check;
ALTER TABLE papers
    ADD CONSTRAINT papers_rating_check CHECK (rating >= 1 AND rating <= 5);

CREATE INDEX IF NOT EXISTS idx_papers_doi        ON papers (doi);
CREATE INDEX IF NOT EXISTS idx_papers_title_trgm ON papers USING gin (title gin_trgm_ops);


-- ── 2. projects ─────────────────────────────────────────────────────────────
DO $$
BEGIN
    CREATE TYPE project_type AS ENUM ('research', 'collection');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS type project_type DEFAULT 'collection';

-- Neon names this constraint explicitly; schema_v2.sql created it as
-- `projects_zotero_collection_key_key`.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_zotero_collection_key_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'projects'::regclass
          AND conname  = 'projects_zotero_collection_key_unique'
    ) THEN
        ALTER TABLE projects
            ADD CONSTRAINT projects_zotero_collection_key_unique
            UNIQUE (zotero_collection_key);
    END IF;
END
$$;


-- ── 3. contributors / authors ───────────────────────────────────────────────
ALTER TABLE contributors
    ADD COLUMN IF NOT EXISTS country TEXT,
    ADD COLUMN IF NOT EXISTS site    TEXT;

ALTER TABLE authors
    ADD COLUMN IF NOT EXISTS country         TEXT,
    ADD COLUMN IF NOT EXISTS profile_picture TEXT,
    ADD COLUMN IF NOT EXISTS webpage         TEXT,
    ADD COLUMN IF NOT EXISTS contributor_id  UUID
        REFERENCES contributors(contributor_id) ON DELETE SET NULL;

-- The Zotero sync upserts authors with ON CONFLICT (full_name).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'authors'::regclass
          AND conname  = 'authors_full_name_unique'
    ) THEN
        ALTER TABLE authors
            ADD CONSTRAINT authors_full_name_unique UNIQUE (full_name);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_authors_contributor_id  ON authors (contributor_id);
CREATE INDEX IF NOT EXISTS idx_authors_fullname_trgm   ON authors USING gin (full_name gin_trgm_ops);


-- ── 4. annotations ──────────────────────────────────────────────────────────
ALTER TABLE annotations
    ADD COLUMN IF NOT EXISTS attachment_id UUID,
    ADD COLUMN IF NOT EXISTS annotation_position   JSONB,
    ADD COLUMN IF NOT EXISTS annotation_sort_index TEXT,
    ADD COLUMN IF NOT EXISTS claim_id UUID;

-- Neon's foreign keys carry no ON DELETE clause; recreate them idempotently.
ALTER TABLE annotations DROP CONSTRAINT IF EXISTS annotations_attachment_id_fkey;
ALTER TABLE annotations
    ADD CONSTRAINT annotations_attachment_id_fkey
    FOREIGN KEY (attachment_id) REFERENCES attachments(attachment_id) ON DELETE SET NULL;

ALTER TABLE annotations DROP CONSTRAINT IF EXISTS annotations_claim_id_fkey;
ALTER TABLE annotations
    ADD CONSTRAINT annotations_claim_id_fkey
    FOREIGN KEY (claim_id) REFERENCES claims(claim_id);

CREATE INDEX IF NOT EXISTS idx_annotations_attachment_id ON annotations (attachment_id);
CREATE INDEX IF NOT EXISTS idx_annotations_sort_index    ON annotations (annotation_sort_index);


-- ── 5. attachments ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attachments_mime_type             ON attachments (mime_type);
CREATE INDEX IF NOT EXISTS idx_attachments_paper_id              ON attachments (paper_id);
CREATE INDEX IF NOT EXISTS idx_attachments_zotero_attachment_key ON attachments (zotero_attachment_key);


-- ── 6. Uniqueness required by the enrichment upserts ────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_concepts_name_unique  ON concepts  (name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_variables_name_unique ON variables (name);
CREATE INDEX IF NOT EXISTS idx_concepts_name_trgm ON concepts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_methods_name_trgm  ON methods  USING gin (name gin_trgm_ops);


-- ── 7. Dashboard tables ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_contributors (
    project_id     UUID NOT NULL REFERENCES projects(project_id)         ON DELETE CASCADE,
    contributor_id UUID NOT NULL REFERENCES contributors(contributor_id) ON DELETE CASCADE,
    project_role   TEXT,
    joined_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, contributor_id)
);

CREATE TABLE IF NOT EXISTS project_tasks (
    task_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    status      TEXT DEFAULT 'todo'
                CHECK (status IN ('todo', 'in_progress', 'blocked', 'completed')),
    priority    TEXT DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date    TIMESTAMPTZ,
    assigned_to UUID REFERENCES contributors(contributor_id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_meetings (
    meeting_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id   UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    meeting_date TIMESTAMPTZ NOT NULL,
    summary      TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_participants (
    meeting_id     UUID NOT NULL REFERENCES project_meetings(meeting_id) ON DELETE CASCADE,
    contributor_id UUID NOT NULL REFERENCES contributors(contributor_id) ON DELETE CASCADE,
    PRIMARY KEY (meeting_id, contributor_id)
);

CREATE TABLE IF NOT EXISTS project_binnacle (
    binnacle_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID REFERENCES projects(project_id)        ON DELETE CASCADE,
    entry_date  TIMESTAMPTZ DEFAULT NOW(),
    title       TEXT,
    content     TEXT NOT NULL,
    task_id     UUID REFERENCES project_tasks(task_id)      ON DELETE SET NULL,
    meeting_id  UUID REFERENCES project_meetings(meeting_id) ON DELETE SET NULL,
    author_id   UUID REFERENCES contributors(contributor_id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Chapters / sections of a book or long paper (see `PaperPart` in models/core.py)
CREATE TABLE IF NOT EXISTS paper_parts (
    part_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id   UUID NOT NULL REFERENCES papers(paper_id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    date_read  TIMESTAMPTZ,
    position   INTEGER,
    pages_read INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project        ON project_tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status         ON project_tasks (status);
CREATE INDEX IF NOT EXISTS idx_project_meetings_project     ON project_meetings (project_id);
CREATE INDEX IF NOT EXISTS idx_project_meetings_date        ON project_meetings (meeting_date);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants (meeting_id);
CREATE INDEX IF NOT EXISTS idx_project_contributors_user    ON project_contributors (contributor_id);
CREATE INDEX IF NOT EXISTS idx_project_binnacle_project     ON project_binnacle (project_id);
CREATE INDEX IF NOT EXISTS idx_project_binnacle_date        ON project_binnacle (entry_date);
CREATE INDEX IF NOT EXISTS idx_paper_parts_paper_id         ON paper_parts (paper_id);


-- ── 8. Reading-state trigger ────────────────────────────────────────────────
-- A paper that has parts is considered read only when every part is read; a
-- paper without parts keeps whatever `is_read` the dashboard set.
--
-- NOTE: this reproduces the function as it exists in Neon. It reads only
-- `NEW.paper_id`, so the DELETE branch silently does nothing (NEW is NULL for
-- DELETE). Migration 002 fixes that with OLD.paper_id.
CREATE OR REPLACE FUNCTION sync_paper_is_read()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE papers
    SET is_read = (
        SELECT COUNT(*) > 0 AND BOOL_AND(is_read)
        FROM paper_parts
        WHERE paper_id = NEW.paper_id
    )
    WHERE paper_id = NEW.paper_id;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_paper_is_read ON paper_parts;
CREATE TRIGGER trg_sync_paper_is_read
    AFTER INSERT OR DELETE OR UPDATE ON paper_parts
    FOR EACH ROW EXECUTE FUNCTION sync_paper_is_read();


-- ── 9. Dashboard views ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_project_activity_summary AS
SELECT
    p.project_id,
    p.name                                     AS project_name,
    p.status                                   AS project_status,
    COUNT(DISTINCT t.task_id)                  AS total_tasks,
    COUNT(DISTINCT t.task_id) FILTER (
        WHERE t.status = 'todo' OR t.status = 'in_progress'
    )                                          AS active_tasks,
    COUNT(DISTINCT m.meeting_id)               AS total_meetings,
    MAX(m.meeting_date)                        AS last_meeting_date,
    COUNT(DISTINCT b.binnacle_id)              AS total_binnacle_entries,
    MAX(b.entry_date)                          AS last_binnacle_entry
FROM projects p
LEFT JOIN project_tasks    t ON p.project_id = t.project_id
LEFT JOIN project_meetings m ON p.project_id = m.project_id
LEFT JOIN project_binnacle b ON p.project_id = b.project_id
GROUP BY p.project_id, p.name, p.status;
