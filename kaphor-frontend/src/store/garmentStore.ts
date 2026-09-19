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
  originalPrice?: number | null;
  rentalPriceDay?: number | null;
  rentalPriceWeek?: number | null;
  images: string[];
  condition: string;
  listingType: string;
  sellerId: string;
  seller?: { id: string; displayName: string };
  isActive?: boolean;
  lifecycleState?: string;
  reservedOrderId?: string | null;
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
  removeGarment: (garmentId: string) => void;
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
  removeGarment: (garmentId: string) =>
    set((state) => ({
      garments: state.garments.filter((g) => g.id !== garmentId),
      featured: state.featured.filter((g) => g.id !== garmentId),
    })),
  fetchGarments: async () => {
    return get().fetchFeed();
  },
  fetchFeed: async (filters = {}) => {
    set({ isLoading: true });
    try {
      const { garmentService } = await import('../services/garmentService');
      const response = await garmentService.getFeed(filters);
      const { useAuthStore } = await import('./authStore');
      const currentUserId = useAuthStore.getState().user?.id;
      const raw = Array.isArray(response.data) ? response.data : [];
      const filtered = currentUserId
        ? raw.filter((g: any) => g.sellerId !== currentUserId && g.seller?.id !== currentUserId)
        : raw;
      set({ 
        garments: filtered, 
        pagination: response.pagination || { nextCursor: null }, 
        isLoading: false 
      });
    } catch (error) {
      set({ isLoading: false });
      console.error('Failed to fetch garment feed', error);
    }
  },
}));

// Real-time live synchronization: remove delisted or paused garments instantly across all accounts
(() => {
  try {
    import('../services/socket').then(({ getSocket, connectSocket }) => {
      const socket = connectSocket() || getSocket();
      if (socket) {
        socket.on('garment:delisted', (payload: { garmentId?: string }) => {
          if (payload?.garmentId) {
            useGarmentStore.getState().removeGarment(payload.garmentId);
          }
        });
      }
    }).catch(() => {});
  } catch {}
})();

