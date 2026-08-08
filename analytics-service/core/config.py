import os
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

class Settings:
    PGHOST = os.getenv("PGHOST", "localhost")
    PGPORT = os.getenv("PGPORT", "5432")
    PGUSER = os.getenv("PGUSER", "postgres")
    PGPASSWORD = os.getenv("PGPASSWORD", "")
    PGDATABASE = os.getenv("PGDATABASE", "shopsense")

    JWT_SECRET = os.getenv("JWT_SECRET", "")
    JWT_ALGORITHM = "HS256"                                       

    CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")
    PORT = int(os.getenv("PORT", "8000"))
    PIPELINE_INTERVAL_HOURS = float(os.getenv("PIPELINE_INTERVAL_HOURS", "6"))

settings = Settings()
