from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from core.database import get_db
from models.core import Contributor
from schemas.core import ContributorCreate, ContributorResponse

router = APIRouter(
    prefix="/api/contributors",
    tags=["Contributors"]
)


@router.get("/", response_model=List[ContributorResponse])
def get_contributors(db: Session = Depends(get_db)):
    return (
        db.query(Contributor)
        .order_by(Contributor.name)
        .all()
    )


@router.get("/{contributor_id}", response_model=ContributorResponse)
def get_contributor(contributor_id: UUID, db: Session = Depends(get_db)):
    contributor = (
        db.query(Contributor)
        .filter(Contributor.contributor_id == contributor_id)
        .first()
    )

    if not contributor:
        raise HTTPException(
            status_code=404,
            detail="Contributor not found"
        )

    return contributor


@router.post("/", response_model=ContributorResponse, status_code=201)
def create_contributor(
    contributor_in: ContributorCreate,
    db: Session = Depends(get_db),
):
    contributor = Contributor(**contributor_in.model_dump())

    db.add(contributor)
    db.commit()
    db.refresh(contributor)

    return contributor


@router.delete("/{contributor_id}", status_code=204)
def delete_contributor(
    contributor_id: UUID,
    db: Session = Depends(get_db),
):
    contributor = (
        db.query(Contributor)
        .filter(Contributor.contributor_id == contributor_id)
        .first()
    )

    if not contributor:
        raise HTTPException(
            status_code=404,
            detail="Contributor not found"
        )

    db.delete(contributor)
    db.commit()