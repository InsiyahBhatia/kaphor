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
  RefreshControl,
  Modal,
  Switch,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNotificationStore, NotificationItem } from '../../../src/store/notificationStore';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';

type NotificationCategory = 'ALL' | 'UNREAD' | 'ORDERS' | 'SWAPS' | 'MESSAGES' | 'SYSTEM';

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
  useBackHandler('/(tabs)/profile');

  const notifications = useNotificationStore((s) => s.notifications);
  const loading = useNotificationStore((s) => s.loading);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const preferences = useNotificationStore((s) => s.preferences);

  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const deleteNotification = useNotificationStore((s) => s.deleteNotification);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const setPreference = useNotificationStore((s) => s.setPreference);
  const loadPreferences = useNotificationStore((s) => s.loadPreferences);

  const [category, setCategory] = useState<NotificationCategory>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    fetchNotifications();
    loadPreferences();
  }, [fetchNotifications, loadPreferences]);

  // Foreground auto-refresh
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        fetchNotifications(true);
      }
    });
    return () => sub.remove();
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    await fetchNotifications(true);
    setRefreshing(false);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    await markAllAsRead();
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to dismiss all notification records?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } catch {}
            await clearAll();
          },
        },
      ]
    );
  };

  const handlePressNotification = async (n: NotificationItem) => {
    if (!n.isRead) {
      markAsRead(n.id);
    }

    const type = n.type || '';
    const data = n.data || {};

    if (type === 'DIRECT_MESSAGE' || type === 'NEW_MESSAGE') {
      if (data.conversationId) {
        router.push(`/messages/${data.conversationId}` as any);
        return;
      }
      router.push('/messages' as any);
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

  const getCategoryMeta = (type: string) => {
    if (type === 'DIRECT_MESSAGE' || type === 'NEW_MESSAGE') {
      return {
        icon: 'chatbubble-ellipses',
        label: 'MESSAGE',
        cta: 'REPLY IN CHAT →',
        color: '#2D5A27',
        bg: 'rgba(45,90,39,0.1)',
      };
    }
    if (type.startsWith('SWAP_')) {
      return {
        icon: 'swap-horizontal',
        label: 'SWAP',
        cta: 'VIEW DOSSIER →',
        color: '#8C6D3B',
        bg: 'rgba(140,109,59,0.12)',
      };
    }
    if (type.startsWith('ORDER_')) {
      return {
        icon: 'bag-check',
        label: 'ORDER',
        cta: 'TRACK ORDER →',
        color: '#1E3A8A',
        bg: 'rgba(30,58,138,0.1)',
      };
    }
    if (type.startsWith('RENTAL_')) {
      return {
        icon: 'calendar',
        label: 'RENTAL',
        cta: 'VIEW LEASE →',
        color: '#6B46C1',
        bg: 'rgba(107,70,193,0.1)',
      };
    }
    return {
      icon: 'notifications',
      label: 'SYSTEM',
      cta: 'VIEW DETAILS →',
      color: colors.charcoal,
      bg: 'rgba(30,31,34,0.08)',
    };
  };

  // Filtered items
  const filteredNotifications = notifications.filter((n) => {
    if (category === 'ALL') return true;
    if (category === 'UNREAD') return !n.isRead;
    const t = n.type || '';
    if (category === 'MESSAGES') return t === 'DIRECT_MESSAGE' || t === 'NEW_MESSAGE';
    if (category === 'SWAPS') return t.startsWith('SWAP_');
    if (category === 'ORDERS') return t.startsWith('ORDER_') || t.startsWith('RENTAL_');
    if (category === 'SYSTEM') {
      return !t.startsWith('SWAP_') && !t.startsWith('ORDER_') && !t.startsWith('RENTAL_') && t !== 'DIRECT_MESSAGE' && t !== 'NEW_MESSAGE';
    }
    return true;
  });

  const categoryCounts: Record<NotificationCategory, number> = {
    ALL: notifications.length,
    UNREAD: unreadCount,
    ORDERS: notifications.filter((n) => n.type?.startsWith('ORDER_') || n.type?.startsWith('RENTAL_')).length,
    SWAPS: notifications.filter((n) => n.type?.startsWith('SWAP_')).length,
    MESSAGES: notifications.filter((n) => n.type === 'DIRECT_MESSAGE' || n.type === 'NEW_MESSAGE').length,
    SYSTEM: notifications.filter((n) => !n.type?.startsWith('SWAP_') && !n.type?.startsWith('ORDER_') && !n.type?.startsWith('RENTAL_') && n.type !== 'DIRECT_MESSAGE' && n.type !== 'NEW_MESSAGE').length,
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
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
            <Text style={styles.title}>ACTIVITY & ALERTS</Text>
            <Text style={styles.subtitle}>
              {unreadCount > 0 ? `${unreadCount} UNREAD NOTIFICATIONS` : 'ALL ALERTS UP TO DATE'}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={handleMarkAllRead}
                style={styles.actionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="checkmark-done" size={16} color={colors.charcoal} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setShowSettingsModal(true)}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="options-outline" size={16} color={colors.charcoal} />
            </TouchableOpacity>

            {notifications.length > 0 && (
              <TouchableOpacity
                onPress={handleClearAll}
                style={styles.actionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Horizontal Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {(['ALL', 'UNREAD', 'ORDERS', 'SWAPS', 'MESSAGES', 'SYSTEM'] as NotificationCategory[]).map((cat) => {
            const count = categoryCounts[cat] || 0;
            const isActive = category === cat;

            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setCategory(cat);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                  {cat}
                </Text>
                {count > 0 && (
                  <View style={[styles.chipBadge, isActive ? styles.chipBadgeActive : undefined]}>
                    <Text style={[styles.chipBadgeText, isActive ? styles.chipBadgeTextActive : undefined]}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content List with Pull-to-Refresh */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.charcoal}
            colors={[colors.charcoal]}
          />
        }
      >
        {loading && !refreshing ? (
          <View style={{ marginTop: 40 }}>
            <DossierLoading variant="notifications" compact />
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name={category === 'UNREAD' ? 'checkmark-circle-outline' : 'notifications-off-outline'}
                size={40}
                color={colors.charcoal}
              />
            </View>
            <Text style={styles.emptyText}>
              {category === 'UNREAD' ? 'NO UNREAD ALERTS' : `NO NOTIFICATIONS IN ${category}`}
            </Text>
            <Text style={styles.emptySubtext}>
              {category === 'UNREAD'
                ? 'You have addressed all active notifications and messages.'
                : 'Real-time updates about your swaps, orders, rentals, and peer messages will appear here.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredNotifications.map((n) => {
              const meta = getCategoryMeta(n.type);

              return (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.card, !n.isRead && styles.cardUnread]}
                  onPress={() => handlePressNotification(n)}
                  activeOpacity={0.88}
                >
                  {/* Left Icon Wrap */}
                  <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                  </View>

                  {/* Card Main Info */}
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeaderRow}>
                      <View style={[styles.typeBadge, { borderColor: meta.color }]}>
                        <Text style={[styles.typeBadgeText, { color: meta.color }]}>
                          {meta.label}
                        </Text>
                      </View>
                      <Text style={styles.cardTime}>
                        {formatRelativeTime(n.createdAt)}
                      </Text>
                    </View>

                    <Text style={[styles.cardTitle, !n.isRead && styles.cardTitleUnread]} numberOfLines={1}>
                      {n.title}
                    </Text>

                    <Text style={styles.cardBody} numberOfLines={2}>
                      {n.body}
                    </Text>

                    <View style={styles.ctaRow}>
                      <Text style={[styles.ctaText, { color: meta.color }]}>
                        {meta.cta}
                      </Text>
                    </View>
                  </View>

                  {/* Card Right Actions */}
                  <View style={styles.cardRightActions}>
                    {!n.isRead && (
                      <TouchableOpacity
                        style={styles.quickMarkReadBtn}
                        onPress={() => {
                          try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          } catch {}
                          markAsRead(n.id);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="checkmark" size={14} color={colors.forest || '#2D5A27'} />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.deleteCardBtn}
                      onPress={() => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        deleteNotification(n.id);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {/* Unread indicator ribbon */}
                  {!n.isRead && <View style={styles.unreadRibbon} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Preferences / Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSettingsModal(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>NOTIFICATION PREFERENCES</Text>
                <Text style={styles.modalSubtitle}>Customize alerts and real-time banner behavior</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowSettingsModal(false)}
              >
                <Ionicons name="close" size={20} color={colors.charcoal} />
              </TouchableOpacity>
            </View>

            <View style={styles.prefList}>
              <View style={styles.prefItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefLabel}>In-App Floating Banners</Text>
                  <Text style={styles.prefDesc}>Show toast popups while actively using the app</Text>
                </View>
                <Switch
                  value={preferences.banners}
                  onValueChange={(val) => setPreference('banners', val)}
                  trackColor={{ false: '#D1D5DB', true: colors.charcoal }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.prefItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefLabel}>Haptic Feedback</Text>
                  <Text style={styles.prefDesc}>Vibrate gently when new alerts or messages arrive</Text>
                </View>
                <Switch
                  value={preferences.haptics}
                  onValueChange={(val) => setPreference('haptics', val)}
                  trackColor={{ false: '#D1D5DB', true: colors.charcoal }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.prefItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefLabel}>Orders & Rentals</Text>
                  <Text style={styles.prefDesc}>Payment confirmations, tracking updates, and return reminders</Text>
                </View>
                <Switch
                  value={preferences.orders}
                  onValueChange={(val) => setPreference('orders', val)}
                  trackColor={{ false: '#D1D5DB', true: colors.charcoal }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.prefItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefLabel}>Swap Exchanges</Text>
                  <Text style={styles.prefDesc}>Direct swap proposals, acceptances, agreement signatures, and disputes</Text>
                </View>
                <Switch
                  value={preferences.swaps}
                  onValueChange={(val) => setPreference('swaps', val)}
                  trackColor={{ false: '#D1D5DB', true: colors.charcoal }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.prefItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefLabel}>Direct Messages</Text>
                  <Text style={styles.prefDesc}>Real-time chat alerts from partner members and sellers</Text>
                </View>
                <Switch
                  value={preferences.messages}
                  onValueChange={(val) => setPreference('messages', val)}
                  trackColor={{ false: '#D1D5DB', true: colors.charcoal }}
                  thumbColor={colors.white}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.doneBtnText}>SAVE & CLOSE</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.charcoal,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1.2,
  },
  subtitle: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.8,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    borderRadius: 4,
  },
  categoryChipActive: {
    backgroundColor: colors.charcoal,
  },
  categoryChipText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  categoryChipTextActive: {
    color: colors.cream,
  },
  chipBadge: {
    backgroundColor: 'rgba(30,31,34,0.1)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
  },
  chipBadgeActive: {
    backgroundColor: colors.cream,
  },
  chipBadgeText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: colors.charcoal,
  },
  chipBadgeTextActive: {
    color: colors.charcoal,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 70,
    paddingHorizontal: 30,
    gap: 12,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F0ECE1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  emptyText: {
    fontFamily: typography.mono,
    color: colors.charcoal,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 4,
  },
  emptySubtext: {
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontSize: 9.5,
    textAlign: 'center',
    lineHeight: 15,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: 'rgba(30,31,34,0.14)',
    borderRadius: 8,
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  cardUnread: {
    borderColor: colors.charcoal,
    backgroundColor: '#FFFEFA',
    borderLeftWidth: 4,
    borderLeftColor: '#C9A84C',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardTime: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    fontWeight: '700',
  },
  cardTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
  },
  cardTitleUnread: {
    fontWeight: '900',
  },
  cardBody: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    color: 'rgba(30,31,34,0.78)',
    lineHeight: 14,
  },
  ctaRow: {
    marginTop: 4,
  },
  ctaText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickMarkReadBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EBF3ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteCardBtn: {
    padding: 4,
  },
  unreadRibbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderTopRightRadius: 6,
    backgroundColor: '#C9A84C',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
  },
  modalTitle: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  modalSubtitle: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  prefList: {
    paddingVertical: 10,
    gap: 14,
  },
  prefItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  prefLabel: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
  },
  prefDesc: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    marginTop: 2,
    maxWidth: '85%',
  },
  doneBtn: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: colors.charcoal,
    borderRadius: 6,
    alignItems: 'center',
  },
  doneBtnText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 1,
  },
});

