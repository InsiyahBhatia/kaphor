import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { safeStorage } from '../utils/storage';
import { persistTokens, clearStoredTokens } from '../services/api';
import { useAuthStore, type AuthUser } from '../store/authStore';

interface User {
  id: string;
  email: string;
  displayName: string;
  username?: string;
  role?: string;
  avatarUrl?: string;
  avatar?: string;
  styleAesthetic?: string;
  onboardingDone?: boolean;
  stats?: {
    listings: number;
    sold: number;
    following: number;
    followers: number;
    purchases: number;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signUp: (userData: any) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUser(raw: Record<string, unknown>): User {
  return {
    id: String(raw.id),
    email: String(raw.email),
    displayName: String(raw.displayName ?? 'User'),
    username: raw.username != null ? String(raw.username) : undefined,
    role: raw.role != null ? String(raw.role) : undefined,
    avatarUrl:
      (raw.avatarUrl as string | undefined) ?? (raw.avatar as string | undefined),
    avatar:
      (raw.avatar as string | undefined) ?? (raw.avatarUrl as string | undefined),
    styleAesthetic: raw.styleAesthetic != null ? String(raw.styleAesthetic) : undefined,
    onboardingDone: raw.onboardingDone != null ? Boolean(raw.onboardingDone) : false,
    stats: raw.stats as User['stats'],
  };
}

function toAuthStoreUser(u: User): AuthUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    role: u.role ?? 'USER',
  };
}

const AUTH_DATA_KEY = 'auth_data';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearLocalSession = async () => {
    setToken(null);
    setUser(null);
    useAuthStore.getState().logout();
    await safeStorage.deleteItem(AUTH_DATA_KEY);
    await clearStoredTokens();
  };

  useEffect(() => {
    loadStorageData();
  }, []);

  async function loadStorageData() {
    try {
      // 1. Concurrently read cached tokens and session data
      const [storedAccess, storedRefresh, authDataSerialized] = await Promise.all([
        safeStorage.getItem('kaphor_access_token'),
        safeStorage.getItem('kaphor_refresh_token'),
        safeStorage.getItem(AUTH_DATA_KEY),
      ]);

      let parsed: {
        user?: Record<string, unknown>;
        token?: string;
        accessToken?: string;
        refreshToken?: string;
      } | null = null;

      if (authDataSerialized) {
        try {
          parsed = JSON.parse(authDataSerialized);
        } catch {
          console.warn('Failed to parse cached auth_data JSON');
        }
      }

      // Prioritize freshest tokens stored by attemptTokenRefresh
      const accessToken = storedAccess || parsed?.accessToken || parsed?.token;
      const refreshToken = storedRefresh || parsed?.refreshToken || '';
      const rawUser = parsed?.user;

      if (!accessToken || !rawUser?.id) {
        // No saved session found
        return;
      }

      const normalized = normalizeUser(rawUser);
      await persistTokens(accessToken, refreshToken);
      useAuthStore.getState().setAuth(toAuthStoreUser(normalized), accessToken);
      setToken(accessToken);
      setUser(normalized);

      // 2. Fetch fresh user in background without blowing away offline session on cold start/timeouts
      const { userService } = await import('../services/userService');
      try {
        const updatedUser = await userService.getMe();
        if (updatedUser) {
          const freshNormalized = normalizeUser(updatedUser);
          setUser(freshNormalized);
          const currentAccess = (await safeStorage.getItem('kaphor_access_token')) || accessToken;
          const currentRefresh = (await safeStorage.getItem('kaphor_refresh_token')) || refreshToken;
          await safeStorage.setItem(
            AUTH_DATA_KEY,
            JSON.stringify({ accessToken: currentAccess, refreshToken: currentRefresh, user: freshNormalized })
          );
        }
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          // If refresh token was genuinely rejected, api interceptor cleared it
          const remainingRefresh = await safeStorage.getItem('kaphor_refresh_token');
          if (!remainingRefresh) {
            console.log('Session expired or revoked (401/403), clearing session');
            await clearLocalSession();
            return;
          }
        }
        console.log('Backend cold start / slow response, keeping cached session');
      }

      // Connect socket now that user session is active
      try {
        const { connectSocket } = await import('../services/socket');
        connectSocket();
      } catch (sockErr) {
        console.log('Socket connect warning on boot:', sockErr);
      }
    } catch (e) {
      console.warn('Error loading auth data', e);
      // Do not wipe credentials on transient errors
    } finally {
      setIsLoading(false);
    }
  }

  async function persistSession(
    newUser: User,
    accessToken: string,
    refreshToken: string
  ) {
    await persistTokens(accessToken, refreshToken);
    useAuthStore.getState().setAuth(toAuthStoreUser(newUser), accessToken);
    setToken(accessToken);
    setUser(newUser);
    await safeStorage.setItem(
      AUTH_DATA_KEY,
      JSON.stringify({
        accessToken,
        refreshToken,
        user: newUser,
      })
    );

    // Connect socket on new session
    try {
      const { connectSocket } = await import('../services/socket');
      connectSocket();
    } catch (sockErr) {
      console.log('Socket connect warning on persistSession:', sockErr);
    }
  }

  const signIn = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const { authService } = await import('../services/authService');
      const data = await authService.login({ email, password });
      const { user: newUser, accessToken, refreshToken } = data;
      await persistSession(normalizeUser(newUser as Record<string, unknown>), accessToken, refreshToken ?? '');
    } catch (error) {
      console.error('Sign in failed', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (userData: any) => {
    setIsLoading(true);
    try {
      const { authService } = await import('../services/authService');
      const data = await authService.register(userData);
      const { user: newUser, accessToken, refreshToken } = data;
      await persistSession(normalizeUser(newUser as Record<string, unknown>), accessToken, refreshToken ?? '');
    } catch (error) {
      console.error('Sign up failed', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async (idToken: string) => {
    setIsLoading(true);
    try {
      const { authService } = await import('../services/authService');
      const data = await authService.googleLogin(idToken);
      const { user: newUser, accessToken, refreshToken } = data;
      await persistSession(normalizeUser(newUser as Record<string, unknown>), accessToken, refreshToken ?? '');
    } catch (error) {
      console.error('Google sign in failed', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { authService } = await import('../services/authService');
      await authService.logout();
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      try {
        const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
        await GoogleSignin.signOut();
      } catch {
        /* module or native sign-out unavailable */
      }
      await clearLocalSession();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signInWithGoogle, signUp, signOut, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
