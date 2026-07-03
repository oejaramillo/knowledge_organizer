from sqlalchemy import Column, Text, Integer, Boolean, ForeignKey, DateTime, ARRAY, SmallInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.database import Base
import uuid

# ==========================================
# 1. CONTRIBUTORS TABLE / MODEL
# ==========================================
class Contributor(Base):
    __tablename__ = "contributors"

    contributor_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True)
    role = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Project memberships
    project_associations = relationship(
        "ProjectContributor",
        back_populates="contributor",
        cascade="all, delete-orphan"
    )

# ==========================================
# 2. ASSOCIATION TABLE / MODEL
# ==========================================
# We use a proper class for the association table because it has 
# extra columns (project_role, joined_at) beyond just the foreign keys.
class ProjectContributor(Base):
    __tablename__ = "project_contributors"

    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), primary_key=True)
    contributor_id = Column(UUID(as_uuid=True), ForeignKey("contributors.contributor_id", ondelete="CASCADE"), primary_key=True)
    project_role = Column(Text, nullable=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    project = relationship("Project", back_populates="project_contributors")
    contributor = relationship("Contributor", back_populates="project_associations")


# ==========================================
# 3. UPDATED PROJECT MODEL
# ==========================================
class Project(Base):
    __tablename__ = "projects"

    project_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    parent_project = Column(UUID(as_uuid=True), ForeignKey("projects.project_id"), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(Text, default="active")
    project_type = Column("type",Text, default="collection")
    keywords = Column(ARRAY(Text), nullable=True)
    zotero_collection_key = Column(Text, unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Self-referential relationship for nested projects
    subprojects = relationship("Project", backref="parent", remote_side=[project_id])

    # NEW RELATIONSHIPS
    tasks = relationship("ProjectTask", back_populates="project", cascade="all, delete-orphan")
    meetings = relationship("ProjectMeeting", back_populates="project", cascade="all, delete-orphan")
    binnacle_entries = relationship("ProjectBinnacle", back_populates="project", cascade="all, delete-orphan")
    
    # Link to the association model
    project_contributors = relationship("ProjectContributor", back_populates="project", cascade="all, delete-orphan")

    paper_associations = relationship("PaperProject", back_populates="project", cascade="all, delete-orphan")


# ==========================================
# 4. NEW FEATURE MODELS
# ==========================================
class ProjectTask(Base):
    __tablename__ = "project_tasks"

    task_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"))
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Text, default="todo")
    priority = Column(Text, default="medium")
    due_date = Column(DateTime(timezone=True), nullable=True)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("contributors.contributor_id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="tasks")
    # Uncomment if you have a Contributor model ready to link:
    # assignee = relationship("Contributor")


class ProjectMeeting(Base):
    __tablename__ = "project_meetings"

    meeting_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"))
    title = Column(Text, nullable=False)
    meeting_date = Column(DateTime(timezone=True), nullable=False)
    summary = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="meetings")


class ProjectBinnacle(Base):
    __tablename__ = "project_binnacle"

    binnacle_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"))
    entry_date = Column(DateTime(timezone=True), server_default=func.now())
    title = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    
    task_id = Column(UUID(as_uuid=True), ForeignKey("project_tasks.task_id", ondelete="SET NULL"), nullable=True)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("project_meetings.meeting_id", ondelete="SET NULL"), nullable=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("contributors.contributor_id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="binnacle_entries")
    task = relationship("ProjectTask")
    meeting = relationship("ProjectMeeting")
    # author = relationship("Contributor")



# ==========================================
# ASSOCIATION MODEL: PAPER <-> PROJECT
# ==========================================
class PaperProject(Base):
    __tablename__ = "paper_projects"

    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers.paper_id", ondelete="CASCADE"), primary_key=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), primary_key=True)
    
    relevance_note = Column(Text, nullable=True)
    citation_intent = Column(Text, nullable=True)
    added_by = Column(UUID(as_uuid=True), ForeignKey("contributors.contributor_id"), nullable=True)  # ← only once
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    paper = relationship("Paper", back_populates="project_associations")       # ← points to Paper
    project = relationship("Project", back_populates="paper_associations")     # ← matches Project model
    contributor = relationship("Contributor")                                   # ← no back_populates needed


# ==========================================
# PAPER MODEL
# ==========================================
class Paper(Base):
    __tablename__ = "papers"

    paper_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(Text, nullable=False)
    doi = Column(Text, nullable=True)
    zotero_key = Column(Text, unique=True, nullable=True)
    year = Column(SmallInteger)
    journal = Column(Text, nullable=True)
    volume = Column(Text, nullable=True)
    issue = Column(Text, nullable=True)
    pages = Column(Text, nullable=True)
    abstract = Column(Text, nullable=True)
    language = Column(Text, default="en")
    pdf_path = Column(Text, nullable=True)
    url = Column(Text, nullable=True)

    # Classifications
    document_type = Column(Text, default="journal_article")
    discipline = Column(ARRAY(Text), nullable=True)
    theoretical_framework = Column(Text, nullable=True)
    status = Column(Text, default="unread")
    citation_intent = Column(ARRAY(Text), nullable=True)

    # Flags
    replication_available = Column(Boolean, default=False)
    code_available = Column(Boolean, default=False)
    is_read = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # --- RELATIONSHIPS ---

    # 1. Projects (via Association Object)
    project_associations = relationship("PaperProject", back_populates="paper", cascade="all, delete-orphan")

    # 2. Add other relationships based on your schema as needed:
    # claims = relationship("Claim", back_populates="paper", cascade="all, delete-orphan")
    # annotations = relationship("Annotation", back_populates="paper", cascade="all, delete-orphan")
    
    # Association models for Authors, Methods, Variables, Concepts, Datasets:
    # author_associations = relationship("PaperAuthor", back_populates="paper", cascade="all, delete-orphan")
    # method_associations = relationship("PaperMethod", back_populates="paper", cascade="all, delete-orphan")
    # variable_associations = relationship("PaperVariable", back_populates="paper", cascade="all, delete-orphan")
    # concept_associations = relationship("PaperConcept", back_populates="paper", cascade="all, delete-orphan")
    # dataset_associations = relationship("PaperDataset", back_populates="paper", cascade="all, delete-orphan")