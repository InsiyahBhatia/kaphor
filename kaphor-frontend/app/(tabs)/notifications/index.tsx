import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { notificationService } from '../../../src/services/notificationService';
import { cachedGet, fetchFresh } from '../../../src/services/api';
import { getSocket, connectSocket } from '../../../src/services/socket';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';
import { safeBack } from '../../../src/utils/navigation';

type NotificationCategory = 'ALL' | 'MESSAGES' | 'SWAPS' | 'ORDERS' | 'SYSTEM';

function formatRelativeTime(dateString: string): string {
  try {
    const now = new Date();
    const past = new Date(dateString);
    const diffSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffSeconds < 60) return 'JUST NOW';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}M AGO`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}H AGO`;
    if (diffSeconds < 172800) return 'YESTERDAY';
    return past.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }).toUpperCase();
  } catch {
    return 'RECENT';
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<NotificationCategory>('ALL');

  const fetchNotifications = useCallback(async (forceFresh = false) => {
    try {
      const data = forceFresh
        ? await fetchFresh('/notifications')
        : await cachedGet('/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time Socket.IO listener
  useEffect(() => {
    let activeSocket = connectSocket() || getSocket();

    const handleNewNotification = (notif: any) => {
      if (notif && notif.id) {
        setNotifications((prev) => [notif, ...prev.filter((item) => item.id !== notif.id)]);
      }
    };

    const handleNewDirectMessage = (data: any) => {
      if (data && data.message) {
        const senderName = data.message.sender?.displayName || 'Direct Message';
        const newNotif = {
          id: `msg_notif_${data.message.id || Date.now()}`,
          type: 'DIRECT_MESSAGE',
          title: `💬 New message from ${senderName}`,
          body: data.message.content || 'Sent you an attachment',
          data: { conversationId: data.conversationId },
          isRead: false,
          createdAt: data.message.createdAt || new Date().toISOString(),
        };
        setNotifications((prev) => [newNotif, ...prev.filter((item) => item.id !== newNotif.id)]);
      }
    };

    const attach = (s: any) => {
      s.on('new_notification', handleNewNotification);
      s.on('new_direct_message', handleNewDirectMessage);
    };

    if (activeSocket) {
      attach(activeSocket);
    }

    const interval = setInterval(() => {
      const s = connectSocket() || getSocket();
      if (s && s !== activeSocket) {
        activeSocket = s;
        attach(activeSocket);
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      if (activeSocket) {
        activeSocket.off('new_notification', handleNewNotification);
        activeSocket.off('new_direct_message', handleNewDirectMessage);
      }
    };
  }, []);

  // Foreground refresh
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        fetchNotifications(true);
      }
    });
    return () => sub.remove();
  }, [fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to dismiss all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationService.clearAll();
              setNotifications([]);
            } catch {}
          },
        },
      ]
    );
  };

  const handlePressNotification = async (n: any) => {
    handleMarkRead(n.id);
    const type = n.type || '';
    const data = n.data || {};

    if (type === 'DIRECT_MESSAGE' || type === 'NEW_MESSAGE') {
      if (data.conversationId) {
        router.push(`/messages/${data.conversationId}` as any);
        return;
      }
      router.push('/(tabs)/messages' as any);
      return;
    }

    if (type.startsWith('SWAP_')) {
      if (data.swapId) {
        if (type === 'SWAP_SHIPPED' || type === 'SWAP_DELIVERED') {
          router.push(`/(tabs)/swap/shipping?swapId=${data.swapId}` as any);
        } else if (type === 'SWAP_AGREEMENT') {
          router.push(`/(tabs)/swap/agreement?swapId=${data.swapId}` as any);
        } else {
          router.push(`/(tabs)/swap/details?swapId=${data.swapId}` as any);
        }
        return;
      }
      router.push('/(tabs)/swap' as any);
      return;
    }

    if (type.startsWith('ORDER_')) {
      if (data.orderId) {
        router.push(`/(tabs)/shop/orders/${data.orderId}` as any);
        return;
      }
      router.push('/(tabs)/shop/orders' as any);
      return;
    }

    if (type.startsWith('RENTAL_')) {
      if (data.rentalId) {
        router.push(`/rental/${data.rentalId}` as any);
        return;
      }
      router.push('/(tabs)/rental' as any);
      return;
    }

    if (type === 'PEER_REVIEW') {
      router.push('/reviews' as any);
      return;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'DIRECT_MESSAGE':
      case 'NEW_MESSAGE':
        return 'chatbubble-ellipses';
      case 'SWAP_REQUEST':
      case 'SWAP_ACCEPTED':
      case 'SWAP_SHIPPED':
      case 'SWAP_COMPLETED':
        return 'swap-horizontal';
      case 'ORDER_PAID':
      case 'ORDER_SHIPPED':
      case 'ORDER_DELIVERED':
        return 'bag-check';
      case 'RENTAL_RESERVED':
      case 'RENTAL_ACTIVE':
      case 'RENTAL_REMINDER':
        return 'calendar';
      case 'PEER_REVIEW':
        return 'star';
      default:
        return 'notifications';
    }
  };

  // Category Filtering
  const filteredNotifications = notifications.filter((n) => {
    if (category === 'ALL') return true;
    const t = n.type || '';
    if (category === 'MESSAGES') return t === 'DIRECT_MESSAGE' || t === 'NEW_MESSAGE';
    if (category === 'SWAPS') return t.startsWith('SWAP_');
    if (category === 'ORDERS') return t.startsWith('ORDER_') || t.startsWith('RENTAL_');
    if (category === 'SYSTEM') return !t.startsWith('SWAP_') && !t.startsWith('ORDER_') && !t.startsWith('RENTAL_') && t !== 'DIRECT_MESSAGE';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            onPress={() => safeBack('/(tabs)/profile')} 
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.charcoal} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>NOTIFICATIONS</Text>
            <Text style={styles.subtitle}>
              {unreadCount > 0 ? `${unreadCount} UNREAD ALERTS` : 'ALL ALERTS CLEAR'}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={handleMarkAllRead} style={styles.actionBtn}>
                <Ionicons name="checkmark-done" size={16} color={colors.charcoal} />
              </TouchableOpacity>
            )}
            {notifications.length > 0 && (
              <TouchableOpacity onPress={handleClearAll} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {(['ALL', 'MESSAGES', 'SWAPS', 'ORDERS', 'SYSTEM'] as NotificationCategory[]).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content List */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ marginTop: 40 }}>
            <DossierLoading variant="notifications" compact />
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={44} color={colors.charcoal} />
            <Text style={styles.emptyText}>NO NOTIFICATIONS IN {category}</Text>
            <Text style={styles.emptySubtext}>
              Real-time activity regarding swaps, messages, and orders will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredNotifications.map((n) => (
              <TouchableOpacity
                key={n.id}
                style={[styles.card, !n.isRead && styles.cardUnread]}
                onPress={() => handlePressNotification(n)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconWrap, !n.isRead && styles.iconWrapUnread]}>
                  <Ionicons
                    name={getIcon(n.type) as any}
                    size={20}
                    color={!n.isRead ? colors.cream : colors.charcoal}
                  />
                </View>

                <View style={styles.cardContent}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.cardTitle, !n.isRead && styles.cardTitleUnread]} numberOfLines={1}>
                      {n.title || n.type}
                    </Text>
                    <Text style={styles.cardTime}>
                      {formatRelativeTime(n.createdAt)}
                    </Text>
                  </View>

                  <Text style={styles.cardBody} numberOfLines={2}>
                    {n.body}
                  </Text>

                  <View style={styles.tapToOpenRow}>
                    <Text style={styles.tapToOpenText}>TAP TO VIEW DETAILS →</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.deleteCardBtn}
                  onPress={() => handleDelete(n.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                {!n.isRead && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#FAF9F6',
    borderBottomWidth: 1.5,
    borderBottomColor: colors.charcoal,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.mono,
    fontSize: 16,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1.5,
  },
  subtitle: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  categoryChipActive: {
    backgroundColor: colors.charcoal,
  },
  categoryChipText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  categoryChipTextActive: {
    color: colors.cream,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 30,
    gap: 10,
  },
  emptyText: {
    fontFamily: typography.mono,
    color: colors.charcoal,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 8,
  },
  emptySubtext: {
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 16,
  },
  list: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: 'rgba(30,31,34,0.15)',
    gap: 14,
    position: 'relative',
  },
  cardUnread: {
    borderColor: colors.charcoal,
    backgroundColor: '#FFFDF9',
    borderLeftWidth: 4,
    borderLeftColor: '#C41E3A',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(30,31,34,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapUnread: {
    backgroundColor: colors.charcoal,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
  },
  cardTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
    flex: 1,
    marginRight: 6,
  },
  cardTitleUnread: {
    fontWeight: '900',
    color: colors.charcoal,
  },
  cardTime: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    fontWeight: '700',
  },
  cardBody: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.charcoal,
    lineHeight: 15,
  },
  tapToOpenRow: {
    marginTop: 6,
  },
  tapToOpenText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: '#8C6D3B',
    letterSpacing: 0.5,
  },
  deleteCardBtn: {
    padding: 4,
    position: 'absolute',
    top: 12,
    right: 12,
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C41E3A',
  },
});
