import api from './api';

export interface RecyclingCenter {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  operatingHours: string;
  acceptedFibers: string[];
  certifications: string[];
  doorstepPickup: boolean;
  dropOffAvailable: boolean;
  rating: number;
  reviewsCount: number;
  zeroLandfillScore: number;
  description: string;
  distance?: string;
  isClosestMatch?: boolean;
}

export interface RecyclingCentersResponse {
  userLocation: {
    city: string;
    pincode: string | null;
    source: string;
  };
  centers: RecyclingCenter[];
}

export const circularService = {
  async getRecyclingCenters(params?: { city?: string; pincode?: string }): Promise<RecyclingCentersResponse> {
    const { data } = await api.get<{ data: RecyclingCentersResponse }>('/circular/recycling-centers', {
      params,
    });
    return data.data;
  },

  async scheduleCollection(payload: {
    garmentId: string;
    address: string;
    preferredSlot: string;
    partnerId: string;
  }) {
    const { data } = await api.post('/circular/schedule-collection', payload);
    return data.data;
  },
};
