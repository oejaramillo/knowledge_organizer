from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from api import (
    meetings, 
    papers, 
    projects, 
    tasks, 
    binnacle, 
    contributors, 
    ideas,
    claims,
    annotations,
    authors
)
from core.database import get_db
from core.config import settings
from core.security import RequireApiTokenMiddleware
from routers import tools, stats, tracker


app = FastAPI(title=settings.PROJECT_TITLE)

# ── AUTHENTICATION (opt-in) ──
# Registered before CORS on purpose: `add_middleware` prepends, so CORS ends up
# outermost and even a 401 response carries the CORS headers.
if settings.API_AUTH_ENABLED:
    if not settings.API_TOKEN:
        raise RuntimeError(
            "API_AUTH_ENABLED is true but API_TOKEN is empty. "
            "Set API_TOKEN (and VITE_API_TOKEN in the frontend) or disable auth."
        )
    app.add_middleware(RequireApiTokenMiddleware, token=settings.API_TOKEN)

# ── CORS CONFIGURATION ──
# Origins come from CORS_ORIGINS in .env ("*" or a comma-separated list) and
# fall back to the local Vite/React dev servers (see core/config.py).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],              # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],              # Allows all headers
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Research Dashboard API"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Checks if the API is running and the database connection to Neon is successful.
    """
    try:
        # Execute a simple query to verify the connection
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "Connected to Neon successfully!"}
    except Exception as e:
        return {"status": "error", "database_error": str(e)}
    
# Include the projects router
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(papers.router)
app.include_router(meetings.router)
app.include_router(binnacle.router)
app.include_router(contributors.router)
app.include_router(ideas.router)
app.include_router(claims.router)
app.include_router(annotations.router)
app.include_router(authors.router)
app.include_router(tools.router)
app.include_router(stats.router)
app.include_router(tracker.router)