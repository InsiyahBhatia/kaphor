import api from './api';

export const impactService = {
  getMyImpact: async () => {
    const { data } = await api.get('/impact/me');
    return data.data;
  },

  getImpactReport: async () => {
    const { data } = await api.get('/impact/me/report');
    return data.data;
  },
};
