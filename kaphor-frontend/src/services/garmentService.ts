import api from './api';
import { Garment } from '../store/garmentStore';

export const garmentService = {
  getGarments: async (params?: any) => {
    const { data } = await api.get('/garments/browse', { params });
    return data.data; // Assuming backend returns { success: true, data: [...] }
  },

  getGarmentById: async (id: string) => {
    const { data } = await api.get(`/garments/${id}`);
    return data.data;
  },

  searchGarments: async (q: string) => {
    const { data } = await api.get('/garments', { params: { q } });
    return data.data;
  },

  getFeed: async (params?: any) => {
    const { data } = await api.get('/garments/feed', { params });
    return data;
  },

  createGarment: async (formData: FormData) => {
    const { data } = await api.post('/garments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  getWishlist: async () => {
    const { data } = await api.get('/garments/wishlist');
    return data.data;
  },
};
