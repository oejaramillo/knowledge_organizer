from psycopg import connect
import os
from dotenv import load_dotenv

load_dotenv()

def get_db():
    return connect(os.getenv("DATABASE_URL"))