import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
# Example: postgresql://user:password@localhost:5432/research_db

engine = create_engine(DATABASE_URL, echo=False)

def init_db(schema_path: str = "schema_v2.sql"):
    """Run the schema SQL file against the database."""
    with open(schema_path, "r") as f:
        sql = f.read()
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()
    print("Schema initialized.")

if __name__ == "__main__":
    init_db()