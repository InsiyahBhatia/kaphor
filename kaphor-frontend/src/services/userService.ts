import api from './api';

export const userService = {
  getMe: async () => {
    const { data } = await api.get('/users/me');
    return data.data;
  },

  updateMe: async (updates: any) => {
    const { data } = await api.put('/users/me', updates);
    return data.data;
  },

  updateAvatar: async (imageUri: string) => {
    const formData = new FormData();
    formData.append('avatar', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'avatar.jpg',
    } as any);
    const { data } = await api.put('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  getMyListings: async () => {
    const { data } = await api.get('/users/me/listings');
    return data.data;
  },

  getMyWardrobe: async () => {
    const { data } = await api.get('/users/me/wardrobe');
    return data.data;
  },

  getMyPurchases: async () => {
    const { data } = await api.get('/users/me/purchases');
    return data.data;
  },

  getPublicProfile: async (userId: string) => {
    const { data } = await api.get(`/users/profile/${userId}/public`);
    return data.data as {
      id: string;
      displayName: string;
      username: string;
      avatar: string | null;
      bio: string | null;
      tier: string;
      isVerified?: boolean;
      verificationStatus?: string;
      verificationType?: string;
      peerReviewCount: number;
      peerReviewAvg: number | null;
      ratingBreakdown?: { 5: number; 4: number; 3: number; 2: number; 1: number };
      trustedSeller: boolean;
    };
  },

  getUserReviews: async (userId: string) => {
    const { data } = await api.get(`/users/profile/${userId}/reviews`);
    return data.data;
  },
};
