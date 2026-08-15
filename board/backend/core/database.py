# ============================================================================
# DATABASE CONFIGURATION AND SESSION MANAGEMENT
# ============================================================================
# This module configures SQLAlchemy for PostgreSQL database connectivity
# and provides dependency injection for database sessions in FastAPI endpoints.
# It handles connection pooling, URL normalization, and session lifecycle.
#
# KEY COMPONENTS:
# 1. Database URL configuration and normalization
# 2. SQLAlchemy engine with connection pooling
# 3. Session factory for database transactions
# 4. Dependency injection for FastAPI routes
# 5. Base class for ORM model definitions
# ============================================================================

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

# Get database URL from settings configuration
db_url = settings.DATABASE_URL

# ── DATABASE URL NORMALIZATION ─────────────────────────────────────────────
# PostgreSQL URL scheme normalization for SQLAlchemy compatibility

if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# ── ENGINE CONFIGURATION ───────────────────────────────────────────────────
# SQLAlchemy engine with optimized settings for serverless databases

engine = create_engine(
    db_url, 
    # Connection health check before use - critical for serverless DBs like Neon that we use
    # that may drop idle connections
    pool_pre_ping=True,
    
    # Connection pool sizing for concurrent request handling
    pool_size=5,        # Base number of connections to maintain
    max_overflow=10     # Additional connections under high load
)

# ── SESSION FACTORY ────────────────────────────────────────────────────────
# Session factory for database operations with transaction management

SessionLocal = sessionmaker(
    autocommit=False,   # Explicit transaction control
    autoflush=False,    # Manual flush control for better performance
    bind=engine         # Bind to configured engine
)

# ── ORM BASE CLASS ─────────────────────────────────────────────────────────
# Base class for all SQLAlchemy ORM models
# Provides common functionality like table creation and metadata management

Base = declarative_base()

# ── DEPENDENCY INJECTION ───────────────────────────────────────────────────
def get_db():
    """
    Database session dependency for FastAPI route handlers.
    
    This function provides database sessions to API endpoints through
    FastAPI's dependency injection system. It ensures proper session
    lifecycle management with automatic cleanup.
    
    The session is created for each request and automatically closed
    when the request completes, ensuring no connection leaks.
    
    Usage in FastAPI routes:
        @router.get("/papers")
        def get_papers(db: Session = Depends(get_db)):
            return db.query(Paper).all()
    
    Yields:
        Session: SQLAlchemy database session
        
    Note:
        The try/finally pattern ensures session cleanup even if
        exceptions occur during request processing.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()