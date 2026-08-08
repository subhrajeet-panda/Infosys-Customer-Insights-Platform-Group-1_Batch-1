const pool = require('../config/db');

async function getCart(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT ci.id AS cart_item_id, ci.quantity, p.*, v.business_name AS vendor_name
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN vendors v ON v.id = p.vendor_id
       WHERE ci.customer_id = $1 ORDER BY ci.created_at DESC`,
      [req.user.id]
    );
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
}

async function addToCart(req, res) {
  try {
    const { productId, quantity = 1 } = req.body;
    const product = await pool.query('SELECT * FROM products WHERE id = $1 AND status = $2', [productId, 'active']);
    if (!product.rows.length) return res.status(404).json({ error: 'Product not available' });

    const { rows } = await pool.query(
      `INSERT INTO cart_items (customer_id, product_id, quantity)
       VALUES ($1,$2,$3)
       ON CONFLICT (customer_id, product_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = now()
       RETURNING *`,
      [req.user.id, productId, quantity]
    );

    await pool.query(
      `INSERT INTO customer_events (customer_id, product_id, event_type) VALUES ($1,$2,'add_to_cart')`,
      [req.user.id, productId]
    );

    res.status(201).json({ item: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
}

async function updateCartItem(req, res) {
  try {
    const { quantity } = req.body;
    if (quantity < 1) return res.status(400).json({ error: 'Quantity must be at least 1' });
    const { rows } = await pool.query(
      `UPDATE cart_items SET quantity = $1, updated_at = now() WHERE id = $2 AND customer_id = $3 RETURNING *`,
      [quantity, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cart item not found' });
    res.json({ item: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
}

async function removeCartItem(req, res) {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM cart_items WHERE id = $1 AND customer_id = $2', [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Cart item not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove cart item' });
  }
}

module.exports = { getCart, addToCart, updateCartItem, removeCartItem };
