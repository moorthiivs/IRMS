import api from '../lib/axios';
import { User } from '../types';

export const usersService = {
  getAll: async (): Promise<User[]> => {
    const { data } = await api.get('/users');
    return data;
  },

  getById: async (id: string): Promise<User> => {
    const { data } = await api.get(`/users/${id}`);
    return data;
  },

  create: async (userData: {
    username: string;
    password: string;
    name: string;
    role: 'ADMIN' | 'INSPECTOR' | 'SUPERVISOR' | 'OPERATOR';
    customerId?: string | null;
  }): Promise<User> => {
    const { data } = await api.post('/users', userData);
    return data;
  },

  update: async (id: string, userData: {
    name?: string;
    password?: string;
    role?: 'ADMIN' | 'INSPECTOR' | 'SUPERVISOR' | 'OPERATOR';
    customerId?: string | null;
    signature?: string;
  }): Promise<User> => {
    const { data } = await api.put(`/users/${id}`, userData);
    return data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/users/${id}`);
    return data;
  },

  updateSignature: async (id: string, signature: string): Promise<User> => {
    const { data } = await api.put(`/users/${id}/signature`, { signature });
    return data;
  },
};
