from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID

from core.database import get_db
from models.core import Author, Paper
from schemas.core import AuthorDetail, AuthorUpdate

router = APIRouter(prefix="/api/authors", tags=["Authors"])


from schemas.core import AuthorDetail, AuthorUpdate, PaperResponse

@router.get("/{author_id}", response_model=AuthorDetail)
def get_author(author_id: UUID, db: Session = Depends(get_db)):
    author = (
        db.query(Author)
        .options(joinedload(Author.papers))
        .filter(Author.author_id == author_id)
        .first()
    )
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")

    papers = sorted(author.papers, key=lambda p: p.year or 0, reverse=True)

    return {**author.__dict__, "papers": papers}  # ← pass full ORM objects, Pydantic serializes them


@router.patch("/{author_id}", response_model=AuthorDetail)
def update_author(author_id: UUID, data: AuthorUpdate, db: Session = Depends(get_db)):
    author = db.query(Author).filter(Author.author_id == author_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(author, field, value)

    db.commit()
    db.refresh(author)
    return get_author(author_id, db)