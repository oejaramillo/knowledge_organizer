from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from api import meetings, papers, projects, tasks, binnacle
from core.database import get_db
from core.config import settings

#from api.projects import projects
#from api.tasks import tasks
#from api.papers import papers
#from api.meetings import meetings
#from api.binnacle import binnacle

app = FastAPI(title=settings.PROJECT_TITLE)

# Set up CORS so the React frontend (running on port 5173 usually) can communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, change this to your actual frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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