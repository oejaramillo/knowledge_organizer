from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime


# ==========================================
# CONTRIBUTORS
# ==========================================
class ContributorBase(BaseModel):
    name: str
    email: Optional[str] = None
    role: Optional[str] = None
    country: Optional[str] = None
    site: Optional[str] = None


class ContributorUpdate(BaseModel):
    name:  Optional[str] = None
    email: Optional[str] = None
    role:  Optional[str] = None
    country: Optional[str] = None
    site:  Optional[str] = None


class ContributorCreate(ContributorBase):
    pass


class ContributorResponse(ContributorBase):
    contributor_id: UUID
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# ==========================================
# PROJECT CONTRIBUTORS
# ==========================================
class ProjectContributorBase(BaseModel):
    contributor_id: UUID
    project_role: Optional[str] = None


class ProjectContributorCreate(ProjectContributorBase):
    pass


class ProjectContributorUpdate(BaseModel):
    project_role: Optional[str] = None


class ProjectContributorResponse(ProjectContributorBase):
    project_id: UUID
    joined_at: Optional[datetime] = None

    contributor: Optional[ContributorResponse] = None

    model_config = ConfigDict(from_attributes=True)

# ==========================================
# 1. TASKS
# ==========================================
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "todo"
    priority: Optional[str] = "medium"
    due_date: Optional[datetime] = None
    
    project_id: UUID
    assigned_to: Optional[UUID] = None

class TaskCreate(TaskBase):
    pass

class TaskResponse(TaskBase):
    task_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    assignee: Optional[ContributorResponse] = None

    model_config = ConfigDict(from_attributes=True)

class TaskUpdate(BaseModel):
    title:       Optional[str] = None
    description: Optional[str] = None
    status:      Optional[str] = None
    priority:    Optional[str] = None
    due_date:    Optional[datetime] = None
    assigned_to: Optional[UUID] = None


# ==========================================
# 2. MEETINGS
# ==========================================
class MeetingBase(BaseModel):
    title: str
    meeting_date: datetime
    summary: Optional[str] = None
    
    project_id: UUID

class MeetingCreate(MeetingBase):
    participant_ids: List[UUID] = []

class MeetingUpdate(BaseModel):
    title:           Optional[str] = None
    meeting_date:    Optional[datetime] = None
    summary:         Optional[str] = None
    participant_ids: Optional[List[UUID]] = None

class MeetingResponse(MeetingBase):
    meeting_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    participants: List[ContributorResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 3. BINNACLE (Activity Log)
# ==========================================
class BinnacleBase(BaseModel):
    title: Optional[str] = None
    content: str
    
    project_id: UUID
    task_id: Optional[UUID] = None
    meeting_id: Optional[UUID] = None
    author_id: Optional[UUID] = None

class BinnacleCreate(BinnacleBase):
    entry_date: Optional[datetime] = None

class BinnacleResponse(BinnacleBase):
    binnacle_id: UUID
    entry_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    author: Optional[ContributorResponse] = None
    task: Optional[TaskResponse] = None        
    meeting: Optional[MeetingResponse] = None  

    model_config = ConfigDict(from_attributes=True)

class BinnacleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    entry_date: Optional[datetime] = None
    task_id: Optional[UUID] = None
    meeting_id: Optional[UUID] = None
    author_id: Optional[UUID] = None

# ==========================================
# AUTHORS
# ==========================================
class PaperSummary(BaseModel):
    paper_id:      UUID
    title:         str
    year:          Optional[int]   = None
    is_digital: Optional[bool] = False
    date_read:  Optional[date] = None
    rating:     Optional[int] = Field(None, ge=1, le=5)
    is_read: Optional[bool] = False
    journal: Optional[str] = None
    volume: Optional[str] = None
    pages: Optional[str] = None
    url: Optional[str] = None

    document_type: Optional[str]   = None

    model_config = ConfigDict(from_attributes=True)


class AuthorResponse(BaseModel):
    author_id:       UUID
    full_name:       str
    last_name:       Optional[str] = None
    first_name:      Optional[str] = None
    institution:     Optional[str] = None
    country:         Optional[str] = None
    orcid:           Optional[str] = None
    profile_picture: Optional[str] = None
    webpage:         Optional[str] = None
    contributor_id:  Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)


