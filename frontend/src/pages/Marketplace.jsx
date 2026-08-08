import React, { useEffect, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import api from '../api/axios';
import analyticsApi from '../api/analyticsAxios';
import ProductCard from '../components/ProductCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatINR } from '../utils/format';

function RecommendedForYou() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (user?.role === 'customer') {
      analyticsApi.get('/customer-intelligence/recommendations/mine')
        .then((res) => setData(res.data))
        .catch(() => setData(null));
    }
  }, [user]);

  if (user?.role !== 'customer' || !data || !data.recommendations?.length) return null;

  return (
    <div className="mb-10 rounded-2xl border border-brand-100 bg-brand-50/50 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} className="text-brand-600" />
        <h2 className="font-display text-lg font-semibold text-gray-900">Recommended for you</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {data.source === 'model' ? 'Based on your purchase history and browsing activity.' : data.method}
      </p>
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
        {data.recommendations.slice(0, 4).map((r) => (
          <div key={r.product_id} className="rounded-xl bg-white border border-gray-100 p-4">
            <span className="text-xs text-brand-600 font-medium">{r.category}</span>
            <h4 className="font-semibold text-gray-900 text-sm mt-1 truncate">{r.name}</h4>
            <p className="text-xs text-gray-400 mt-0.5">{r.vendor_name}</p>
            <span className="font-display font-semibold text-sm block mt-2">{formatINR(r.price)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/products/categories').then((res) => setCategories(res.data.categories));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (category) params.category = category;
    if (search) params.search = search;
    const t = setTimeout(() => {
      api.get('/products', { params }).then((res) => setProducts(res.data.products)).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [category, search]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-gray-900">Marketplace</h1>
        <p className="text-gray-500 mt-1">Browse products from approved vendors across ShopSense.</p>
      </div>

      <RecommendedForYou />

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mb-8 flex-wrap">
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(category === c ? '' : c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              category === c ? 'bg-ink-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 text-center py-20">Loading products…</div>
      ) : products.length === 0 ? (
        <div className="text-gray-400 text-center py-20">No products match your filters yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
