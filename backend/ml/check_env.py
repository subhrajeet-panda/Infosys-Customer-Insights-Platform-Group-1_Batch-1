import sys

print(f"Using interpreter: {sys.executable}\n")

print("1. Checking required packages...")
required = ["pandas", "numpy", "sklearn", "psycopg2", "dotenv"]
missing = []
for mod in required:
    try:
        __import__(mod)
        print(f"   OK  {mod}")
    except ImportError as e:
        print(f"   MISSING  {mod}  ({e})")
        missing.append(mod)

if missing:
    print(f"\nFAILED: missing packages: {', '.join(missing)}")
    print("Fix: pip install -r requirements.txt   (using THIS interpreter)")
    sys.exit(1)

print("\n2. Checking backend/.env is found...")
from pathlib import Path
from dotenv import load_dotenv
import os

env_path = Path(__file__).resolve().parent.parent / ".env"
if not env_path.exists():
    print(f"   MISSING  {env_path}")
    print("Fix: cp backend/.env.example backend/.env and fill in your DB credentials.")
    sys.exit(1)
load_dotenv(env_path)
print(f"   OK  found {env_path}")

for key in ["PGHOST", "PGPORT", "PGUSER", "PGDATABASE"]:
    val = os.getenv(key)
    print(f"   {key} = {val!r}")
    if not val:
        print(f"\nFAILED: {key} is not set in backend/.env")
        sys.exit(1)

print("\n3. Checking live Postgres connection...")
try:
    from db import get_connection
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT 1")
    print("   OK  connected")
except Exception as e:
    print(f"   FAILED  {e}")
    sys.exit(1)

print("\n4. Checking expected tables exist...")
expected_tables = ["users", "vendors", "products", "orders", "order_items", "ml_results", "customer_events"]
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
existing = {row[0] for row in cur.fetchall()}
for t in expected_tables:
    status = "OK" if t in existing else "MISSING"
    print(f"   {status}  {t}")
    if t not in existing:
        print(f"\nFAILED: table '{t}' not found. Fix: cd backend && npm run migrate && npm run seed")
        sys.exit(1)

cur.execute("SELECT COUNT(*) FROM orders")
order_count = cur.fetchone()[0]
print(f"\n   orders in DB: {order_count}")
if order_count == 0:
    print("   WARNING: no orders yet — models will run but have nothing to learn from. Run: npm run seed")

conn.close()
print("\nAll checks passed. This interpreter is correctly set up.")
print(f"If the app still errors, set PYTHON_BIN in backend/.env to exactly: {sys.executable}")
