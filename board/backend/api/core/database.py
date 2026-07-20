from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

db_url = settings.DATABASE_URL

# SQLAlchemy requires "postgresql://" instead of the older "postgres://"
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# pool_pre_ping=True checks if the connection is alive before using it (Crucial for Neon serverless DBs)
engine = create_engine(
    db_url, 
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get the DB session in our route endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()