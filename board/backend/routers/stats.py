from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import get_db

router = APIRouter(prefix="/api/stats", tags=["Stats"])

@router.get("/")
def get_reading_stats(db: Session = Depends(get_db)):
    totals = db.execute(text("""
        SELECT
            COUNT(*)                                  AS total_papers,
            COUNT(*) FILTER (WHERE is_read = true)    AS total_read
        FROM papers
    """)).fetchone()

    time_stats = db.execute(text("""
        SELECT
            COUNT(*) FILTER (
                WHERE is_read = true
                AND date_read >= date_trunc('month', CURRENT_TIMESTAMP)
            ) AS month_read,
            COUNT(*) FILTER (
                WHERE is_read = true
                AND date_read >= date_trunc('year', CURRENT_TIMESTAMP)
            ) AS year_read
        FROM papers
    """)).fetchone()

    last_read = db.execute(text("""
        SELECT title, year, document_type, date_read
        FROM papers
        WHERE is_read = true
          AND date_read IS NOT NULL
        ORDER BY date_read DESC
        LIMIT 8
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
            TRIM(CONCAT(a.first_name, ' ', a.last_name)) AS name,
            COUNT(DISTINCT pa.paper_id)                  AS count
        FROM authors a
        JOIN paper_authors pa ON a.author_id = pa.author_id
        JOIN papers p          ON pa.paper_id = p.paper_id
        WHERE p.is_read = true
        GROUP BY a.author_id, a.first_name, a.last_name
        ORDER BY count DESC
        LIMIT 10
    """)).fetchall()

    monthly_trend = db.execute(text("""
        SELECT
            TO_CHAR(date_trunc('month', date_read), 'Mon YY') AS month,
            date_trunc('month', date_read)                    AS month_ts,
            COUNT(*)                                          AS count
        FROM papers
        WHERE is_read = true
          AND date_read IS NOT NULL
          AND date_read >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY date_trunc('month', date_read)
        ORDER BY month_ts
    """)).fetchall()

    by_type_month = db.execute(text("""
        SELECT document_type, COUNT(*) AS read_count
        FROM papers
        WHERE is_read = true
          AND date_read >= date_trunc('month', CURRENT_DATE)
        GROUP BY document_type
        ORDER BY read_count DESC
    """)).fetchall()

    by_type_last_month = db.execute(text("""
        SELECT document_type, COUNT(*) AS read_count
        FROM papers
        WHERE is_read = true
          AND date_read >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
          AND date_read <  date_trunc('month', CURRENT_DATE)
        GROUP BY document_type
        ORDER BY read_count DESC
    """)).fetchall()

    by_type_year = db.execute(text("""
        SELECT document_type, COUNT(*) AS read_count
        FROM papers
        WHERE is_read = true
          AND date_read >= date_trunc('year', CURRENT_DATE)
        GROUP BY document_type
        ORDER BY read_count DESC
    """)).fetchall()

    return {
        "total_papers":  totals.total_papers,
        "total_read":    totals.total_read,
        "month_read":    time_stats.month_read,
        "year_read":     time_stats.year_read,
        "last_read": [
            {
                "title":         r.title,
                "year":          r.year,
                "document_type": r.document_type,
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
        "top_authors": [
            {"name": r.name, "count": r.count}
            for r in top_authors
        ],
        "monthly_trend": [
            {"month": r.month, "count": r.count}
            for r in monthly_trend
        ],

        "by_type_month": [
            {"document_type": r.document_type or "unknown", "read_count": r.read_count}
            for r in by_type_month
        ],
        "by_type_last_month": [
            {"document_type": r.document_type or "unknown", "read_count": r.read_count}
            for r in by_type_last_month
        ],
        "by_type_year": [
            {"document_type": r.document_type or "unknown", "read_count": r.read_count}
            for r in by_type_year
        ],
    }