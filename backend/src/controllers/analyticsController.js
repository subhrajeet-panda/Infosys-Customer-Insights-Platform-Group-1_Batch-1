const pool = require('../config/db');

async function vendorAnalytics(req, res) {
  try {
    const vendorId = req.vendor.id;

    const totals = await pool.query(`
      SELECT
        COALESCE(SUM(total_amount),0)::float AS total_revenue,
        COALESCE(SUM(vendor_earning),0)::float AS total_earnings,
        COALESCE(SUM(commission_amount),0)::float AS total_commission_paid,
        COUNT(*)::int AS total_orders,
        COALESCE(AVG(total_amount),0)::float AS avg_order_value,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'delivered'),0)::float AS delivered_revenue,
        COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_orders,
        COUNT(*) FILTER (WHERE status IN ('pending','confirmed','shipped'))::int AS in_progress_orders
      FROM orders WHERE vendor_id = $1 AND status != 'cancelled'`, [vendorId]);

    const revenueByDay = await pool.query(`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             SUM(total_amount)::float AS revenue,
             SUM(vendor_earning)::float AS earnings,
             COUNT(*)::int AS orders
      FROM orders WHERE vendor_id = $1 AND status != 'cancelled'
        AND created_at >= now() - interval '30 days'
      GROUP BY 1 ORDER BY 1`, [vendorId]);

    const topProducts = await pool.query(`
      SELECT oi.product_id AS id, oi.product_name AS name,
             SUM(oi.quantity)::int AS units_sold, SUM(oi.subtotal)::float AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.vendor_id = $1 AND o.status != 'cancelled'
      GROUP BY oi.product_id, oi.product_name ORDER BY revenue DESC LIMIT 5`, [vendorId]);

    const inventory = await pool.query(`
      SELECT COUNT(*)::int AS total_products,
             COUNT(*) FILTER (WHERE stock_quantity = 0)::int AS out_of_stock,
             COUNT(*) FILTER (WHERE status = 'active')::int AS active_products
      FROM products WHERE vendor_id = $1`, [vendorId]);

    const orderStatusBreakdown = await pool.query(`
      SELECT status, COUNT(*)::int AS count FROM orders WHERE vendor_id = $1 GROUP BY status`, [vendorId]);

    const recentOrders = await pool.query(`
      SELECT id, status, total_amount::float AS total_amount, created_at, updated_at
      FROM orders WHERE vendor_id = $1 ORDER BY created_at DESC LIMIT 8`, [vendorId]);

    res.json({
      totals: totals.rows[0],
      revenueByDay: revenueByDay.rows,
      topProducts: topProducts.rows,
      inventory: inventory.rows[0],
      orderStatusBreakdown: orderStatusBreakdown.rows,
      recentOrders: recentOrders.rows,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vendor analytics' });
  }
}

module.exports = { vendorAnalytics };
