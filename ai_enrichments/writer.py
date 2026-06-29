"""
Writes parsed AI output to PostgreSQL.
All writes are idempotent — safe to re-run.
"""

from zotero_sync.db import get_db_connection
from .parser import (
    clean_paper_meta,
    clean_claim,
    clean_concept,
    clean_method,
    clean_variable,
)


def write_enrichment(paper_id: str, parsed: dict) -> dict:
    """
    Writes all enrichment data for one paper inside a single transaction.
    Returns a summary dict with counts of what was written.
    """
    meta      = clean_paper_meta(parsed.get("paper_meta", {}))
    claims    = [clean_claim(c)    for c in parsed.get("claims",    []) if c.get("claim")]
    concepts  = [clean_concept(c)  for c in parsed.get("concepts",  []) if c.get("name")]
    methods   = [clean_method(m)   for m in parsed.get("methods",   []) if m.get("name")]
    variables = [clean_variable(v) for v in parsed.get("variables", []) if v.get("name")]

    with get_db_connection() as conn:
        with conn.cursor() as cur:

            # ── 1. Update paper metadata ───────────────────────────────────
            cur.execute(
                """
                UPDATE papers SET
                    discipline            = %s,
                    theoretical_framework = %s,
                    citation_intent       = %s,
                    language              = %s,
                    status                = 'processed',
                    updated_at            = NOW()
                WHERE paper_id = %s
                """,
                (
                    meta["discipline"] or None,
                    meta["theoretical_framework"],
                    meta["citation_intent"] or None,
                    meta["language"],
                    paper_id,
                ),
            )

            # ── 2. Insert claims ───────────────────────────────────────────
            claim_ids = []
            for c in claims:
                cur.execute(
                    """
                    INSERT INTO claims (
                        paper_id, claim_type, claim, quote,
                        page_number, direction, effect_size,
                        population, period, confidence_level,
                        logical_form, scope_conditions,
                        historical_period, geographic_scope, tags
                    )
                    VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, %s, %s
                    )
                    ON CONFLICT DO NOTHING
                    RETURNING claim_id
                    """,
                    (
                        paper_id,
                        c["claim_type"],
                        c["claim"],
                        c["quote"],
                        c["page_number"],
                        c["direction"],
                        c["effect_size"],
                        c["population"],
                        c["period"],
                        c["confidence_level"],
                        c["logical_form"],
                        c["scope_conditions"],
                        c["historical_period"],
                        c["geographic_scope"],
                        c["tags"] or None,
                    ),
                )
                row = cur.fetchone()
                if row:
                    claim_ids.append(row["claim_id"])

            # ── 3. Upsert concepts + link to paper ─────────────────────────
            for concept in concepts:
                cur.execute(
                    """
                    INSERT INTO concepts (name, definition, origin, discipline)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (name) DO UPDATE SET
                        definition = COALESCE(EXCLUDED.definition, concepts.definition),
                        origin     = COALESCE(EXCLUDED.origin,     concepts.origin),
                        discipline = COALESCE(EXCLUDED.discipline,  concepts.discipline)
                    RETURNING concept_id
                    """,
                    (
                        concept["name"],
                        concept["definition"],
                        concept["origin"],
                        concept["discipline"] or None,
                    ),
                )
                concept_id = cur.fetchone()["concept_id"]

                cur.execute(
                    """
                    INSERT INTO paper_concepts (paper_id, concept_id, role, context_note)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (paper_id, concept_id, role) DO UPDATE SET
                        context_note = EXCLUDED.context_note
                    """,
                    (paper_id, concept_id, concept["role"], concept["context_note"]),
                )

            # ── 4. Upsert methods + link to paper ──────────────────────────
            for method in methods:
                cur.execute(
                    """
                    INSERT INTO methods (name, paradigm, tradition, category)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (name) DO UPDATE SET
                        paradigm  = COALESCE(EXCLUDED.paradigm,  methods.paradigm),
                        tradition = COALESCE(EXCLUDED.tradition, methods.tradition),
                        category  = COALESCE(EXCLUDED.category,  methods.category)
                    RETURNING method_id
                    """,
                    (
                        method["name"],
                        method["paradigm"],
                        method["tradition"],
                        method["category"],
                    ),
                )
                method_id = cur.fetchone()["method_id"]

                cur.execute(
                    """
                    INSERT INTO paper_methods (paper_id, method_id, context_note)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (paper_id, method_id) DO UPDATE SET
                        context_note = EXCLUDED.context_note
                    """,
                    (paper_id, method_id, method["context_note"]),
                )

            # ── 5. Upsert variables + link to paper ────────────────────────
            for variable in variables:
                cur.execute(
                    """
                    INSERT INTO variables (name, category, definition, unit)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (name) DO UPDATE SET
                        definition = COALESCE(EXCLUDED.definition, variables.definition),
                        unit       = COALESCE(EXCLUDED.unit,       variables.unit)
                    RETURNING variable_id
                    """,
                    (
                        variable["name"],
                        variable["category"],
                        variable["definition"],
                        variable["unit"],
                    ),
                )
                variable_id = cur.fetchone()["variable_id"]

                cur.execute(
                    """
                    INSERT INTO paper_variables (paper_id, variable_id, role)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (paper_id, variable_id, role) DO NOTHING
                    """,
                    (paper_id, variable_id, variable["role"]),
                )

        conn.commit()

    return {
        "claims":    len(claim_ids),
        "concepts":  len(concepts),
        "methods":   len(methods),
        "variables": len(variables),
    }