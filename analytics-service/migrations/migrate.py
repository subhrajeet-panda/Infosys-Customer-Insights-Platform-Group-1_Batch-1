import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core.db import execute

def migrate():
    sql_path = Path(__file__).resolve().parent / "001_model_registry.sql"
    sql = sql_path.read_text()
    print("Applying model_registry migration...")
    execute(sql)
    print("Done — model_registry table is ready.")

if __name__ == "__main__":
    migrate()
