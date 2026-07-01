import api from '../lib/axios';

export const settingsService = {
  getAll: async (): Promise<Record<string, string>> => {
    const { data } = await api.get('/settings');
    return data;
  },

  update: async (key: string, value: string): Promise<{ message: string }> => {
    const { data } = await api.put('/settings', { key, value });
    return data;
  },
};
