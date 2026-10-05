import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import { optimizedUri, normalizeImageUri } from '../components/KaphorImage';

const prefetched = new Set<string>();

// Garments seen in any list (rentals, swaps...) so detail pages can paint instantly while revalidating
const seedMap = new Map<string, any>();
export function seedGarments(list: any[] | undefined | null): void {
  if (!Array.isArray(list)) return;
  for (const g of list) {
    if (g?.id) seedMap.set(g.id, g);
  }
  if (seedMap.size > 300) {
    const drop = seedMap.size - 300;
    let i = 0;
    for (const k of seedMap.keys()) {
      if (i++ >= drop) break;
      seedMap.delete(k);
    }
  }
}
export function peekGarment(id: string | undefined): any | undefined {
  if (!id) return undefined;
  return seedMap.get(id) ?? useGarmentStore.getState().garments.find((g) => g.id === id);
}

/** Warm the disk cache with the detail-page hero image (width 500 => ~1000px) for the first visible items. */
export function prefetchDetailImages(items: Array<{ images?: string[] | null }> | undefined, count = 4): void {
  if (!items?.length) return;
  const urls: string[] = [];
  for (const g of items.slice(0, count)) {
    const raw = normalizeImageUri(g?.images?.[0]);
    if (!raw || !/^https?:/.test(raw)) continue;
    const url = optimizedUri(raw, 500);
    if (!prefetched.has(url)) {
      prefetched.add(url);
      urls.push(url);
    }
  }
  if (urls.length) {
    try {
      ExpoImage.prefetch(urls, 'memory-disk').catch(() => {});
    } catch {}
  }
}

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
  updatedAt?: string;
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
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
}

const CACHE_KEY = '@kaphor_shop_feed_cache';

// Monotonic request id: ignore responses from superseded fetches (fast filter/search changes)
let feedSeq = 0;
let lastFilters: any = {};
let loadMoreInFlight = false;

async function filterOwn(raw: any[]): Promise<any[]> {
  const { useAuthStore } = await import('./authStore');
  const currentUserId = useAuthStore.getState().user?.id;
  const hasOtherListings = currentUserId ? raw.some((g: any) => g.sellerId !== currentUserId && g.seller?.id !== currentUserId) : false;
  return hasOtherListings
    ? raw.filter((g: any) => g.sellerId !== currentUserId && g.seller?.id !== currentUserId)
    : raw;
}

export const useGarmentStore = create<GarmentState>((set, get) => ({
  garments: [],
  featured: [],
  isLoading: true, // Start in loading state until first cache read or fetch resolves
  fetchError: null,
  pagination: { nextCursor: null },
  isLoadingMore: false,
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
    // Stale-while-revalidate: only show loading when there is nothing to display yet
    const seq = ++feedSeq;
    lastFilters = filters;
    set({ isLoading: get().garments.length === 0, fetchError: null });
    try {
      const { garmentService } = await import('../services/garmentService');
      const response = await garmentService.getFeed(filters);
      if (seq !== feedSeq) return; // a newer request superseded this one
      const raw = Array.isArray(response.data) ? response.data : [];
      // Only filter out current user's items if other listings exist in marketplace
      const filtered = await filterOwn(raw);
      if (seq !== feedSeq) return;
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
      if (seq !== feedSeq) return;
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
  loadMore: async () => {
    const cursor = get().pagination.nextCursor;
    if (!cursor || loadMoreInFlight) return;
    loadMoreInFlight = true;
    const seq = feedSeq;
    set({ isLoadingMore: true });
    try {
      const { garmentService } = await import('../services/garmentService');
      const response = await garmentService.getFeed({ ...lastFilters, after: cursor });
      if (seq !== feedSeq) return;
      const incoming = await filterOwn(Array.isArray(response.data) ? response.data : []);
      const seen = new Set(get().garments.map((g) => g.id));
      set((state) => ({
        garments: [...state.garments, ...incoming.filter((g: any) => !seen.has(g.id))],
        pagination: response.pagination || { nextCursor: null },
      }));
    } catch {
      // keep existing content; next scroll will retry
    } finally {
      loadMoreInFlight = false;
      set({ isLoadingMore: false });
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

