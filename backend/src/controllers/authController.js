const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function sanitize(user) {
  const { password_hash, ...rest } = user;
  return rest;
}

async function register(req, res) {
  const client = await pool.connect();
  try {
    const {
      name, email, password, role, phone,
      businessName, businessDescription, categories, contactPhone, businessAddress,
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password and role are required' });
    }
    
    if (!['customer', 'vendor'].includes(role)) {
      return res.status(403).json({ error: 'Admin accounts cannot be created via registration.' });
    }

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, role, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, passwordHash, role, phone || null]
    );
    const user = userResult.rows[0];

    let vendor = null;
    if (role === 'vendor') {
      if (!businessName) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'businessName is required for vendor registration' });
      }
      const vendorResult = await client.query(
        `INSERT INTO vendors
          (user_id, business_name, business_description, categories, contact_email, contact_phone, business_address, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
        [
          user.id,
          businessName,
          businessDescription || null,
          Array.isArray(categories) ? categories : (categories ? categories.split(',').map(s => s.trim()) : []),
          email,
          contactPhone || phone || null,
          businessAddress || null,
        ]
      );
      vendor = vendorResult.rows[0];
    }

    await client.query('COMMIT');

    const token = signToken(user);
    res.status(201).json({ token, user: sanitize(user), vendor });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    let vendor = null;
    if (user.role === 'vendor') {
      const v = await pool.query('SELECT * FROM vendors WHERE user_id = $1', [user.id]);
      vendor = v.rows[0] || null;
    }

    const token = signToken(user);
    res.json({ token, user: sanitize(user), vendor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}

async function me(req, res) {
  let vendor = null;
  if (req.user.role === 'vendor') {
    const v = await pool.query('SELECT * FROM vendors WHERE user_id = $1', [req.user.id]);
    vendor = v.rows[0] || null;
  }
  res.json({ user: req.user, vendor });
}

module.exports = { register, login, me };
