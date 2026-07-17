from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from typing import List
from uuid import UUID

from core.database import get_db

from models.core import (
    Project, 
    ProjectContributor, 
    Contributor,
    ProjectBinnacle,
    PaperProject,
    Paper
)

from schemas.core import (
    ProjectCreate, 
    ProjectResponse, 
    ProjectDetailedResponse, 
    ProjectContributorCreate, 
    ProjectContributorResponse
)


router = APIRouter(
    prefix="/api/projects",
    tags=["Projects"]
)

@router.get("/", response_model=List[ProjectResponse])
def get_all_projects(db: Session = Depends(get_db)):
    """
    Fetch a lightweight list of all projects.
    """
    projects = db.query(Project).all()
    return projects

@router.get("/{project_id}", response_model=ProjectDetailedResponse)
def get_project(project_id: UUID, db: Session = Depends(get_db)):
    """
    Fetch a specific project by its UUID, including all its nested 
    Tasks, Meetings, and Binnacle entries for the dashboard.
    """
    # Use selectinload to fetch all relationships efficiently!
    project = (
        db.query(Project)
        .options(
            selectinload(Project.binnacle_entries).selectinload(ProjectBinnacle.author),
            selectinload(Project.binnacle_entries).selectinload(ProjectBinnacle.task),
            selectinload(Project.binnacle_entries).selectinload(ProjectBinnacle.meeting),
            selectinload(Project.tasks),
            selectinload(Project.meetings),
            selectinload(Project.ideas),
            selectinload(Project.project_contributors)
                .selectinload(ProjectContributor.contributor),
            selectinload(Project.paper_associations)
                .selectinload(PaperProject.paper)
                .selectinload(Paper.authors),   # ← new
        )
        .filter(Project.project_id == project_id)
        .first()
    )
        
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return project

@router.post("/", response_model=ProjectResponse, status_code=201)
def create_project(project_in: ProjectCreate, db: Session = Depends(get_db)):
    """
    Create a new project.
    """
    # Unpack the Pydantic model directly into the SQLAlchemy model
    new_project = Project(**project_in.model_dump())
    
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    
    return new_project

@router.post("/{project_id}/contributors", response_model=ProjectContributorResponse, status_code=201)
def add_contributor_to_project(
    project_id: UUID,
    payload: ProjectContributorCreate,
    db: Session = Depends(get_db),
):
    # Verify project exists
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify contributor exists
    contributor = db.query(Contributor).filter(
        Contributor.contributor_id == payload.contributor_id
    ).first()
    if not contributor:
        raise HTTPException(status_code=404, detail="Contributor not found")

    # Check not already linked
    existing = db.query(ProjectContributor).filter_by(
        project_id=project_id,
        contributor_id=payload.contributor_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Contributor already in project")

    link = ProjectContributor(
        project_id=project_id,
        contributor_id=payload.contributor_id,
        project_role=payload.project_role,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link