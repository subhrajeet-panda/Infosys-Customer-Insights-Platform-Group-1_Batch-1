require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const VENDORS = [
  { businessName: 'UrbanThread Apparel', email: 'vendor1@shopsense.demo', categories: ['Fashion'] },
  { businessName: 'GadgetHive Electronics', email: 'vendor2@shopsense.demo', categories: ['Electronics'] },
  { businessName: 'HomeNest Living', email: 'vendor3@shopsense.demo', categories: ['Home & Kitchen'] },
  { businessName: 'PureGlow Beauty', email: 'vendor4@shopsense.demo', categories: ['Beauty'] },
];

const PRODUCT_NAMES = {
  Fashion: ['Denim Jacket', 'Cotton T-Shirt', 'Running Sneakers', 'Wool Scarf', 'Leather Belt'],
  Electronics: ['Wireless Earbuds', 'Smart Watch', 'Bluetooth Speaker', 'Power Bank', 'USB-C Hub'],
  'Home & Kitchen': ['Ceramic Mug Set', 'Non-stick Pan', 'Table Lamp', 'Storage Basket', 'Cutlery Set'],
  Beauty: ['Vitamin C Serum', 'Herbal Shampoo', 'Matte Lipstick', 'Face Moisturizer', 'Sunscreen SPF50'],
};

const PRICE_MAP = {
  Electronics: [1200, 8500],
  Fashion: [500, 3500],
  'Home & Kitchen': [350, 2800],
  Beauty: [250, 1800],
};

const CUSTOMER_PROFILES = [
  { name: 'Ananya Sharma', orders: 14, shape: 'loyal_recent' },
  { name: 'Rohan Mehta', orders: 11, shape: 'loyal_recent' },
  { name: 'Priya Nair', orders: 9, shape: 'steady' },
  { name: 'Karan Verma', orders: 8, shape: 'steady' },
  { name: 'Sneha Iyer', orders: 6, shape: 'steady' },
  { name: 'Aditya Rao', orders: 5, shape: 'slowing' },
  { name: 'Ishita Kapoor', orders: 4, shape: 'slowing' },
  { name: 'Vikram Singh', orders: 3, shape: 'dormant' },
  { name: 'Meera Pillai', orders: 2, shape: 'dormant' },
  { name: 'Arjun Das', orders: 1, shape: 'one_time_old' },
  { name: 'Divya Menon', orders: 3, shape: 'new' },
  { name: 'Rahul Gupta', orders: 2, shape: 'new' },
  { name: 'Kavya Reddy', orders: 0, shape: 'browser_only' },
  { name: 'Naveen Kumar', orders: 0, shape: 'browser_only' },
  { name: 'Tanvi Joshi', orders: 5, shape: 'steady' },
];

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return +(Math.random() * (max - min) + min).toFixed(2); }
function daysAgo(n) { return new Date(Date.now() - n * 24 * 60 * 60 * 1000 - randInt(0, 86400000)); }

