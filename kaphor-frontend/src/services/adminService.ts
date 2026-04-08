import api from './api';

export const adminService = {
  getMonitor: async () => {
    const { data } = await api.get<{ data: any }>('/admin/monitor');
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
  
  listUsers: async (params?: { limit?: number }) => {
    const { data } = await api.get<{ data: any[] }>('/admin/users', {
      params: {
        ...(params?.limit ? { limit: params.limit } : {}),
      },
    });
    return data.data;
  },

  updateUser: async (id: string, updates: { isActive?: boolean; role?: string; tier?: string }) => {
    const { data } = await api.patch<{ data: any }>(`/admin/users/${id}`, updates);
    return data.data;
  },
};


