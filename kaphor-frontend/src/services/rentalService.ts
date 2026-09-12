import api from './api';

export const rentalService = {
  getAvailableRentals: async () => {
    const { data } = await api.get('/rentals/available');
    return data.data;
  },

  getMyRentals: async (role?: 'all' | 'renter' | 'lender') => {
    const query = role ? `?role=${role}` : '';
    const { data } = await api.get(`/rentals/me${query}`);
    return data.data;
  },

  createRental: async (garmentId: string, days: number) => {
    const { data } = await api.post('/rentals', { garmentId, days });
    return data.data;
  },

  dispatchRental: async (id: string, details?: { trackingNumber?: string; carrier?: string }) => {
    const { data } = await api.patch(`/rentals/${id}/dispatch`, details || {});
    return data.data;
  },

  returnRental: async (id: string) => {
    const { data } = await api.patch(`/rentals/${id}/return`);
    return data.data;
  },

  releaseDeposit: async (id: string) => {
    const { data } = await api.post(`/rentals/${id}/release-deposit`);
    return data.data;
  },
};
