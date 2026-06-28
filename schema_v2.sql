-- ============================================================
-- RESEARCH KNOWLEDGE MANAGEMENT SYSTEM
-- PostgreSQL Schema v2.0
-- Pluralist: quantitative, theoretical, qualitative,
--            historical, sociological, philosophical
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector for AI embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- trigram search on text


-- ============================================================
-- CONTRIBUTORS  (defined first — referenced by other tables)
-- ============================================================

CREATE TABLE contributors (
    contributor_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    email           TEXT UNIQUE,
    role            TEXT CHECK (role IN ('lead','coauthor','ra','advisor')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- CORE: PAPERS
-- ============================================================

CREATE TABLE papers (
    paper_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title                TEXT NOT NULL,
    doi                  TEXT,
    zotero_key           TEXT UNIQUE,
    year                 SMALLINT,
    journal              TEXT,
    volume               TEXT,
    issue                TEXT,
    pages                TEXT,
    abstract             TEXT,
    language             TEXT DEFAULT 'en',
    pdf_path             TEXT,
    url                  TEXT,

    -- Document type (books, chapters, reports, etc.)
    document_type        TEXT DEFAULT 'journal_article'
                         CHECK (document_type IN (
                             'journal_article',
                             'book',
                             'book_chapter',
                             'working_paper',
                             'dissertation',
                             'report',
                             'policy_document',
                             'historical_document',
                             'other'
                         )),

    -- Disciplinary scope
    discipline           TEXT[],   -- ['economics','sociology','philosophy', ...]

    -- Theoretical / paradigmatic positioning
    theoretical_framework TEXT,    -- e.g. 'New Institutional Economics',
                                   --      'Feminist Political Economy',
                                   --      'Post-Keynesian', 'Structuralist'

    -- Reading workflow
    status               TEXT DEFAULT 'unread'
                         CHECK (status IN (
                             'unread','reading','read','processed','archived'
                         )),

    -- Why this paper is cited (multi-purpose array)
    -- Quantitative: motivation, identification, data, robustness, mechanism, comparison
    -- Theoretical:  theoretical_foundation, conceptual_definition, normative_benchmark
    -- Historical:   historical_context, stylized_fact
    -- Cross-disciplinary: disciplinary_bridge, methodological_critique
    citation_intent      TEXT[],

    replication_available BOOLEAN DEFAULT FALSE,
    code_available        BOOLEAN DEFAULT FALSE,
    is_read               BOOLEAN DEFAULT FALSE,

    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_papers_year      ON papers(year);
CREATE INDEX idx_papers_status    ON papers(status);
CREATE INDEX idx_papers_doctype   ON papers(document_type);
CREATE INDEX idx_papers_discipline ON papers USING gin(discipline);
CREATE INDEX idx_papers_title     ON papers
    USING gin(to_tsvector('english', title));
CREATE INDEX idx_papers_abstract  ON papers
    USING gin(to_tsvector('english', coalesce(abstract,'')));


-- ============================================================
-- AUTHORS
-- ============================================================

CREATE TABLE authors (
    author_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name   TEXT NOT NULL,
    last_name   TEXT,
    first_name  TEXT,
    institution TEXT,
    orcid       TEXT UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_authors_name ON authors
    USING gin(to_tsvector('english', full_name));

CREATE TABLE paper_authors (
    paper_id    UUID REFERENCES papers(paper_id)  ON DELETE CASCADE,
    author_id   UUID REFERENCES authors(author_id) ON DELETE CASCADE,
    position    SMALLINT NOT NULL,   -- 1 = first author
    PRIMARY KEY (paper_id, author_id)
);


-- ============================================================
-- PROJECTS  (mirrors Zotero collection hierarchy)
-- ============================================================

CREATE TABLE projects (
    project_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                  TEXT NOT NULL,
    parent_project        UUID REFERENCES projects(project_id),  -- nested collections
    description           TEXT,
    status                TEXT DEFAULT 'active'
                          CHECK (status IN (
                              'active','paused','completed','archived'
                          )),
    keywords              TEXT[],
    zotero_collection_key TEXT UNIQUE,   -- sync anchor back to Zotero
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Example rows matching your Zotero screenshot:
-- ('Economía ecuatoriana', NULL)
-- ('DCI',                  <Economía ecuatoriana id>)
-- ('Salario mínimo y pobreza', <Economía ecuatoriana id>)
-- ('Economía laboral',     NULL)
-- ('Female labor force participation', <Economía laboral id>)
-- ('IA y mercado laboral', <Economía laboral id>)
-- ('Retornos a la educación', <Economía laboral id>)

CREATE TABLE paper_projects (
    paper_id        UUID REFERENCES papers(paper_id)   ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    relevance_note  TEXT,
    citation_intent TEXT,
    added_by        UUID REFERENCES contributors(contributor_id),
    added_at        TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (paper_id, project_id)
);


-- ============================================================
-- METHODS  (two-level taxonomy: quantitative → philosophical)
-- ============================================================

CREATE TABLE methods (
    method_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL UNIQUE,

    -- Top-level paradigm
    paradigm    TEXT CHECK (paradigm IN (
                    'quantitative',
                    'qualitative',
                    'theoretical',
                    'mixed',
                    'historical',
                    'philosophical'
                )),

    -- Intellectual tradition within the paradigm
    tradition   TEXT,   -- e.g. 'institutionalist', 'post-Keynesian',
                        --      'feminist', 'structuralist', 'Marxist',
                        --      'phenomenological', 'post-structuralist'

    category    TEXT,   -- quasi-experimental, structural, descriptive,
                        -- interpretive, normative, genealogical, etc.
    description TEXT
);

-- Seed examples (run separately after schema creation):
-- Quantitative:  DiD, IV, RDD, Event Study, Matching, Synthetic Control,
--                Structural Model, OLS, Probit/Logit, RCT
-- Qualitative:   Grounded Theory, Ethnography, Discourse Analysis,
--                Case Study, Process Tracing, Focus Groups
-- Theoretical:   Axiomatic Modeling, Game Theory, General Equilibrium,
--                Comparative Statics, Mechanism Design
-- Historical:    Comparative Historical Analysis, Archival Research,
--                Oral History, Periodization
-- Philosophical: Dialectical Analysis, Hermeneutics, Phenomenology,
--                Normative Analysis, Conceptual Analysis

CREATE TABLE paper_methods (
    paper_id     UUID REFERENCES papers(paper_id)  ON DELETE CASCADE,
    method_id    UUID REFERENCES methods(method_id) ON DELETE CASCADE,
    context_note TEXT,   -- how exactly this method was used in the paper
    PRIMARY KEY (paper_id, method_id)
);


-- ============================================================
-- VARIABLES  (quantitative papers)
-- ============================================================

CREATE TABLE variables (
    variable_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    category    TEXT,   -- outcome, treatment, control, instrument
    definition  TEXT,
    unit        TEXT,
    aliases     TEXT[]
);

CREATE TABLE paper_variables (
    paper_id    UUID REFERENCES papers(paper_id)    ON DELETE CASCADE,
    variable_id UUID REFERENCES variables(variable_id) ON DELETE CASCADE,
    role        TEXT CHECK (role IN (
                    'outcome','treatment','control',
                    'instrument','moderator','mediator'
                )),
    PRIMARY KEY (paper_id, variable_id, role)
);


-- ============================================================
-- CONCEPTS  (theoretical / qualitative papers)
-- ============================================================

CREATE TABLE concepts (
    concept_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             TEXT NOT NULL,
    definition       TEXT,
    origin           TEXT,        -- who coined it / which tradition
    discipline       TEXT[],      -- ['economics','sociology','philosophy', ...]
    aliases          TEXT[],
    related_concepts UUID[],      -- loose links to other concept UUIDs
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_concepts_name ON concepts
    USING gin(to_tsvector('english', name || ' ' || coalesce(definition,'')));

-- Examples:
-- 'Double Movement'         (Polanyi)
-- 'Embeddedness'            (Granovetter)
-- 'Capabilities Approach'   (Sen)
-- 'Social Reproduction'     (feminist economics)
-- 'Primitive Accumulation'  (Marx)
-- 'Path Dependence'         (North)
-- 'Moral Economy'           (Thompson / Scott)
-- 'Coloniality of Power'    (Quijano)

CREATE TABLE paper_concepts (
    paper_id    UUID REFERENCES papers(paper_id)    ON DELETE CASCADE,
    concept_id  UUID REFERENCES concepts(concept_id) ON DELETE CASCADE,
    role        TEXT CHECK (role IN (
                    'introduces',       -- paper coins or defines the concept
                    'applies',          -- paper uses the concept
                    'critiques',        -- paper challenges the concept
                    'extends',          -- paper builds on the concept
                    'operationalizes'   -- turns concept into measurable variable
                )),
    context_note TEXT,
    PRIMARY KEY (paper_id, concept_id, role)
);

-- Bridge: concept operationalized into a variable
-- Captures the theory → empirics link explicitly
CREATE TABLE concept_variable_links (
    concept_id  UUID REFERENCES concepts(concept_id)  ON DELETE CASCADE,
    variable_id UUID REFERENCES variables(variable_id) ON DELETE CASCADE,
    paper_id    UUID REFERENCES papers(paper_id)       ON DELETE CASCADE,
    note        TEXT,
    PRIMARY KEY (concept_id, variable_id, paper_id)
);


-- ============================================================
-- DATASETS  (empirical papers)
-- ============================================================

CREATE TABLE datasets (
    dataset_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                 TEXT NOT NULL,
    acronym              TEXT,
    country              TEXT,
    source               TEXT,
    years_covered        TEXT,
    frequency            TEXT,          -- annual, quarterly, monthly
    level_of_observation TEXT,          -- individual, household, firm, municipality
    url                  TEXT,
    notes                TEXT
);

-- Examples: ENEMDU, CPS, ACS, DHS, ENAHO, PNAD, LSMS

CREATE TABLE paper_datasets (
    paper_id   UUID REFERENCES papers(paper_id)    ON DELETE CASCADE,
    dataset_id UUID REFERENCES datasets(dataset_id) ON DELETE CASCADE,
    usage_note TEXT,
    PRIMARY KEY (paper_id, dataset_id)
);


-- ============================================================
-- CLAIMS  (formerly findings — now pluralist)
-- ============================================================

CREATE TABLE claims (
    claim_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id        UUID REFERENCES papers(paper_id) ON DELETE CASCADE,

    -- Type discriminator: determines which fields are meaningful
    claim_type      TEXT DEFAULT 'empirical'
                    CHECK (claim_type IN (
                        'empirical',        -- quantitative result
                        'theoretical',      -- formal model proposition
                        'conceptual',       -- definition or framework argument
                        'historical',       -- historical interpretation
                        'normative',        -- value judgment or policy argument
                        'methodological'    -- argument about research design
                    )),

    -- Universal fields (all claim types)
    claim           TEXT NOT NULL,       -- one declarative sentence
    page_number     SMALLINT,
    quote           TEXT,                -- exact supporting quote
    tags            TEXT[],
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    -- Empirical / theoretical fields
    direction       TEXT CHECK (direction IN (
                        'positive','negative','null','mixed','unclear'
                    )),
    effect_size     TEXT,                -- e.g. "10% increase", "0.3 SD"
    population      TEXT,                -- who / where
    period          TEXT,                -- time frame
    confidence_level REAL,              -- researcher's confidence 0–1

    -- Theoretical / conceptual fields
    logical_form    TEXT,               -- "If X then Y under condition Z"
    scope_conditions TEXT,              -- boundary conditions / assumptions

    -- Historical / contextual fields
    historical_period TEXT,             -- e.g. "1970–1982", "post-ISI era"
    geographic_scope  TEXT              -- e.g. "Ecuador", "Latin America"
);

COMMENT ON COLUMN claims.effect_size      IS 'Meaningful for empirical claims only';
COMMENT ON COLUMN claims.direction        IS 'Meaningful for empirical and theoretical claims';
COMMENT ON COLUMN claims.confidence_level IS 'Meaningful for empirical claims only';
COMMENT ON COLUMN claims.logical_form     IS 'Meaningful for theoretical and conceptual claims';
COMMENT ON COLUMN claims.scope_conditions IS 'Meaningful for theoretical and conceptual claims';
COMMENT ON COLUMN claims.historical_period IS 'Meaningful for historical claims';

CREATE INDEX idx_claims_paper ON claims(paper_id);
CREATE INDEX idx_claims_type  ON claims(claim_type);
CREATE INDEX idx_claims_text  ON claims
    USING gin(to_tsvector('english', claim));


-- ============================================================
-- EVIDENCE LINKS  (relationships between claims)
-- Works across ALL claim types: empirical ↔ theoretical ↔ normative
-- ============================================================

CREATE TABLE evidence_links (
    evidence_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_a      UUID REFERENCES claims(claim_id) ON DELETE CASCADE,
    claim_b      UUID REFERENCES claims(claim_id) ON DELETE CASCADE,
    relationship TEXT NOT NULL
                 CHECK (relationship IN (
                     'supports',
                     'contradicts',
                     'extends',
                     'replicates',
                     'questions',
                     'qualifies'
                 )),
    note         TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT no_self_link CHECK (claim_a <> claim_b)
);


-- ============================================================
-- ANNOTATIONS  (synced from Zotero highlights)
-- ============================================================

CREATE TABLE annotations (
    annotation_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id              UUID REFERENCES papers(paper_id) ON DELETE CASCADE,
    page_number           SMALLINT,
    highlight_text        TEXT,
    user_note             TEXT,
    color                 TEXT,   -- yellow, red, green, blue, purple
    annotation_type       TEXT DEFAULT 'highlight'
                          CHECK (annotation_type IN (
                              'highlight','note','image','ink'
                          )),
    zotero_annotation_key TEXT UNIQUE,
    contributor_id        UUID REFERENCES contributors(contributor_id),
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    synced_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_annotations_paper ON annotations(paper_id);
CREATE INDEX idx_annotations_text  ON annotations
    USING gin(to_tsvector('english',
        coalesce(highlight_text,'') || ' ' || coalesce(user_note,'')));


-- ============================================================
-- IDEAS  (researcher's own ideas, linked to any paper type)
-- ============================================================

CREATE TABLE ideas (
    idea_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id     UUID REFERENCES projects(project_id),
    title          TEXT NOT NULL,
    description    TEXT,
    status         TEXT DEFAULT 'raw'
                   CHECK (status IN (
                       'raw','developing','testable','abandoned','published'
                   )),
    contributor_id UUID REFERENCES contributors(contributor_id),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE idea_links (
    idea_id    UUID REFERENCES ideas(idea_id)  ON DELETE CASCADE,
    paper_id   UUID REFERENCES papers(paper_id) ON DELETE SET NULL,
    claim_id   UUID REFERENCES claims(claim_id) ON DELETE SET NULL,
    concept_id UUID REFERENCES concepts(concept_id) ON DELETE SET NULL,
    link_note  TEXT,
    PRIMARY KEY (idea_id, paper_id, claim_id, concept_id)
);


-- ============================================================
-- RESEARCH QUESTIONS
-- ============================================================

CREATE TABLE research_questions (
    question_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID REFERENCES projects(project_id),
    question    TEXT NOT NULL,
    motivation  TEXT,
    status      TEXT DEFAULT 'open'
                CHECK (status IN (
                    'open','in_progress','answered','abandoned'
                )),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- AI LAYER: EMBEDDINGS  (pgvector)
-- ============================================================

CREATE TABLE paper_embeddings (
    embedding_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id     UUID REFERENCES papers(paper_id) ON DELETE CASCADE,
    content_type TEXT CHECK (content_type IN (
                     'abstract','full_text','claims',
                     'annotations','summary'
                 )),
    embedding    vector(1536),   -- OpenAI text-embedding-3-small dimensions
    model_used   TEXT DEFAULT 'text-embedding-3-small',
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (paper_id, content_type)
);

-- HNSW index for fast approximate nearest-neighbor search
CREATE INDEX idx_embeddings_hnsw ON paper_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);


-- ============================================================
-- AUDIT / CHANGE LOG
-- ============================================================

CREATE TABLE change_log (
    log_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name     TEXT NOT NULL,
    record_id      UUID NOT NULL,
    action         TEXT CHECK (action IN ('INSERT','UPDATE','DELETE')),
    contributor_id UUID REFERENCES contributors(contributor_id),
    changed_fields JSONB,
    changed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SYNC STATUS
-- ============================================================

CREATE TABLE sync_state (
    source TEXT PRIMARY KEY,
    last_library_version BIGINT,
    last_sync TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ATTACHMENTS
-- ============================================================

CREATE TABLE attachments (

    attachment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    paper_id UUID
        REFERENCES papers(paper_id)
        ON DELETE CASCADE,

    zotero_attachment_key TEXT UNIQUE,

    filename TEXT,

    mime_type TEXT,

    file_path TEXT,

    md5 TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- VIEWS
-- ============================================================

-- Full paper card with all linked entities
CREATE VIEW v_paper_full AS
SELECT
    p.paper_id,
    p.title,
    p.year,
    p.journal,
    p.doi,
    p.document_type,
    p.discipline,
    p.theoretical_framework,
    p.status,
    p.citation_intent,
    string_agg(DISTINCT a.full_name, ', ' ORDER BY a.full_name) AS authors,
    array_agg(DISTINCT pr.name)    AS projects,
    array_agg(DISTINCT m.name)     AS methods,
    array_agg(DISTINCT v.name)     AS variables,
    array_agg(DISTINCT con.name)   AS concepts,
    array_agg(DISTINCT d.name)     AS datasets,
    COUNT(DISTINCT cl.claim_id)    AS n_claims,
    COUNT(DISTINCT an.annotation_id) AS n_annotations
FROM papers p
LEFT JOIN paper_authors  pa  ON p.paper_id = pa.paper_id
LEFT JOIN authors        a   ON pa.author_id = a.author_id
LEFT JOIN paper_projects pp  ON p.paper_id = pp.paper_id
LEFT JOIN projects       pr  ON pp.project_id = pr.project_id
LEFT JOIN paper_methods  pm  ON p.paper_id = pm.paper_id
LEFT JOIN methods        m   ON pm.method_id = m.method_id
LEFT JOIN paper_variables pv ON p.paper_id = pv.paper_id
LEFT JOIN variables      v   ON pv.variable_id = v.variable_id
LEFT JOIN paper_concepts pc  ON p.paper_id = pc.paper_id
LEFT JOIN concepts       con ON pc.concept_id = con.concept_id
LEFT JOIN paper_datasets pd  ON p.paper_id = pd.paper_id
LEFT JOIN datasets       d   ON pd.dataset_id = d.dataset_id
LEFT JOIN claims         cl  ON p.paper_id = cl.paper_id
LEFT JOIN annotations    an  ON p.paper_id = an.paper_id
GROUP BY p.paper_id;

-- Evidence map across ALL claim types
CREATE VIEW v_evidence_map AS
SELECT
    pa.title        AS paper_a,
    ca.claim_type   AS type_a,
    ca.claim        AS claim_a,
    el.relationship,
    pb.title        AS paper_b,
    cb.claim_type   AS type_b,
    cb.claim        AS claim_b,
    el.note
FROM evidence_links el
JOIN claims  ca ON el.claim_a = ca.claim_id
JOIN claims  cb ON el.claim_b = cb.claim_id
JOIN papers  pa ON ca.paper_id = pa.paper_id
JOIN papers  pb ON cb.paper_id = pb.paper_id;

-- Project reading progress
CREATE VIEW v_project_progress AS
SELECT
    pr.name                                                        AS project,
    COUNT(p.paper_id)                                              AS total_papers,
    COUNT(p.paper_id) FILTER (WHERE p.status = 'processed')       AS processed,
    COUNT(p.paper_id) FILTER (WHERE p.status = 'read')            AS read,
    COUNT(p.paper_id) FILTER (WHERE p.status = 'unread')          AS unread,
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

-- Concept → variable operationalization bridge
CREATE VIEW v_concept_operationalization AS
SELECT
    con.name        AS concept,
    con.origin,
    v.name          AS variable,
    v.definition    AS variable_definition,
    p.title         AS paper,
    p.year,
    cvl.note
FROM concept_variable_links cvl
JOIN concepts  con ON cvl.concept_id = con.concept_id
JOIN variables v   ON cvl.variable_id = v.variable_id
JOIN papers    p   ON cvl.paper_id = p.paper_id;

-- Papers by discipline and paradigm
CREATE VIEW v_library_by_discipline AS
SELECT
    p.document_type,
    p.discipline,
    p.theoretical_framework,
    m.paradigm,
    COUNT(DISTINCT p.paper_id) AS n_papers
FROM papers p
LEFT JOIN paper_methods pm ON p.paper_id = pm.paper_id
LEFT JOIN methods       m  ON pm.method_id = m.method_id
GROUP BY p.document_type, p.discipline, p.theoretical_framework, m.paradigm;
