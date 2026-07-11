import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  fontFamily: 'Inter' | 'PlusJakartaSans';
  setFontFamily: (font: 'Inter' | 'PlusJakartaSans') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      fontFamily: 'Inter',
      setFontFamily: (fontFamily) => set({ fontFamily }),
    }),
    {
      name: 'irms-app-storage',
    }
  )
);
