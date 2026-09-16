import api from './api';

export interface RecommendedGarment {
  id: string;
  title: string;
  brand: string;
  category: string;
  subCategory?: string | null;
  size: string;
  price: number;
  rentalPriceDay?: number | null;
  rentalPriceWeek?: number | null;
  condition: string;
  listingType: string;
  images: string[];
  fitScore: number;
  matchReason: string;
  seller: {
    id: string;
    username: string;
    avatar?: string | null;
  };
}

export interface FairSwapRecommendation {
  myGarment?: {
    id: string;
    title: string;
    price: number;
    images: string[];
  } | null;
  recommendedSwap: {
    id: string;
    title: string;
    brand: string;
    category: string;
    price: number;
    condition: string;
    images: string[];
    seller: {
      id: string;
      username: string;
      avatar?: string | null;
    };
  };
  variancePercent: number;
  fitScore: number;
  isFairSwap: boolean;
}

export interface UserTasteProfile {
  userId: string;
  displayName: string;
  dominantAesthetic: string;
  aestheticConfidence: number;
  topCategories: Array<{ name: string; count: number }>;
  topBrands: Array<{ name: string; count: number }>;
  preferredSizes: string[];
  priceRange: {
    min: number;
    max: number;
    avg: number;
  };
  circularityAffinity: {
    sale: number;
    rental: number;
    swap: number;
  };
  recentInteractions: Array<{
    garmentId: string;
    title: string;
    category: string;
    brand: string;
    imageUrl?: string;
    eventType: string;
    timestamp: string;
  }>;
  totalInteractions: number;
}

export const recommendationService = {
  getPersonalizedFeed: async (limit: number = 20): Promise<RecommendedGarment[]> => {
    try {
      const { data } = await api.get(`/recommendations/for-you?limit=${limit}`);
      return data.data || [];
    } catch {
      return [];
    }
  },

  getSimilarGarments: async (garmentId: string, limit: number = 8): Promise<RecommendedGarment[]> => {
    try {
      const { data } = await api.get(`/recommendations/similar/${garmentId}?limit=${limit}`);
      return data.data || [];
    } catch {
      return [];
    }
  },

  getRentalPicks: async (limit: number = 10): Promise<RecommendedGarment[]> => {
    try {
      const { data } = await api.get(`/recommendations/rentals?limit=${limit}`);
      return data.data || [];
    } catch {
      return [];
    }
  },

  getFairSwaps: async (limit: number = 8): Promise<FairSwapRecommendation[]> => {
    try {
      const { data } = await api.get(`/recommendations/swaps?limit=${limit}`);
      return data.data || [];
    } catch {
      return [];
    }
  },

  getUserTasteProfile: async (): Promise<UserTasteProfile | null> => {
    try {
      const { data } = await api.get('/recommendations/profile');
      return data.data || null;
    } catch {
      return null;
    }
  },
};
