import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { RefreshCw, AlertTriangle, TrendingDown, Download, Database, TrendingUp, Terminal } from 'lucide-react';
import api from '../api/axios';
import analyticsApi from '../api/analyticsAxios';
import { formatINR, ordinal } from '../utils/format';
import { downloadReport } from '../utils/download';
import { useLiveQuery } from '../hooks/useLiveQuery.js';

const TABS = ['Analytics', 'Vendor Approvals', 'Customer Analytics', 'Advanced Analytics (BI)', 'System Status'];
const COLORS = ['#1fae9c', '#4fd8c4', '#8a8fa8', '#20264a', '#c7cadb'];

function StatCard({ label, value, sub, trendData }) {
  const max = trendData && trendData.length ? Math.max(...trendData.map((d) => d.value), 1) : 0;
  return (
    <div className="group relative rounded-2xl border border-gray-100 bg-white p-5 transition-all hover:border-gray-200 hover:shadow-sm">
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="font-display text-[26px] leading-tight font-semibold text-gray-900 mt-1.5">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1.5">{sub}</div>}
      {trendData && trendData.length > 1 && (
        <div className="flex items-end gap-[3px] h-7 mt-4">
          {trendData.map((d, i) => (
            <div
              key={i}
              className="flex-1 rounded-[2px] bg-brand-100 group-hover:bg-brand-300 transition-colors duration-300"
              style={{ height: `${Math.max((d.value / max) * 100, 8)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyticsTab() {
  const { data, loading, lastUpdated, reload } = useLiveQuery(() => api.get('/admin/analytics').then((res) => res.data), []);
  if (loading && !data) return <div className="text-gray-400 py-12 text-center">Loading platform analytics…</div>;
  if (!data) return null;

  const { totals, vendorCounts, revenueByDay, topVendors, categoryBreakdown, recentOrders } = data;
  const statusMap = Object.fromEntries(vendorCounts.map((v) => [v.status, v.count]));
  const statusColors = {
    delivered: 'bg-green-100 text-green-700', shipped: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-amber-100 text-amber-700', pending: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  const sparkline = (revenueByDay || []).slice(-14).map((d) => ({ value: d.revenue }));
  const maxVendorRevenue = Math.max(...(topVendors || []).map((v) => v.revenue), 1);

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
        <StatCard label="Platform Revenue" value={formatINR(totals.total_revenue)} sub={`${totals.total_orders} orders (all non-cancelled)`} trendData={sparkline} />
        <StatCard label="Delivered Revenue" value={formatINR(totals.delivered_revenue)} sub={`${totals.delivered_orders} delivered orders`} />
        <StatCard label="In Progress" value={totals.in_progress_orders} sub="pending / confirmed / shipped" />
        <StatCard label="Platform Earnings" value={formatINR(totals.platform_earnings)} sub="commission collected" />
        <StatCard label="Approved Vendors" value={statusMap.approved || 0} sub={`${statusMap.pending || 0} pending review`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Marketplace revenue — last 30 days</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueByDay}>
              <defs>
                <linearGradient id="revenueFillDaily" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1fae9c" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#1fae9c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => formatINR(v)} />
              <Area type="monotone" dataKey="revenue" stroke="#1fae9c" strokeWidth={2.5} fill="url(#revenueFillDaily)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Revenue by category</h3>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={categoryBreakdown} dataKey="revenue" nameKey="category" innerRadius={52} outerRadius={80} paddingAngle={2}>
                {categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
              </Pie>
              <Tooltip formatter={(v) => formatINR(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
            {categoryBreakdown.map((c, i) => (
              <div key={c.category} className="flex items-center gap-1.5 text-xs min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-gray-500 truncate">{c.category}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Top vendors by revenue</h3>
        <div className="space-y-4">
          {topVendors.map((v) => (
            <div key={v.id}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-700 font-medium">{v.business_name}</span>
                <span className="text-gray-400">{v.orders} orders · {formatINR(v.revenue)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
                  style={{ width: `${(v.revenue / maxVendorRevenue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Recent orders (all vendors)</h3>
        <div className="divide-y divide-gray-50">
          {(recentOrders || []).map((o) => (
            <div key={o.id} className="flex justify-between items-center text-sm py-2.5 first:pt-0 last:pb-0 -mx-2 px-2 rounded-lg hover:bg-gray-50/70 transition-colors">
              <span className="text-gray-500">
                <span className="font-mono text-xs text-gray-400">#{o.id.slice(0, 8)}</span> · {o.vendor_name} · {new Date(o.created_at).toLocaleString('en-IN')}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-gray-700 font-medium">{formatINR(o.total_amount)}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
              </span>
            </div>
          ))}
          {(!recentOrders || recentOrders.length === 0) && <p className="text-gray-400 text-sm py-2">No orders yet.</p>}
        </div>
      </div>
    </div>
  );
}

function VendorApprovalsTab() {
  const [vendors, setVendors] = useState([]);
  const [filter, setFilter] = useState('');
  const load = () => api.get('/admin/vendors', { params: filter ? { status: filter } : {} }).then((res) => setVendors(res.data.vendors));
  useEffect(() => { load(); }, [filter]);

  const setStatus = async (id, status) => { await api.patch(`/admin/vendors/${id}/status`, { status }); load(); };
  const setCommission = async (id, rate) => { await api.patch(`/admin/vendors/${id}/commission`, { commissionRate: parseFloat(rate) }); load(); };

  const statusColors = {
    approved: 'bg-green-100 text-green-700', pending: 'bg-amber-100 text-amber-700',
    rejected: 'bg-red-100 text-red-700', suspended: 'bg-gray-200 text-gray-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'approved', 'suspended', 'rejected'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${
              filter === s ? 'bg-ink-900 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3">Business</th>
              <th className="text-left px-5 py-3">Owner</th>
              <th className="text-left px-5 py-3">Categories</th>
              <th className="text-left px-5 py-3">Commission</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-left px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className="border-t border-gray-100 hover:bg-gray-50/60 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {v.logo_url ? (
                        <img src={v.logo_url} alt={v.business_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-gray-400 font-semibold">{v.business_name?.[0]}</span>
                      )}
                    </div>
                    {v.business_name}
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-500">{v.owner_name}<br /><span className="text-xs text-gray-400">{v.owner_email}</span></td>
                <td className="px-5 py-3 text-gray-500">{(v.categories || []).join(', ')}</td>
                <td className="px-5 py-3">
                  <input type="number" defaultValue={v.commission_rate} step="0.5"
                    onBlur={(e) => e.target.value != v.commission_rate && setCommission(v.id, e.target.value)}
                    className="w-16 rounded-lg border border-gray-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400" /> %
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[v.status]}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                    {v.status}
                  </span>
                </td>
                <td className="px-5 py-3 space-x-2 whitespace-nowrap">
                  {v.status !== 'approved' && <button onClick={() => setStatus(v.id, 'approved')} className="text-xs text-green-600 hover:underline">Approve</button>}
                  {v.status === 'approved' && <button onClick={() => setStatus(v.id, 'suspended')} className="text-xs text-gray-500 hover:underline">Suspend</button>}
                  {v.status === 'pending' && <button onClick={() => setStatus(v.id, 'rejected')} className="text-xs text-red-500 hover:underline">Reject</button>}
                  {v.status === 'suspended' && <button onClick={() => setStatus(v.id, 'approved')} className="text-xs text-green-600 hover:underline">Reactivate</button>}
                </td>
              </tr>
            ))}
            {vendors.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No vendors match this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function useAnalyticsResult(path) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    analyticsApi.get(path).then((res) => setResult(res.data)).catch(() => setResult(null)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  return { result, loading, reload: load };
}

function CustomerAnalyticsTab() {
  const segmentation = useAnalyticsResult('/customer-intelligence/segmentation');
  const churn = useAnalyticsResult('/customer-intelligence/churn');
  const recs = useAnalyticsResult('/customer-intelligence/recommendations');
  const validation = useAnalyticsResult('/registry/validation');
  const [runningAll, setRunningAll] = useState(false);
  const [error, setError] = useState('');

  const runAll = async () => {
    setRunningAll(true); setError('');
    try {
      const res = await analyticsApi.post('/registry/run-all');
      const failed = Object.entries(res.data.results || {}).filter(([, v]) => v !== 'ok');
      if (failed.length) {
        setError(`${failed.length} model(s) failed: ${failed.map(([k, v]) => `${k} (${v})`).join('; ')}`);
      }
      segmentation.reload(); churn.reload(); recs.reload(); validation.reload();
    } catch (err) {
      setError('Failed to trigger models. Is the analytics-service (FastAPI) running and reachable at VITE_ANALYTICS_API_URL?');
    } finally {
      setRunningAll(false);
    }
  };

  const seg = segmentation.result?.payload;
  const churnData = churn.result?.payload;
  const recData = recs.result?.payload;
  const valData = validation.result?.payload;

  const inventoryChartData = valData?.inventory_forecast?.mae != null
    ? [{ metric: 'MAE', value: valData.inventory_forecast.mae }, { metric: 'RMSE', value: valData.inventory_forecast.rmse }]
    : [];
  const recChartData = valData?.recommendations?.precision_at_k != null
    ? [
        { metric: `Precision@${valData.recommendations.top_k}`, value: valData.recommendations.precision_at_k },
        { metric: `Recall@${valData.recommendations.top_k}`, value: valData.recommendations.recall_at_k },
      ]
    : [];
  const segChartData = valData?.segmentation?.silhouette_score != null
    ? [{ metric: 'Silhouette score', value: valData.segmentation.silhouette_score }]
    : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Inventory Intelligence & Customer Analytics</h3>
          <p className="text-xs text-gray-400 mt-0.5">Python ML models: segmentation (KMeans), churn scoring, hybrid recommendations, and holdout validation.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadReport('customer_segmentation', 'xlsx')}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600">
            <Download size={14} /> Segments
          </button>
          <button onClick={() => downloadReport('churn_analysis', 'xlsx')}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600">
            <Download size={14} /> Churn
          </button>
          <button onClick={runAll} disabled={runningAll}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800 disabled:opacity-60">
            <RefreshCw size={14} className={runningAll ? 'animate-spin' : ''} /> {runningAll ? 'Running all models…' : 'Run all models'}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</div>}

      <div className="rounded-xl border border-gray-100 bg-white p-6">
        <h4 className="font-semibold text-gray-900 mb-1">Customer segmentation</h4>
        <p className="text-xs text-gray-400 mb-4">RFM features (recency/frequency/monetary) clustered with KMeans.</p>
        {segmentation.loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : !seg || !seg.segment_summary?.length ? (
          <p className="text-gray-400 text-sm">Not run yet, or not enough order history — click "Run all models".</p>
        ) : (
          <>
            <div className="grid lg:grid-cols-5 gap-6 mb-4">
              <div className="lg:col-span-2 flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={seg.segment_summary} dataKey="customers" nameKey="segment_label" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {seg.segment_summary.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} customers`, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1 w-full">
                  {seg.segment_summary.map((s, i) => (
                    <div key={s.segment_label} className="flex items-center gap-1.5 text-xs min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-500 truncate">{s.segment_label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-3 grid sm:grid-cols-2 gap-4">
                {seg.segment_summary.map((s) => (
                  <div key={s.segment_label} className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                    <div className="text-sm font-semibold text-gray-900">{s.segment_label}</div>
                    <div className="text-2xl font-display font-semibold text-brand-700 mt-1">{s.customers}</div>
                    <div className="text-xs text-gray-400 mt-1">avg {formatINR(s.avg_monetary)} · {Math.round(s.avg_recency_days)}d since last order</div>
                  </div>
                ))}
              </div>
            </div>
            {seg.silhouette_score != null && (
              <p className="text-xs text-gray-400">Cluster quality (silhouette score): <span className="font-mono">{seg.silhouette_score.toFixed(3)}</span></p>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6">
        <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><TrendingDown size={16} className="text-red-500" /> Churn risk</h4>
        <p className="text-xs text-gray-400 mb-4">Rule-based scoring on ordering-cadence slowdown vs. each customer's own history.</p>
        {churn.loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : !churnData || !churnData.at_risk_customers?.length ? (
          <p className="text-gray-400 text-sm">Not run yet, or no at-risk customers found.</p>
        ) : (
          <div className="space-y-2">
            {churnData.at_risk_customers.slice(0, 8).map((c) => (
              <div key={c.customer_id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                <div>
                  <span className="font-medium text-gray-900">{c.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{c.reason}</span>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.risk_level === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {c.risk_level} · {c.risk_score}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="rounded-xl border border-gray-100 bg-white p-6">
        <h4 className="font-semibold text-gray-900 mb-1">Personalized recommendations</h4>
        <p className="text-xs text-gray-400 mb-4">{recData?.method || 'Hybrid collaborative + content-based filtering.'}</p>
        {recs.loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : !recData || !recData.customer_recommendations?.length ? (
          <p className="text-gray-400 text-sm">Not run yet, or not enough purchase history.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {recData.customer_recommendations.slice(0, 4).map((c) => (
              <div key={c.customer_id} className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                <div className="text-sm font-semibold text-gray-900 mb-2">{c.customer_name}</div>
                <ul className="text-xs text-gray-500 space-y-1">
                  {c.recommendations.slice(0, 4).map((r) => (
                    <li key={r.product_id} className="flex justify-between"><span>{r.name}</span><span>{formatINR(r.price)}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation - now with charts */}
      <div className="rounded-xl border border-gray-100 bg-white p-6">
        <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" /> Model validation</h4>
        <p className="text-xs text-gray-400 mb-4">Backtested against held-out historical marketplace data (train/test split).</p>
        {validation.loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : !valData ? (
          <p className="text-gray-400 text-sm">Not run yet — click "Run all models".</p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-6">
            <div>
              <div className="text-xs text-gray-400 uppercase mb-2">Inventory forecast error</div>
              {inventoryChartData.length ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={inventoryChartData}>
                    <XAxis dataKey="metric" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1fae9c" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="text-gray-400 text-xs py-8">{valData.inventory_forecast?.note}</div>}
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase mb-2">Recommendation accuracy</div>
              {recChartData.length ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={recChartData}>
                    <XAxis dataKey="metric" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#4fd8c4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="text-gray-400 text-xs py-8">{valData.recommendations?.note}</div>}
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase mb-2">Segmentation quality</div>
              {segChartData.length ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={segChartData}>
                    <XAxis dataKey="metric" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} domain={[-1, 1]} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8a8fa8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="text-gray-400 text-xs py-8">{valData.segmentation?.note}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MarketplaceBenchmarkingSection() {
  const { result, loading, reload } = useAnalyticsResult('/benchmarking/marketplace');
  const payload = result?.payload;
  const ms = payload?.marketplace_summary;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6">
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-semibold text-gray-900 flex items-center gap-2"><TrendingUp size={16} className="text-brand-600" /> Marketplace benchmarking</h4>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadReport('revenue_benchmarking', 'xlsx')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600">
            <Download size={13} /> Export
          </button>
          <button onClick={reload} className="text-xs text-gray-500 hover:text-brand-600"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">Period-over-period growth, percentile ranking, and category leaders across all approved vendors.</p>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : !ms ? (
        <p className="text-gray-400 text-sm">Not run yet — run it from the Model Registry section below.</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Marketplace revenue (30d)</div>
              <div className="text-xl font-display font-semibold text-gray-900 mt-1.5">{formatINR(ms.total_revenue_current)}</div>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Growth vs. prior 30d</div>
              <div className={`text-xl font-display font-semibold mt-1.5 ${ms.marketplace_growth_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {ms.marketplace_growth_pct >= 0 ? '+' : ''}{ms.marketplace_growth_pct}%
              </div>
              <div className="h-1 rounded-full bg-gray-200 mt-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${ms.marketplace_growth_pct >= 0 ? 'bg-green-500' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(Math.abs(ms.marketplace_growth_pct), 100)}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Vendors benchmarked</div>
              <div className="text-xl font-display font-semibold text-gray-900 mt-1.5">{ms.vendor_count}</div>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Category leaders</div>
              <div className="text-xs text-gray-600 mt-2 space-y-1">
                {ms.category_leaders?.slice(0, 3).map((c) => (
                  <div key={c.category} className="flex justify-between gap-2"><span className="text-gray-400">{c.category}</span><span className="font-medium">{c.vendor_name}</span></div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Marketplace revenue — last 12 weeks</h5>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={ms.revenue_trend}>
                  <defs>
                    <linearGradient id="revenueFillWeekly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1fae9c" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#1fae9c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="week_label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => formatINR(v)} labelFormatter={(d) => `Week of ${new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`} />
                  <Area type="monotone" dataKey="revenue" stroke="#1fae9c" strokeWidth={2.5} fill="url(#revenueFillWeekly)" dot={{ r: 3, fill: '#1fae9c', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Vendors by revenue (30d)</h5>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={payload.vendors?.slice(0, 8)} layout="vertical" margin={{ left: 24 }}>
                  <defs>
                    <linearGradient id="vendorBarFill" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#1fae9c" />
                      <stop offset="100%" stopColor="#4fd8c4" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}`} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="vendor_name" tick={{ fontSize: 10 }} width={110} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => formatINR(v)} />
                  <Bar dataKey="revenue_current" fill="url(#vendorBarFill)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {ms.category_summary?.length > 0 && (
            <div className="mb-6">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Revenue by category</h5>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                {ms.category_summary.map((c) => (
                  <div key={c.category} className="rounded-lg bg-gray-50 border-l-2 border-brand-500 p-3">
                    <div className="text-xs text-gray-500">{c.category}</div>
                    <div className="text-sm font-display font-semibold text-gray-900 mt-0.5">{formatINR(c.total_revenue_current)}</div>
                    <div className={`text-xs mt-0.5 ${c.growth_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {c.growth_pct >= 0 ? '+' : ''}{c.growth_pct}% · {c.vendor_count} vendor{c.vendor_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2">Vendor</th>
                  <th className="text-left px-3 py-2">Category</th>
                  <th className="text-left px-3 py-2">Revenue (30d)</th>
                  <th className="text-left px-3 py-2">Growth</th>
                  <th className="text-left px-3 py-2">Projected 30d</th>
                  <th className="text-left px-3 py-2">Percentile</th>
                  <th className="text-left px-3 py-2">AOV</th>
                </tr>
              </thead>
              <tbody>
                {payload.vendors?.map((v, i) => (
                  <tr key={v.vendor_id} className={`border-t border-gray-50 hover:bg-gray-50/60 transition-colors ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-3 py-2 font-medium text-gray-900">{v.vendor_name}</td>
                    <td className="px-3 py-2 text-gray-500">{v.category}</td>
                    <td className="px-3 py-2 text-gray-500">{formatINR(v.revenue_current)}</td>
                    <td className={`px-3 py-2 font-medium ${v.growth_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>{v.growth_pct >= 0 ? '+' : ''}{v.growth_pct}%</td>
                    <td className="px-3 py-2 text-gray-500">{formatINR(v.projected_next_30d?.projected_revenue)}</td>
                    <td className="px-3 py-2 text-gray-500">{ordinal(v.revenue_percentile)}</td>
                    <td className="px-3 py-2 text-gray-500">{formatINR(v.aov_current)}</td>
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

function ModelRegistrySection() {
  const [models, setModels] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [versions, setVersions] = useState([]);
  const [runningAll, setRunningAll] = useState(false);

  const load = () => {
    setLoading(true);
    analyticsApi.get('/registry/models').then((res) => setModels(res.data.models)).catch(() => setModels([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const viewVersions = async (modelType) => {
    if (expanded === modelType) { setExpanded(null); return; }
    try {
      const res = await analyticsApi.get(`/registry/models/${modelType}/versions`);
      setVersions(res.data.versions || []);
      setExpanded(modelType);
    } catch (err) {
      setVersions([]);
      setExpanded(modelType);
    }
  };

  const promote = async (modelType, version) => {
    await analyticsApi.post(`/registry/models/${modelType}/promote/${version}`);
    load();
    viewVersions(modelType);
  };

  const runAll = async () => {
    setRunningAll(true);
    try {
      await analyticsApi.post('/registry/run-all');
      load();
    } finally {
      setRunningAll(false);
    }
  };

  const statusColors = { active: 'bg-green-100 text-green-700', archived: 'bg-gray-100 text-gray-500', failed: 'bg-red-100 text-red-700' };

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6">
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-semibold text-gray-900 flex items-center gap-2"><Database size={16} className="text-ink-700" /> Model registry</h4>
        <button onClick={runAll} disabled={runningAll}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800 disabled:opacity-60">
          <RefreshCw size={13} className={runningAll ? 'animate-spin' : ''} /> {runningAll ? 'Running pipeline…' : 'Run automated pipeline'}
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-4">Every run is versioned. Promote an older version to roll back a model.</p>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : !models?.length ? (
        <p className="text-gray-400 text-sm">No models have been run yet.</p>
      ) : (
        <div className="space-y-2">
          {models.map((m) => (
            <div key={m.model_type} className="border border-gray-100 rounded-lg">
              <button onClick={() => viewVersions(m.model_type)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50">
                <div>
                  <span className="font-medium text-gray-900 text-sm">{m.model_type}</span>
                  <span className="text-xs text-gray-400 ml-3">v{m.version} · {m.triggered_by} · {new Date(m.trained_at).toLocaleString('en-IN')}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[m.status]}`}>{m.status}</span>
              </button>
              {expanded === m.model_type && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-2 bg-gray-50">
                  {versions.map((v) => (
                    <div key={v.version} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">
                        v{v.version} · {v.triggered_by} · {new Date(v.trained_at).toLocaleString('en-IN')}
                        {v.duration_ms != null && ` · ${(v.duration_ms / 1000).toFixed(1)}s`}
                        {v.error && <span className="text-red-500 ml-2">{v.error.slice(0, 60)}</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full font-medium ${statusColors[v.status]}`}>{v.status}</span>
                        {v.status === 'archived' && (
                          <button onClick={() => promote(m.model_type, v.version)} className="text-brand-600 hover:underline">Promote</button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExecutiveSummarySection() {
  const { result: summary, loading, reload } = useAnalyticsResult('/reports/executive-summary');

  if (loading) return <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-gray-400">Loading executive summary…</div>;
  if (!summary) return null;

  const { sections, note } = summary;
  const revenue = sections.revenue;
  const inventory = sections.inventory;
  const churn = sections.churn_risk;
  const confidence = sections.model_confidence;

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 text-white p-6">
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-display font-semibold flex items-center gap-2"><TrendingUp size={16} className="text-brand-400" /> Executive Summary</h4>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadReport('executive_summary', 'pdf')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-ink-700 text-ink-200 hover:border-brand-400 hover:text-brand-400">
            <Download size={13} /> Export PDF
          </button>
          <button onClick={reload} className="text-xs text-ink-400 hover:text-brand-400"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>
      <p className="text-xs text-ink-400 mb-5">One-page rollup across every model — for leadership, not deep analysis.</p>

      {note && <div className="text-xs text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2 mb-4">{note}</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg bg-white/5 border border-ink-700 p-4">
          <div className="text-[10px] text-ink-400 uppercase tracking-wide">Marketplace Revenue (30d)</div>
          <div className="font-display text-xl font-semibold mt-1">{revenue ? formatINR(revenue.total_revenue_30d) : '—'}</div>
          <div className="text-xs text-brand-400 mt-1">{revenue ? `${revenue.growth_pct >= 0 ? '+' : ''}${revenue.growth_pct}% · ${revenue.vendor_count} vendors` : 'not run yet'}</div>
          {revenue && (
            <div className="h-1 rounded-full bg-white/10 mt-3 overflow-hidden">
              <div className={`h-full rounded-full ${revenue.growth_pct >= 0 ? 'bg-brand-400' : 'bg-red-400'}`} style={{ width: `${Math.min(Math.abs(revenue.growth_pct), 100)}%` }} />
            </div>
          )}
        </div>
        <div className="rounded-lg bg-white/5 border border-ink-700 p-4">
          <div className="text-[10px] text-ink-400 uppercase tracking-wide">Inventory Alerts</div>
          <div className="font-display text-xl font-semibold mt-1">{inventory ? inventory.products_needing_replenishment : '—'}</div>
          <div className="text-xs text-ink-400 mt-1">{inventory ? `of ${inventory.products_analyzed} products need reorder` : 'not run yet'}</div>
          {inventory && (
            <div className="h-1 rounded-full bg-white/10 mt-3 overflow-hidden">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min((inventory.products_needing_replenishment / Math.max(inventory.products_analyzed, 1)) * 100, 100)}%` }} />
            </div>
          )}
        </div>
        <div className="rounded-lg bg-white/5 border border-ink-700 p-4">
          <div className="text-[10px] text-ink-400 uppercase tracking-wide">Churn Risk</div>
          <div className="font-display text-xl font-semibold mt-1">{churn ? churn.high_risk : '—'}</div>
          <div className="text-xs text-ink-400 mt-1">{churn ? `high risk · ${churn.medium_risk} medium` : 'not run yet'}</div>
          {churn && (
            <div className="h-1 rounded-full bg-white/10 mt-3 overflow-hidden">
              <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.min((churn.high_risk / Math.max(churn.high_risk + churn.medium_risk, 1)) * 100, 100)}%` }} />
            </div>
          )}
        </div>
        <div className="rounded-lg bg-white/5 border border-ink-700 p-4">
          <div className="text-[10px] text-ink-400 uppercase tracking-wide">Model Confidence</div>
          <div className="font-display text-xl font-semibold mt-1">{confidence?.segmentation_silhouette != null ? confidence.segmentation_silhouette.toFixed(2) : '—'}</div>
          <div className="text-xs text-ink-400 mt-1">segmentation silhouette</div>
          {confidence?.segmentation_silhouette != null && (
            <div className="h-1 rounded-full bg-white/10 mt-3 overflow-hidden">
              <div className="h-full rounded-full bg-brand-400" style={{ width: `${Math.max(Math.min(((confidence.segmentation_silhouette + 1) / 2) * 100, 100), 0)}%` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdvancedAnalyticsTab() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-semibold text-gray-900">Advanced Analytics & BI (Milestone 3)</h3>
        <p className="text-xs text-gray-400 mt-0.5">Served by the FastAPI analytics-service — revenue benchmarking, model registry, and automated pipelines.</p>
      </div>
      <ExecutiveSummarySection />
      <MarketplaceBenchmarkingSection />
      <ModelRegistrySection />
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return 'never';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function TerminalLine({ status, label, detail, indent }) {
  const symbol = status === 'pending' ? '…' : status === 'ok' ? '✓' : status === 'warn' ? '!' : '✗';
  const color = status === 'pending' ? 'text-gray-500' : status === 'ok' ? 'text-green-400' : status === 'warn' ? 'text-amber-400' : 'text-red-400';
  return (
    <div className={`flex items-baseline gap-2 ${indent ? 'pl-6' : ''}`}>
      <span className={`${color} w-4 flex-shrink-0`}>{symbol}</span>
      <span className="text-gray-300 whitespace-nowrap">{label}</span>
      <span className="flex-1 border-b border-dotted border-gray-800 mx-1 translate-y-[-3px]" />
      <span className={`${color} whitespace-nowrap font-medium`}>{detail}</span>
    </div>
  );
}

function SystemStatusTab() {
  const [nodeHealth, setNodeHealth] = useState({ state: 'pending' });
  const [analyticsHealth, setAnalyticsHealth] = useState({ state: 'pending' });
  const [models, setModels] = useState({ state: 'pending', data: [] });
  const [lastChecked, setLastChecked] = useState(null);
  const [checking, setChecking] = useState(false);

  const runChecks = async () => {
    setChecking(true);
    const start = Date.now();

    api.get('/health')
      .then((res) => setNodeHealth({ state: 'ok', data: res.data, latency: Date.now() - start }))
      .catch((err) => setNodeHealth({ state: 'error', error: err.message }));

    const analyticsStart = Date.now();
    analyticsApi.get('/health')
      .then((res) => setAnalyticsHealth({ state: res.data.status === 'ok' ? 'ok' : 'warn', data: res.data, latency: Date.now() - analyticsStart }))
      .catch((err) => setAnalyticsHealth({ state: 'error', error: err.message }));

    analyticsApi.get('/registry/models')
      .then((res) => setModels({ state: 'ok', data: res.data.models || [] }))
      .catch((err) => setModels({ state: 'error', data: [], error: err.message }));

    setLastChecked(new Date());
    setChecking(false);
  };

  useEffect(() => {
    runChecks();
    const interval = setInterval(runChecks, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ALL_MODEL_TYPES = [
    'inventory_forecast', 'customer_segmentation', 'recommendations',
    'churn_analysis', 'revenue_benchmarking', 'spending_analysis', 'validation',
  ];
  const modelByType = Object.fromEntries((models.data || []).map((m) => [m.model_type, m]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Terminal size={16} /> System Status</h3>
          <p className="text-xs text-gray-400 mt-0.5">Live health checks across every service — auto-refreshes every 15s.</p>
        </div>
        <button onClick={runChecks} disabled={checking}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600 disabled:opacity-60">
          <RefreshCw size={13} className={checking ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-800 shadow-lg">
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 border-b border-gray-800">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          <span className="ml-3 text-xs font-mono text-gray-500">shopsense@admin:~$ status --watch</span>
        </div>
        <div className="bg-black p-5 font-mono text-sm space-y-2.5 overflow-x-auto">
          <TerminalLine status="ok" label="Frontend (React)" detail="RENDERING" />

          <TerminalLine
            status={nodeHealth.state === 'pending' ? 'pending' : nodeHealth.state === 'ok' ? 'ok' : 'fail'}
            label="Backend API (Node/Express)"
            detail={
              nodeHealth.state === 'ok' ? `OK · ${nodeHealth.latency}ms`
                : nodeHealth.state === 'error' ? 'UNREACHABLE' : 'checking…'
            }
          />
          {nodeHealth.state === 'ok' && (
            <TerminalLine indent status={nodeHealth.data.db === 'connected' ? 'ok' : 'fail'}
              label="└─ PostgreSQL (via Node)" detail={nodeHealth.data.db === 'connected' ? `connected · ${nodeHealth.data.db_latency_ms}ms` : 'unreachable'} />
          )}

          <TerminalLine
            status={analyticsHealth.state === 'pending' ? 'pending' : analyticsHealth.state === 'ok' ? 'ok' : analyticsHealth.state === 'warn' ? 'warn' : 'fail'}
            label="Analytics Service (FastAPI)"
            detail={
              analyticsHealth.state === 'ok' ? `OK · ${analyticsHealth.latency}ms`
                : analyticsHealth.state === 'warn' ? 'DEGRADED'
                : analyticsHealth.state === 'error' ? 'UNREACHABLE' : 'checking…'
            }
          />
          {(analyticsHealth.state === 'ok' || analyticsHealth.state === 'warn') && (
            <>
              <TerminalLine indent status={analyticsHealth.data.db === 'connected' ? 'ok' : 'fail'}
                label="└─ PostgreSQL (via FastAPI)" detail={analyticsHealth.data.db === 'connected' ? `connected · ${analyticsHealth.data.db_latency_ms}ms` : 'unreachable'} />
              <TerminalLine indent status={analyticsHealth.data.scheduler_enabled ? 'ok' : 'warn'}
                label="└─ Automated pipeline scheduler" detail={analyticsHealth.data.scheduler_enabled ? `every ${analyticsHealth.data.pipeline_interval_hours}h` : 'disabled'} />
            </>
          )}

          <div className="pt-2 text-gray-600">── ML models (registry) ──────────────</div>
          {models.state === 'error' && <TerminalLine status="fail" label="Model registry" detail="UNREACHABLE" />}
          {models.state !== 'error' && ALL_MODEL_TYPES.map((type) => {
            const m = modelByType[type];
            if (!m) return <TerminalLine key={type} status="warn" label={type} detail="not run yet" />;
            const status = m.status === 'active' ? 'ok' : m.status === 'failed' ? 'fail' : 'warn';
            const detail = m.status === 'failed'
              ? `FAILED v${m.version} · ${timeAgo(m.trained_at)}`
              : `${m.status} v${m.version} · ${timeAgo(m.trained_at)}`;
            return <TerminalLine key={type} status={status} label={type} detail={detail} />;
          })}

          <div className="pt-2 text-gray-600 text-xs">
            {lastChecked && `last checked ${lastChecked.toLocaleTimeString('en-IN')}`}
            <span className="ml-1 inline-block w-2 h-3.5 bg-green-400 align-middle animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('Analytics');
  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-gray-900 mb-1">Admin Dashboard</h1>
      <p className="text-gray-500 mb-8">Marketplace-wide analytics, vendor lifecycle, and ML-driven customer intelligence.</p>

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

      {tab === 'Analytics' && <AnalyticsTab />}
      {tab === 'Vendor Approvals' && <VendorApprovalsTab />}
      {tab === 'Customer Analytics' && <CustomerAnalyticsTab />}
      {tab === 'Advanced Analytics (BI)' && <AdvancedAnalyticsTab />}
      {tab === 'System Status' && <SystemStatusTab />}
    </div>
  );
}
