import api from './api';

export const aiService = {
  chat: async (message: string, garmentId?: string, conversationId?: string) => {
    // Note: This matches the SSE endpoint but for simple use we can use a standard POST if we modify the backend.
    // However, the current backend uses SSE (text/event-stream).
    // For now, let's treat it as a standard JSON POST for the options.
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${/* needs token */ ''}`,
      },
      body: JSON.stringify({ message, garmentId, conversationId }),
    });
    return response;
  },
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
