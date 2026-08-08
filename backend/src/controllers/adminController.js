const pool = require('../config/db');

async function listVendors(req, res) {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) { params.push(status); where = 'WHERE v.status = $1'; }
    const { rows } = await pool.query(
      `SELECT v.*, u.name AS owner_name, u.email AS owner_email
       FROM vendors v JOIN users u ON u.id = v.user_id
       ${where} ORDER BY v.applied_at DESC`, params
    );
    res.json({ vendors: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
}

async function updateVendorStatus(req, res) {
  try {
    const { status, complianceNotes } = req.body;
    const allowed = ['pending', 'approved', 'rejected', 'suspended'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const approvedAtClause = status === 'approved' ? 'now()' : 'approved_at';
    const { rows } = await pool.query(
      `UPDATE vendors SET status = $1, compliance_notes = COALESCE($2, compliance_notes),
        approved_at = ${approvedAtClause}, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [status, complianceNotes || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ vendor: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update vendor status' });
  }
}

async function updateCommission(req, res) {
  try {
    const { commissionRate } = req.body;
    if (commissionRate === undefined || commissionRate < 0 || commissionRate > 100) {
      return res.status(400).json({ error: 'commissionRate must be between 0 and 100' });
    }
    const { rows } = await pool.query(
      'UPDATE vendors SET commission_rate = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [commissionRate, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ vendor: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update commission' });
  }
}

async function platformAnalytics(req, res) {
  try {
    const totals = await pool.query(`
      SELECT
        COALESCE(SUM(total_amount),0)::float AS total_revenue,
        COALESCE(SUM(commission_amount),0)::float AS platform_earnings,
        COUNT(*)::int AS total_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'delivered'),0)::float AS delivered_revenue,
        COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_orders,
        COUNT(*) FILTER (WHERE status IN ('pending','confirmed','shipped'))::int AS in_progress_orders
      FROM orders WHERE status != 'cancelled'`);

    const vendorCounts = await pool.query(`SELECT status, COUNT(*)::int AS count FROM vendors GROUP BY status`);

    const revenueByDay = await pool.query(`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             SUM(total_amount)::float AS revenue,
             COUNT(*)::int AS orders
      FROM orders WHERE status != 'cancelled' AND created_at >= now() - interval '30 days'
      GROUP BY 1 ORDER BY 1`);

    const topVendors = await pool.query(`
      SELECT v.id, v.business_name, SUM(o.total_amount)::float AS revenue, COUNT(o.id)::int AS orders
      FROM orders o JOIN vendors v ON v.id = o.vendor_id
      WHERE o.status != 'cancelled'
      GROUP BY v.id, v.business_name ORDER BY revenue DESC LIMIT 5`);

    const categoryBreakdown = await pool.query(`
      SELECT COALESCE(oi.category, 'Uncategorized') AS category,
             SUM(oi.subtotal)::float AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status != 'cancelled'
      GROUP BY oi.category ORDER BY revenue DESC`);

    const orderStatusBreakdown = await pool.query(`
      SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status`);

    const recentOrders = await pool.query(`
      SELECT o.id, o.status, o.total_amount::float AS total_amount, o.created_at, v.business_name AS vendor_name
      FROM orders o JOIN vendors v ON v.id = o.vendor_id
      ORDER BY o.created_at DESC LIMIT 10`);

    res.json({
      totals: totals.rows[0],
      vendorCounts: vendorCounts.rows,
      revenueByDay: revenueByDay.rows,
      topVendors: topVendors.rows,
      categoryBreakdown: categoryBreakdown.rows,
      orderStatusBreakdown: orderStatusBreakdown.rows,
      recentOrders: recentOrders.rows,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch platform analytics' });
  }
}

module.exports = { listVendors, updateVendorStatus, updateCommission, platformAnalytics };
