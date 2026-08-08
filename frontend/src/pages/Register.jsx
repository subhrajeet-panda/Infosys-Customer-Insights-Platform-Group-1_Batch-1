import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ROLES = [
  { value: 'customer', label: 'Customer', desc: 'Shop the marketplace' },
  { value: 'vendor', label: 'Vendor', desc: 'Sell your products' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') || 'customer');
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    businessName: '', businessDescription: '', categories: '', businessAddress: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await register({ ...form, role });
      if (role === 'vendor') navigate('/vendor/dashboard');
      else navigate('/marketplace');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="font-display text-2xl font-semibold text-gray-900">Create your account</h1>
        <p className="text-gray-500 text-sm mt-1 mb-6">Choose how you'll use ShopSense.</p>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {ROLES.map((r) => (
            <button
              type="button" key={r.value}
              onClick={() => setRole(r.value)}
              className={`rounded-lg border px-3 py-3 text-left transition ${
                role === r.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-sm text-gray-900">{r.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
            </button>
          ))}
        </div>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Full name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          {role === 'vendor' && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Business details</p>
              <div>
                <label className="text-sm font-medium text-gray-700">Business name</label>
                <input required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea rows={2} value={form.businessDescription} onChange={(e) => setForm({ ...form, businessDescription: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Categories (comma-separated)</label>
                <input placeholder="Electronics, Fashion" value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Business address</label>
                <input value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Your vendor account will start as <strong>pending</strong> until an admin approves it.
              </p>
            </div>
          )}

          <button disabled={loading}
            className="w-full py-2.5 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800 transition disabled:opacity-60">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500 text-center">
          Already have an account? <Link to="/login" className="text-brand-600 font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
