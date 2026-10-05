import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from '../services/notificationService';
import { messageService } from '../services/messageService';
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
  activeConversationId: string | null;

  // Actions
  fetchUnreadCount: () => Promise<void>;
  fetchUnreadMessageCount: () => Promise<void>;
  fetchNotifications: (forceFresh?: boolean) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  addRealtimeNotification: (notif: NotificationItem) => void;
  setPreference: (key: keyof NotificationPreferences, value: boolean) => Promise<void>;
  loadPreferences: () => Promise<void>;
  setUnreadMessageCount: (count: number) => void;
  setActiveConversationId: (id: string | null) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  unreadMessageCount: 0,
  notifications: [],
  loading: false,
  preferences: DEFAULT_PREFS,
  activeConversationId: null,

  setActiveConversationId: (id: string | null) => set({ activeConversationId: id }),

  fetchUnreadCount: async () => {
    try {
      const count = await notificationService.getUnreadCount();
      set({ unreadCount: count });
    } catch {
      // Fallback if endpoint fails
    }
  },

  fetchUnreadMessageCount: async () => {
    try {
      const count = await messageService.getUnreadCount();
      set({ unreadMessageCount: count });
    } catch {
      // Fallback
    }
  },

  fetchNotifications: async (forceFresh = false) => {
    const hadData = get().notifications.length > 0;
    // Only show a skeleton when there is nothing to show yet
    if (!hadData) {
      set({ loading: true });
      // Instant paint from the persisted copy while the network request runs
      try {
        const raw = await AsyncStorage.getItem('@kaphor_cache_/notifications');
        if (raw && get().notifications.length === 0) {
          const persisted = JSON.parse(raw);
          if (Array.isArray(persisted)) {
            const l = persisted.filter((n: NotificationItem) => n.type !== 'DIRECT_MESSAGE' && n.type !== 'NEW_MESSAGE');
            set({ notifications: l, unreadCount: l.filter((n: NotificationItem) => !n.isRead).length, loading: false });
          }
        }
      } catch {}
    }
    try {
      const data = forceFresh || get().notifications.length > 0
        ? await fetchFresh('/notifications')
        : await cachedGet('/notifications');
      const rawList = Array.isArray(data) ? data : [];
      const list = rawList.filter((n: NotificationItem) => n.type !== 'DIRECT_MESSAGE' && n.type !== 'NEW_MESSAGE');
      const unread = list.filter((n: NotificationItem) => !n.isRead).length;
      set({ notifications: list, unreadCount: unread, loading: false });
    } catch {
      // Keep whatever is on screen when the refresh fails
      set({ loading: false });
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
    // Alerts bell is only for swap, rental, sell, and reviews - never direct messages
    if (notif.type === 'DIRECT_MESSAGE' || notif.type === 'NEW_MESSAGE') return;
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
