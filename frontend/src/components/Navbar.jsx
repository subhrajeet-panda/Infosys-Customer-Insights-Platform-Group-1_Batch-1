import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Heart, Package, LineChart } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cartCount, wishlistItems } = useCart();
  const navigate = useNavigate();

  const dashboardLink =
    user?.role === 'vendor' ? '/vendor/dashboard' :
    user?.role === 'admin' ? '/admin/dashboard' : null;

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold font-display">S</div>
          <span className="text-xl font-bold text-gray-900 font-display">ShopSense</span>
        </Link>
        <div className="flex items-center gap-5 text-sm font-medium text-gray-600">
          <Link to="/marketplace" className="hover:text-brand-600">Marketplace</Link>

          {user?.role === 'customer' && (
            <>
              <Link to="/wishlist" className="relative hover:text-brand-600">
                <Heart size={20} />
                {wishlistItems.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-brand-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{wishlistItems.length}</span>
                )}
              </Link>
              <Link to="/cart" className="relative hover:text-brand-600">
                <ShoppingCart size={20} />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-brand-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{cartCount}</span>
                )}
              </Link>
              <Link to="/orders" className="hover:text-brand-600" title="My Orders"><Package size={20} /></Link>
              <Link to="/spending-analysis" className="hover:text-brand-600" title="Spending Analysis"><LineChart size={20} /></Link>
            </>
          )}

          {user ? (
            <>
              {dashboardLink && <Link to={dashboardLink} className="hover:text-brand-600">Dashboard</Link>}
              <span className="text-gray-300">|</span>
              <span className="text-gray-500 hidden sm:inline">Hi, {user.name.split(' ')[0]}</span>
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-brand-600">Login</Link>
              <Link to="/register" className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
