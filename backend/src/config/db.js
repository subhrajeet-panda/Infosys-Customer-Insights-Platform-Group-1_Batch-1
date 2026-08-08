const { Pool } = require('pg');
require('dotenv').config();

const isRender = (process.env.PGHOST || '').includes('render.com');

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ...(isRender && { ssl: { rejectUnauthorized: false } }),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;
