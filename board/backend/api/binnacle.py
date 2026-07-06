from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from core.database import get_db
from models.core import (
    ProjectBinnacle,
    Project,
    ProjectTask,
    ProjectMeeting,
    Contributor,
)
from schemas.core import BinnacleCreate, BinnacleResponse

router = APIRouter(
    prefix="/api/binnacle",
    tags=["Binnacle"]
)

@router.post("/", response_model=BinnacleResponse, status_code=201)
def create_binnacle_entry(binnacle_in: BinnacleCreate, db: Session = Depends(get_db)):
    """
    Create a new binnacle (journal) entry for a project.
    """
    # 1. Verify the project exists
    project = db.query(Project).filter(Project.project_id == binnacle_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # 2. (Optional) Verify linked task exists if provided
    if binnacle_in.task_id:
        task = db.query(ProjectTask).filter(ProjectTask.task_id == binnacle_in.task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Linked task not found")

    # 3. (Optional) Verify linked meeting exists if provided
    if binnacle_in.meeting_id:
        meeting = db.query(ProjectMeeting).filter(ProjectMeeting.meeting_id == binnacle_in.meeting_id).first()
        if not meeting:
            raise HTTPException(status_code=404, detail="Linked meeting not found")
        
    if binnacle_in.author_id:
        author = (
            db.query(Contributor)
            .filter(Contributor.contributor_id == binnacle_in.author_id)
            .first()
        )

        if not author:
            raise HTTPException(
                status_code=404,
                detail="Author not found"
            )

    new_entry = ProjectBinnacle(**binnacle_in.model_dump())
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    return new_entry

@router.get("/", response_model=List[BinnacleResponse])
def get_all_binnacle_entries(db: Session = Depends(get_db)):
    """
    Fetch all binnacle entries across all projects.
    """
    return db.query(ProjectBinnacle).order_by(ProjectBinnacle.entry_date.desc()).all()

@router.get("/{binnacle_id}", response_model=BinnacleResponse)
def get_binnacle_entry(binnacle_id: UUID, db: Session = Depends(get_db)):
    """
    Fetch a specific binnacle entry.
    """
    entry = db.query(ProjectBinnacle).filter(ProjectBinnacle.binnacle_id == binnacle_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Binnacle entry not found")
    return entry

@router.delete("/{binnacle_id}", status_code=204)
def delete_binnacle_entry(binnacle_id: UUID, db: Session = Depends(get_db)):
    """
    Delete a specific binnacle entry.
    """
    entry = db.query(ProjectBinnacle).filter(ProjectBinnacle.binnacle_id == binnacle_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Binnacle entry not found")
        
    db.delete(entry)
    db.commit()
    return None