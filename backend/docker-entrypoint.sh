#!/bin/sh
set -e

echo "⏳ Waiting for Postgres to be ready..."
RETRIES=0
until node -e "
const { Pool } = require('pg');
const p = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  connectionTimeoutMillis: 5000,
  ssl: process.env.PGHOST && process.env.PGHOST.includes('render.com')
    ? { rejectUnauthorized: false } : false,
});
p.query('SELECT 1')
  .then(() => { p.end(); process.exit(0); })
  .catch((err) => { console.error('DB connect error:', err.message); p.end(); process.exit(1); });
"; do
  RETRIES=$((RETRIES + 1))
  if [ "$RETRIES" -ge 30 ]; then
    echo "❌ Postgres did not become ready after 60s. Check PGHOST, PGUSER, PGPASSWORD, PGDATABASE."
    exit 1
  fi
  echo "  Postgres not ready yet (attempt $RETRIES/30) — retrying in 2s..."
  sleep 2
done

echo "✅ Postgres is ready."

echo "🗄️  Running database migrations (schema.sql)..."
node src/seed/migrate.js

echo "🔍 Checking if database needs seeding..."
NEEDS_SEED=$(node -e "
const { Pool } = require('pg');
const p = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.PGHOST && process.env.PGHOST.includes('render.com')
    ? { rejectUnauthorized: false } : false,
});
p.query('SELECT COUNT(*) FROM users')
  .then(r => { p.end(); process.stdout.write(r.rows[0].count === '0' ? 'yes' : 'no'); })
  .catch(() => { p.end(); process.stdout.write('yes'); });
")

if [ "$NEEDS_SEED" = "yes" ]; then
  echo "🌱 Database is empty — running seed script..."
  node src/seed/seed.js
  echo "✅ Seed complete. Demo accounts ready (password: Password123!)"
else
  echo "✅ Database already has data — skipping seed."
fi

echo "🚀 Starting ShopSense API..."
exec node src/server.js
