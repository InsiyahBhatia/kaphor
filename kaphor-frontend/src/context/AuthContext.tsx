import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
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
    await SecureStore.deleteItemAsync(AUTH_DATA_KEY);
    await clearStoredTokens();
  };

  useEffect(() => {
    loadStorageData();
  }, []);

  async function loadStorageData() {
    try {
      const authDataSerialized = await SecureStore.getItemAsync(AUTH_DATA_KEY);
      if (!authDataSerialized) {
        return;
      }
      const parsed = JSON.parse(authDataSerialized) as {
        user?: Record<string, unknown>;
        token?: string;
        accessToken?: string;
        refreshToken?: string;
      };
      const accessToken = parsed.accessToken ?? parsed.token;
      const refreshToken = parsed.refreshToken ?? '';
      const rawUser = parsed.user;
      if (!accessToken || !rawUser?.id) {
        await clearLocalSession();
        return;
      }
      const normalized = normalizeUser(rawUser);
      await persistTokens(accessToken, refreshToken);
      useAuthStore.getState().setAuth(toAuthStoreUser(normalized), accessToken);
      setToken(accessToken);
      setUser(normalized);

      const { userService } = await import('../services/userService');
      try {
        const updatedUser = await userService.getMe();
        if (updatedUser) {
          const freshNormalized = normalizeUser(updatedUser);
          setUser(freshNormalized);
          // Also update SecureStore so next boot is faster
          await SecureStore.setItemAsync(
            AUTH_DATA_KEY,
            JSON.stringify({ accessToken, refreshToken, user: freshNormalized })
          );
        }
      } catch (err: any) {
        // Only clear if the token was explicitly revoked or invalid (401)
        if (err?.response?.status === 401) {
          console.log('Session expired or revoked (401), clearing session');
          await clearLocalSession();
          return;
        }
        // Network timeout / Render cold start: preserve offline/cached session!
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
      console.log('Error loading auth data', e);
      await clearLocalSession();
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
    await SecureStore.setItemAsync(
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
