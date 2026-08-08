import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Wishlist() {
  const { wishlistItems } = useCart();

  if (wishlistItems.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-gray-900">Your wishlist is empty</h1>
        <p className="text-gray-500 mt-2">Tap the heart icon on any product to save it for later.</p>
        <Link to="/marketplace" className="inline-block mt-6 px-6 py-2.5 rounded-lg bg-ink-900 text-white font-semibold hover:bg-ink-800">
          Go to marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-gray-900 mb-8">Your Wishlist</h1>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {wishlistItems.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}
