#!/bin/sh
set -e

echo "⏳ Waiting for Postgres to be ready..."
RETRIES=0
until python3 -c "
import psycopg2, os, sys, ssl

host = os.environ['PGHOST']
port = int(os.environ.get('PGPORT', 5432))
user = os.environ['PGUSER']
password = os.environ['PGPASSWORD']
dbname = os.environ['PGDATABASE']
is_prod = os.environ.get('NODE_ENV', '') == 'production' or 'render.com' in host

try:
    if is_prod:
        conn = psycopg2.connect(
            host=host, port=port, user=user,
            password=password, dbname=dbname,
            sslmode='require',
        )
    else:
        conn = psycopg2.connect(
            host=host, port=port, user=user,
            password=password, dbname=dbname,
        )
    conn.close()
    sys.exit(0)
except Exception as e:
    print(f'DB connect error: {e}', file=sys.stderr)
    sys.exit(1)
"; do
  RETRIES=$((RETRIES + 1))
  if [ "$RETRIES" -ge 30 ]; then
    echo "❌ Postgres did not become ready after 60s. Check PGHOST, PGUSER, PGPASSWORD, PGDATABASE env vars on Render."
    exit 1
  fi
  echo "  Postgres not ready yet (attempt $RETRIES/30) — retrying in 2s..."
  sleep 2
done

echo "✅ Postgres is ready."

echo "🗄️  Running analytics migrations (model_registry)..."
python3 migrations/migrate.py

echo "🚀 Starting ShopSense Analytics Service..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
