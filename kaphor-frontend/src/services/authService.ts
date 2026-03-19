import api from './api';

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
    await api.post('/auth/logout');
  },
};
