from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from core.database import get_db
from models.core import Claim, Paper, Annotation
from schemas.core import ClaimCreate, ClaimResponse, PaperUpdate

router = APIRouter(prefix="/api/claims", tags=["Claims"])

@router.get("/paper/{paper_id}", response_model=List[ClaimResponse])
def get_claims_for_paper(paper_id: UUID, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return db.query(Claim).filter(Claim.paper_id == paper_id)\
             .order_by(Claim.created_at).all()

@router.post("/", response_model=ClaimResponse, status_code=201)
def create_claim(claim_in: ClaimCreate, db: Session = Depends(get_db)):
    claim = Claim(**claim_in.model_dump())
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim

@router.delete("/{claim_id}", status_code=204)
def delete_claim(claim_id: UUID, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    db.delete(claim)
    db.commit()

@router.get("/{paper_id}/claims")
def get_claims(paper_id: UUID, db: Session = Depends(get_db)):
    return db.query(Claim).filter(Claim.paper_id == paper_id).order_by(Claim.created_at.desc()).all()

@router.post("/{paper_id}/claims", status_code=201)
def create_claim(paper_id: UUID, claim_in: ClaimCreate, db: Session = Depends(get_db)):
    claim = Claim(paper_id=paper_id, **claim_in.model_dump())
    db.add(claim); db.commit(); db.refresh(claim)
    return claim

@router.delete("/claims/{claim_id}", status_code=204)
def delete_claim(claim_id: UUID, db: Session = Depends(get_db)):
    c = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not c: raise HTTPException(404)
    db.delete(c); db.commit()

@router.get("/{paper_id}/annotations")
def get_annotations(paper_id: UUID, db: Session = Depends(get_db)):
    return db.query(Annotation).filter(Annotation.paper_id == paper_id).order_by(Annotation.page_number).all()

@router.put("/{paper_id}")
def update_paper(paper_id: UUID, patch: PaperUpdate, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper: raise HTTPException(404)
    for k, v in patch.model_dump(exclude_unset=True).items():
        setattr(paper, k, v)
    db.commit(); db.refresh(paper)
    return paper