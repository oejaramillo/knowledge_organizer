from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import get_db

router = APIRouter(prefix="/api/tracker", tags=["Tracker"])

@router.get("/projects")
def get_tracker_projects(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT
            p.project_id,
            p.name,
            p.status,
            p.description,
            -- latest binnacle entry
            b.entry_date     AS last_entry_date,
            b.title          AS last_entry_title,
            LEFT(b.content, 160) AS last_entry_snippet
        FROM projects p
        LEFT JOIN LATERAL (
            SELECT entry_date, title, content
            FROM project_binnacle
            WHERE project_id = p.project_id
            ORDER BY entry_date DESC
            LIMIT 1
        ) b ON true
        WHERE p.type = 'research'
          AND p.status != 'archived'
        ORDER BY b.entry_date DESC NULLS LAST, p.name ASC
    """)).fetchall()

    return [
        {
            "project_id":          str(r.project_id),
            "name":                r.name,
            "status":              r.status,
            "description":         r.description,
            "last_entry_date":     str(r.last_entry_date)[:10] if r.last_entry_date else None,
            "last_entry_title":    r.last_entry_title,
            "last_entry_snippet":  r.last_entry_snippet,
        }
        for r in rows
    ]