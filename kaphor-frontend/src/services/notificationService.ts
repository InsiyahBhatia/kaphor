import api from './api';

export const notificationService = {
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
};
