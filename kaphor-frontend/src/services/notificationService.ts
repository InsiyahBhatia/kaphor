import api from './api';

export const notificationService = {
  getUnreadCount: async (): Promise<number> => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      return typeof data.unreadCount === 'number' ? data.unreadCount : 0;
    } catch {
      return 0;
    }
  },

  getNotifications: async () => {
    const { data } = await api.get('/notifications');
    return data.data;
  },

  markAsRead: async (id: string) => {
    const { data } = await api.patch(`/notifications/${id}/read`);
    return data.data;
  },

  markAllAsRead: async () => {
    const { data } = await api.patch('/notifications/read-all');
    return data.data;
  },

  deleteNotification: async (id: string) => {
    const { data } = await api.delete(`/notifications/${id}`);
    return data;
  },

  clearAll: async () => {
    const { data } = await api.delete('/notifications/clear-all');
    return data;
  },
};
