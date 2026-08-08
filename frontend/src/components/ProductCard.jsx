import React, { useState } from 'react';
import { Heart, ShoppingCart, Check } from 'lucide-react';
import { formatINR } from '../utils/format';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function ProductCard({ product }) {
  const { user } = useAuth();
  const { cartItems, wishlistItems, addToCart, toggleWishlist } = useCart();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const inWishlist = wishlistItems.some((w) => w.id === product.id);
  const inCart = cartItems.some((c) => c.id === product.id);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    if (!user) return navigate('/login');
    if (user.role !== 'customer') return;
    setBusy(true);
    try { await addToCart(product.id, 1); } finally { setBusy(false); }
  };

  const handleWishlist = async (e) => {
    e.preventDefault();
    if (!user) return navigate('/login');
    if (user.role !== 'customer') return;
    await toggleWishlist(product.id, inWishlist);
  };

  return (
    <div className="group rounded-xl border border-gray-100 bg-white overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition">
      <div className="relative aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
        ) : (
          <span className="text-gray-300 text-4xl font-display">{product.name[0]}</span>
        )}
        {(!user || user.role === 'customer') && (
          <button onClick={handleWishlist}
            className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition ${
              inWishlist ? 'bg-rose-500 text-white' : 'bg-white/90 text-gray-500 hover:text-rose-500'
            }`}>
            <Heart size={16} fill={inWishlist ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      <div className="p-4">
        <span className="text-xs text-brand-600 font-medium">{product.category}</span>
        <h3 className="font-semibold text-gray-900 mt-1 truncate">{product.name}</h3>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-4 h-4 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {product.vendor_logo_url ? (
              <img src={product.vendor_logo_url} alt={product.vendor_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[8px] text-gray-400 font-semibold">{product.vendor_name?.[0]}</span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">{product.vendor_name}</p>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="font-display font-semibold text-gray-900">{formatINR(product.price)}</span>
          <span className="text-xs text-gray-400">{product.stock_quantity} in stock</span>
        </div>
        {(!user || user.role === 'customer') && (
          <button
            onClick={handleAddToCart} disabled={busy || product.stock_quantity === 0}
            className={`mt-3 w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition ${
              inCart ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-ink-900 text-white hover:bg-ink-800'
            } disabled:opacity-50`}
          >
            {inCart ? <><Check size={15} /> In cart</> : <><ShoppingCart size={15} /> Add to cart</>}
          </button>
        )}
      </div>
    </div>
  );
}
