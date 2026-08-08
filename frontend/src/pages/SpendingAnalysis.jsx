import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { RefreshCw, Download, TrendingUp, ShoppingBag, Wallet, Award } from 'lucide-react';
import analyticsApi from '../api/analyticsAxios';
import { formatINR, ordinal } from '../utils/format';
import { downloadReport } from '../utils/download';

const COLORS = ['#1fae9c', '#4fd8c4', '#8a8fa8', '#20264a', '#c7cadb'];

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
        {Icon && <Icon size={14} />} {label}
      </div>
      <div className="font-display text-2xl font-semibold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function SpendingAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    analyticsApi.get('/spending-analysis/mine')
      .then((res) => { setData(res.data); setError(''); })
      .catch((err) => setError(err.response?.data?.detail || 'Spending analysis not available yet'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const runModel = async () => {
    setRunning(true);
    try {
      await analyticsApi.post('/spending-analysis/run');
      load();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Model run failed';
      setError(typeof msg === 'string' ? msg : 'Model run failed — is the analytics service running?');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="text-gray-400 py-24 text-center">Loading your spending analysis…</div>;

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center space-y-4">
        <h1 className="font-display text-2xl font-semibold text-gray-900">Spending Analysis</h1>
        <p className="text-gray-400">{error || 'No spending data yet.'}</p>
        <button onClick={runModel} disabled={running}
          className="flex items-center gap-2 mx-auto text-sm px-5 py-2.5 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800 disabled:opacity-60">
          <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> {running ? 'Running…' : 'Run my spending analysis'}
        </button>
      </div>
    );
  }

  const { spending: s, marketplace_context: mc } = data;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-gray-900">Spending Analysis</h1>
          <p className="text-gray-500 mt-1">Where your money's going, and how it's trending.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runModel} disabled={running}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600 disabled:opacity-60">
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> {running ? 'Running…' : 'Refresh'}
          </button>
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800">
              <Download size={14} /> Export
            </button>
            <div className="absolute right-0 mt-1 w-32 rounded-lg border border-gray-100 bg-white shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-10">
              {['csv', 'xlsx', 'pdf'].map((fmt) => (
                <button key={fmt} onClick={() => downloadReport('spending_analysis', fmt)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 uppercase">
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-6">Version {data.version} · last updated {new Date(data.trained_at).toLocaleString('en-IN')}</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Wallet} label="Total Spent" value={formatINR(s.total_spent)}
          sub={`${s.growth_pct >= 0 ? '+' : ''}${s.growth_pct}% vs prior 30 days`} />
        <StatCard icon={ShoppingBag} label="Total Orders" value={s.total_orders}
          sub={`avg ${formatINR(s.avg_order_value)} per order`} />
        <StatCard icon={Award} label="Spender Percentile" value={ordinal(s.spending_percentile)}
          sub="among all ShopSense customers" />
        <StatCard icon={TrendingUp} label="Favorite Category" value={s.top_category || '—'}
          sub={mc ? `marketplace median: ${formatINR(mc.median_total_spent)}` : ''} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl border border-gray-100 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Monthly spending — last 6 months</h3>
          {s.monthly_trend?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={s.monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month_label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Line type="monotone" dataKey="spend" stroke="#1fae9c" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm py-16 text-center">No orders in the last 6 months yet.</p>}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Spending by category</h3>
          {s.category_breakdown?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={s.category_breakdown} dataKey="amount" nameKey="category" outerRadius={85} label={(entry) => `${entry.category} (${entry.pct}%)`}>
                  {s.category_breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm py-16 text-center">No purchases yet to break down by category.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Top vendors you've bought from</h3>
        {s.vendor_breakdown?.length ? (
          <ResponsiveContainer width="100%" height={Math.max(160, s.vendor_breakdown.length * 40)}>
            <BarChart data={s.vendor_breakdown} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
              <YAxis type="category" dataKey="vendor_name" tick={{ fontSize: 11 }} width={140} />
              <Tooltip formatter={(v) => formatINR(v)} />
              <Bar dataKey="amount" fill="#1fae9c" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-gray-400 text-sm py-8 text-center">No vendors purchased from yet.</p>}
      </div>
    </div>
  );
}
