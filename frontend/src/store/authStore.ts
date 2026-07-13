import { create } from 'zustand';
import { apiFetch } from '../utils/api';

interface User {
  id: number;
  name: string;
  surname: string;
  mail: string;
  phone_number: string;
  profile_photo: string | null;
  role: string;
  is_active: boolean;
  birthday: string | null;
  created_at: string | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  fetchUser: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user, loading: false }),
  fetchUser: async () => {
    try {
      const res = await apiFetch('/auth/me');
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, isAuthenticated: true, loading: false });
      } else {
        set({ user: null, isAuthenticated: false, loading: false });
      }
    } catch (error) {
      set({ user: null, isAuthenticated: false, loading: false });
    }
  },
  logout: async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    set({ user: null, isAuthenticated: false });
    window.location.href = '/';
  },
}));


