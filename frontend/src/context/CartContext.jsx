import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [wishlistItems, setWishlistItems] = useState([]);

  const refreshCart = useCallback(async () => {
    if (user?.role !== 'customer') return setCartItems([]);
    const { data } = await api.get('/cart');
    setCartItems(data.items);
  }, [user]);

  const refreshWishlist = useCallback(async () => {
    if (user?.role !== 'customer') return setWishlistItems([]);
    const { data } = await api.get('/wishlist');
    setWishlistItems(data.items);
  }, [user]);

  useEffect(() => { refreshCart(); refreshWishlist(); }, [refreshCart, refreshWishlist]);

  const addToCart = async (productId, quantity = 1) => {
    await api.post('/cart', { productId, quantity });
    await refreshCart();
  };
  const updateCartItem = async (cartItemId, quantity) => {
    await api.put(`/cart/${cartItemId}`, { quantity });
    await refreshCart();
  };
  const removeFromCart = async (cartItemId) => {
    await api.delete(`/cart/${cartItemId}`);
    await refreshCart();
  };
  const toggleWishlist = async (productId, isInWishlist) => {
    if (isInWishlist) await api.delete(`/wishlist/${productId}`);
    else await api.post('/wishlist', { productId });
    await refreshWishlist();
  };

  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{
      cartItems, wishlistItems, cartCount,
      addToCart, updateCartItem, removeFromCart, toggleWishlist,
      refreshCart, refreshWishlist,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
