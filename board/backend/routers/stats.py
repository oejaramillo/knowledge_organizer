"""Reading analytics for the summary page.

Everything the dashboard needs to answer "what am I reading, how much, and how
is it trending" is computed here in a handful of aggregate queries.

Reading activity has two sources, and they must not double-count:

* a paper that is fully read contributes its own ``pages_read`` / ``date_read``;
* a paper that is *not* fully read contributes the pages/dates of its **parts**
  (chapters), never the paper row itself.

That rule lives once in ``_READ_EVENTS`` and is reused by the totals, the monthly
series, the heatmap and the streaks, so every panel agrees with every other.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.database import get_db

router = APIRouter(prefix="/api/stats", tags=["Stats"])

# Heatmap window: 26 complete weeks, starting on a Monday so the grid aligns.
HEATMAP_WEEKS = 26

_READ_EVENTS = """
    SELECT p.paper_id,
           p.date_read::date          AS day,
           1                          AS papers,
           COALESCE(p.pages_read, 0)  AS pages
    FROM papers p
    WHERE p.is_read = true
      AND p.date_read IS NOT NULL

    UNION ALL

    SELECT pp.paper_id,
           pp.date_read::date         AS day,
           0                          AS papers,
           COALESCE(pp.pages_read, 0) AS pages
    FROM paper_parts pp
    JOIN papers p ON p.paper_id = pp.paper_id
    WHERE p.is_read = false
      AND pp.is_read = true
      AND pp.date_read IS NOT NULL
"""

_ACTIVITY_BY_DAY = f"""
    WITH events AS ({_READ_EVENTS}),
    papers_read AS (SELECT day, SUM(papers) AS papers FROM events GROUP BY day),
    pages_read  AS (SELECT day, SUM(pages)  AS pages  FROM events GROUP BY day),
    calendar AS (
        SELECT generate_series(
            date_trunc('week', CURRENT_DATE) - INTERVAL '{HEATMAP_WEEKS - 1} weeks',
            date_trunc('week', CURRENT_DATE) + INTERVAL '6 days',
            INTERVAL '1 day'
        )::date AS day
    )
    SELECT c.day,
           COALESCE(pr.papers, 0) AS papers,
           COALESCE(pg.pages, 0)  AS pages
    FROM calendar c
    LEFT JOIN papers_read pr ON pr.day = c.day
    LEFT JOIN pages_read  pg ON pg.day = c.day
    ORDER BY c.day
"""

_ACTIVE_DAYS = f"""
    WITH events AS ({_READ_EVENTS})
    SELECT DISTINCT day FROM events WHERE pages > 0 OR papers > 0 ORDER BY day
"""

_PAGES_BY_MONTH = f"""
    WITH events AS ({_READ_EVENTS}),
    months AS (
        SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
            date_trunc('month', CURRENT_DATE),
            INTERVAL '1 month'
        ) AS month
    ),
    totals AS (
        SELECT date_trunc('month', day) AS month, SUM(pages) AS pages
        FROM events WHERE pages > 0 GROUP BY 1
    )
    SELECT TO_CHAR(m.month, 'Mon YY') AS month,
           m.month                    AS month_ts,
           COALESCE(t.pages, 0)       AS pages
    FROM months m
    LEFT JOIN totals t ON t.month = m.month
    ORDER BY m.month
"""

_PAPERS_BY_MONTH = """
    WITH months AS (
        SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
            date_trunc('month', CURRENT_DATE),
            INTERVAL '1 month'
        ) AS month
    ),
    totals AS (
        SELECT date_trunc('month', date_read) AS month, COUNT(*) AS count
        FROM papers
        WHERE is_read = true AND date_read IS NOT NULL
        GROUP BY 1
    )
    SELECT TO_CHAR(m.month, 'Mon YY') AS month,
           m.month                    AS month_ts,
           COALESCE(t.count, 0)       AS count
    FROM months m
    LEFT JOIN totals t ON t.month = m.month
    ORDER BY m.month
"""

_CURRENTLY_READING = """
    SELECT p.paper_id,
           p.title,
           p.year,
           p.document_type,
           COALESCE(p.pages_read, 0)                                 AS pages_read,
           COUNT(pp.part_id)                                         AS total_parts,
           COUNT(pp.part_id) FILTER (WHERE pp.is_read)               AS parts_read,
           SUM(COALESCE(pp.pages_read, 0)) FILTER (WHERE pp.is_read) AS part_pages,
           MAX(pp.date_read) FILTER (WHERE pp.is_read)               AS last_activity,
           (SELECT STRING_AGG(pr.name, ', ' ORDER BY pr.name)
              FROM paper_projects ppj
              JOIN projects pr ON pr.project_id = ppj.project_id
             WHERE ppj.paper_id = p.paper_id)                        AS projects
    FROM papers p
    JOIN paper_parts pp ON pp.paper_id = p.paper_id
    WHERE p.is_read = false
    GROUP BY p.paper_id, p.title, p.year, p.document_type, p.pages_read
    HAVING COUNT(pp.part_id) FILTER (WHERE pp.is_read) > 0
    ORDER BY MAX(pp.date_read) FILTER (WHERE pp.is_read) DESC NULLS LAST
    LIMIT 8
