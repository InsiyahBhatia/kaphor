import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  styleAesthetic?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signUp: (userData: any) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStorageData();
  }, []);

  async function loadStorageData() {
    try {
      const authDataSerialized = await SecureStore.getItemAsync('auth_data');
      if (authDataSerialized) {
        const _authData = JSON.parse(authDataSerialized);
        setUser(_authData.user);
        setToken(_authData.token);
      }
    } catch (e) {
      console.log('Error loading auth data', e);
    } finally {
      setIsLoading(false);
    }
  }

  const signIn = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const { authService } = await import('../services/authService');
      const data = await authService.login({ email, password });
      
      const { user: newUser, accessToken } = data;
      setToken(accessToken);
      setUser(newUser);
      
      await SecureStore.setItemAsync('auth_data', JSON.stringify({ token: accessToken, user: newUser }));
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
      
      const { user: newUser, accessToken } = data;
      setToken(accessToken);
      setUser(newUser);
      
      await SecureStore.setItemAsync('auth_data', JSON.stringify({ token: accessToken, user: newUser }));
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
      
      const { user: newUser, accessToken } = data;
      setToken(accessToken);
      setUser(newUser);
      
      await SecureStore.setItemAsync('auth_data', JSON.stringify({ token: accessToken, user: newUser }));
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
      setToken(null);
      setUser(null);
      await SecureStore.deleteItemAsync('auth_data');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signInWithGoogle, signUp, signOut }}>
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
