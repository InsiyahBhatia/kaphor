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

  updateGarment: async (id: string, updates: any) => {
    const { data } = await api.put(`/garments/${id}`, updates);
    return data.data;
  },

  deleteGarment: async (id: string) => {
    const { data } = await api.delete(`/garments/${id}`);
    return data.data;
  },

  pauseGarment: async (id: string) => {
    const { data } = await api.post(`/garments/${id}/pause`);
    return data.data;
  },

  moveToWardrobe: async (id: string) => {
    const { data } = await api.post(`/garments/${id}/wardrobe`);
    return data.data;
  },
};

