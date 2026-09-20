from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID

from core.database import get_db
from models.core import Author
from schemas.core import AuthorDetail, AuthorUpdate

router = APIRouter(prefix="/api/authors", tags=["Authors"])


def _get_author_or_404(db: Session, author_id: UUID) -> Author:
    author = (
        db.query(Author)
        .options(joinedload(Author.papers))
        .filter(Author.author_id == author_id)
        .first()
    )
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    return author


def _author_payload(author: Author) -> dict:
    """Build the AuthorDetail payload, newest papers first.

    Returning the mapped columns explicitly keeps SQLAlchemy's internal
    ``_sa_instance_state`` out of the response.
    """
    payload = {k: v for k, v in vars(author).items() if not k.startswith("_")}
    payload["papers"] = sorted(author.papers, key=lambda p: p.year or 0, reverse=True)
    return payload


@router.get("/countries", response_model=List[str])
def get_countries(db: Session = Depends(get_db)):
    rows = db.query(Author.country).filter(Author.country.isnot(None)).distinct().all()
    return sorted([r[0] for r in rows if r[0]])


@router.get("/{author_id}", response_model=AuthorDetail)
def get_author(author_id: UUID, db: Session = Depends(get_db)):
    return _author_payload(_get_author_or_404(db, author_id))


@router.patch("/{author_id}", response_model=AuthorDetail)
def update_author(author_id: UUID, data: AuthorUpdate, db: Session = Depends(get_db)):
    author = _get_author_or_404(db, author_id)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(author, field, value)

    db.commit()
    db.refresh(author)
    return _author_payload(author)
