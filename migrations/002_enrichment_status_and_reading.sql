-- ============================================================================
-- 002 — Separate enrichment state from reading state
-- ============================================================================
-- Agreed semantic changes applied on top of 001:
--
--   1. `papers.status` belongs to the AI enrichment pipeline only.
--      Reading progress is tracked by `papers.is_read` / `papers.date_read` /
--      `paper_parts` (see the `trg_sync_paper_is_read` trigger in 001).
--   2. `papers.document_type` default matches the vocabulary actually stored
--      (Zotero item types, camelCase).
--   3. `sync_paper_is_read()` resolves the paper id from OLD on DELETE, so the
--      reading flag stays correct when a part is removed.
--   4. `v_project_progress` derives "read"/"unread" from `is_read` instead of
--      the old reading values of `status`.
--
-- Idempotent: safe to re-run.
-- ============================================================================


-- ── 1. papers.status becomes an enrichment-only marker ──────────────────────
ALTER TABLE papers DROP CONSTRAINT IF EXISTS papers_status_check;

-- Older reading values ('unread', 'reading', 'read', 'archived') collapse into
-- 'pending'. Enrichment progress ('processed') is preserved.
UPDATE papers
   SET status = 'pending'
 WHERE status IS DISTINCT FROM 'processed';

ALTER TABLE papers ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE papers
    ADD CONSTRAINT papers_status_check CHECK (status IN ('pending', 'processed'));

COMMENT ON COLUMN papers.status IS
    'AI enrichment state: pending (not enriched yet) or processed. '
    'Reading progress is tracked by is_read / date_read / paper_parts.';


-- ── 2. document_type default matches the stored vocabulary ──────────────────
ALTER TABLE papers ALTER COLUMN document_type SET DEFAULT 'journalArticle';

COMMENT ON COLUMN papers.document_type IS
    'Zotero item type, stored verbatim (journalArticle, bookSection, dataset, ...).';


-- ── 3. Fix the paper_parts trigger on DELETE ────────────────────────────────
-- The 001 version read only NEW.paper_id; NEW is NULL for DELETE, so removing a
-- part left papers.is_read stale.
CREATE OR REPLACE FUNCTION sync_paper_is_read()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    target_paper UUID;
BEGIN
    target_paper := COALESCE(NEW.paper_id, OLD.paper_id);

    IF target_paper IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    UPDATE papers
    SET is_read = (
        SELECT COUNT(*) > 0 AND BOOL_AND(is_read)
        FROM paper_parts
        WHERE paper_id = target_paper
    )
    WHERE paper_id = target_paper;

    RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_paper_is_read ON paper_parts;
CREATE TRIGGER trg_sync_paper_is_read
    AFTER INSERT OR DELETE OR UPDATE ON paper_parts
    FOR EACH ROW EXECUTE FUNCTION sync_paper_is_read();


-- ── 4. Project progress view uses the reading flag ──────────────────────────
CREATE OR REPLACE VIEW v_project_progress AS
SELECT
    pr.name                                                        AS project,
    COUNT(p.paper_id)                                              AS total_papers,
    COUNT(p.paper_id) FILTER (WHERE p.status = 'processed')        AS processed,
    COUNT(p.paper_id) FILTER (WHERE p.is_read = true)              AS read,
    COUNT(p.paper_id) FILTER (WHERE p.is_read = false)             AS unread,
    COUNT(DISTINCT cl.claim_id)                                    AS total_claims,
    COUNT(DISTINCT cl.claim_id) FILTER
        (WHERE cl.claim_type = 'empirical')                        AS empirical_claims,
    COUNT(DISTINCT cl.claim_id) FILTER
        (WHERE cl.claim_type IN ('theoretical','conceptual',
                                  'normative','historical'))       AS non_empirical_claims,
    COUNT(DISTINCT an.annotation_id)                               AS total_annotations
FROM projects pr
LEFT JOIN paper_projects pp ON pr.project_id = pp.project_id
LEFT JOIN papers         p  ON pp.paper_id = p.paper_id
LEFT JOIN claims         cl ON p.paper_id = cl.paper_id
LEFT JOIN annotations    an ON p.paper_id = an.paper_id
GROUP BY pr.project_id, pr.name;
