import { create } from 'zustand';

export interface CartItem {
  garmentId: string;
  title: string;
  brand: string;
  price: number;
  image?: string;
  quantity: number;
  listingType: 'SALE' | 'RENTAL' | 'ACCESSORY_SWAP';
  rentalDays?: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (garmentId: string) => void;
  updateQuantity: (garmentId: string, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.garmentId === item.garmentId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.garmentId === item.garmentId
              ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
              : i
          ),
        };
      }
      return {
        items: [...state.items, { ...item, quantity: item.quantity ?? 1 }],
      };
    }),
  removeItem: (garmentId) =>
    set((state) => ({
      items: state.items.filter((i) => i.garmentId !== garmentId),
    })),
  updateQuantity: (garmentId, quantity) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.garmentId === garmentId ? { ...i, quantity } : i
      ),
    })),
  clearCart: () => set({ items: [] }),
  total: () =>
    get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}));