function scheduleForShape(shape, count) {
  const days = [];
  switch (shape) {
    case 'loyal_recent':
      for (let i = 0; i < count; i++) days.push(randInt(0, 100));
      break;
    case 'steady':
      for (let i = 0; i < count; i++) days.push(Math.floor((i / count) * 100) + randInt(0, 6));
      break;
    case 'slowing':
      for (let i = 0; i < count; i++) days.push(randInt(45, 110));
      break;
    case 'dormant':
      for (let i = 0; i < count; i++) days.push(randInt(70, 115));
      break;
    case 'one_time_old':
      days.push(randInt(90, 115));
      break;
    case 'new':
      for (let i = 0; i < count; i++) days.push(randInt(0, 20));
      break;
    case 'browser_only':
      break;
    default:
      for (let i = 0; i < count; i++) days.push(randInt(0, 100));
  }
  return days;
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding ShopSense demo data...');
    const passwordHash = await bcrypt.hash('MyPassword123!', 10);

    const adminRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'admin')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING *`,
      ['ShopSense Admin', 'admin@shopsense.demo', passwordHash]
    );
    console.log('Admin:', adminRes.rows[0].email);

    const customers = [];
    for (let i = 0; i < CUSTOMER_PROFILES.length; i++) {
      const profile = CUSTOMER_PROFILES[i];
      const email = `customer${i + 1}@shopsense.demo`;
      const r = await client.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'customer')
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING *`,
        [profile.name, email, passwordHash]
      );
      customers.push({ ...r.rows[0], profile });
    }
    console.log(`Customers: ${customers.length}`);

    const vendorRecords = [];
    for (const v of VENDORS) {
      const userRes = await client.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'vendor')
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING *`,
        [v.businessName + ' Owner', v.email, passwordHash]
      );
      const user = userRes.rows[0];

      const vendorRes = await client.query(
        `INSERT INTO vendors (user_id, business_name, business_description, categories, contact_email, commission_rate, status, approved_at)
         VALUES ($1,$2,$3,$4,$5,$6,'approved', now())
         ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
         RETURNING *`,
        [user.id, v.businessName, `${v.businessName} - trusted marketplace seller.`, v.categories, v.email, randFloat(8, 15)]
      );
      const vendor = vendorRes.rows[0];

      const products = [];
      for (const category of v.categories) {
        for (const name of PRODUCT_NAMES[category]) {
          const existing = await client.query('SELECT * FROM products WHERE vendor_id = $1 AND name = $2', [vendor.id, name]);
          let product;
          if (existing.rows.length) {
            product = existing.rows[0];
          } else {
            const [lo, hi] = PRICE_MAP[category];
            const res = await client.query(
              `INSERT INTO products (vendor_id, name, description, category, price, stock_quantity, status)
               VALUES ($1,$2,$3,$4,$5,$6,'active') RETURNING *`,
              [vendor.id, name, `High quality ${name.toLowerCase()} from ${v.businessName}.`, category, randFloat(lo, hi), randInt(30, 250)]
            );
            product = res.rows[0];
          }
          products.push(product);
        }
      }
      vendorRecords.push({ vendor, products });
    }

    const allProducts = vendorRecords.flatMap((v) => v.products);

    const pendingUserRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'vendor')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING *`,
      ['NovaCraft Owner', 'vendor5@shopsense.demo', passwordHash]
    );
    await client.query(
      `INSERT INTO vendors (user_id, business_name, business_description, categories, contact_email, status)
       VALUES ($1,$2,$3,$4,$5,'pending') ON CONFLICT (user_id) DO NOTHING`,
      [pendingUserRes.rows[0].id, 'NovaCraft Supplies', 'Awaiting review - new sports gear seller.', ['Sports'], 'vendor5@shopsense.demo']
    );
    console.log(`Vendors seeded: ${vendorRecords.length} approved + 1 pending`);

    await client.query('DELETE FROM order_items');
    await client.query('DELETE FROM orders');
    await client.query('DELETE FROM customer_events');
    await client.query('DELETE FROM cart_items');
    await client.query('DELETE FROM wishlist_items');

    let orderCount = 0, itemCount = 0, eventCount = 0;

    for (const customer of customers) {
      const { profile } = customer;

      const viewCount = profile.shape === 'browser_only' ? randInt(15, 30) : randInt(3, 12);
      for (let i = 0; i < viewCount; i++) {
        const product = allProducts[randInt(0, allProducts.length - 1)];
        await client.query(
          `INSERT INTO customer_events (customer_id, product_id, event_type, created_at) VALUES ($1,$2,'view',$3)`,
          [customer.id, product.id, daysAgo(randInt(0, 60))]
        );
        eventCount++;
        if (Math.random() < 0.3) {
          await client.query(
            `INSERT INTO customer_events (customer_id, product_id, event_type, created_at) VALUES ($1,$2,'wishlist',$3)`,
            [customer.id, product.id, daysAgo(randInt(0, 60))]
          );
          eventCount++;
        }
      }

      const orderDaysAgo = scheduleForShape(profile.shape, profile.orders);
      for (const age of orderDaysAgo) {
        const createdAt = daysAgo(age);
        const basketSize = randInt(1, 3);
        const basketProducts = [];
        for (let i = 0; i < basketSize; i++) basketProducts.push(allProducts[randInt(0, allProducts.length - 1)]);

        const byVendor = {};
        for (const p of basketProducts) {
          const vendorRecord = vendorRecords.find((v) => v.vendor.id === p.vendor_id);
          if (!byVendor[p.vendor_id]) byVendor[p.vendor_id] = { vendor: vendorRecord.vendor, items: [] };
          byVendor[p.vendor_id].items.push(p);
        }

        for (const vendorId of Object.keys(byVendor)) {
          const { vendor, items } = byVendor[vendorId];
          const lineItems = items.map((p) => ({ product: p, quantity: randInt(1, 3) }));
          const totalAmount = lineItems.reduce((sum, li) => sum + parseFloat(li.product.price) * li.quantity, 0);
          const commissionRate = parseFloat(vendor.commission_rate);
          const commissionAmount = +(totalAmount * (commissionRate / 100)).toFixed(2);
          const vendorEarning = +(totalAmount - commissionAmount).toFixed(2);

          let status = 'delivered';
          if (age <= 2) status = ['pending', 'confirmed'][randInt(0, 1)];
          else if (age <= 5) status = 'confirmed';
          else if (age <= 8) status = 'shipped';
          else if (Math.random() < 0.04) status = 'cancelled';

          const orderRes = await client.query(
            `INSERT INTO orders
              (customer_id, vendor_id, total_amount, commission_amount, vendor_earning, status,
               shipping_name, shipping_address, shipping_phone, placed_at, confirmed_at, shipped_at, delivered_at, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [
              customer.id, vendorId, totalAmount.toFixed(2), commissionAmount, vendorEarning, status,
              customer.name, `${randInt(1, 200)}, ${['MG Road', 'Park Street', 'Jubilee Hills', 'Sector 21', 'Anna Nagar'][randInt(0, 4)]}, India`,
              `98${randInt(10000000, 99999999)}`,
              createdAt,
              status !== 'pending' ? createdAt : null,
              ['shipped', 'delivered'].includes(status) ? createdAt : null,
              status === 'delivered' ? createdAt : null,
              createdAt,
            ]
          );
          const order = orderRes.rows[0];
          orderCount++;

          for (const li of lineItems) {
            const subtotal = +(parseFloat(li.product.price) * li.quantity).toFixed(2);
            await client.query(
              `INSERT INTO order_items (order_id, product_id, product_name, category, quantity, unit_price, subtotal)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [order.id, li.product.id, li.product.name, li.product.category, li.quantity, li.product.price, subtotal]
            );
            itemCount++;
            await client.query(
              `INSERT INTO customer_events (customer_id, product_id, event_type, created_at) VALUES ($1,$2,'purchase',$3)`,
              [customer.id, li.product.id, createdAt]
            );
            eventCount++;
          }
        }
      }
    }

    console.log(`Orders: ${orderCount}, order line items: ${itemCount}, browsing events: ${eventCount}`);

    const demoCustomer = customers[0];
    const cartPicks = [allProducts[randInt(0, allProducts.length - 1)], allProducts[randInt(0, allProducts.length - 1)]];
    for (const p of cartPicks) {
      await client.query(
        `INSERT INTO cart_items (customer_id, product_id, quantity) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [demoCustomer.id, p.id, randInt(1, 2)]
      );
    }
    const wishlistPicks = allProducts.slice(0, 3);
    for (const p of wishlistPicks) {
      await client.query(
        `INSERT INTO wishlist_items (customer_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [demoCustomer.id, p.id]
      );
    }

    console.log('\nSeed complete. Demo login credentials (password for all: Password123!):');
    console.log('  Admin:     admin@shopsense.demo');
    console.log('  Vendor:    vendor1@shopsense.demo (UrbanThread Apparel, approved)');
    console.log('  Vendor:    vendor5@shopsense.demo (NovaCraft Supplies, pending approval)');
    console.log('  Customer:  customer1@shopsense.demo (Ananya Sharma - has cart, wishlist, order history)');
    console.log('\nNext: cd backend/ml && pip install -r requirements.txt, then run the models');
    console.log('  (POST /api/ml/run-all as an admin, or run each script directly with python3).');
  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    
    if (require.main === module) await pool.end();
  }
}

if (require.main === module) {
  seed().catch(() => process.exit(1));
}

module.exports = { seed };

