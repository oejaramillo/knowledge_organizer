"""Project tracker.

The tracker answers a single question: *what am I working on, and what am I
leaving behind?*

"Work" on a research project is any of three signals, and all three count
equally:

* a **binnacle** entry,
* a **meeting**,
* a **reading** — a paper marked read, or a chapter of a paper still in
  progress (the same definition the reading summary uses).

"Working now" is therefore *derived*, never stored: it is simply the research
project with the most recent work event. The deliberate decision ("I am putting
this aside on purpose") is the project's own ``status`` field, so an intentional
pause is never confused with accidental neglect.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.database import get_db

router = APIRouter(prefix="/api/tracker", tags=["Tracker"])

# How many weeks of history the sparkline covers.
SPARKLINE_WEEKS = 8

# Binnacle entries and meetings are already attached to a project; readings are
# attached through paper_projects (a paper can belong to several projects).
_WORK = """
    SELECT project_id, entry_date::date AS day, 'binnacle' AS kind
    FROM project_binnacle
    WHERE project_id IS NOT NULL

    UNION ALL

    SELECT project_id, meeting_date::date AS day, 'meeting' AS kind
    FROM project_meetings
    WHERE project_id IS NOT NULL

    UNION ALL

    SELECT ppj.project_id, p.date_read::date AS day, 'reading' AS kind
    FROM papers p
    JOIN paper_projects ppj ON ppj.paper_id = p.paper_id
    WHERE p.is_read = true AND p.date_read IS NOT NULL

    UNION ALL

    SELECT ppj.project_id, pt.date_read::date AS day, 'reading' AS kind
    FROM paper_parts pt
    JOIN papers p            ON p.paper_id = pt.paper_id
    JOIN paper_projects ppj  ON ppj.paper_id = p.paper_id
    WHERE p.is_read = false AND pt.is_read = true AND pt.date_read IS NOT NULL
"""

_PROJECTS = f"""
    WITH work AS ({_WORK}),
    research AS (
        SELECT project_id, name, status, description
        FROM projects
        WHERE type = 'research'
          AND status <> 'archived'
    ),
    activity AS (
        SELECT project_id,
               MAX(day)                                              AS last_day,
               MAX(day) FILTER (WHERE kind = 'binnacle')             AS last_binnacle,
               MAX(day) FILTER (WHERE kind = 'meeting')              AS last_meeting,
               MAX(day) FILTER (WHERE kind = 'reading')              AS last_reading,
               COUNT(*) FILTER (WHERE kind = 'binnacle')             AS n_binnacle,
               COUNT(*) FILTER (WHERE kind = 'meeting')              AS n_meetings,
               COUNT(*) FILTER (WHERE kind = 'reading')              AS n_readings,
               COUNT(*) FILTER (WHERE day >= CURRENT_DATE - INTERVAL '7 days')  AS work_7d,
               COUNT(*) FILTER (WHERE day >= CURRENT_DATE - INTERVAL '30 days') AS work_30d
        FROM work
        GROUP BY project_id
    ),
    papers AS (
        SELECT pp.project_id,
               COUNT(DISTINCT p.paper_id)                        AS papers_total,
               COUNT(DISTINCT p.paper_id) FILTER (WHERE p.is_read) AS papers_read
        FROM paper_projects pp
        JOIN papers p ON p.paper_id = pp.paper_id
        GROUP BY pp.project_id
    )
    SELECT r.project_id, r.name, r.status, r.description,
           a.last_day, a.last_binnacle, a.last_meeting, a.last_reading,
           COALESCE(a.n_binnacle, 0)  AS n_binnacle,
           COALESCE(a.n_meetings, 0)  AS n_meetings,
           COALESCE(a.n_readings, 0)  AS n_readings,
           COALESCE(a.work_7d, 0)     AS work_7d,
           COALESCE(a.work_30d, 0)    AS work_30d,
           COALESCE(pp.papers_total, 0) AS papers_total,
           COALESCE(pp.papers_read, 0)  AS papers_read,
           (SELECT b.title FROM project_binnacle b
             WHERE b.project_id = r.project_id
             ORDER BY b.entry_date DESC LIMIT 1)         AS last_note_title,
           (SELECT LEFT(b.content, 200) FROM project_binnacle b
             WHERE b.project_id = r.project_id
             ORDER BY b.entry_date DESC LIMIT 1)         AS last_note_snippet
    FROM research r
    LEFT JOIN activity a ON a.project_id = r.project_id
    LEFT JOIN papers   pp ON pp.project_id = r.project_id
    ORDER BY a.last_day DESC NULLS LAST, r.name ASC
"""

_SPARKLINE = f"""
    WITH work AS ({_WORK}),
    weeks AS (
        SELECT generate_series(
            date_trunc('week', CURRENT_DATE) - INTERVAL '{SPARKLINE_WEEKS - 1} weeks',
            date_trunc('week', CURRENT_DATE),
            INTERVAL '1 week'
        )::date AS week
    )
    SELECT w.project_id, wk.week, COUNT(work.day) AS count
    FROM weeks wk
    CROSS JOIN (SELECT DISTINCT project_id FROM work) w
    LEFT JOIN work
           ON work.project_id = w.project_id
          AND date_trunc('week', work.day)::date = wk.week
    GROUP BY w.project_id, wk.week
    ORDER BY w.project_id, wk.week
"""


def _activity_kind(last_binnacle, last_meeting, last_reading):
    """Which of the three signals happened most recently."""
    dated = [
        (last_binnacle, "binnacle"),
        (last_meeting, "meeting"),
        (last_reading, "reading"),
    ]
    dated = [(d, k) for d, k in dated if d is not None]
    if not dated:
        return None
    return max(dated, key=lambda pair: pair[0])[1]


@router.get("/projects")
def get_tracker_projects(db: Session = Depends(get_db)):
    rows = db.execute(text(_PROJECTS)).fetchall()

    sparkline: dict = {}
    for r in db.execute(text(_SPARKLINE)).fetchall():
        sparkline.setdefault(str(r.project_id), []).append(
            {"week": r.week.isoformat(), "count": int(r.count)}
        )

    today: date = db.execute(text("SELECT CURRENT_DATE AS today")).fetchone().today

    projects = []
    for r in rows:
        last_day = r.last_day
        projects.append({
            "project_id":       str(r.project_id),
            "name":             r.name,
            "status":           r.status,
            "description":      r.description,
            "last_activity":    last_day.isoformat() if last_day else None,
            "last_activity_kind": _activity_kind(r.last_binnacle, r.last_meeting, r.last_reading),
            "days_since":       (today - last_day).days if last_day else None,
            "last_binnacle":    r.last_binnacle.isoformat() if r.last_binnacle else None,
            "last_meeting":     r.last_meeting.isoformat() if r.last_meeting else None,
            "last_reading":     r.last_reading.isoformat() if r.last_reading else None,
            "counts": {
                "binnacle": r.n_binnacle,
                "meetings": r.n_meetings,
                "readings": r.n_readings,
            },
            "work_7d":      r.work_7d,
            "work_30d":     r.work_30d,
            "papers_total": r.papers_total,
            "papers_read":  r.papers_read,
            "last_note_title":   r.last_note_title,
            "last_note_snippet": r.last_note_snippet,
            "weekly":       sparkline.get(str(r.project_id), []),
        })

    return projects
