import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  fetchError: string | null;
  pagination: { nextCursor: string | null };
  setGarments: (garments: Garment[]) => void;
  setFeatured: (featured: Garment[]) => void;
  setLoading: (loading: boolean) => void;
  appendGarments: (garments: Garment[]) => void;
  removeGarment: (garmentId: string) => void;
  fetchGarments: () => Promise<void>;
  fetchFeed: (filters?: any) => Promise<void>;
}

const CACHE_KEY = '@kaphor_shop_feed_cache';

export const useGarmentStore = create<GarmentState>((set, get) => ({
  garments: [],
  featured: [],
  isLoading: true, // Start in loading state until first cache read or fetch resolves
  fetchError: null,
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
    set({ isLoading: true, fetchError: null });
    try {
      const { garmentService } = await import('../services/garmentService');
      const response = await garmentService.getFeed(filters);
      const { useAuthStore } = await import('./authStore');
      const currentUserId = useAuthStore.getState().user?.id;
      const raw = Array.isArray(response.data) ? response.data : [];
      // Only filter out current user's items if other listings exist in marketplace
      const hasOtherListings = currentUserId ? raw.some((g: any) => g.sellerId !== currentUserId && g.seller?.id !== currentUserId) : false;
      const filtered = hasOtherListings
        ? raw.filter((g: any) => g.sellerId !== currentUserId && g.seller?.id !== currentUserId)
        : raw;
      set({ 
        garments: filtered, 
        pagination: response.pagination || { nextCursor: null }, 
        isLoading: false,
        fetchError: null,
      });

      // Persist primary feed to offline disk cache so it displays instantaneously on subsequent visits
      if (!filters.q && (!filters.category || filters.category === 'ALL') && (!filters.size && !filters.condition)) {
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(filtered)).catch(() => {});
      }
    } catch (error) {
      set({ isLoading: false });
      console.error('Failed to fetch garment feed', error);
      if (error instanceof Error) {
        const isTimeout = error.message.includes('timeout') || error.message.includes('exceeded');
        set({
          fetchError: isTimeout
            ? 'Request timed out. The marketplace may still be waking up — pull to refresh.'
            : 'Could not load the marketplace. Check your connection and retry.',
        });
      } else {
        set({ fetchError: 'Could not load the marketplace. Check your connection and retry.' });
      }
    }
  },
}));

// Immediately rehydrate cached feed from disk on launch for 0ms initial render
AsyncStorage.getItem(CACHE_KEY)
  .then((cached) => {
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0 && useGarmentStore.getState().garments.length === 0) {
          useGarmentStore.setState({ garments: parsed, isLoading: false });
        }
      } catch {}
    }
  })
  .catch(() => {});

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

