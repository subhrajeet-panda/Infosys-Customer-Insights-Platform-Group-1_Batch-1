import axios from 'axios';

const analyticsApi = axios.create({
  baseURL: import.meta.env.VITE_ANALYTICS_API_URL || 'http://localhost:8000',
});

analyticsApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('shopsense_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default analyticsApi;
