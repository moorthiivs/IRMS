import api from '../lib/axios';
import { User } from '../types';

export const authService = {
  login: async (username: string, password: string):Promise<{access_token: string, user: User}> => {
    const { data } = await api.post('/auth/login', { username, password });
    
    return {
      access_token: data.token,
      user: data.user,
    };
  },
  
  getProfile: async (): Promise<User> => {
    const { data } = await api.get('/auth/me');
    return data;
  }
};
