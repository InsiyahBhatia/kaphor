import api from './api';

export const aiService = {
  submitStyleQuiz: async (selections: string[]) => {
    const { data } = await api.post('/ai/style-quiz', { styles: selections });
    return data.data;
  },

  getRecommendations: async () => {
    const { data } = await api.get('/ai/recommendations');
    return data.data;
  },
};
