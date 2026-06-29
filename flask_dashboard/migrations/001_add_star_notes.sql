-- ====================================================================
-- Migration 001: add `star` and `notes` columns to papers
-- ====================================================================
-- The dashboard exposes a "star" (favourite) flag and a free-text
-- "notes" field on papers. These are not part of schema_v2.sql, so we
-- add them here. Safe to run multiple times (IF NOT EXISTS).
-- ====================================================================

ALTER TABLE papers ADD COLUMN IF NOT EXISTS star  BOOLEAN DEFAULT FALSE;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_papers_star ON papers(star);

-- Trigram extension is already enabled by schema_v2.sql (pg_trgm).
-- Add trigram indexes used by fuzzy / ILIKE search to keep it fast.
CREATE INDEX IF NOT EXISTS idx_papers_title_trgm
    ON papers USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_authors_fullname_trgm
    ON authors USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_concepts_name_trgm
    ON concepts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_methods_name_trgm
    ON methods USING gin (name gin_trgm_ops);
