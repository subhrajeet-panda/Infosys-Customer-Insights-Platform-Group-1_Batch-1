const pool = require('../config/db');

async function getMyProfile(req, res) {
  res.json({ vendor: req.vendor });
}

async function updateMyProfile(req, res) {
  try {
    const {
      businessName, businessDescription, categories,
      contactEmail, contactPhone, businessAddress,
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE vendors SET
        business_name = COALESCE($1, business_name),
        business_description = COALESCE($2, business_description),
        categories = COALESCE($3, categories),
        contact_email = COALESCE($4, contact_email),
        contact_phone = COALESCE($5, contact_phone),
        business_address = COALESCE($6, business_address),
        updated_at = now()
       WHERE id = $7 RETURNING *`,
      [
        businessName || null,
        businessDescription || null,
        Array.isArray(categories) ? categories : null,
        contactEmail || null,
        contactPhone || null,
        businessAddress || null,
        req.vendor.id,
      ]
    );
    res.json({ vendor: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

async function uploadLogo(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { rows } = await pool.query(
      `UPDATE vendors SET logo_url = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [req.file.path, req.vendor.id]
    );
    res.json({ vendor: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Logo upload failed' });
  }
}

async function listApprovedVendors(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, business_name, business_description, categories, logo_url, created_at
       FROM vendors WHERE status = 'approved' ORDER BY created_at DESC`
    );
    res.json({ vendors: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
}

async function getVendorPublic(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, business_name, business_description, categories, logo_url, created_at
       FROM vendors WHERE id = $1 AND status = 'approved'`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Vendor not found' });

    const products = await pool.query(
      `SELECT * FROM products WHERE vendor_id = $1 AND status = 'active' ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ vendor: rows[0], products: products.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadLogo,
  listApprovedVendors,
  getVendorPublic,
};
