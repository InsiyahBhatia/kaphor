import api from './api';

export const rentalService = {
  getAvailableRentals: async () => {
    const { data } = await api.get('/rentals/available');
    return data.data;
  },

  getMyRentals: async () => {
    const { data } = await api.get('/rentals/me');
    return data.data;
  },

  createRental: async (garmentId: string, days: number) => {
    const { data } = await api.post('/rentals', { garmentId, days });
    return data.data;
  },

  returnRental: async (id: string) => {
    const { data } = await api.patch(`/rentals/${id}/return`);
    return data.data;
  },
};
