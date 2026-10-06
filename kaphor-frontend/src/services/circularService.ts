import AsyncStorage from '@react-native-async-storage/async-storage';
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

const CENTERS_CACHE_KEY = '@kaphor_recycling_centers_v1';
const CENTERS_FRESH_MS = 10 * 60 * 1000;

let centersMemory: { data: RecyclingCentersResponse; at: number } | null = null;
let centersInFlight: Promise<RecyclingCentersResponse> | null = null;

export const circularService = {
  /** Last known centers (memory, then disk) so the screen can paint instantly. */
  async peekRecyclingCenters(): Promise<RecyclingCentersResponse | null> {
    if (centersMemory) return centersMemory.data;
    try {
      const raw = await AsyncStorage.getItem(CENTERS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { data: RecyclingCentersResponse; at: number };
      centersMemory = parsed;
      return parsed.data;
    } catch {
      return null;
    }
  },

  async getRecyclingCenters(params?: { city?: string; pincode?: string }): Promise<RecyclingCentersResponse> {
    const useCache = !params?.city && !params?.pincode;
    if (useCache && centersMemory && Date.now() - centersMemory.at < CENTERS_FRESH_MS) {
      return centersMemory.data;
    }
    if (useCache && centersInFlight) return centersInFlight;

    const request = api
      .get<{ data: RecyclingCentersResponse }>('/circular/recycling-centers', { params })
      .then(({ data }) => {
        if (useCache) {
          centersMemory = { data: data.data, at: Date.now() };
          AsyncStorage.setItem(CENTERS_CACHE_KEY, JSON.stringify(centersMemory)).catch(() => {});
        }
        return data.data;
      })
      .finally(() => {
        if (useCache) centersInFlight = null;
      });
    if (useCache) centersInFlight = request;
    return request;
  },
};


