# ============================================================================
# DATABASE SCHEMA INITIALIZATION SCRIPT
# ============================================================================
# This is the main database initialization script for the Research Knowledge 
# Management System. It reads and executes the PostgreSQL schema file to
# set up all required tables, indexes, views, and constraints, in production
# it uses NEON database, it might be outdated due to ALTER TABLE runs in NEON.
# 
# Usage:
#   python app.py
#
# Prerequisites:
#   - PostgreSQL database with required extensions (uuid-ossp, vector, pg_trgm)
#   - DATABASE_URL environment variable set in .env file
# ============================================================================

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables from .env file
# This must be called before accessing os.getenv() to ensure variables are loaded
load_dotenv()

# Get database connection string from environment
DATABASE_URL = os.getenv("DATABASE_URL")

# Create SQLAlchemy engine for database operations
engine = create_engine(DATABASE_URL, echo=False)

def init_db(schema_path: str = "schema_v2.sql"):
    """
    Initialize the database by executing the complete schema SQL file.
    
    This function:
    1. Reads the entire schema SQL file containing table definitions, 
       indexes, views, and constraints
    2. Executes it as a single transaction against the database
    3. Creates all required tables for the research management system
    
    Args:
        schema_path (str): Path to the SQL schema file. Defaults to "schema_v2.sql"
    
    Raises:
        FileNotFoundError: If the schema file doesn't exist
        SQLAlchemyError: If database connection or SQL execution fails
    """
    with open(schema_path, "r") as f:
        sql = f.read()
    
    # Execute the schema within a single connection to ensure transaction consistency
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()
    
    print("Schema initialized.")

# Main execution block - runs when script is executed directly
if __name__ == "__main__":
    init_db()