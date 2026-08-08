import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  RefreshCw, AlertTriangle, Download, IndianRupee, PackageCheck, ShoppingCart,
  Boxes, TrendingUp, TrendingDown, CheckCircle2,
} from 'lucide-react';
import api from '../api/axios';
import analyticsApi from '../api/analyticsAxios';
import { useAuth } from '../context/AuthContext.jsx';
import { formatINR, ordinal } from '../utils/format';
import { downloadReport } from '../utils/download';
import { useLiveQuery } from '../hooks/useLiveQuery.js';

const TABS = ['Overview', 'Catalogue', 'Orders', 'Inventory Intelligence', 'Benchmarking', 'Profile'];

const CHART_COLORS = {
  teal: '#1fae9c',
  tealDark: '#137a6c',
  amber: '#f59e0b',
  blue: '#3b82f6',
  red: '#ef4444',
  slate: '#c7cadb',
  ink: '#0f172a',
};

const STATUS_COLORS = {
  delivered: CHART_COLORS.teal,
  shipped: CHART_COLORS.blue,
  confirmed: CHART_COLORS.amber,
  pending: CHART_COLORS.amber,
  cancelled: CHART_COLORS.red,
  rejected: CHART_COLORS.red,
  approved: CHART_COLORS.teal,
  suspended: CHART_COLORS.slate,
};

function StatCard({ label, value, sub, icon: Icon, accent = 'teal' }) {
  const accentBg = {
    teal: 'bg-brand-50 text-brand-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
  }[accent];

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 hover:shadow-sm hover:border-gray-200 transition">
      <div className="flex items-start justify-between">
        <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accentBg}`}>
            <Icon size={15} />
          </div>
        )}
      </div>
      <div className="font-display text-2xl font-semibold text-gray-900 mt-2">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    approved: 'bg-green-100 text-green-700', pending: 'bg-amber-100 text-amber-700',
    rejected: 'bg-red-100 text-red-700', suspended: 'bg-gray-200 text-gray-600',
    delivered: 'bg-green-100 text-green-700', shipped: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-amber-100 text-amber-700', cancelled: 'bg-red-100 text-red-700',
  };
  return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${colors[status] || 'bg-gray-100'}`}>{status}</span>;
}

function DonutLegend({ items }) {
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: it.color }} />
            {it.label}
          </span>
          <span className="text-gray-900 font-medium">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

