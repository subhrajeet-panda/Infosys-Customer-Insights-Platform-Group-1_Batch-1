require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const authRoutes    = require('./routes/authRoutes');
const vendorRoutes  = require('./routes/vendorRoutes');
const productRoutes = require('./routes/productRoutes');
const adminRoutes   = require('./routes/adminRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const cartRoutes    = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const orderRoutes   = require('./routes/orderRoutes');
const mlRoutes      = require('./routes/mlRoutes');

const app = express();

const rawOrigins = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', async (req, res) => {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      service: 'ShopSense API',
      db: 'connected',
      db_latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      service: 'ShopSense API',
      db: 'unreachable',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/api/seed', async (req, res) => {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return res.status(403).json({ error: 'Seeding is disabled (SEED_SECRET not set).' });
  }
  if (req.query.secret !== secret) {
    return res.status(403).json({ error: 'Invalid seed secret.' });
  }
  try {
    const { seed } = require('./seed/seed');
    await seed();
    res.json({ status: 'ok', message: 'Database seeded successfully. Demo accounts ready (password: Password123!)' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use('/api/auth',      authRoutes);
app.use('/api/vendors',   vendorRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/cart',      cartRoutes);
app.use('/api/wishlist',  wishlistRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/ml',        mlRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ShopSense API running on http://localhost:${PORT}`);
  console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
});
