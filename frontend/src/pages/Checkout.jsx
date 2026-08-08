import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatINR } from '../utils/format';
import api from '../api/axios';

export default function Checkout() {
  const { cartItems, refreshCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ shippingName: user?.name || '', shippingAddress: '', shippingPhone: '' });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  const total = cartItems.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
  const vendorGroups = [...new Set(cartItems.map((i) => i.vendor_name))];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPlacing(true);
    try {
      await api.post('/orders/checkout', form);
      await refreshCart();
      navigate('/orders?justPlaced=1');
    } catch (err) {
      setError(err.response?.data?.error || 'Checkout failed');
    } finally {
      setPlacing(false);
    }
  };

  if (cartItems.length === 0) {
    return <div className="max-w-3xl mx-auto px-6 py-24 text-center text-gray-500">Your cart is empty.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-gray-900 mb-8">Checkout</h1>
      <div className="grid md:grid-cols-2 gap-8">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Shipping details</h3>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="text-sm font-medium text-gray-700">Full name</label>
            <input required value={form.shippingName} onChange={(e) => setForm({ ...form, shippingName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Delivery address</label>
            <textarea required rows={3} value={form.shippingAddress} onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="House / street, area, city, state, PIN" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Phone number</label>
            <input required value={form.shippingPhone} onChange={(e) => setForm({ ...form, shippingPhone: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="98XXXXXXXX" />
          </div>
          {vendorGroups.length > 1 && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              Your cart spans {vendorGroups.length} vendors — this will be placed as {vendorGroups.length} separate orders, one per vendor.
            </p>
          )}
          <button disabled={placing} className="w-full py-3 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-60">
            {placing ? 'Placing order…' : `Place order — ${formatINR(total)}`}
          </button>
          <p className="text-xs text-gray-400 text-center">Demo checkout — no real payment is processed.</p>
        </form>

        <div className="rounded-xl border border-gray-100 bg-white p-6 h-fit">
          <h3 className="font-semibold text-gray-900 mb-4">Order items</h3>
          <div className="space-y-3">
            {cartItems.map((item) => (
              <div key={item.cart_item_id} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.name} × {item.quantity}</span>
                <span className="text-gray-500">{formatINR(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between font-semibold text-gray-900">
            <span>Total</span><span>{formatINR(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
