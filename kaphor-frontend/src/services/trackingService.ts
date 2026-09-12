import api from './api';
import { TransactionOrder } from './orderService';

export interface OrdersSummaryData {
  totalActive: number;
  orders: {
    buyingActive: number;
    sellingActive: number;
    sellingNeedsShip: number;
    completed: number;
    total: number;
  };
  rentals: {
    borrowingActive: number;
    lendingActive: number;
    completed: number;
    total: number;
  };
  swaps: {
    active: number;
    completed: number;
    total: number;
  };
}

export interface RentalItem {
  id: string;
  garmentId: string;
  renterId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: 'RESERVED' | 'ACTIVE' | 'RETURNED' | 'OVERDUE';
  userRole: 'RENTER' | 'LENDER';
  garment: {
    id: string;
    title: string;
    brand: string;
    images: string[];
    category?: string;
    price?: number;
    rentalPriceDay?: number;
    rentalPriceWeek?: number;
    condition?: string;
    sellerId: string;
    seller?: {
      id: string;
      displayName: string;
      username: string;
      avatar: string | null;
    };
  };
  renter: {
    id: string;
    displayName: string;
    username: string;
    avatar: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SwapTransactionItem {
  id: string;
  initiatorId: string;
  receiverId: string;
  status: string;
  compositeStatus: string;
  createdAt: string;
  updatedAt: string;
  partner: {
    id: string;
    displayName: string;
    username: string;
    avatar: string | null;
  };
  isInitiator: boolean;
  offeredGarment: {
    id: string;
    title: string;
    brand: string;
    images: string[];
    price?: number;
    category?: string;
  };
  wantedGarment: {
    id: string;
    title: string;
    brand: string;
    images: string[];
    price?: number;
    category?: string;
  };
  actionsNeeded?: string[];
}

export const trackingService = {
  async getSummary(): Promise<OrdersSummaryData> {
    try {
      const { data } = await api.get<{ data: OrdersSummaryData }>('/orders/summary');
      return data.data;
    } catch {
      return {
        totalActive: 0,
        orders: { buyingActive: 0, sellingActive: 0, sellingNeedsShip: 0, completed: 0, total: 0 },
        rentals: { borrowingActive: 0, lendingActive: 0, completed: 0, total: 0 },
        swaps: { active: 0, completed: 0, total: 0 },
      };
    }
  },

  async getOrders(): Promise<TransactionOrder[]> {
    const { data } = await api.get<{ data: TransactionOrder[] }>('/orders/transactions');
    return data.data || [];
  },

  async getRentals(role: 'all' | 'renter' | 'lender' = 'all'): Promise<RentalItem[]> {
    const { data } = await api.get<{ data: RentalItem[] }>(`/rentals/me?role=${role}`);
    return data.data || [];
  },

  async getSwaps(): Promise<any[]> {
    const { data } = await api.get('/swaps');
    return Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  },

  async markOrderShipped(orderId: string): Promise<TransactionOrder> {
    const { data } = await api.patch<{ data: TransactionOrder }>(`/orders/${orderId}/ship`);
    return data.data;
  },

  async markOrderDelivered(orderId: string): Promise<TransactionOrder> {
    const { data } = await api.patch<{ data: TransactionOrder }>(`/orders/${orderId}/deliver`);
    return data.data;
  },

  async dispatchRental(rentalId: string, details?: { trackingNumber?: string; carrier?: string }) {
    const { data } = await api.patch(`/rentals/${rentalId}/dispatch`, details || {});
    return data.data;
  },

  async returnRental(rentalId: string) {
    const { data } = await api.patch(`/rentals/${rentalId}/return`);
    return data.data;
  },

  async releaseRentalDeposit(rentalId: string) {
    const { data } = await api.post(`/rentals/${rentalId}/release-deposit`);
    return data.data;
  },
};
