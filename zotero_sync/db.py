import os
from psycopg import connect
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    """Returns a connection to the Neon database."""
    return connect(os.getenv("DATABASE_URL"), row_factory=dict_row)