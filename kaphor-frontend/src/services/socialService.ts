import api from './api';

export const socialService = {
  getFeed: async () => {
    const { data } = await api.get('/social/feed');
    return data.data; // Array of posts
  },

  likePost: async (postId: string) => {
    const { data } = await api.post(`/social/posts/${postId}/like`);
    return data.data;
  },

  commentOnPost: async (postId: string, text: string) => {
    const { data } = await api.post(`/social/posts/${postId}/comments`, { text });
    return data.data;
  },
};
