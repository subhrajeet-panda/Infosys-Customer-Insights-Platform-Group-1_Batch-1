import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { formatINR } from '../utils/format';

export default function Cart() {
  const { cartItems, updateCartItem, removeFromCart } = useCart();
  const navigate = useNavigate();

  const total = cartItems.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);

  if (cartItems.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-gray-900">Your cart is empty</h1>
        <p className="text-gray-500 mt-2">Browse the marketplace and add something you like.</p>
        <Link to="/marketplace" className="inline-block mt-6 px-6 py-2.5 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800">
          Go to marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-gray-900 mb-8">Your Cart</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => (
            <div key={item.cart_item_id} className="flex gap-4 rounded-xl border border-gray-100 bg-white p-4">
              <div className="w-20 h-20 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <span className="text-gray-300 text-2xl">{item.name[0]}</span>}
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    <p className="text-xs text-gray-400">by {item.vendor_name}</p>
                  </div>
                  <button onClick={() => removeFromCart(item.cart_item_id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg">
                    <button onClick={() => updateCartItem(item.cart_item_id, Math.max(1, item.quantity - 1))} className="p-1.5 hover:bg-gray-50"><Minus size={14} /></button>
                    <span className="text-sm w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateCartItem(item.cart_item_id, item.quantity + 1)} className="p-1.5 hover:bg-gray-50"><Plus size={14} /></button>
                  </div>
                  <span className="font-display font-semibold">{formatINR(item.price * item.quantity)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-6 h-fit">
          <h3 className="font-semibold text-gray-900 mb-4">Order summary</h3>
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Subtotal</span><span>{formatINR(total)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400 mb-4">
            <span>Shipping</span><span>Calculated at checkout</span>
          </div>
          <div className="border-t border-gray-100 pt-4 flex justify-between font-semibold text-gray-900 mb-6">
            <span>Total</span><span>{formatINR(total)}</span>
          </div>
          <button onClick={() => navigate('/checkout')} className="w-full py-3 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-700">
            Proceed to checkout
          </button>
        </div>
      </div>
    </div>
  );
}
