import api from './api';

export interface ConversationParticipant {
  id: string;
  displayName: string;
  username: string;
  avatar: string | null;
  isVerified?: boolean;
  verificationStatus?: string;
  tier?: string;
}

export interface ConversationGarment {
  id: string;
  title: string;
  brand: string;
  images?: string[];
  image?: string;
  price?: number;
  rentalPriceDay?: number;
  rentalPriceWeek?: number;
  listingType?: string;
  category?: string;
  size?: string;
  condition?: string;
  description?: string;
  sellerId?: string;
  userId?: string;
  seller?: ConversationParticipant;
}

export interface ConversationOrder {
  id: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  type?: 'SALE' | 'SWAP' | 'RENTAL' | 'GENERAL';
  orderId?: string | null;
  swapId?: string | null;
  rentalId?: string | null;
  otherUser: ConversationParticipant;
  garment: ConversationGarment | null;
  order?: ConversationOrder | null;
  swap?: { id: string; status: string } | null;
  rental?: { id: string; status: string } | null;
  lastMessageText: string;
  lastMessageAt: string;
  unreadCount: number;
  createdAt: string;
}

export interface DirectMessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  imageUrl?: string | null;
  isFlagged: boolean;
  readAt: string | null;
  createdAt: string;
  sender: ConversationParticipant;
}

export interface ConversationDetailResponse {
  conversation: {
    id: string;
    otherUser: ConversationParticipant;
    garment: ConversationGarment | null;
    order?: ConversationOrder | null;
    swap?: { id: string; status: string; createdAt?: string } | null;
    rental?: { id: string; status: string; totalPrice?: number; totalAmount?: number; startDate?: string; endDate?: string; createdAt?: string } | null;
    counterpartyGarments?: ConversationGarment[];
    sellerGarments?: ConversationGarment[];
  };
  messages: DirectMessageItem[];
}

export const messageService = {
  async getUnreadCount(): Promise<number> {
    try {
      const { data } = await api.get<{ unreadCount: number }>('/messages/unread-count');
      return typeof data?.unreadCount === 'number' ? data.unreadCount : 0;
    } catch {
      try {
        const list = await messageService.listConversations();
        return list.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      } catch {
        return 0;
      }
    }
  },

  async listConversations(): Promise<ConversationSummary[]> {
    const { data } = await api.get<{ data: ConversationSummary[] }>('/messages/conversations');
    return data.data;
  },

  async getOrCreateConversation(
    recipientId: string,
    garmentId?: string,
    options?: { orderId?: string; swapId?: string; rentalId?: string; type?: string }
  ): Promise<ConversationSummary> {
    const { data } = await api.post<{ data: ConversationSummary }>('/messages/conversations', {
      recipientId,
      garmentId,
      ...options,
    });
    return data.data;
  },

  async getOrCreateOrderConversation(orderId: string): Promise<ConversationSummary> {
    const { data } = await api.post<{ data: ConversationSummary }>(`/messages/orders/${orderId}/conversation`);
    return data.data;
  },

  async getConversationMessages(conversationId: string): Promise<ConversationDetailResponse> {
    const { data } = await api.get<{ data: ConversationDetailResponse }>(`/messages/conversations/${conversationId}`);
    return data.data;
  },

  async linkGarment(conversationId: string, garmentId: string | null): Promise<{ garment: ConversationGarment | null }> {
    const { data } = await api.patch<{ data: { garment: ConversationGarment | null } }>(
      `/messages/conversations/${conversationId}/garment`,
      { garmentId }
    );
    return data.data;
  },

  async sendMessage(
    conversationId: string,
    content: string,
    imageUrl?: string
  ): Promise<{ data: DirectMessageItem; warning?: string }> {
    const { data } = await api.post<{ data: DirectMessageItem; warning?: string }>(
      `/messages/conversations/${conversationId}`,
      { content, imageUrl }
    );
    return data;
  },

  async reportUser(userId: string, reason: string, details?: string): Promise<{ message: string }> {
    const { data } = await api.post<{ data: { message: string } }>(`/messages/users/${userId}/report`, {
      reason,
      details,
    });
    return data.data;
  },

  async deleteConversation(conversationId: string): Promise<{ success: boolean; message: string }> {
    const { data } = await api.delete<{ data: { success: boolean; message: string } }>(
      `/messages/conversations/${conversationId}`
    );
    return data.data;
  },
};

