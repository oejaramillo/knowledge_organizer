from sqlalchemy import (
    Column,
    Text, 
    Integer, 
    Boolean, 
    ForeignKey, 
    DateTime, 
    ARRAY, 
    SmallInteger, 
    Table,
    Float
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.database import Base
import uuid

# ==========================================
# ASSOCIATION TABLES (module level)
# ==========================================
meeting_participants = Table(
    "meeting_participants",
    Base.metadata,
    Column("meeting_id", UUID(as_uuid=True), ForeignKey("project_meetings.meeting_id", ondelete="CASCADE"), primary_key=True),
    Column("contributor_id", UUID(as_uuid=True), ForeignKey("contributors.contributor_id", ondelete="CASCADE"), primary_key=True),
)

paper_authors_table = Table(
    "paper_authors",
    Base.metadata,
    Column("paper_id", UUID(as_uuid=True), ForeignKey("papers.paper_id", ondelete="CASCADE"), primary_key=True),
    Column("author_id", UUID(as_uuid=True), ForeignKey("authors.author_id", ondelete="CASCADE"), primary_key=True),
    Column("position", SmallInteger, nullable=False, default=1),
)

# ==========================================
# 1. CONTRIBUTORS TABLE / MODEL
# ==========================================
class Contributor(Base):
    __tablename__ = "contributors"

    contributor_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True)
    role = Column(Text)
    country = Column(Text, nullable=True)
    site = Column(Text, nullable=True)      
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
class ProjectContributor(Base):
    __tablename__ = "project_contributors"

    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), primary_key=True)
    contributor_id = Column(UUID(as_uuid=True), ForeignKey("contributors.contributor_id", ondelete="CASCADE"), primary_key=True)
    project_role = Column(Text, nullable=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="project_contributors")
    contributor = relationship("Contributor", back_populates="project_associations")


