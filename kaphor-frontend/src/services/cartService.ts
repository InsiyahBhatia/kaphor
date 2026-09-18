import api, { invalidateCache } from './api';

export const cartService = {
  getCart: async () => {
    const { data } = await api.get('/cart');
    return data.data;
  },
  addToCart: async (garmentId: string) => {
    const { data } = await api.post('/cart', { garmentId });
    invalidateCache('/cart');
    return data.data;
  },
  removeFromCart: async (garmentId: string) => {
    const { data } = await api.delete(`/cart/${garmentId}`);
    invalidateCache('/cart');
    return data;
  },
};
