# ============================================================================
# AI ENRICHMENT PIPELINE - DATABASE WRITER
# ============================================================================
# This module handles persistence of AI-extracted knowledge to PostgreSQL.
# It implements idempotent database operations that can be safely re-run
# without creating duplicates or data corruption.
#
# KEY OPERATIONS:
# 1. Update paper metadata with AI-extracted classifications
# 2. Insert claims with full context and validation
# 3. Upsert concepts, methods, variables (create or update existing)
# 4. Link extracted entities to papers through junction tables
# 5. Handle all operations within single transaction for consistency
#
# UPSERT STRATEGY:
# - Papers: Update metadata only
# - Claims: Insert new (conflict = skip)
# - Concepts/Methods/Variables: Upsert (create or enhance existing)
# - Links: Upsert with context updates
# ============================================================================

# Import database connection from zotero sync module
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
    Write all AI-extracted knowledge for one paper to the database.
    
    This function orchestrates the complete database persistence workflow
    within a single transaction to ensure data consistency. It handles:
    
    1. Paper metadata updates (discipline, framework, citation intent)
    2. Claims insertion with conflict handling
    3. Concepts/methods/variables upserts with relationship linking
    4. Status updates to track processing completion
    
    The operation is idempotent - safe to re-run without creating duplicates
    or corrupting existing data. This allows reprocessing papers with
    updated models or prompts.
    
    Args:
        paper_id (str): Unique identifier for the paper being processed
        parsed (dict): Cleaned and validated AI response from parser module
        
    Returns:
        dict: Summary counts of inserted/updated records:
              - claims: Number of new claims inserted
              - concepts: Number of concepts processed
              - methods: Number of methods processed  
              - variables: Number of variables processed
              
    Raises:
        DatabaseError: If transaction fails (automatically rolled back)
    """
    
    # ── CLEAN AND VALIDATE INPUT DATA ────────────────────────────────────────
    # Use parser functions to ensure data quality and type safety
    meta      = clean_paper_meta(parsed.get("paper_meta", {}))
    claims    = [clean_claim(c)    for c in parsed.get("claims",    []) if c.get("claim")]
    concepts  = [clean_concept(c)  for c in parsed.get("concepts",  []) if c.get("name")]
    methods   = [clean_method(m)   for m in parsed.get("methods",   []) if m.get("name")]
    variables = [clean_variable(v) for v in parsed.get("variables", []) if v.get("name")]

    # ── DATABASE TRANSACTION ─────────────────────────────────────────────────
    # All operations within single transaction ensures consistency
    with get_db_connection() as conn:
        with conn.cursor() as cur:

            # ── 1. UPDATE PAPER METADATA ─────────────────────────────────────
            # Update paper record with AI-extracted high-level classifications
            # This enriches the paper with disciplinary and theoretical context
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

            # ── 2. INSERT CLAIMS ─────────────────────────────────────────────
            # Insert new claims with full context and metadata
            # ON CONFLICT DO NOTHING prevents duplicates on re-runs
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

            # ── 3. UPSERT CONCEPTS + LINK TO PAPER ───────────────────────────
            # Create new concepts or update existing ones with enhanced metadata
            # Link concepts to papers with role and context information
            for concept in concepts:
                # Upsert concept (create new or update existing)
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

                # Link concept to paper with usage context
                cur.execute(
                    """
                    INSERT INTO paper_concepts (paper_id, concept_id, role, context_note)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (paper_id, concept_id, role) DO UPDATE SET
                        context_note = EXCLUDED.context_note
                    """,
                    (paper_id, concept_id, concept["role"], concept["context_note"]),
                )

            # ── 4. UPSERT METHODS + LINK TO PAPER ────────────────────────────
            # Handle research methodology entities and their paper associations
            for method in methods:
                # Upsert method with paradigm and tradition classification
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

                # Link method to paper with usage context
                cur.execute(
                    """
                    INSERT INTO paper_methods (paper_id, method_id, context_note)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (paper_id, method_id) DO UPDATE SET
                        context_note = EXCLUDED.context_note
                    """,
                    (paper_id, method_id, method["context_note"]),
                )

            # ── 5. UPSERT VARIABLES + LINK TO PAPER ──────────────────────────
            # Handle quantitative variables and their operationalization context
            for variable in variables:
                # Upsert variable with definition and measurement unit
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

                # Link variable to paper with analytical role
                cur.execute(
                    """
                    INSERT INTO paper_variables (paper_id, variable_id, role)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (paper_id, variable_id, role) DO NOTHING
                    """,
                    (paper_id, variable_id, variable["role"]),
                )

        # Commit all operations as single atomic transaction
        conn.commit()

    # ── RETURN PROCESSING SUMMARY ─────────────────────────────────────────────
    # Provide counts for monitoring and debugging
    return {
        "claims":    len(claim_ids),
        "concepts":  len(concepts),
        "methods":   len(methods),
        "variables": len(variables),
    }