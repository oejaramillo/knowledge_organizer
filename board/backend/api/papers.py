from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from core.database import get_db
from models.core import Paper, Claim, Annotation, PaperPart
from schemas.core import (
    PaperCreate, 
    PaperResponse,
    PaperUpdate,
    ClaimCreate, 
    ClaimResponse,
    AnnotationResponse,
    PaperPartCreate, 
    PaperPartUpdate, 
    PaperPartResponse
)

router = APIRouter(
    prefix="/api/papers",
    tags=["Papers"]
)

@router.patch("/{paper_id}", response_model=PaperResponse)
def update_paper(paper_id: UUID, patch: PaperUpdate, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    for k, v in patch.model_dump(exclude_unset=True).items():
        setattr(paper, k, v)
    db.commit()
    db.refresh(paper)
    return paper

@router.post("/", response_model=PaperResponse, status_code=201)
def create_paper(paper_in: PaperCreate, db: Session = Depends(get_db)):
    """
    Add a new paper to your database.
    """
    # Optional: check if paper with Zotero key already exists
    if paper_in.zotero_key:
        existing = db.query(Paper).filter(Paper.zotero_key == paper_in.zotero_key).first()
        if existing:
            raise HTTPException(status_code=400, detail="Paper with this Zotero key already exists")

    new_paper = Paper(**paper_in.model_dump())
    db.add(new_paper)
    db.commit()
    db.refresh(new_paper)
    return new_paper

@router.get("/", response_model=List[PaperResponse])
def get_all_papers(db: Session = Depends(get_db)):
    """
    Fetch the entire library of papers.
    """
    return db.query(Paper).all()

@router.get("/{paper_id}", response_model=PaperResponse)
def get_paper(paper_id: UUID, db: Session = Depends(get_db)):
    """
    Fetch a specific paper.
    """
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper

@router.put("/{paper_id}", response_model=PaperResponse)
def update_paper(paper_id: UUID, patch: PaperUpdate, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    for k, v in patch.model_dump(exclude_unset=True).items():
        setattr(paper, k, v)
    db.commit()
    db.refresh(paper)
    return paper

@router.get("/{paper_id}/claims", response_model=List[ClaimResponse])
def get_claims(paper_id: UUID, db: Session = Depends(get_db)):
    return db.query(Claim).filter(Claim.paper_id == paper_id)\
             .order_by(Claim.created_at.desc()).all()

@router.post("/{paper_id}/claims", response_model=ClaimResponse, status_code=201)
def create_claim(paper_id: UUID, claim_in: ClaimCreate, db: Session = Depends(get_db)):
    claim = Claim(paper_id=paper_id, **claim_in.model_dump(exclude={"paper_id"}, exclude_unset=True))
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim

@router.delete("/claims/{claim_id}", status_code=204)
def delete_claim(claim_id: UUID, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    db.delete(claim)
    db.commit()

@router.get("/{paper_id}/annotations", response_model=List[AnnotationResponse])
def get_annotations(paper_id: UUID, db: Session = Depends(get_db)):
    return db.query(Annotation).filter(Annotation.paper_id == paper_id)\
             .order_by(Annotation.page_number).all()

@router.get("/{paper_id}/parts", response_model=List[PaperPartResponse])
def get_parts(paper_id: UUID, db: Session = Depends(get_db)):
    return db.query(PaperPart).filter(PaperPart.paper_id == paper_id)\
             .order_by(PaperPart.position, PaperPart.created_at).all()

@router.post("/{paper_id}/parts", response_model=PaperPartResponse, status_code=201)
def create_part(paper_id: UUID, part_in: PaperPartCreate, db: Session = Depends(get_db)):
    part = PaperPart(paper_id=paper_id, **part_in.model_dump())
    db.add(part)
    db.commit()
    db.refresh(part)
    return part

@router.patch("/parts/{part_id}", response_model=PaperPartResponse)
def update_part(part_id: UUID, patch: PaperPartUpdate, db: Session = Depends(get_db)):
    part = db.query(PaperPart).filter(PaperPart.part_id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    for k, v in patch.model_dump(exclude_unset=True).items():
        setattr(part, k, v)
    db.commit()
    db.refresh(part)
    return part

@router.delete("/parts/{part_id}", status_code=204)
def delete_part(part_id: UUID, db: Session = Depends(get_db)):
    part = db.query(PaperPart).filter(PaperPart.part_id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    db.delete(part)
    db.commit()