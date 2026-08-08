import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('shopsense_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [vendor, setVendor] = useState(() => {
    const raw = localStorage.getItem('shopsense_vendor');
    return raw ? JSON.parse(raw) : null;
  });

  const persist = (token, user, vendor) => {
    localStorage.setItem('shopsense_token', token);
    localStorage.setItem('shopsense_user', JSON.stringify(user));
    localStorage.setItem('shopsense_vendor', JSON.stringify(vendor || null));
    setUser(user);
    setVendor(vendor || null);
  };

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    persist(data.token, data.user, data.vendor);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    persist(data.token, data.user, data.vendor);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('shopsense_token');
    localStorage.removeItem('shopsense_user');
    localStorage.removeItem('shopsense_vendor');
    setUser(null);
    setVendor(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, vendor, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
