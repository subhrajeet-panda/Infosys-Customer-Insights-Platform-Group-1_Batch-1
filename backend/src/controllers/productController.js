const pool = require('../config/db');

async function listProducts(req, res) {
  try {
    const { category, search, vendorId } = req.query;
    const conditions = ["p.status = 'active'", "v.status = 'approved'"];
    const params = [];

    if (category) {
      params.push(category);
      conditions.push(`p.category = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`p.name ILIKE $${params.length}`);
    }
    if (vendorId) {
      params.push(vendorId);
      conditions.push(`p.vendor_id = $${params.length}`);
    }

    const query = `
      SELECT p.*, v.business_name AS vendor_name, v.logo_url AS vendor_logo_url
      FROM products p
      JOIN vendors v ON v.id = p.vendor_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.created_at DESC
      LIMIT 100`;

    const { rows } = await pool.query(query, params);
    res.json({ products: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

async function listCategories(req, res) {
  try {
    const { rows } = await pool.query('SELECT value FROM marketplace_settings WHERE key = $1', ['allowed_categories']);
    const categories = rows[0] ? rows[0].value.split(',') : [];
    res.json({ categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
}

async function listMyProducts(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE vendor_id = $1 ORDER BY created_at DESC',
      [req.vendor.id]
    );
    res.json({ products: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch your products' });
  }
}

async function createProduct(req, res) {
  try {
    if (req.vendor.status !== 'approved') {
      return res.status(403).json({ error: 'Vendor must be approved to add products' });
    }
    const { name, description, category, price, stockQuantity } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'name and price are required' });
    }
    const imageUrl = req.file ? req.file.path : null;

    const { rows } = await pool.query(
      `INSERT INTO products (vendor_id, name, description, category, price, stock_quantity, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.vendor.id, name, description || null, category || null, price, stockQuantity || 0, imageUrl]
    );
    res.status(201).json({ product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create product' });
  }
}

async function updateProduct(req, res) {
  try {
    const { name, description, category, price, stockQuantity, status } = req.body;
    const imageUrl = req.file ? req.file.path : null;

    const { rows } = await pool.query(
      `UPDATE products SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        price = COALESCE($4, price),
        stock_quantity = COALESCE($5, stock_quantity),
        status = COALESCE($6, status),
        image_url = COALESCE($7, image_url),
        updated_at = now()
       WHERE id = $8 AND vendor_id = $9 RETURNING *`,
      [name || null, description || null, category || null, price || null,
       stockQuantity ?? null, status || null, imageUrl, req.params.id, req.vendor.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
}

async function deleteProduct(req, res) {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM products WHERE id = $1 AND vendor_id = $2',
      [req.params.id, req.vendor.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Product not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
}

async function logView(req, res) {
  try {
    if (req.user) {
      await pool.query(
        `INSERT INTO customer_events (customer_id, product_id, event_type) VALUES ($1,$2,'view')`,
        [req.user.id, req.params.id]
      );
    }
    res.status(204).send();
  } catch (err) {
    res.status(204).send(); 
  }
}

module.exports = {
  listProducts, listCategories, listMyProducts, createProduct, updateProduct, deleteProduct, logView,
};
