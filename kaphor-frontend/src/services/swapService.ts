import api from './api';

export const swapService = {
  getSwaps: async () => {
    const { data } = await api.get('/swaps');
    return data.data;
  },

  createSwapRequest: async (payload: { garmentId: string; offeredGarmentId: string }) => {
    const { data } = await api.post('/swaps', payload);
    return data.data;
  },

  respondToSwap: async (id: string, response: 'accept' | 'reject') => {
    const { data } = await api.patch(`/swaps/${id}`, { response });
    return data.data;
  },
};
