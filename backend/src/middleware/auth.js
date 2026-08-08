const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [decoded.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

async function attachVendor(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM vendors WHERE user_id = $1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Vendor profile not found' });
    req.vendor = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.id]);
    if (rows.length) req.user = rows[0];
    next();
  } catch (err) {
    next();
  }
}

module.exports = { requireAuth, requireRole, attachVendor, optionalAuth };