function OverviewTab({ vendor }) {
  const { data, loading, lastUpdated, reload } = useLiveQuery(
    () => api.get('/analytics/vendor').then((res) => res.data),
    [vendor.id],
  );

  const statusBreakdown = useMemo(() => {
    const orders = data?.recentOrders || [];
    if (orders.length === 0) return [];
    const counts = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([status, count]) => ({
      name: status, value: count, color: STATUS_COLORS[status] || CHART_COLORS.slate,
    }));
  }, [data]);

  const inventoryBreakdown = useMemo(() => {
    if (!data?.inventory) return [];
    const { total_products, out_of_stock } = data.inventory;
    const inStock = Math.max(total_products - out_of_stock, 0);
    return [
      { name: 'In stock', value: inStock, color: CHART_COLORS.teal },
      { name: 'Out of stock', value: out_of_stock, color: CHART_COLORS.red },
    ];
  }, [data]);

  if (vendor.status !== 'approved') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        Your vendor account is <strong>{vendor.status}</strong>. Analytics and product listing unlock once an admin approves your account.
      </div>
    );
  }
  if (loading && !data) return <div className="text-gray-400 py-12 text-center">Loading analytics…</div>;
  if (!data) return null;
  const { totals, revenueByDay, topProducts, inventory, recentOrders } = data;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">
          {lastUpdated ? `Live · updated ${lastUpdated.toLocaleTimeString('en-IN')}` : ''}
        </span>
        <button onClick={reload} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Revenue" value={formatINR(totals.total_revenue)} sub={`${totals.total_orders} orders (all non-cancelled)`} icon={IndianRupee} accent="teal" />
        <StatCard label="Delivered Revenue" value={formatINR(totals.delivered_revenue)} sub={`${totals.delivered_orders} delivered orders`} icon={PackageCheck} accent="blue" />
        <StatCard label="In Progress" value={totals.in_progress_orders} sub="pending / confirmed / shipped" icon={ShoppingCart} accent="amber" />
        <StatCard label="Your Earnings" value={formatINR(totals.total_earnings)} sub="after commission" icon={TrendingUp} accent="teal" />
        <StatCard label="Avg Order Value" value={formatINR(totals.avg_order_value)} icon={IndianRupee} accent="blue" />
        <StatCard label="Out of Stock" value={inventory.out_of_stock} sub={`of ${inventory.total_products} products`} icon={Boxes} accent="red" />
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Revenue — last 30 days</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={revenueByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
            <Tooltip formatter={(v) => formatINR(v)} />
            <Line type="monotone" dataKey="revenue" stroke={CHART_COLORS.teal} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {(statusBreakdown.length > 0 || inventoryBreakdown.length > 0) && (
        <div className="grid md:grid-cols-2 gap-6">
          {statusBreakdown.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Recent orders by status</h3>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="55%" height={180}>
                  <PieChart>
                    <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {statusBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1">
                  <DonutLegend items={statusBreakdown.map((s) => ({ label: s.name, value: s.value, color: s.color }))} />
                </div>
              </div>
            </div>
          )}
          {inventoryBreakdown.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Stock health</h3>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="55%" height={180}>
                  <PieChart>
                    <Pie data={inventoryBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {inventoryBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1">
                  <DonutLegend items={inventoryBreakdown.map((s) => ({ label: s.name, value: s.value, color: s.color }))} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-100 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Top products</h3>
          {topProducts.length > 0 && (
            <ResponsiveContainer width="100%" height={Math.max(topProducts.length * 34, 120)}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Bar dataKey="revenue" fill={CHART_COLORS.teal} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-3 text-sm mt-4">
            {topProducts.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{p.name}</span>
                <span className="text-gray-400">{p.units_sold} units · {formatINR(p.revenue)}</span>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-gray-400 text-sm">No sales yet.</p>}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Inventory snapshot</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart
              data={[
                { name: 'Total', count: inventory.total_products, color: CHART_COLORS.slate },
                { name: 'Active', count: inventory.active_products, color: CHART_COLORS.teal },
                { name: 'Out of stock', count: inventory.out_of_stock, color: CHART_COLORS.red },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                <Cell fill={CHART_COLORS.slate} />
                <Cell fill={CHART_COLORS.teal} />
                <Cell fill={CHART_COLORS.red} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="space-y-3 text-sm mt-4">
            <div className="flex justify-between"><span className="text-gray-700">Total products</span><span className="text-gray-400">{inventory.total_products}</span></div>
            <div className="flex justify-between"><span className="text-gray-700">Active listings</span><span className="text-gray-400">{inventory.active_products}</span></div>
            <div className="flex justify-between"><span className="text-gray-700">Out of stock</span><span className="text-gray-400">{inventory.out_of_stock}</span></div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Recent orders</h3>
        <div className="space-y-2">
          {(recentOrders || []).map((o) => (
            <div key={o.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0">
              <span className="text-gray-500">#{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString('en-IN')}</span>
              <span className="flex items-center gap-3">
                <span className="text-gray-700">{formatINR(o.total_amount)}</span>
                <StatusBadge status={o.status} />
              </span>
            </div>
          ))}
          {(!recentOrders || recentOrders.length === 0) && <p className="text-gray-400 text-sm">No orders yet.</p>}
        </div>
      </div>
    </div>
  );
}

function CatalogueTab({ vendor }) {
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: '', price: '', stockQuantity: '' });
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/products/mine').then((res) => setProducts(res.data.products));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append('image', imageFile);
      await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm({ name: '', description: '', category: '', price: '', stockQuantity: '' });
      setImageFile(null);
      setShowForm(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add product');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this product?')) return;
    await api.delete(`/products/${id}`);
    load();
  };

  if (vendor.status !== 'approved') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">Catalogue management unlocks once your vendor account is approved by an admin.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Your products ({products.length})</h3>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-lg bg-ink-900 text-white text-sm font-semibold hover:bg-ink-800">
          {showForm ? 'Cancel' : '+ Add product'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-100 bg-white p-6 grid sm:grid-cols-2 gap-4">
          <input required placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2" />
          <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2" />
          <input required type="number" step="0.01" placeholder="Price (₹)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2" />
          <input type="number" placeholder="Stock quantity" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2" />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 sm:col-span-2" rows={2} />
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="sm:col-span-2 text-sm" />
          <button disabled={saving} className="sm:col-span-2 py-2.5 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save product'}
          </button>
        </form>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <div key={p.id} className="rounded-xl border border-gray-100 bg-white overflow-hidden hover:shadow-sm transition">
            <div className="aspect-video bg-gray-100 flex items-center justify-center">
              {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" /> : <span className="text-gray-300 text-3xl">{p.name[0]}</span>}
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start">
                <h4 className="font-semibold text-gray-900">{p.name}</h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{p.status}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{p.category}</p>
              <div className="flex justify-between items-center mt-3">
                <span className="font-display font-semibold">{formatINR(p.price)}</span>
                <span className="text-xs text-gray-400">{p.stock_quantity} in stock</span>
              </div>
              <button onClick={() => remove(p.id)} className="mt-3 text-xs text-red-500 hover:text-red-700">Delete</button>
            </div>
          </div>
        ))}
        {products.length === 0 && <p className="text-gray-400 col-span-full text-center py-8">No products yet — add your first one above.</p>}
      </div>
    </div>
  );
}

function OrdersTab({ vendor }) {
  const { data, loading, reload } = useLiveQuery(
    () => api.get('/orders/vendor').then((res) => res.data.orders),
    [vendor.id],
  );
  const orders = data || [];

  const NEXT_STATUS = { pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };

  const advance = async (order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    await api.patch(`/orders/${order.id}/status`, { status: next });
    reload();
  };

  if (vendor.status !== 'approved') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">Orders will appear here once your vendor account is approved.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Incoming orders ({orders.length})</h3>
        <button onClick={reload} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      {orders.length === 0 && <p className="text-gray-400 text-sm">No orders yet.</p>}
      {orders.map((order) => (
        <div key={order.id} className="rounded-xl border border-gray-100 bg-white p-5">
          <div className="flex flex-wrap justify-between gap-3 mb-3">
            <div>
              <p className="text-xs text-gray-400">Order #{order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleDateString('en-IN')}</p>
              <p className="text-sm text-gray-600">{order.shipping_name} · {order.shipping_phone}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-display font-semibold">{formatINR(order.total_amount)}</span>
              <StatusBadge status={order.status} />
            </div>
          </div>
          <div className="text-sm text-gray-600 space-y-1 mb-3">
            {order.items.map((it) => (
              <div key={it.id} className="flex justify-between">
                <span>{it.product_name} × {it.quantity}</span>
                <span>{formatINR(it.subtotal)}</span>
              </div>
            ))}
          </div>
          {NEXT_STATUS[order.status] && (
            <button onClick={() => advance(order)} className="text-xs px-3 py-1.5 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800">
              Mark as {NEXT_STATUS[order.status]}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function InventoryIntelligenceTab({ vendor }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    analyticsApi.get('/forecast/inventory')
      .then((res) => setResult(res.data))
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const runModel = async () => {
    setRunning(true); setError('');
    try {
      await analyticsApi.post('/forecast/inventory/run');
      load();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Model run failed';
      setError(typeof msg === 'string' ? msg : 'Model run failed — is the analytics service running?');
    } finally {
      setRunning(false);
    }
  };

  if (vendor.status !== 'approved') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">Inventory intelligence unlocks once your vendor account is approved.</div>;
  }

  const payload = result?.payload;
  const myProducts = payload?.products || [];

  const replenishmentBreakdown = useMemo(() => {
    if (myProducts.length === 0) return [];
    const needing = myProducts.filter((p) => p.needs_replenishment).length;
    const healthy = myProducts.length - needing;
    return [
      { name: 'Healthy', value: healthy, color: CHART_COLORS.teal },
      { name: 'Needs reorder', value: needing, color: CHART_COLORS.amber },
    ].filter((s) => s.value > 0);
  }, [myProducts]);

  const stockoutRisk = useMemo(() => {
    return [...myProducts]
      .filter((p) => p.days_until_stockout != null)
      .sort((a, b) => a.days_until_stockout - b.days_until_stockout)
      .slice(0, 6)
      .map((p) => ({ name: p.product_name, days: p.days_until_stockout }));
  }, [myProducts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Demand forecast & replenishment</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {result ? `Version ${result.version} · trained ${new Date(result.trained_at).toLocaleString('en-IN')}` : 'Not run yet'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {payload && (
            <button onClick={() => downloadReport('inventory_forecast', 'csv')}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600">
              <Download size={14} /> Export CSV
            </button>
          )}
          <button onClick={runModel} disabled={running}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800 disabled:opacity-60">
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> {running ? 'Running model…' : 'Run forecast'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
          <div className="text-xs text-red-400 mt-1">Make sure the analytics-service (FastAPI) is running on the URL in VITE_ANALYTICS_API_URL.</div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 py-12 text-center">Loading…</div>
      ) : !payload ? (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-gray-400">
          No forecast yet — click "Run forecast" to analyze your sales history.
        </div>
      ) : myProducts.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-gray-400">
          Not enough sales history for your products yet.
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            {replenishmentBreakdown.length > 0 && (
              <div className="rounded-xl border border-gray-100 bg-white p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Replenishment status</h4>
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="55%" height={180}>
                    <PieChart>
                      <Pie data={replenishmentBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                        {replenishmentBreakdown.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1">
                    <DonutLegend items={replenishmentBreakdown.map((s) => ({ label: s.name, value: s.value, color: s.color }))} />
                  </div>
                </div>
              </div>
            )}
            {stockoutRisk.length > 0 && (
              <div className="rounded-xl border border-gray-100 bg-white p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Closest to stockout</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stockoutRisk} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v} days`, 'Until stockout']} />
                    <Bar dataKey="days" radius={[0, 4, 4, 0]}>
                      {stockoutRisk.map((entry) => (
                        <Cell key={entry.name} fill={entry.days <= 7 ? CHART_COLORS.red : entry.days <= 14 ? CHART_COLORS.amber : CHART_COLORS.teal} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-left px-4 py-3">Stock</th>
                  <th className="text-left px-4 py-3">Avg daily demand</th>
                  <th className="text-left px-4 py-3">14-day forecast</th>
                  <th className="text-left px-4 py-3">Days to stockout</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {myProducts.map((p) => (
                  <tr key={p.product_id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.product_name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.current_stock}</td>
                    <td className="px-4 py-3 text-gray-500">{p.avg_daily_demand} <span className="text-xs text-gray-400">({p.trend_direction})</span></td>
                    <td className="px-4 py-3 text-gray-500">{p.forecast_next_14_days}</td>
                    <td className="px-4 py-3 text-gray-500">{p.days_until_stockout ?? '—'}</td>
                    <td className="px-4 py-3">
                      {p.needs_replenishment ? (
                        <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                          <AlertTriangle size={13} /> Reorder {p.recommended_reorder_qty} units
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                          <CheckCircle2 size={13} /> Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function BenchmarkingTab({ vendor }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    analyticsApi.get('/benchmarking/vendor')
      .then((res) => { setData(res.data); setError(''); })
      .catch((err) => setError(err.response?.data?.detail || 'Benchmarking not available yet'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const runModel = async () => {
    setRunning(true);
    try {
      await analyticsApi.post('/benchmarking/run');
      load();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Model run failed';
      setError(typeof msg === 'string' ? msg : 'Model run failed — is the analytics service running?');
    } finally {
      setRunning(false);
    }
  };

  if (vendor.status !== 'approved') {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">Benchmarking unlocks once your vendor account is approved.</div>;
  }
  if (loading) return <div className="text-gray-400 py-12 text-center">Loading…</div>;
  if (error || !data) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-gray-400 space-y-4">
        <p>{error || 'No benchmarking data yet.'}</p>
        <button onClick={runModel} disabled={running}
          className="flex items-center gap-2 mx-auto text-sm px-4 py-2 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800 disabled:opacity-60">
          <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> {running ? 'Running model…' : 'Run benchmarking'}
        </button>
      </div>
    );
  }

  const { vendor_benchmark: vb, marketplace_summary: ms } = data;
  const growthUp = vb.growth_pct >= 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-gray-900">How you compare to the marketplace</h3>
          <p className="text-xs text-gray-400 mt-0.5">Last {ms.window_days} days vs. the prior {ms.window_days} days · version {data.version}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runModel} disabled={running}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600 disabled:opacity-60">
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> {running ? 'Running…' : 'Re-run'}
          </button>
          <button onClick={() => downloadReport('revenue_benchmarking', 'pdf')}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600">
            <Download size={14} /> Export PDF
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Your Revenue (30d)" value={formatINR(vb.revenue_current)}
          sub={`${growthUp ? '+' : ''}${vb.growth_pct}% vs prior period`} icon={IndianRupee} accent="teal" />
        <StatCard label="Projected Next 30d" value={formatINR(vb.projected_next_30d?.projected_revenue)}
          sub={`trend: ${vb.projected_next_30d?.trend_direction || 'n/a'}`} icon={growthUp ? TrendingUp : TrendingDown} accent={growthUp ? 'teal' : 'red'} />
        <StatCard label="Marketplace Percentile" value={ordinal(vb.revenue_percentile)}
          sub="among approved vendors" icon={Boxes} accent="blue" />
        <StatCard label="Your AOV" value={formatINR(vb.aov_current)}
          sub={`${vb.aov_vs_category_pct >= 0 ? '+' : ''}${vb.aov_vs_category_pct}% vs ${vb.category} peers`} icon={ShoppingCart} accent="amber" />
        <StatCard label="Marketplace Growth" value={`${ms.marketplace_growth_pct >= 0 ? '+' : ''}${ms.marketplace_growth_pct}%`}
          sub="all vendors, same period" icon={TrendingUp} accent="teal" />
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Your revenue — last 12 weeks</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={vb.revenue_trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="week_label" tick={{ fontSize: 10 }}
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
            <Tooltip formatter={(v) => formatINR(v)} labelFormatter={(d) => `Week of ${new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`} />
            <Line type="monotone" dataKey="revenue" stroke={CHART_COLORS.teal} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-100 bg-white p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Your AOV vs. {vb.category} peers</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={[
              { name: 'You', aov: vb.aov_current },
              { name: `${vb.category} avg`, aov: vb.category_avg_aov },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
              <Tooltip formatter={(v) => formatINR(v)} />
              <Bar dataKey="aov" radius={[4, 4, 0, 0]}>
                <Cell fill={CHART_COLORS.teal} />
                <Cell fill={CHART_COLORS.slate} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-6">
          <h4 className="font-semibold text-gray-900 mb-3">Where you stand</h4>
          <div className="flex items-center gap-6 mb-4">
            <ResponsiveContainer width="45%" height={140}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Percentile', value: vb.revenue_percentile },
                    { name: 'Remaining', value: Math.max(100 - vb.revenue_percentile, 0) },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={40} outerRadius={60} startAngle={90} endAngle={-270}
                >
                  <Cell fill={CHART_COLORS.teal} />
                  <Cell fill="#eef0f5" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div>
              <div className="font-display text-2xl font-semibold text-gray-900">{ordinal(vb.revenue_percentile)}</div>
              <div className="text-xs text-gray-400">percentile marketplace-wide</div>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Your category</span><span className="text-gray-900 font-medium">{vb.category}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Category peer avg. AOV</span><span className="text-gray-900 font-medium">{formatINR(vb.category_avg_aov)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">In top quartile of vendors?</span>
              <span className={`font-medium ${ms.top_quartile_vendors?.length && vb.revenue_percentile >= 75 ? 'text-green-600' : 'text-gray-400'}`}>
                {vb.revenue_percentile >= 75 ? 'Yes' : 'Not yet'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ vendor, refresh }) {
  const [form, setForm] = useState({
    businessName: vendor.business_name || '', businessDescription: vendor.business_description || '',
    categories: (vendor.categories || []).join(', '), contactEmail: vendor.contact_email || '',
    contactPhone: vendor.contact_phone || '', businessAddress: vendor.business_address || '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleLogoSelect = (file) => {
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/vendors/me/profile', { ...form, categories: form.categories.split(',').map((s) => s.trim()) });
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        await api.post('/vendors/me/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setLogoFile(null);
        setLogoPreview(null);
      }
      refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
          {logoPreview || vendor.logo_url ? (
            <img src={logoPreview || vendor.logo_url} alt={`${vendor.business_name} logo`} className="w-full h-full object-cover" />
          ) : (
            <span className="text-gray-300 text-2xl font-display">{vendor.business_name?.[0] || '?'}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={vendor.status} />
          <span className="text-xs text-gray-400">Commission rate: {vendor.commission_rate}%</span>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Business name</label>
          <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea rows={3} value={form.businessDescription} onChange={(e) => setForm({ ...form, businessDescription: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Categories</label>
          <input value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Contact email</label>
            <input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Contact phone</label>
            <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Business address</label>
          <input value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Logo</label>
          <input type="file" accept="image/*" onChange={(e) => handleLogoSelect(e.target.files[0])} className="mt-1 text-sm" />
          {logoPreview && <p className="text-xs text-brand-600 mt-1">New logo selected — click "Save changes" to upload it.</p>}
        </div>
        <button disabled={saving} className="py-2.5 px-6 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}

export default function VendorDashboard() {
  const { vendor: authVendor } = useAuth();
  const [vendor, setVendor] = useState(authVendor);
  const [tab, setTab] = useState('Overview');

  const refresh = () => api.get('/vendors/me/profile').then((res) => setVendor(res.data.vendor));
  useEffect(() => { refresh(); }, []);

  if (!vendor) return <div className="text-center py-20 text-gray-400">Loading vendor profile…</div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-gray-900">{vendor.business_name}</h1>
          <p className="text-gray-500 mt-1">Vendor dashboard</p>
        </div>
        <StatusBadge status={vendor.status} />
      </div>

      <div className="flex gap-2 mb-8 border-b border-gray-100 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
              tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab vendor={vendor} />}
      {tab === 'Catalogue' && <CatalogueTab vendor={vendor} />}
      {tab === 'Orders' && <OrdersTab vendor={vendor} />}
      {tab === 'Inventory Intelligence' && <InventoryIntelligenceTab vendor={vendor} />}
      {tab === 'Benchmarking' && <BenchmarkingTab vendor={vendor} />}
      {tab === 'Profile' && <ProfileTab vendor={vendor} refresh={refresh} />}
    </div>
  );
}
