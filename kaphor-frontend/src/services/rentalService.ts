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

  approveRental: async (id: string) => {
    const { data } = await api.post(`/rentals/${id}/approve`);
    return data.data;
  },

  declineRental: async (id: string, reason?: string) => {
    const { data } = await api.post(`/rentals/${id}/decline`, { reason });
    return data.data;
  },

  confirmPayment: async (id: string, paymentData?: { paymentId?: string; razorpayOrderId?: string }) => {
    const { data } = await api.post(`/rentals/${id}/confirm-payment`, paymentData || {});
    return data.data;
  },

  confirmDelivery: async (id: string) => {
    const { data } = await api.post(`/rentals/${id}/confirm-delivery`);
    return data.data;
  },

  confirmReturnDelivery: async (id: string) => {
    const { data } = await api.post(`/rentals/${id}/confirm-return-delivery`);
    return data.data;
  },

  postReview: async (id: string, review: { rating: number; comment?: string }) => {
    const { data } = await api.post(`/rentals/${id}/review`, review);
    return data;
  },

  getCarrierTrackingUrl: (carrier?: string, trackingNumber?: string): string | null => {
    if (!trackingNumber) return null;
    const cleanNum = encodeURIComponent(trackingNumber.trim());
    const c = (carrier || '').toUpperCase();
    if (c.includes('BLUE') || c.includes('DART')) {
      return `https://www.bluedart.com/tracking?track=${cleanNum}`;
    }
    if (c.includes('DELHI')) {
      return `https://www.delhivery.com/track/package/${cleanNum}`;
    }
    if (c.includes('DTDC')) {
      return `https://www.dtdc.in/tracking/tracking_results.asp?pin=${cleanNum}`;
    }
    if (c.includes('POST') || c.includes('SPEED')) {
      return `https://www.indiapost.gov.in/_layouts/15/dpt.cept.tracking/trackconsignment.aspx`;
    }
    if (c.includes('EKART')) {
      return `https://ekartlogistics.com/shipmenttrack/${cleanNum}`;
    }
    if (c.includes('SHADOW') || c.includes('FAX')) {
      return `https://shadowfax.in/track/${cleanNum}`;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(`${carrier || 'courier'} tracking ${cleanNum}`)}`;
  }
};