"""

_PROJECT_ACTIVITY = """
    SELECT pr.name,
           COUNT(DISTINCT p.paper_id)                              AS total_papers,
           COUNT(DISTINCT p.paper_id) FILTER (WHERE p.is_read)     AS read_papers,
           COALESCE(SUM(p.pages_read) FILTER (WHERE p.is_read), 0) AS pages_read
    FROM projects pr
    JOIN paper_projects pp ON pp.project_id = pr.project_id
    JOIN papers p          ON p.paper_id = pp.paper_id
    GROUP BY pr.project_id, pr.name
    HAVING COUNT(DISTINCT p.paper_id) > 0
    ORDER BY read_papers DESC, total_papers DESC
    LIMIT 8
"""


def _compute_streaks(active_days: list[date], today: date) -> dict:
    """Current and longest run of consecutive days with reading activity."""
    days = sorted(set(active_days))
    if not days:
        return {"current": 0, "longest": 0, "active_days": 0}

    longest = 1
    run = 1
    for previous, current in zip(days, days[1:]):
        run = run + 1 if (current - previous).days == 1 else 1
        longest = max(longest, run)

    # A streak only breaks once a whole day has passed, so an empty "today"
    # still allows the run to continue from yesterday.
    day_set = set(days)
    if days[-1] == today:
        cursor = today
    elif days[-1] == today - timedelta(days=1):
        cursor = today - timedelta(days=1)
    else:
        return {"current": 0, "longest": longest, "active_days": len(days)}

    current = 0
    while cursor in day_set:
        current += 1
        cursor -= timedelta(days=1)

    return {"current": current, "longest": longest, "active_days": len(days)}


def _by_type_period(db: Session, sql: str) -> list[dict]:
    rows = db.execute(text(sql)).fetchall()
    return [
        {"document_type": r.document_type or "unknown", "read_count": r.read_count}
        for r in rows
    ]


@router.get("/")
def get_reading_stats(db: Session = Depends(get_db)):
    totals = db.execute(text("""
        SELECT
            COUNT(*)                                  AS total_papers,
            COUNT(*) FILTER (WHERE is_read = true)    AS total_read
        FROM papers
    """)).fetchone()

    pages_totals = db.execute(text(f"""
        WITH events AS ({_READ_EVENTS})
        SELECT
            COALESCE(SUM(pages), 0)                                        AS total_pages,
            COALESCE(SUM(pages) FILTER (
                WHERE day >= date_trunc('month', CURRENT_DATE)
            ), 0)                                                           AS pages_this_month,
            COALESCE(SUM(pages) FILTER (
                WHERE day >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
                  AND day <  date_trunc('month', CURRENT_DATE)
            ), 0)                                                           AS pages_last_month,
            COALESCE(SUM(pages) FILTER (
                WHERE day >= date_trunc('year', CURRENT_DATE)
            ), 0)                                                           AS pages_this_year
        FROM events
    """)).fetchone()

    time_stats = db.execute(text("""
        SELECT
            COUNT(*) FILTER (
                WHERE is_read = true
                AND date_read >= date_trunc('month', CURRENT_TIMESTAMP)
            ) AS month_read,
            COUNT(*) FILTER (
                WHERE is_read = true
                AND date_read >= date_trunc('month', CURRENT_TIMESTAMP) - INTERVAL '1 month'
                AND date_read <  date_trunc('month', CURRENT_TIMESTAMP)
            ) AS last_month_read,
            COUNT(*) FILTER (
                WHERE is_read = true
                AND date_read >= date_trunc('year', CURRENT_TIMESTAMP)
            ) AS year_read
        FROM papers
    """)).fetchone()

    backlog = db.execute(text("""
        SELECT COUNT(*) AS unread FROM papers WHERE is_read = false
    """)).fetchone()

    last_read = db.execute(text("""
        SELECT p.paper_id, p.title, p.year, p.document_type, p.date_read,
               (SELECT STRING_AGG(pr.name, ', ' ORDER BY pr.name)
                  FROM paper_projects pp
                  JOIN projects pr ON pr.project_id = pp.project_id
                 WHERE pp.paper_id = p.paper_id) AS projects
        FROM papers p
        WHERE p.is_read = true
          AND p.date_read IS NOT NULL
        ORDER BY p.date_read DESC
        LIMIT 10
    """)).fetchall()

    by_type = db.execute(text("""
        SELECT document_type,
               COUNT(*) FILTER (WHERE is_read = true)  AS read_count,
               COUNT(*)                                AS total_count
        FROM papers
        GROUP BY document_type
        ORDER BY total_count DESC
    """)).fetchall()

    top_authors = db.execute(text("""
        SELECT
            COALESCE(
                NULLIF(TRIM(CONCAT(a.first_name, ' ', a.last_name)), ''),
                a.full_name
            )                                                    AS name,
            COUNT(DISTINCT pa.paper_id)                          AS count,
            COUNT(DISTINCT pa.paper_id) FILTER (WHERE p.is_read) AS read_count
        FROM authors a
        JOIN paper_authors pa ON a.author_id = pa.author_id
        JOIN papers p          ON pa.paper_id = p.paper_id
        GROUP BY a.author_id, a.first_name, a.last_name, a.full_name
        ORDER BY read_count DESC, count DESC
        LIMIT 10
    """)).fetchall()

    monthly_trend    = db.execute(text(_PAPERS_BY_MONTH)).fetchall()
    monthly_pages    = db.execute(text(_PAGES_BY_MONTH)).fetchall()
    daily_activity   = db.execute(text(_ACTIVITY_BY_DAY)).fetchall()
    active_days      = [r.day for r in db.execute(text(_ACTIVE_DAYS)).fetchall()]
    currently_reading = db.execute(text(_CURRENTLY_READING)).fetchall()
    project_activity = db.execute(text(_PROJECT_ACTIVITY)).fetchall()
    today            = db.execute(text("SELECT CURRENT_DATE AS today")).fetchone().today

    return {
        # ── headline ────────────────────────────────────────────────────────
        "total_papers":     totals.total_papers,
        "total_read":       totals.total_read,
        "month_read":       time_stats.month_read,
        "last_month_read":  time_stats.last_month_read,
        "year_read":        time_stats.year_read,
        "backlog_unread":   backlog.unread,
        "today":            today.isoformat(),

        # ── pages ───────────────────────────────────────────────────────────
        "pages_total":      int(pages_totals.total_pages),
        "pages_this_month": int(pages_totals.pages_this_month),
        "pages_last_month": int(pages_totals.pages_last_month),
        "pages_this_year":  int(pages_totals.pages_this_year),

        # ── trends ──────────────────────────────────────────────────────────
        "monthly_trend": [
            {"month": r.month, "count": r.count} for r in monthly_trend
        ],
        "monthly_pages": [
            {"month": r.month, "pages": int(r.pages)} for r in monthly_pages
        ],
        "daily_activity": [
            {"date": r.day.isoformat(), "papers": int(r.papers), "pages": int(r.pages)}
            for r in daily_activity
        ],
        "streak": _compute_streaks(active_days, today),

        # ── what is happening right now ─────────────────────────────────────
        "currently_reading": [
            {
                "paper_id":      str(r.paper_id),
                "title":         r.title,
                "year":          r.year,
                "document_type": r.document_type,
                "projects":      r.projects,
                "pages_read":    int(r.pages_read or 0),
                "part_pages":    int(r.part_pages or 0),
                "total_parts":   int(r.total_parts or 0),
                "parts_read":    int(r.parts_read or 0),
                "last_activity": str(r.last_activity)[:10] if r.last_activity else None,
            }
            for r in currently_reading
        ],

        # ── where the reading happens ───────────────────────────────────────
        "projects": [
            {
                "name":         r.name,
                "total_papers": int(r.total_papers),
                "read_papers":  int(r.read_papers),
                "pages_read":   int(r.pages_read or 0),
            }
            for r in project_activity
        ],

        # ── library breakdown ───────────────────────────────────────────────
        "last_read": [
            {
                "paper_id":      str(r.paper_id),
                "title":         r.title,
                "year":          r.year,
                "document_type": r.document_type,
                "projects":      r.projects,
                "date_read":     str(r.date_read)[:10] if r.date_read else None,
            }
            for r in last_read
        ],
        "by_type": [
            {
                "document_type": r.document_type or "unknown",
                "read_count":    r.read_count,
                "total_count":   r.total_count,
            }
            for r in by_type
        ],
        "by_type_month": _by_type_period(db, """
            SELECT document_type, COUNT(*) AS read_count
            FROM papers
            WHERE is_read = true
              AND date_read >= date_trunc('month', CURRENT_DATE)
            GROUP BY document_type
            ORDER BY read_count DESC
        """),
        "by_type_last_month": _by_type_period(db, """
            SELECT document_type, COUNT(*) AS read_count
            FROM papers
            WHERE is_read = true
              AND date_read >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
              AND date_read <  date_trunc('month', CURRENT_DATE)
            GROUP BY document_type
            ORDER BY read_count DESC
        """),
        "by_type_year": _by_type_period(db, """
            SELECT document_type, COUNT(*) AS read_count
            FROM papers
            WHERE is_read = true
              AND date_read >= date_trunc('year', CURRENT_DATE)
            GROUP BY document_type
            ORDER BY read_count DESC
        """),
        "top_authors": [
            {"name": r.name, "count": r.count, "read_count": r.read_count}
            for r in top_authors
        ],
    }
