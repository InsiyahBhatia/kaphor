import api from './api';

export const adminService = {
  getMonitor: async () => {
    const { data } = await api.get<{ data: any }>('/admin/monitor');
    return data.data;
  },

  getAnalytics: async (range: '7d' | '30d' | '90d' = '30d') => {
    const { data } = await api.get<{ data: any }>('/admin/analytics', { params: { range } });
    return data.data;
  },

  getHealth: async () => {
    const { data } = await api.get<{ data: any }>('/admin/health');
    return data.data;
  },

  listOrders: async (params?: { status?: string; q?: string; page?: number; limit?: number }) => {
    const { data } = await api.get<{ data: any[]; meta?: any }>('/admin/orders', { params });
    return data;
  },

  getOrder: async (id: string) => {
    const { data } = await api.get<{ data: any }>(`/admin/orders/${id}`);
    return data.data;
  },

  refundOrder: async (orderId: string, reason?: string) => {
    const { data } = await api.post<{ data: any }>('/payments/refund', { orderId, reason });
    return data.data;
  },

  listReports: async (params?: { status?: string; limit?: number }) => {
    const { data } = await api.get<{ data: any[] }>('/admin/reports', { params });
    return data.data;
  },

  updateReport: async (id: string, status: string) => {
    const { data } = await api.patch<{ data: any }>(`/admin/reports/${id}`, { status });
    return data.data;
  },

  listUpcycles: async (params?: { status?: string; limit?: number }) => {
    const { data } = await api.get<{ data: any[] }>('/admin/upcycles', { params });
    return data.data;
  },

  updateUpcycle: async (id: string, status: string, adminNotes?: string) => {
    const { data } = await api.patch<{ data: any }>(`/admin/upcycles/${id}`, { status, ...(adminNotes ? { adminNotes } : {}) });
    return data.data;
  },

  listVerifications: async (params?: { status?: string; limit?: number }) => {
    const { data } = await api.get<{ data: any[] }>('/admin/verifications', { params });
    return data.data;
  },

  updateVerification: async (id: string, status: string) => {
    const { data } = await api.patch<{ data: any }>(`/admin/verifications/${id}`, { status });
    return data.data;
  },

  listAudit: async (params?: { page?: number; limit?: number; action?: string }) => {
    const { data } = await api.get<{ data: any[]; meta?: any }>('/admin/audit', { params });
    return data;
  },

  listCircularRequests: async (params?: { status?: string; limit?: number }) => {
    const { data } = await api.get<{ data: any[] }>('/admin/circular-requests', { params });
    return data.data;
  },

  updateCircularRequest: async (id: string, status: string) => {
    const { data } = await api.patch<{ data: any }>(`/admin/circular-requests/${id}`, { status });
    return data.data;
  },

  updateSwapStatus: async (id: string, status: string) => {
    const { data } = await api.patch<{ data: any }>(`/admin/swaps/${id}`, { status });
    return data.data;
  },

  listBespokeRequests: async (params?: { status?: string; limit?: number }) => {
    const { data } = await api.get<{ data: any[] }>('/admin/bespoke-requests', {
      params: {
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.limit ? { limit: params.limit } : {}),
      },
    });
    return data.data;
  },

  updateBespokeStatus: async (id: string, status: string) => {
    const { data } = await api.patch<{ data: any }>(`/admin/bespoke-requests/${id}`, { status });
    return data.data;
  },

  listSwaps: async (params?: { status?: string; limit?: number }) => {
    const { data } = await api.get<{ data: any[] }>('/admin/swaps', {
      params: {
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.limit ? { limit: params.limit } : {}),
      },
    });
    return data.data;
  },

  listRentals: async (params?: { status?: string; limit?: number }) => {
    const { data } = await api.get<{ data: any[] }>('/admin/rentals', {
      params: {
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.limit ? { limit: params.limit } : {}),
      },
    });
    return data.data;
  },
  
  listUsers: async (params?: { limit?: number; q?: string; page?: number; verification?: string }) => {
    const { data } = await api.get<{ data: any[]; meta?: any }>('/admin/users', { params });
    return data;
  },

  updateUser: async (id: string, updates: { isActive?: boolean; role?: string; tier?: string }) => {
    const { data } = await api.patch<{ data: any }>(`/admin/users/${id}`, updates);
    return data.data;
  },

  deleteUser: async (id: string) => {
    const { data } = await api.delete<{ data: any }>(`/admin/users/${id}`);
    return data.data;
  },
  
  listGarments: async (params?: { limit?: number; q?: string; lifecycle?: string; active?: boolean }) => {
    const { data } = await api.get<{ data: any[]; meta?: any }>('/admin/garments', { params });
    return data;
  },

  pauseGarment: async (id: string) => {
    const { data } = await api.post<{ data: any }>(`/garments/${id}/pause`);
    return data.data;
  },

  deleteGarment: async (id: string) => {
    const { data } = await api.delete<{ data: any }>(`/garments/${id}`);
    return data.data;
  },
};
