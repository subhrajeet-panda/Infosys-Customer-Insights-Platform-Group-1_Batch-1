import React from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts';
import {
  TrendingUp, Users, ShieldAlert, Sparkles, Database, LineChart as LineChartIcon,
} from 'lucide-react';

const TICKER = [
  { label: 'Electronics', delta: '+18.2%' },
  { label: 'Fashion', delta: '+9.4%' },
  { label: 'Home & Kitchen', delta: '+6.1%' },
  { label: 'Beauty', delta: '+14.7%' },
  { label: 'Active vendors', delta: '128' },
  { label: 'Orders today', delta: '3,204' },
  { label: 'Forecast accuracy', delta: '94.1%' },
  { label: 'Avg. approval time', delta: '4.2 hrs' },
];

const PREVIEW_REVENUE = [
  { day: 'Mon', revenue: 42000 }, { day: 'Tue', revenue: 48500 }, { day: 'Wed', revenue: 45200 },
  { day: 'Thu', revenue: 53800 }, { day: 'Fri', revenue: 61200 }, { day: 'Sat', revenue: 58900 },
  { day: 'Sun', revenue: 67400 },
];
const PREVIEW_VENDORS = [
  { name: 'UrbanThread', revenue: 82 }, { name: 'GadgetHive', revenue: 64 },
  { name: 'HomeNest', revenue: 47 }, { name: 'PureGlow', revenue: 38 },
];
const PREVIEW_COLORS = ['#1fae9c', '#4fd8c4', '#8a8fa8', '#c7cadb'];

const CAPABILITIES = [
  { icon: LineChartIcon, title: 'Inventory Forecasting', desc: 'Linear-trend demand forecasting with safety-stock reorder points, per product.' },
  { icon: Users, title: 'Customer Segmentation', desc: 'RFM features clustered with KMeans — Champions, Loyal, At Risk, New.' },
  { icon: ShieldAlert, title: 'Churn Detection', desc: 'Transparent, rule-based risk scoring cross-referenced with browsing activity.' },
  { icon: TrendingUp, title: 'Revenue Benchmarking', desc: 'Period-over-period growth, marketplace percentile, category peer comparison.' },
  { icon: Sparkles, title: 'Recommendation Engine', desc: 'Hybrid collaborative + content-based filtering, with cold-start fallback.' },
  { icon: Database, title: 'Versioned Model Registry', desc: 'Every pipeline run tracked, promotable, and validated against holdout data.' },
];

const ROLES = [
  {
    role: 'Vendor',
    tagline: 'Bring your catalogue. We bring the customers, the forecasts, and the benchmarks.',
    points: ['Upload products with images in seconds', 'Demand forecasts & reorder alerts per product', 'See how you rank against the marketplace'],
    cta: 'Register as a vendor',
    link: '/register?role=vendor',
  },
  {
    role: 'Customer',
    tagline: 'Shop a curated marketplace of verified, approved sellers.',
    points: ['Browse by category across all vendors', 'Personalized recommendations as you shop', 'Track every order from placed to delivered'],
    cta: 'Register as a customer',
    link: '/register?role=customer',
  },
];

