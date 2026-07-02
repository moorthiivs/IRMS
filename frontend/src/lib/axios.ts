import axios from 'axios';
import { useAuthStore } from '../store/auth-store';

const api = axios.create({
  baseURL: 'https://irms-gzasfnghh6g2b3hu.centralindia-01.azurewebsites.net/api',
  //baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to inject the JWT token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
