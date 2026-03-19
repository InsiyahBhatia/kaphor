import api from './api';

export const userService = {
  getMe: async () => {
    const { data } = await api.get('/users/me');
    return data.data;
  },

  updateMe: async (updates: any) => {
    const { data } = await api.put('/users/me', updates);
    return data.data;
  },

  getMyListings: async () => {
    const { data } = await api.get('/users/me/listings');
    return data.data;
  },

  getMyPurchases: async () => {
    const { data } = await api.get('/users/me/purchases');
    return data.data;
  },
};