class AuthorDetail(AuthorResponse):
    papers: List[PaperSummary] = []

    model_config = ConfigDict(from_attributes=True)


class AuthorUpdate(BaseModel):
    institution:     Optional[str]  = None
    country:         Optional[str]  = None
    profile_picture: Optional[str]  = None
    webpage:         Optional[str]  = None
    contributor_id:  Optional[UUID] = None


# ==========================================
# PAPERS
# ==========================================
class PaperBase(BaseModel):
    title: str
    doi: Optional[str] = None
    zotero_key: Optional[str] = None
    year: Optional[int] = None
    journal: Optional[str] = None
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    pages_read: Optional[int] = 0
    abstract: Optional[str] = None
    language: Optional[str] = "en"
    pdf_path: Optional[str] = None
    url: Optional[str] = None
    date_read:  Optional[date] = None
    rating:     Optional[int] = Field(None, ge=1, le=5)
    is_digital: Optional[bool] = False
    is_print: Optional[bool] = False
    notes: Optional[str] = None
    
    document_type: Optional[str] = "journalArticle"
    discipline: Optional[List[str]] = None
    theoretical_framework: Optional[str] = None
    # AI enrichment state ('pending' | 'processed') — not part of the reading
    # workflow, so it is intentionally absent from PaperUpdate.
    status: Optional[str] = "pending"
    citation_intent: Optional[List[str]] = None
    
    replication_available: Optional[bool] = False
    code_available: Optional[bool] = False
    is_read: Optional[bool] = False

    # Read-only counters derived from claims/annotations (see models/core.py)
    n_claims: Optional[int] = 0
    n_annotations: Optional[int] = 0

class PaperCreate(PaperBase):
    pass

class PaperResponse(PaperBase):
    paper_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    authors: List[AuthorResponse] = []
    # Only the *count* of parts travels with a paper; the parts themselves are
    # fetched by GET /api/papers/{id}/parts when that tab is opened. Shipping
    # them here triggered one extra query per paper (an N+1 over the network).
    n_parts: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)

class PaperUpdate(BaseModel):
    """Fields the dashboard may change.

    `status` is intentionally absent: it belongs to the AI enrichment pipeline.
    Reading progress is expressed through `is_read` / `date_read` / `pages_read`.
    """
    date_read:            Optional[date] = None
    rating:               Optional[int] = Field(None, ge=1, le=5)
    is_digital:           Optional[bool] = None
    is_print:             Optional[bool] = None
    notes:                Optional[str] = None
    pages_read:           Optional[int] = None
    is_read:              Optional[bool] = None
    theoretical_framework: Optional[str] = None
    discipline:           Optional[List[str]] = None
    citation_intent:      Optional[List[str]] = None
    replication_available: Optional[bool] = None
    code_available:       Optional[bool] = None

class PaperProjectResponse(BaseModel):
    paper_id:       UUID
    relevance_note: Optional[str] = None
    citation_intent: Optional[str] = None
    added_at:       Optional[datetime] = None
    paper:          PaperResponse

    model_config = ConfigDict(from_attributes=True)

# ==========================================
# PAPER PARTS (Chapters)
# ==========================================
class PaperPartCreate(BaseModel):
    title:     str
    is_read:   bool = False
    date_read: Optional[datetime] = None
    pages_read: Optional[int] = None
    position:  Optional[int] = None

class PaperPartUpdate(BaseModel):
    title:     Optional[str] = None
    is_read:   Optional[bool] = None
    date_read: Optional[datetime] = None
    pages_read: Optional[int] = None
    position:  Optional[int] = None

class PaperPartResponse(BaseModel):
    part_id:   UUID
    paper_id:  UUID
    title:     str
    is_read:   bool
    date_read: Optional[datetime] = None
    position:  Optional[int] = None
    created_at: Optional[datetime] = None
    pages_read: Optional[int] = 0
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 5. PROJECTS
# ==========================================
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "active"
    project_type: Optional[str] = "collection"
    keywords: Optional[List[str]] = None
    zotero_collection_key: Optional[str] = None
    parent_project: Optional[UUID] = None

