import * as SecureStore from 'expo-secure-store';
import api from './api';

const REFRESH_KEY = 'kaphor_refresh_token';

export const authService = {
  login: async (credentials: any) => {
    const { data } = await api.post('/auth/login', credentials);
    return data.data; // { user, accessToken, refreshToken }
  },

  register: async (userData: any) => {
    const { data } = await api.post('/auth/register', userData);
    return data.data;
  },

  googleLogin: async (idToken: string) => {
    const { data } = await api.post('/auth/google', { idToken });
    return data.data;
  },

  getMe: async () => {
    const { data } = await api.get('/auth/me');
    return data.data;
  },

  logout: async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
  },
};
