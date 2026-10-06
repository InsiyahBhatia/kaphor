import api from './api';

export const aiService = {
  getHistory: async (conversationId?: string) => {
    const url = conversationId ? `/ai/history/${conversationId}` : '/ai/history';
    const { data } = await api.get(url);
    return data.data;
  },
  submitStyleQuiz: async (answers: string[]) => {
    const { data } = await api.post('/ai/style-quiz', { answers });
    return data.data;
  },

  skipStyleQuiz: async () => {
    const { data } = await api.post('/ai/style-quiz/skip');
    return data.data;
  },
  getStyleProfile: async () => {
    const { data } = await api.get('/ai/style-profile');
    return data.data;
  },
  getRecommendations: async () => {
    const { data } = await api.get('/ai/recommendations');
    return data.data;
  },
};
