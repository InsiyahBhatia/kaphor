import api from './api';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

export interface TransactionOrder {
  id: string;
  buyerId: string;
  sellerId: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    garmentId: string;
    price: number;
    quantity: number;
    garment: { id: string; title: string; brand: string; images: string[] };
  }>;
  buyer: { id: string; displayName: string; username: string; avatar: string | null };
  seller: { id: string; displayName: string; username: string; avatar: string | null };
  peerReview: { id: string; rating: number; comment: string | null } | null;
  messages?: Array<{ id: string; body: string; createdAt: string; senderId: string }>;
}

export interface OrderMessage {
  id: string;
  orderId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: { id: string; displayName: string; avatar: string | null; username: string };
}

export const orderService = {
  /** Open a PENDING order thread to message the seller before paying (reuses existing if any). */
  async createInquiry(garmentId: string): Promise<{ orderId: string; existing?: boolean }> {
    const { data } = await api.post<{ data: { orderId: string; existing?: boolean } }>('/orders/inquiry', {
      garmentId,
    });
    return data.data;
  },

  async listTransactions(): Promise<TransactionOrder[]> {
    const { data } = await api.get<{ data: TransactionOrder[] }>('/orders/transactions');
    return data.data;
  },

  async getOrder(orderId: string): Promise<TransactionOrder> {
    const { data } = await api.get<{ data: TransactionOrder }>(`/orders/${orderId}`);
    return data.data;
  },

  async markShipped(orderId: string): Promise<TransactionOrder> {
    const { data } = await api.patch<{ data: TransactionOrder }>(`/orders/${orderId}/ship`);
    return data.data;
  },

  async markDelivered(orderId: string): Promise<TransactionOrder> {
    const { data } = await api.patch<{ data: TransactionOrder }>(`/orders/${orderId}/deliver`);
    return data.data;
  },

  async getMessages(orderId: string): Promise<OrderMessage[]> {
    const { data } = await api.get<{ data: OrderMessage[] }>(`/orders/${orderId}/messages`);
    return data.data;
  },

  async sendMessage(orderId: string, body: string): Promise<OrderMessage> {
    const { data } = await api.post<{ data: OrderMessage }>(`/orders/${orderId}/messages`, { body });
    return data.data;
  },

  async submitPeerReview(orderId: string, rating: number, comment?: string) {
    const { data } = await api.post<{ data: { id: string } }>(`/orders/${orderId}/peer-review`, {
      rating,
      comment,
    });
    return data.data;
  },
};
