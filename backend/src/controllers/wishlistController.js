const pool = require('../config/db');

async function getWishlist(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT wi.id AS wishlist_item_id, p.*, v.business_name AS vendor_name
       FROM wishlist_items wi
       JOIN products p ON p.id = wi.product_id
       JOIN vendors v ON v.id = p.vendor_id
       WHERE wi.customer_id = $1 ORDER BY wi.created_at DESC`,
      [req.user.id]
    );
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
}

async function addToWishlist(req, res) {
  try {
    const { productId } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO wishlist_items (customer_id, product_id) VALUES ($1,$2)
       ON CONFLICT (customer_id, product_id) DO NOTHING RETURNING *`,
      [req.user.id, productId]
    );
    await pool.query(
      `INSERT INTO customer_events (customer_id, product_id, event_type) VALUES ($1,$2,'wishlist')`,
      [req.user.id, productId]
    );
    res.status(201).json({ item: rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
}

async function removeFromWishlist(req, res) {
  try {
    await pool.query(
      'DELETE FROM wishlist_items WHERE product_id = $1 AND customer_id = $2',
      [req.params.productId, req.user.id]
    );
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
}

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
