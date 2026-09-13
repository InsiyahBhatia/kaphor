import api from './api';

export interface RentalShippingAddress {
  id?: string;
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string | null;
  landmark?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface CreateRentalParams {
  garmentId: string;
  days?: number;
  startDate?: string;
  endDate?: string;
  message?: string;
  shippingAddress?: RentalShippingAddress | null;
  metadata?: any;
}

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

  getRentalById: async (id: string) => {
    const { data } = await api.get(`/rentals/${id}`);
    return data.data;
  },

  createRental: async (params: CreateRentalParams) => {
    const { data } = await api.post('/rentals', params);
    return data.data;
  },

  dispatchRental: async (id: string, details?: { trackingNumber?: string; carrier?: string }) => {
    const { data } = await api.patch(`/rentals/${id}/dispatch`, details || {});
    return data.data;
  },

  returnRental: async (id: string, details?: { returnTracking?: string; returnCarrier?: string }) => {
    const { data } = await api.patch(`/rentals/${id}/return`, details || {});
    return data.data;
  },

  releaseDeposit: async (id: string) => {
    const { data } = await api.post(`/rentals/${id}/release-deposit`);
    return data.data;
  },

  getEscrow: async (id: string) => {
    const { data } = await api.get(`/rentals/${id}/escrow`);
    return data.data;
  },

  postReview: async (id: string, review: { rating: number; comment?: string }) => {
    const { data } = await api.post(`/rentals/${id}/review`, review);
    return data;
  }
};
