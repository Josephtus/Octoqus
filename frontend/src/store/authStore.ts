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
    const token = localStorage.getItem('token');
    if (!token) {
      set({ user: null, isAuthenticated: false, loading: false });
      return;
    }

    try {
      const res = await apiFetch('/auth/me');
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, isAuthenticated: true, loading: false });
      } else {
        localStorage.removeItem('token');
        set({ user: null, isAuthenticated: false, loading: false });
      }
    } catch (error) {
      localStorage.removeItem('token');
      set({ user: null, isAuthenticated: false, loading: false });
    }
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, isAuthenticated: false });
    window.location.href = '/';
  },
}));