class ProjectCreate(ProjectBase):
    pass

# Standard lightweight response
class ProjectResponse(ProjectBase):
    project_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class ProjectUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None
    status:      Optional[str] = None
    project_type: Optional[str] = None
    keywords:    Optional[List[str]] = None

# ==========================================
# 6. IDEAS
# ==========================================
class IdeaCreate(BaseModel):
    project_id:     Optional[UUID] = None
    title:          str
    description:    Optional[str] = None
    status:         Optional[str] = "raw"   # raw | developing | testable | abandoned | published
    contributor_id: Optional[UUID] = None

class IdeaUpdate(BaseModel):
    title:          Optional[str] = None
    description:    Optional[str] = None
    status:         Optional[str] = None
    contributor_id: Optional[UUID] = None

class IdeaResponse(BaseModel):
    idea_id:        UUID
    project_id:     Optional[UUID]
    title:          str
    description:    Optional[str]
    status:         Optional[str]
    contributor_id: Optional[UUID]
    created_at:     Optional[datetime]
    updated_at:     Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# CLAIMS
# ==========================================
class ClaimResponse(BaseModel):
    claim_id:          UUID
    paper_id:          UUID
    claim_type:        Optional[str] = "empirical"
    claim:             str
    page_number:       Optional[int] = None
    quote:             Optional[str] = None
    tags:              Optional[List[str]] = None
    created_at:        Optional[datetime] = None

    direction:         Optional[str] = None
    effect_size:       Optional[str] = None
    population:        Optional[str] = None
    period:            Optional[str] = None
    confidence_level:  Optional[float] = None

    logical_form:      Optional[str] = None
    scope_conditions:  Optional[str] = None

    historical_period: Optional[str] = None
    geographic_scope:  Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ClaimCreate(BaseModel):
    paper_id: Optional[UUID] = None
    claim_type:        Optional[str] = "empirical"
    claim:             str
    page_number:       Optional[int] = None
    quote:             Optional[str] = None
    tags:              Optional[List[str]] = None
    direction:         Optional[str] = None
    effect_size:       Optional[str] = None
    population:        Optional[str] = None
    period:            Optional[str] = None
    confidence_level:  Optional[float] = None
    logical_form:      Optional[str] = None
    scope_conditions:  Optional[str] = None
    historical_period: Optional[str] = None
    geographic_scope:  Optional[str] = None


# ==========================================
# ANNOTATIONS
# ==========================================
class AnnotationResponse(BaseModel):
    annotation_id:         UUID
    paper_id:              UUID
    page_number:           Optional[int] = None
    highlight_text:        Optional[str] = None
    user_note:             Optional[str] = None
    color:                 Optional[str] = None
    annotation_type:       Optional[str] = "highlight"
    zotero_annotation_key: Optional[str] = None
    contributor_id:        Optional[UUID] = None
    claim_id:              Optional[UUID] = None
    annotation_sort_index: Optional[str] = None
    created_at:            Optional[datetime] = None
    synced_at:             Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 7. AGGREGATE DASHBOARD SCHEMAS
# ==========================================
# This one pulls everything together! When you hit your frontend API, 
# returning this model will give you the project AND all its activities.
class ProjectCollectionResponse(ProjectResponse):
    """A reading collection: papers and contributors only.

    Research-only sections (tasks, meetings, binnacle, ideas) are deliberately
    absent so the API never loads or serialises them for a collection.
    """
    project_contributors: List[ProjectContributorResponse] = Field(default_factory=list)
    paper_associations:   List[PaperProjectResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ProjectSectionsResponse(BaseModel):
    """The research panels, fetched only when one of them is opened.

    Loading these up front costs several extra round-trips against the remote
    database for every project view, even when the panels stay closed.
    """
    tasks:            List[TaskResponse] = Field(default_factory=list)
    meetings:         List[MeetingResponse] = Field(default_factory=list)
    binnacle_entries: List[BinnacleResponse] = Field(default_factory=list)
    ideas:            List[IdeaResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)