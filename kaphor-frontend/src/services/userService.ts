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
      peerReviewCount: number;
      peerReviewAvg: number | null;
      trustedSeller: boolean;
    };
  },

  getUserReviews: async (userId: string) => {
    const { data } = await api.get(`/users/profile/${userId}/reviews`);
    return data.data;
  },
};
