import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isHydrated: boolean;
  setAuth: (user: AuthUser | null, accessToken: string | null) => void;
  setTokens: (accessToken: string | null) => void;
  logout: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isHydrated: false,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  setTokens: (accessToken) => set({ accessToken }),
  logout: () => set({ user: null, accessToken: null }),
  setHydrated: (isHydrated) => set({ isHydrated }),
}));
