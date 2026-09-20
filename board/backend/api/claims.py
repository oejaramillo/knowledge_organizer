"""Claims endpoints.

Historically this router grew two parallel sets of routes for the same
resource (`/api/claims/{paper_id}/claims` and `/api/papers/{paper_id}/claims`).
Both are kept for backwards compatibility, but the duplicated logic now lives in
shared helpers and the handlers have unique names.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from core.database import get_db
from models.core import Claim, Paper, Annotation
from schemas.core import (
    AnnotationResponse,
    ClaimCreate,
    ClaimResponse,
    PaperResponse,
    PaperUpdate,
)

router = APIRouter(prefix="/api/claims", tags=["Claims"])


# ── Shared lookups ──────────────────────────────────────────────────────────

def _get_paper_or_404(db: Session, paper_id: UUID) -> Paper:
    paper = db.query(Paper).filter(Paper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper


def _get_claim_or_404(db: Session, claim_id: UUID) -> Claim:
    claim = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


def _create_claim(db: Session, paper_id: UUID | None, claim_in: ClaimCreate) -> Claim:
    payload = claim_in.model_dump(exclude={"paper_id"}, exclude_unset=True)
    claim = Claim(paper_id=paper_id, **payload)
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim


# ── Claims ──────────────────────────────────────────────────────────────────

@router.get("/paper/{paper_id}", response_model=List[ClaimResponse])
def list_claims_for_paper(paper_id: UUID, db: Session = Depends(get_db)):
    _get_paper_or_404(db, paper_id)
    return (
        db.query(Claim)
        .filter(Claim.paper_id == paper_id)
        .order_by(Claim.created_at)
        .all()
    )


@router.post("/", response_model=ClaimResponse, status_code=201)
def create_claim(claim_in: ClaimCreate, db: Session = Depends(get_db)):
    return _create_claim(db, claim_in.paper_id, claim_in)


@router.delete("/{claim_id}", status_code=204)
def delete_claim(claim_id: UUID, db: Session = Depends(get_db)):
    db.delete(_get_claim_or_404(db, claim_id))
    db.commit()


# ── Legacy aliases (same resource, kept so existing callers keep working) ───

@router.get("/{paper_id}/claims", response_model=List[ClaimResponse])
def list_claims_for_paper_legacy(paper_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(Claim)
        .filter(Claim.paper_id == paper_id)
        .order_by(Claim.created_at.desc())
        .all()
    )


@router.post("/{paper_id}/claims", response_model=ClaimResponse, status_code=201)
def create_claim_for_paper_legacy(
    paper_id: UUID,
    claim_in: ClaimCreate,
    db: Session = Depends(get_db),
):
    # The paper id always comes from the path: passing it through the body as
    # well used to raise a duplicate-keyword TypeError.
    return _create_claim(db, paper_id, claim_in)


@router.delete("/claims/{claim_id}", status_code=204, include_in_schema=False)
def delete_claim_legacy(claim_id: UUID, db: Session = Depends(get_db)):
    db.delete(_get_claim_or_404(db, claim_id))
    db.commit()


# ── Annotations / paper shortcuts ───────────────────────────────────────────

@router.get("/{paper_id}/annotations", response_model=List[AnnotationResponse])
def list_annotations_for_paper(paper_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(Annotation)
        .filter(Annotation.paper_id == paper_id)
        .order_by(Annotation.page_number)
        .all()
    )


@router.put("/{paper_id}", response_model=PaperResponse)
def update_paper(paper_id: UUID, patch: PaperUpdate, db: Session = Depends(get_db)):
    paper = _get_paper_or_404(db, paper_id)
    for k, v in patch.model_dump(exclude_unset=True).items():
        setattr(paper, k, v)
    db.commit()
    db.refresh(paper)
    return paper
