import { create } from 'zustand';

export interface Garment {
  id: string;
  title: string;
  description: string;
  brand: string;
  category: string;
  subCategory?: string | null;
  size: string;
  color: string[];
  price?: number | null;
  rentalPriceDay?: number | null;
  rentalPriceWeek?: number | null;
  images: string[];
  condition: string;
  listingType: string;
  sellerId: string;
  seller?: { id: string; displayName: string };
}

interface GarmentState {
  garments: Garment[];
  featured: Garment[];
  isLoading: boolean;
  pagination: { nextCursor: string | null };
  setGarments: (garments: Garment[]) => void;
  setFeatured: (featured: Garment[]) => void;
  setLoading: (loading: boolean) => void;
  appendGarments: (garments: Garment[]) => void;
  fetchGarments: () => Promise<void>;
  fetchFeed: (filters?: any) => Promise<void>;
}

export const useGarmentStore = create<GarmentState>((set, get) => ({
  garments: [],
  featured: [],
  isLoading: false,
  pagination: { nextCursor: null },
  setGarments: (garments) => set({ garments }),
  setFeatured: (featured) => set({ featured }),
  setLoading: (isLoading) => set({ isLoading }),
  appendGarments: (garments) =>
    set((state) => ({
      garments: [...state.garments, ...garments],
    })),
  fetchGarments: async () => {
    return get().fetchFeed();
  },
  fetchFeed: async (filters = {}) => {
    set({ isLoading: true });
    try {
      const { garmentService } = await import('../services/garmentService');
      const response = await garmentService.getFeed(filters);
      set({ 
        garments: response.data, 
        pagination: response.pagination || { nextCursor: null }, 
        isLoading: false 
      });
    } catch (error) {
      set({ isLoading: false });
      console.error('Failed to fetch garment feed', error);
    }
  },
}));
