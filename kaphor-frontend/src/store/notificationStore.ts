import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from '../services/notificationService';
import { cachedGet, fetchFresh } from '../services/api';

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  banners: boolean;
  haptics: boolean;
  orders: boolean;
  swaps: boolean;
  messages: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  banners: true,
  haptics: true,
  orders: true,
  swaps: true,
  messages: true,
};

const PREFS_STORAGE_KEY = '@kaphor_notif_preferences';

interface NotificationState {
  unreadCount: number;
  unreadMessageCount: number;
  notifications: NotificationItem[];
  loading: boolean;
  preferences: NotificationPreferences;

  // Actions
  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: (forceFresh?: boolean) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  addRealtimeNotification: (notif: NotificationItem) => void;
  setPreference: (key: keyof NotificationPreferences, value: boolean) => Promise<void>;
  loadPreferences: () => Promise<void>;
  setUnreadMessageCount: (count: number) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  unreadMessageCount: 0,
  notifications: [],
  loading: false,
  preferences: DEFAULT_PREFS,

  fetchUnreadCount: async () => {
    try {
      const count = await notificationService.getUnreadCount();
      set({ unreadCount: count });
    } catch {
      // Fallback if endpoint fails
    }
  },

  fetchNotifications: async (forceFresh = false) => {
    set({ loading: true });
    try {
      const data = forceFresh
        ? await fetchFresh('/notifications')
        : await cachedGet('/notifications');
      const list = Array.isArray(data) ? data : [];
      const unread = list.filter((n: NotificationItem) => !n.isRead).length;
      set({ notifications: list, unreadCount: unread, loading: false });
    } catch {
      set({ notifications: [], loading: false });
    }
  },

  markAsRead: async (id: string) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      await notificationService.markAsRead(id);
    } catch {
      get().fetchUnreadCount();
    }
  },

  markAllAsRead: async () => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));

    try {
      await notificationService.markAllAsRead();
    } catch {
      get().fetchUnreadCount();
    }
  },

  deleteNotification: async (id: string) => {
    const item = get().notifications.find((n) => n.id === id);
    const wasUnread = item && !item.isRead;

    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }));

    try {
      await notificationService.deleteNotification(id);
    } catch {
      get().fetchNotifications(true);
    }
  },

  clearAll: async () => {
    set({ notifications: [], unreadCount: 0 });
    try {
      await notificationService.clearAll();
    } catch {
      get().fetchNotifications(true);
    }
  },

  addRealtimeNotification: (notif: NotificationItem) => {
    set((state) => {
      const exists = state.notifications.some((n) => n.id === notif.id);
      if (exists) return state;
      return {
        notifications: [notif, ...state.notifications],
        unreadCount: state.unreadCount + (notif.isRead ? 0 : 1),
      };
    });
  },

  loadPreferences: async () => {
    try {
      const stored = await AsyncStorage.getItem(PREFS_STORAGE_KEY);
      if (stored) {
        set({ preferences: { ...DEFAULT_PREFS, ...JSON.parse(stored) } });
      }
    } catch {}
  },

  setPreference: async (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...get().preferences, [key]: value };
    set({ preferences: updated });
    try {
      await AsyncStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  },

  setUnreadMessageCount: (count: number) => {
    set({ unreadMessageCount: Math.max(0, count) });
  },
}));