# ==========================================
# 3. PROJECT MODEL
# ==========================================
class Project(Base):
    __tablename__ = "projects"

    project_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    parent_project = Column(UUID(as_uuid=True), ForeignKey("projects.project_id"), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(Text, default="active")
    project_type = Column("type", Text, default="collection")
    keywords = Column(ARRAY(Text), nullable=True)
    zotero_collection_key = Column(Text, unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    subprojects = relationship("Project", backref="parent", remote_side=[project_id])

    tasks = relationship("ProjectTask", back_populates="project", cascade="all, delete-orphan")
    meetings = relationship("ProjectMeeting", back_populates="project", cascade="all, delete-orphan")
    binnacle_entries = relationship("ProjectBinnacle", back_populates="project", cascade="all, delete-orphan")
    project_contributors = relationship("ProjectContributor", back_populates="project", cascade="all, delete-orphan")
    paper_associations = relationship("PaperProject", back_populates="project", cascade="all, delete-orphan")
    ideas = relationship("Idea", back_populates="project", cascade="all, delete-orphan")

# ==========================================
# 4. FEATURE MODELS
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
    assignee = relationship("Contributor")  # ← uncommented

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
    participants = relationship("Contributor", secondary=meeting_participants, lazy="selectin")

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
    author = relationship("Contributor")

# ==========================================
# ASSOCIATION MODEL: PAPER <-> PROJECT
# ==========================================
class PaperProject(Base):
    __tablename__ = "paper_projects"

    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers.paper_id", ondelete="CASCADE"), primary_key=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), primary_key=True)
    relevance_note = Column(Text, nullable=True)
    citation_intent = Column(Text, nullable=True)
    added_by = Column(UUID(as_uuid=True), ForeignKey("contributors.contributor_id"), nullable=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    paper = relationship("Paper", back_populates="project_associations")
    project = relationship("Project", back_populates="paper_associations")
    contributor = relationship("Contributor")


# ==========================================
# AUTHORS MODEL
# ==========================================
class Author(Base):
    __tablename__ = "authors"

    author_id       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name       = Column(Text, nullable=False)
    last_name       = Column(Text, nullable=True)
    first_name      = Column(Text, nullable=True)
    institution     = Column(Text, nullable=True)
    country         = Column(Text, nullable=True)
    orcid           = Column(Text, unique=True, nullable=True)
    profile_picture = Column(Text, nullable=True)
    webpage         = Column(Text, nullable=True)
    contributor_id  = Column(UUID(as_uuid=True), ForeignKey("contributors.contributor_id", ondelete="SET NULL"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    contributor  = relationship("Contributor")
    
    papers = relationship(
        "Paper",
        secondary=paper_authors_table,
        back_populates="authors",
    )


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
    date_read  = Column(DateTime(timezone=True), nullable=True)
    rating     = Column(SmallInteger, nullable=True)   # 1–5, NULL = unrated
    is_digital = Column(Boolean, default=False)
    is_print   = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)

    document_type = Column(Text, default="journal_article")
    discipline = Column(ARRAY(Text), nullable=True)
    theoretical_framework = Column(Text, nullable=True)
    status = Column(Text, default="unread")
    citation_intent = Column(ARRAY(Text), nullable=True)

    replication_available = Column(Boolean, default=False)
    code_available = Column(Boolean, default=False)
    is_read = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project_associations = relationship(
        "PaperProject", 
        back_populates="paper", 
        cascade="all, delete-orphan"
    )

    authors = relationship(
        "Author",
        secondary=paper_authors_table,
        order_by=paper_authors_table.c.position,
        lazy="selectin"
    )

    claims = relationship(
        "Claim", 
        back_populates="paper", 
        cascade="all, delete-orphan"
    )

    annotations = relationship(
        "Annotation", 
        back_populates="paper", 
        cascade="all, delete-orphan"
    )

    authors = relationship(
        "Author",
        secondary=paper_authors_table,
        back_populates="papers",
    )

    parts = relationship(
        "PaperPart", 
        backref="paper", 
        cascade="all, delete-orphan", 
        order_by="PaperPart.position"
    )

# ==========================================
# PAPERS PARTS
# ==========================================
class PaperPart(Base):
    __tablename__ = "paper_parts"

    part_id    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id   = Column(UUID(as_uuid=True), ForeignKey("papers.paper_id", ondelete="CASCADE"), nullable=False)
    title      = Column(Text, nullable=False)
    is_read    = Column(Boolean, default=False, nullable=False)
    date_read  = Column(DateTime(timezone=True))
    position   = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())



# ==========================================
# IDEAS MODEL
# ==========================================
class Idea(Base):
    __tablename__ = "ideas"

    idea_id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id     = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=True)
    title          = Column(Text, nullable=False)
    description    = Column(Text, nullable=True)
    status         = Column(Text, default="raw")   # raw | developing | testable | abandoned | published
    contributor_id = Column(UUID(as_uuid=True), ForeignKey("contributors.contributor_id", ondelete="SET NULL"), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())

    project     = relationship("Project", back_populates="ideas")
    contributor = relationship("Contributor")


# ==========================================
# CLAIMS MODEL
# ==========================================
class Claim(Base):
    __tablename__ = "claims"

    claim_id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id         = Column(UUID(as_uuid=True), ForeignKey("papers.paper_id", ondelete="CASCADE"))
    claim_type       = Column(Text, default="empirical")
    claim            = Column(Text, nullable=False)
    page_number      = Column(SmallInteger, nullable=True)
    quote            = Column(Text, nullable=True)
    tags             = Column(ARRAY(Text), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    # Empirical / theoretical
    direction        = Column(Text, nullable=True)
    effect_size      = Column(Text, nullable=True)
    population       = Column(Text, nullable=True)
    period           = Column(Text, nullable=True)
    confidence_level = Column(Float, nullable=True)

    # Theoretical / conceptual
    logical_form     = Column(Text, nullable=True)
    scope_conditions = Column(Text, nullable=True)

    # Historical
    historical_period = Column(Text, nullable=True)
    geographic_scope  = Column(Text, nullable=True)

    paper = relationship("Paper", back_populates="claims")

# ==========================================
# ANNOTATIONS MODEL
# ==========================================
class Annotation(Base):
    __tablename__ = "annotations"

    annotation_id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id              = Column(UUID(as_uuid=True), ForeignKey("papers.paper_id", ondelete="CASCADE"))
    page_number           = Column(SmallInteger, nullable=True)
    highlight_text        = Column(Text, nullable=True)
    user_note             = Column(Text, nullable=True)
    color                 = Column(Text, nullable=True)   # yellow, red, green, blue, purple
    annotation_type       = Column(Text, default="highlight")
    zotero_annotation_key = Column(Text, unique=True, nullable=True)
    contributor_id        = Column(UUID(as_uuid=True), ForeignKey("contributors.contributor_id", ondelete="SET NULL"), nullable=True)
    created_at            = Column(DateTime(timezone=True), server_default=func.now())
    synced_at             = Column(DateTime(timezone=True), server_default=func.now())

    # Extended fields from migrations
    attachment_id         = Column(UUID(as_uuid=True), ForeignKey("attachments.attachment_id", ondelete="SET NULL"), nullable=True)
    annotation_position   = Column(Text, nullable=True)   # JSONB → Text is fine for now
    annotation_sort_index = Column(Text, nullable=True)
    claim_id              = Column(UUID(as_uuid=True), ForeignKey("claims.claim_id", ondelete="SET NULL"), nullable=True)

    paper = relationship("Paper", back_populates="annotations")
    contributor = relationship("Contributor")