from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from typing import List
from uuid import UUID

from core.database import get_db
from models.core import Project
# Import the new schemas we just created
from schemas.core import ProjectCreate, ProjectResponse, ProjectDetailedResponse

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
            selectinload(Project.tasks),
            selectinload(Project.meetings),
            selectinload(Project.binnacle_entries)
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