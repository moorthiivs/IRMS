import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  activeShift?: { id: string; name: string } | null;
  machineNumber?: string | null;
  appMode: 'INSPECTION' | 'POKAYOKE';
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  setAppMode: (mode: 'INSPECTION' | 'POKAYOKE') => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      activeShift: null,
      machineNumber: null,
      appMode: 'INSPECTION',

      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      setAppMode: (mode) => set({ appMode: mode }),
    }),
    {
      name: 'irms-auth-storage',
    }
  )
);