function Ticker() {
  const items = [...TICKER, ...TICKER];
  return (
    <div className="relative overflow-hidden border-y border-ink-700/60 bg-ink-800/60 py-3">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink-900 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink-900 to-transparent z-10" />
      <div className="flex gap-10 whitespace-nowrap animate-[scroll_28s_linear_infinite] font-mono text-sm text-ink-200">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-ink-400">{item.label}</span>
            <span className={item.delta.startsWith('+') ? 'text-brand-400' : 'text-white'}>{item.delta}</span>
            <span className="text-ink-700">•</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[scroll_28s_linear_infinite\\] { animation: none; }
        }
      `}</style>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-800 overflow-hidden shadow-2xl shadow-black/40 transition-transform duration-300 hover:-translate-y-1">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-ink-700 bg-ink-800/80">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
        <span className="ml-3 text-xs font-mono text-ink-400">admin.shopsense.app/analytics</span>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <span className="font-display font-semibold text-sm">Marketplace Analytics</span>
          <span className="flex items-center gap-1.5 text-xs font-mono text-brand-400">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" /> LIVE DEMO DATA
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Revenue (7d)', value: '₹3.8L', delta: '+12.4%' },
            { label: 'Active Models', value: '6', delta: 'all healthy' },
            { label: 'Forecast Acc.', value: '94.1%', delta: 'validated' },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-lg bg-ink-900/60 border border-ink-700 p-3">
              <div className="text-[10px] text-ink-400 uppercase tracking-wide">{kpi.label}</div>
              <div className="font-display font-semibold text-lg mt-0.5">{kpi.value}</div>
              <div className="text-[10px] text-brand-400 mt-0.5">{kpi.delta}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-ink-900/60 border border-ink-700 p-3">
          <div className="text-[10px] text-ink-400 uppercase tracking-wide mb-2">Revenue trend</div>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={PREVIEW_REVENUE} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#20264a" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#8a8fa8' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: '#171b34', border: '1px solid #20264a', fontSize: 11 }} />
              <Line type="monotone" dataKey="revenue" stroke="#2dd4bf" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg bg-ink-900/60 border border-ink-700 p-3">
          <div className="text-[10px] text-ink-400 uppercase tracking-wide mb-2">Top vendors by revenue</div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={PREVIEW_VENDORS} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#8a8fa8' }} width={70} axisLine={false} tickLine={false} />
              <Bar dataKey="revenue" radius={[0, 3, 3, 0]}>
                {PREVIEW_VENDORS.map((_, i) => <Cell key={i} fill={PREVIEW_COLORS[i % PREVIEW_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="bg-ink-900 text-white">
      
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-16">
        <div className="grid md:grid-cols-2 gap-14 items-center">
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 text-xs font-mono tracking-wide mb-6">
              MULTIVENDOR MARKETPLACE ANALYTICS
            </span>
            <h1 className="font-display text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight">
              Every sale,<br />
              <span className="text-brand-400">sensed</span> in real time.
            </h1>
            <p className="mt-6 text-lg text-ink-200 max-w-md leading-relaxed">
              ShopSense pairs a real multivendor marketplace with a full
              analytics stack — forecasting, segmentation, churn detection,
              and revenue benchmarking — running on a versioned model
              registry, not a spreadsheet.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link to="/register?role=vendor" className="px-6 py-3 rounded-lg bg-brand-500 text-ink-900 font-semibold hover:bg-brand-400 transition">
                Start selling as a vendor
              </Link>
              <Link to="/register?role=customer" className="px-6 py-3 rounded-lg border border-ink-700 text-white font-semibold hover:border-brand-500 hover:text-brand-400 transition">
                Shop as a customer
              </Link>
            </div>
          </div>

          <DashboardPreview />
        </div>
      </section>

      <Ticker />

      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="font-display text-3xl font-semibold mb-2">Not just a storefront — a full analytics stack.</h2>
        <p className="text-ink-400 mb-10 max-w-2xl">
          A FastAPI analytics service runs six production ML pipelines against real marketplace data, with a model registry that versions, validates, and lets you roll back every run.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CAPABILITIES.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-ink-700 bg-ink-800/60 p-6 transition-colors duration-200 hover:border-brand-500/60 hover:bg-ink-800"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4">
                <c.icon size={20} className="text-brand-400" />
              </div>
              <h3 className="font-display font-semibold mb-1.5">{c.title}</h3>
              <p className="text-sm text-ink-400 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="font-display text-3xl font-semibold mb-2">One platform, built for both sides.</h2>
        <p className="text-ink-400 mb-10 max-w-2xl">Whoever you are in the marketplace, ShopSense gives you the view built for your job.</p>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
          {ROLES.map((card) => (
            <div key={card.role} className="rounded-2xl border border-ink-700 bg-ink-800 p-8 flex flex-col">
              <span className="font-display text-xl font-semibold text-brand-400">{card.role}</span>
              <p className="mt-2 text-ink-200 text-sm leading-relaxed">{card.tagline}</p>
              <ul className="mt-5 space-y-2.5 text-sm text-ink-400 flex-1">
                {card.points.map((p) => (
                  <li key={p} className="flex gap-2"><span className="text-brand-500">—</span>{p}</li>
                ))}
              </ul>
              <Link to={card.link} className="mt-6 text-center px-4 py-2.5 rounded-lg bg-white/5 border border-ink-700 hover:border-brand-500 hover:text-brand-400 transition text-sm font-semibold">
                {card.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-ink-800 bg-ink-800/40">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="font-display text-3xl font-semibold mb-10">From application to first sale.</h2>
          <div className="grid md:grid-cols-4 gap-6 font-mono text-sm">
            {[
              ['01', 'Register', 'Vendor submits business details & categories.'],
              ['02', 'Review', 'Admin checks compliance & approves or requests changes.'],
              ['03', 'List', 'Vendor uploads catalogue with Cloudinary-hosted images.'],
              ['04', 'Sell & learn', 'Orders flow into analytics, forecasting & benchmarking.'],
            ].map(([n, title, desc]) => (
              <div key={n} className="border-t-2 border-brand-500 pt-4">
                <div className="text-brand-400 mb-2">{n}</div>
                <div className="font-display text-base font-semibold text-white mb-1">{title}</div>
                <div className="text-ink-400 font-body">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-800 py-10 text-center">
        <p className="text-ink-400 text-sm">
          © {new Date().getFullYear()} ShopSense — a multivendor marketplace with a real analytics stack.
        </p>
        <p className="text-ink-700 text-xs font-mono mt-2">
          Node · FastAPI · PostgreSQL · React · scikit-learn
        </p>
      </footer>
    </div>
  );
}
