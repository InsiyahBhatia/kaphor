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
  listingType?: string;
}

export interface ConversationSummary {
  id: string;
  otherUser: ConversationParticipant;
  garment: ConversationGarment | null;
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
  };
  messages: DirectMessageItem[];
}

export const messageService = {
  async listConversations(): Promise<ConversationSummary[]> {
    const { data } = await api.get<{ data: ConversationSummary[] }>('/messages/conversations');
    return data.data;
  },

  async getOrCreateConversation(recipientId: string, garmentId?: string): Promise<ConversationSummary> {
    const { data } = await api.post<{ data: ConversationSummary }>('/messages/conversations', {
      recipientId,
      garmentId,
    });
    return data.data;
  },

  async getConversationMessages(conversationId: string): Promise<ConversationDetailResponse> {
    const { data } = await api.get<{ data: ConversationDetailResponse }>(`/messages/conversations/${conversationId}`);
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
};
