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
  setGarments: (garments: Garment[]) => void;
  setFeatured: (featured: Garment[]) => void;
  setLoading: (loading: boolean) => void;
  appendGarments: (garments: Garment[]) => void;
  fetchGarments: () => Promise<void>;
}

export const useGarmentStore = create<GarmentState>((set) => ({
  garments: [],
  featured: [],
  isLoading: false,
  setGarments: (garments) => set({ garments }),
  setFeatured: (featured) => set({ featured }),
  setLoading: (isLoading) => set({ isLoading }),
  appendGarments: (garments) =>
    set((state) => ({
      garments: [...state.garments, ...garments],
    })),
  fetchGarments: async () => {
    set({ isLoading: true });
    try {
      // We will call the service from the component for now or add it here
      // But adding it here makes the store more self-contained.
      const { garmentService } = await import('../services/garmentService');
      const data = await garmentService.getGarments();
      set({ garments: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Failed to fetch garments', error);
    }
  },
}));
