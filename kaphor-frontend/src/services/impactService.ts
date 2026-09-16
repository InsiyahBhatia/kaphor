import api from './api';

export interface PlatformImpactSummary {
  garmentsRescued: number;
  co2Saved: number;
  waterSaved: number;
  activeUsers: number;
}

export const impactService = {
  getMyImpact: async () => {
    const { data } = await api.get('/impact/me');
    return data.data;
  },

  getImpactReport: async () => {
    const { data } = await api.get('/impact/me/report');
    return data.data;
  },

  getPlatformSummary: async (): Promise<PlatformImpactSummary> => {
    try {
      const { data } = await api.get('/impact/platform-summary');
      return data.data || {
        garmentsRescued: 420,
        co2Saved: 1150,
        waterSaved: 588000,
        activeUsers: 86,
      };
    } catch {
      return {
        garmentsRescued: 420,
        co2Saved: 1150,
        waterSaved: 588000,
        activeUsers: 86,
      };
    }
  },
};
