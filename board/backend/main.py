# ============================================================================
# RESEARCH BOARD - FASTAPI BACKEND APPLICATION
# ============================================================================
# This is the main FastAPI application that provides the REST API for the
# Research Knowledge Management System's web dashboard. It serves as the
# backend for the React frontend, providing endpoints for managing papers,
# projects, tasks, meetings, and all other research entities.
#
# KEY FEATURES:
# 1. RESTful API endpoints for all research entities
# 2. CORS middleware for frontend communication
# 3. Database health monitoring
# 4. Modular router organization
# 5. Automatic API documentation via FastAPI
#
# ARCHITECTURE:
# - main.py: Application setup and routing
# - api/: Individual entity endpoints (papers, projects, etc.)
# - core/: Database and configuration management
# - models/: SQLAlchemy ORM models
# - schemas/: Pydantic request/response models
# ============================================================================

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

# Import API routers for each research entity
from api import (
    meetings,     # Project meeting management
    papers,       # Paper and bibliography management  
    projects,     # Research project organization
    tasks,        # Task tracking and assignment
    binnacle,     # Research activity logging
    contributors, # Team member management
    ideas,        # Research idea tracking
    claims,       # Extracted research claims
    annotations,  # Paper annotations and highlights
    authors       # Author information management
)

# Import core application components
from core.database import get_db
from core.config import settings

# Import additional tools and utilities
from routers import tools

# ── APPLICATION INITIALIZATION ─────────────────────────────────────────────
# Create FastAPI application instance with project metadata
app = FastAPI(title=settings.PROJECT_TITLE)

# ── CORS MIDDLEWARE CONFIGURATION ──────────────────────────────────────────
# Cross-Origin Resource Sharing setup for frontend communication
# This allows the React frontend to communicate with the API from different ports

# Define allowed origins for CORS requests
# These represent the typical development ports for frontend applications
origins = [
    "http://localhost:5173",  # Vite default development port
    "http://127.0.0.1:5173",  # Alternative localhost format
    "http://localhost:3000",  # Create React App default port
]

# Add CORS middleware with permissive development settings
# Due that the app is fully local, we can keep it loose
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            # List of allowed origins
    allow_credentials=True,           # Allow cookies and auth headers
    allow_methods=["*"],              # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],              # Allow all headers
)

# ── ROOT ENDPOINT ───────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    """
    Root endpoint providing basic API information.
    
    Simple health check and welcome message for API consumers.
    Useful for verifying the API is running and accessible.
    
    Returns:
        dict: Welcome message with API identification
    """
    return {"message": "Welcome to the Research Dashboard API"}

# ── HEALTH CHECK ENDPOINT ──────────────────────────────────────────────────
@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Database connectivity health check endpoint.
    
    This endpoint verifies both that the API is running and that the
    database connection to PostgreSQL (hosted on Neon) is functional.
    Essential for monitoring and deployment verification.
    
    Args:
        db (Session): Database session injected by FastAPI
        
    Returns:
        dict: Health status with database connectivity information
        
    Note:
        Executes a simple SELECT 1 query to verify database connectivity
        without affecting application data.
    """
    try:
        # Execute minimal query to test database connectivity
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "Connected to Neon successfully!"}
    except Exception as e:
        return {"status": "error", "database_error": str(e)}

# ── API ROUTER REGISTRATION ────────────────────────────────────────────────
# Register all entity-specific API routers with the main application
# Each router handles CRUD operations for a specific research entity

# Core research management entities
app.include_router(projects.router)      # Project organization and hierarchy
app.include_router(tasks.router)         # Task management and assignment
app.include_router(meetings.router)      # Meeting scheduling and notes

# Bibliography and knowledge management
app.include_router(papers.router)        # Paper metadata and content
app.include_router(claims.router)        # AI-extracted research claims
app.include_router(annotations.router)   # Paper highlights and notes
app.include_router(authors.router)       # Author information and profiles

# Team and activity management
app.include_router(contributors.router)  # Team member management
app.include_router(binnacle.router)      # Research activity logging
app.include_router(ideas.router)         # Research idea tracking

# Utility and tool endpoints
app.include_router(tools.router)         # Additional tools and utilities