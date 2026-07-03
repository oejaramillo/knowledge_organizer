from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime


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

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 2. MEETINGS
# ==========================================
class MeetingBase(BaseModel):
    title: str
    meeting_date: datetime
    summary: Optional[str] = None
    
    project_id: UUID

class MeetingCreate(MeetingBase):
    pass

class MeetingResponse(MeetingBase):
    meeting_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

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

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 4. PAPERS
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
    abstract: Optional[str] = None
    language: Optional[str] = "en"
    pdf_path: Optional[str] = None
    url: Optional[str] = None
    
    document_type: Optional[str] = "journal_article"
    discipline: Optional[List[str]] = None
    theoretical_framework: Optional[str] = None
    status: Optional[str] = "unread"
    citation_intent: Optional[List[str]] = None
    
    replication_available: Optional[bool] = False
    code_available: Optional[bool] = False
    is_read: Optional[bool] = False

class PaperCreate(PaperBase):
    pass

class PaperResponse(PaperBase):
    paper_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

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


# ==========================================
# 6. AGGREGATE DASHBOARD SCHEMAS
# ==========================================
# This one pulls everything together! When you hit your frontend API, 
# returning this model will give you the project AND all its activities.
class ProjectDetailedResponse(ProjectResponse):
    tasks: List[TaskResponse] = []
    meetings: List[MeetingResponse] = []
    binnacle_entries: List[BinnacleResponse] = []
    # If eventually keeping track of papers in this view:
    # papers: List[PaperResponse] = []
    
    model_config = ConfigDict(from_attributes=True)