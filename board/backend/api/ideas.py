from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from core.database import get_db
from models.core import Idea
from schemas.core import IdeaCreate, IdeaUpdate, IdeaResponse

router = APIRouter(
    prefix="/api/ideas",
    tags=["Ideas"]
)


@router.get("/", response_model=List[IdeaResponse])
def list_ideas(project_id: Optional[UUID] = None, db: Session = Depends(get_db)):
    """List all ideas, optionally filtered by project."""
    query = db.query(Idea)
    if project_id:
        query = query.filter(Idea.project_id == project_id)
    return query.order_by(Idea.created_at.desc()).all()


@router.get("/{idea_id}", response_model=IdeaResponse)
def get_idea(idea_id: UUID, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.idea_id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    return idea


@router.post("/", response_model=IdeaResponse, status_code=201)
def create_idea(payload: IdeaCreate, db: Session = Depends(get_db)):
    idea = Idea(**payload.model_dump())
    db.add(idea)
    db.commit()
    db.refresh(idea)
    return idea


@router.patch("/{idea_id}", response_model=IdeaResponse)
def update_idea(idea_id: UUID, payload: IdeaUpdate, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.idea_id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(idea, field, value)
    db.commit()
    db.refresh(idea)
    return idea


@router.delete("/{idea_id}", status_code=204)
def delete_idea(idea_id: UUID, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.idea_id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    db.delete(idea)
    db.commit()