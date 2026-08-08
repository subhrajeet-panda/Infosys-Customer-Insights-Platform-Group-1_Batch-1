import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      if (data.user.role === 'vendor') navigate('/vendor/dashboard');
      else if (data.user.role === 'admin') navigate('/admin/dashboard');
      else navigate('/marketplace');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="font-display text-2xl font-semibold text-gray-900">Welcome back</h1>
        <p className="text-gray-500 text-sm mt-1 mb-6">Log in to your ShopSense account.</p>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input
              type="password" required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
            />
          </div>
          <button
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800 transition disabled:opacity-60"
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500 text-center">
          New to ShopSense? <Link to="/register" className="text-brand-600 font-medium">Create an account</Link>
        </p>

        <div className="mt-6 text-xs text-gray-400 border-t border-gray-100 pt-4">
          Demo logins (password: <span className="font-mono">Password123!</span>):<br />
          admin@shopsense.demo · vendor1@shopsense.demo · customer1@shopsense.demo
        </div>
      </div>
    </div>
  );
}
