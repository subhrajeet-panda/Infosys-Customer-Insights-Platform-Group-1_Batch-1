const pool = require('../config/db');

const STATUS_STEPS = ['pending', 'confirmed', 'shipped', 'delivered'];

async function checkout(req, res) {
  const client = await pool.connect();
  try {
    const { shippingName, shippingAddress, shippingPhone } = req.body;
    if (!shippingName || !shippingAddress || !shippingPhone) {
      return res.status(400).json({ error: 'shippingName, shippingAddress and shippingPhone are required' });
    }

    const cart = await client.query(
      `SELECT ci.quantity, p.id AS product_id, p.name, p.category, p.price, p.stock_quantity,
              p.vendor_id, v.commission_rate, v.status AS vendor_status
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN vendors v ON v.id = p.vendor_id
       WHERE ci.customer_id = $1`,
      [req.user.id]
    );

    if (!cart.rows.length) return res.status(400).json({ error: 'Your cart is empty' });

    for (const item of cart.rows) {
      if (item.vendor_status !== 'approved') {
        return res.status(400).json({ error: `${item.name} is currently unavailable` });
      }
      if (item.quantity > item.stock_quantity) {
        return res.status(400).json({ error: `Only ${item.stock_quantity} left in stock for ${item.name}` });
      }
    }

    const byVendor = {};
    for (const item of cart.rows) {
      if (!byVendor[item.vendor_id]) byVendor[item.vendor_id] = [];
      byVendor[item.vendor_id].push(item);
    }

    await client.query('BEGIN');
    const createdOrders = [];

    for (const vendorId of Object.keys(byVendor)) {
      const items = byVendor[vendorId];
      const totalAmount = items.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);
      const commissionRate = parseFloat(items[0].commission_rate);
      const commissionAmount = +(totalAmount * (commissionRate / 100)).toFixed(2);
      const vendorEarning = +(totalAmount - commissionAmount).toFixed(2);

      const orderRes = await client.query(
        `INSERT INTO orders
          (customer_id, vendor_id, total_amount, commission_amount, vendor_earning, status,
           shipping_name, shipping_address, shipping_phone, confirmed_at)
         VALUES ($1,$2,$3,$4,$5,'confirmed',$6,$7,$8, now()) RETURNING *`,
        [req.user.id, vendorId, totalAmount.toFixed(2), commissionAmount, vendorEarning,
         shippingName, shippingAddress, shippingPhone]
      );
      const order = orderRes.rows[0];

      for (const item of items) {
        const subtotal = +(parseFloat(item.price) * item.quantity).toFixed(2);
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, category, quantity, unit_price, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [order.id, item.product_id, item.name, item.category, item.quantity, item.price, subtotal]
        );
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity - $1,
             status = CASE WHEN stock_quantity - $1 <= 0 THEN 'out_of_stock' ELSE status END
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );
        await client.query(
          `INSERT INTO customer_events (customer_id, product_id, event_type) VALUES ($1,$2,'purchase')`,
          [req.user.id, item.product_id]
        );
      }
      createdOrders.push(order);
    }

    await client.query('DELETE FROM cart_items WHERE customer_id = $1', [req.user.id]);
    await client.query('COMMIT');

    res.status(201).json({ orders: createdOrders });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Checkout failed' });
  } finally {
    client.release();
  }
}

async function myOrders(req, res) {
  try {
    const orders = await pool.query(
      `SELECT o.*, v.business_name AS vendor_name
       FROM orders o JOIN vendors v ON v.id = o.vendor_id
       WHERE o.customer_id = $1 ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    const items = await pool.query(
      `SELECT oi.* FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.customer_id = $1`,
      [req.user.id]
    );
    const itemsByOrder = {};
    for (const it of items.rows) {
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
      itemsByOrder[it.order_id].push(it);
    }
    const result = orders.rows.map((o) => ({
      ...o,
      items: itemsByOrder[o.id] || [],
      trackingSteps: STATUS_STEPS,
      currentStepIndex: o.status === 'cancelled' ? -1 : STATUS_STEPS.indexOf(o.status),
    }));
    res.json({ orders: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
}

async function cancelOrder(req, res) {
  try {
    const order = await pool.query('SELECT * FROM orders WHERE id = $1 AND customer_id = $2', [req.params.id, req.user.id]);
    if (!order.rows.length) return res.status(404).json({ error: 'Order not found' });
    if (!['pending', 'confirmed'].includes(order.rows[0].status)) {
      return res.status(400).json({ error: 'Order can no longer be cancelled' });
    }

    await pool.query(`UPDATE orders SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = $1`, [req.params.id]);

    const items = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id]);
    for (const item of items.rows) {
      if (item.product_id) {
        await pool.query(`UPDATE products SET stock_quantity = stock_quantity + $1, status = 'active' WHERE id = $2`, [item.quantity, item.product_id]);
      }
    }
    res.json({ message: 'Order cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
}

async function vendorOrders(req, res) {
  try {
    const orders = await pool.query(
      `SELECT o.* FROM orders o WHERE o.vendor_id = $1 ORDER BY o.created_at DESC LIMIT 100`,
      [req.vendor.id]
    );
    const items = await pool.query(
      `SELECT oi.* FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.vendor_id = $1`,
      [req.vendor.id]
    );
    const itemsByOrder = {};
    for (const it of items.rows) {
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
      itemsByOrder[it.order_id].push(it);
    }
    res.json({ orders: orders.rows.map((o) => ({ ...o, items: itemsByOrder[o.id] || [] })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vendor orders' });
  }
}

async function updateOrderStatus(req, res) {
  try {
    const { status } = req.body;
    if (!STATUS_STEPS.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const timestampCol = { confirmed: 'confirmed_at', shipped: 'shipped_at', delivered: 'delivered_at' }[status];
    const setClause = timestampCol ? `, ${timestampCol} = now()` : '';

    const { rows } = await pool.query(
      `UPDATE orders SET status = $1, updated_at = now() ${setClause} WHERE id = $2 AND vendor_id = $3 RETURNING *`,
      [status, req.params.id, req.vendor.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
}

module.exports = { checkout, myOrders, cancelOrder, vendorOrders, updateOrderStatus };
