from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from core.database import get_db
from models.core import Annotation, Paper
from schemas.core import AnnotationResponse

router = APIRouter(prefix="/api/annotations", tags=["Annotations"])

@router.get("/paper/{paper_id}", response_model=List[AnnotationResponse])
def get_annotations_for_paper(paper_id: UUID, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return db.query(Annotation).filter(Annotation.paper_id == paper_id)\
             .order_by(Annotation.annotation_sort_index.nullslast(), Annotation.page_number).all()