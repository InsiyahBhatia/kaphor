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
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNotificationStore, NotificationItem } from '../../../src/store/notificationStore';
import { swapService } from '../../../src/services/swapService';
import { colors, typography } from '../../../src/theme';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { Loader } from '../../../src/components/common/Loader';

type NotificationCategory = 'UNREAD' | 'SWAP' | 'SELLING' | 'RENTAL' | 'REVIEWS';

const keyExtractor = (n: NotificationItem) => n.id;
const Separator = () => <View style={{ height: 10 }} />;

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

  const [category, setCategory] = useState<NotificationCategory>('UNREAD');
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
        try {
          // Dynamic Latest-Stage Resolver: query the current live state of this swap
          const liveSwap = await swapService.getSwapById(data.swapId);
          const status = (liveSwap?.status as string) || '';

          if (status === 'REQUESTED') {
            // Balance Page (shows both users' trade values + Fair Value Matcher)
            router.push(`/(tabs)/swap/details?swapId=${data.swapId}` as any);
            return;
          }

          if (status === 'ACCEPTED' || status === 'AGREEMENT_PENDING') {
            const isFullySigned = (liveSwap as any).initiatorSigned && (liveSwap as any).receiverSigned;
            if (!isFullySigned) {
              router.push(`/(tabs)/swap/agreement?swapId=${data.swapId}` as any);
              return;
            }
            router.push(`/(tabs)/swap/details?swapId=${data.swapId}` as any);
            return;
          }

          if (
            status === 'AGREEMENT_SIGNED' ||
            status === 'ADDRESS_SHARED' ||
            status === 'SHIPPED' ||
            status === 'BOTH_SHIPPED' ||
            status === 'DELIVERED'
          ) {
            router.push(`/(tabs)/swap/shipping?swapId=${data.swapId}` as any);
            return;
          }

          if (status === 'COMPLETED') {
            router.push(`/(tabs)/swap/details?swapId=${data.swapId}&review=1` as any);
            return;
          }

          // Default fallback for any other active state: Balance Page
          router.push(`/(tabs)/swap/details?swapId=${data.swapId}` as any);
          return;
        } catch {
          // Fallback if network lookup fails
          if (type === 'SWAP_SHIPPED' || type === 'SWAP_DELIVERED') {
            router.push(`/(tabs)/swap/shipping?swapId=${data.swapId}` as any);
          } else if (type === 'SWAP_AGREEMENT') {
            router.push(`/(tabs)/swap/agreement?swapId=${data.swapId}` as any);
          } else {
            router.push(`/(tabs)/swap/details?swapId=${data.swapId}` as any);
          }
          return;
        }
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
        router.push(`/(tabs)/rental/lease/${data.rentalId}` as any);
        return;
      }
      if (data.garmentId) {
        router.push(`/(tabs)/rental/${data.garmentId}` as any);
        return;
      }
      router.push('/(tabs)/rental?tab=my' as any);
      return;
    }

    if (type === 'PEER_REVIEW') {
      if (data.targetRoute) {
        router.push(data.targetRoute as any);
        return;
      }
      if (data.orderId) {
        router.push(`/(tabs)/shop/orders/${data.orderId}?review=true` as any);
        return;
      }
      if (data.rentalId) {
        router.push(`/(tabs)/rental/lease/${data.rentalId}?review=true` as any);
        return;
      }
      if (data.swapId) {
        router.push(`/(tabs)/swap/details?swapId=${data.swapId}&review=1` as any);
        return;
      }
      if (data.userId) {
        router.push(`/reviews?userId=${data.userId}` as any);
        return;
      }
      router.push('/reviews' as any);
      return;
    }

    if (data.targetRoute) {
      router.push(data.targetRoute as any);
      return;
    }
  };

  const getCategoryMeta = (type: string) => {
    if (type === 'DIRECT_MESSAGE' || type === 'NEW_MESSAGE') {
      return {
        icon: 'chatbubble-ellipses',
        label: 'MESSAGE',
        cta: 'REPLY IN CHAT →',
        color: colors.inkSoft,
        bg: colors.emeraldLight,
      };
    }
    if (type.startsWith('SWAP_')) {
      return {
        icon: 'swap-horizontal',
        label: 'SWAP',
        cta: 'VIEW ACTIVE STAGE →',
        color: colors.goldDark,
        bg: colors.goldLight,
      };
    }
    if (type.startsWith('ORDER_')) {
      return {
        icon: 'bag-check',
        label: 'SELLING',
        cta: 'TRACK ORDER →',
        color: colors.ink,
        bg: colors.overlayLight,
      };
    }
    if (type.startsWith('RENTAL_')) {
      return {
        icon: 'calendar',
        label: 'RENTAL',
        cta: 'VIEW LEASE →',
        color: colors.ink,
        bg: colors.overlayLight,
      };
    }
    if (type === 'PEER_REVIEW') {
      return {
        icon: 'star',
        label: 'REVIEW',
        cta: 'LEAVE REVIEW →',
        color: colors.orange,
        bg: colors.goldLight,
      };
    }
    return {
      icon: 'notifications',
      label: 'ALERT',
      cta: 'VIEW DETAILS →',
      color: colors.charcoal,
      bg: colors.overlayLight,
    };
  };

  // Bell notifications strictly exclude direct messages (only swap, rental, sell, reviews)
  const bellNotifications = notifications.filter(
    (n) => n.type !== 'DIRECT_MESSAGE' && n.type !== 'NEW_MESSAGE'
  );
  const bellUnreadCount = bellNotifications.filter((n) => !n.isRead).length;

  // Filtered items
  const filteredNotifications = bellNotifications.filter((n) => {
    if (category === 'UNREAD') return !n.isRead;
    const t = n.type || '';
    if (category === 'SWAP') return t.startsWith('SWAP_');
    if (category === 'SELLING') return t.startsWith('ORDER_');
    if (category === 'RENTAL') return t.startsWith('RENTAL_');
    if (category === 'REVIEWS') return t === 'PEER_REVIEW';
    return true;
  });

  const categoryCounts: Record<NotificationCategory, number> = {
    UNREAD: bellUnreadCount,
    SWAP: bellNotifications.filter((n) => n.type?.startsWith('SWAP_')).length,
    SELLING: bellNotifications.filter((n) => n.type?.startsWith('ORDER_')).length,
    RENTAL: bellNotifications.filter((n) => n.type?.startsWith('RENTAL_')).length,
    REVIEWS: bellNotifications.filter((n) => n.type === 'PEER_REVIEW').length,
  };

  const renderNotification = ({ item: n }: { item: NotificationItem }) => {
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
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Confirm"
                  style={styles.quickMarkReadBtn}
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    markAsRead(n.id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="checkmark" size={14} color={colors.forest || colors.inkSoft} />
                </TouchableOpacity>
              )}

              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
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
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" 
            onPress={() => safeBack('/(tabs)/profile')} 
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.charcoal} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>ACTIVITY & ALERTS</Text>
            <Text style={styles.subtitle}>
              {bellUnreadCount > 0 ? `${bellUnreadCount} UNREAD ALERTS` : 'ALL ALERTS UP TO DATE'}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {bellUnreadCount > 0 && (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Checkmark done"
                onPress={handleMarkAllRead}
                style={styles.actionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="checkmark-done" size={16} color={colors.charcoal} />
              </TouchableOpacity>
            )}

            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Filters"
              onPress={() => setShowSettingsModal(true)}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="options-outline" size={16} color={colors.charcoal} />
            </TouchableOpacity>

            {bellNotifications.length > 0 && (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Delete"
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
          {(['UNREAD', 'SWAP', 'SELLING', 'RENTAL', 'REVIEWS'] as NotificationCategory[]).map((cat) => {
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
      <FlatList
        data={filteredNotifications}
        keyExtractor={keyExtractor}
        renderItem={renderNotification}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          loading && notifications.length === 0 ? (
          <View style={{ marginTop: 40 }}>
            <Loader variant="notifications" compact />
          </View>
          ) : (
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
                ? 'You have addressed all active transaction alerts.'
                : 'Real-time updates about your swaps, orders, rentals, and reviews will appear here.'}
            </Text>
          </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.charcoal}
            colors={[colors.charcoal]}
          />
        }
      />

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
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                  trackColor={{ false: colors.borderLight, true: colors.charcoal }}
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
                  trackColor={{ false: colors.borderLight, true: colors.charcoal }}
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
                  trackColor={{ false: colors.borderLight, true: colors.charcoal }}
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
                  trackColor={{ false: colors.borderLight, true: colors.charcoal }}
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
                  trackColor={{ false: colors.borderLight, true: colors.charcoal }}
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
    backgroundColor: colors.paperLight,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 18,
    color: colors.charcoal,
  },
  subtitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 18,
    color: colors.textMuted,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 18,
    color: colors.charcoal,
  },
  categoryChipTextActive: {
    color: colors.cream,
  },
  chipBadge: {
    backgroundColor: colors.overlayLight,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
  },
  chipBadgeActive: {
    backgroundColor: colors.cream,
  },
  chipBadgeText: {
    fontFamily: typography.mono,
    fontSize: 11.5,
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
    backgroundColor: colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  emptyText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    color: colors.charcoal,
    fontSize: 17,
    marginTop: 4,
  },
  emptySubtext: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    color: colors.textMuted,
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 23,
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
    borderColor: colors.overlayLight,
    borderRadius: 8,
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  cardUnread: {
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 18,
  },
  cardTime: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.textMuted,
  },
  cardTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
  },
  cardTitleUnread: {
    fontWeight: '900',
  },
  cardBody: {
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.inkSoft,
    lineHeight: 17,
  },
  ctaRow: {
    marginTop: 4,
  },
  ctaText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
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
    backgroundColor: colors.emeraldLight,
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
    backgroundColor: colors.gold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
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
    borderBottomColor: colors.overlayLight,
  },
  modalTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 18,
    color: colors.charcoal,
  },
  modalSubtitle: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 18,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
  },
  prefDesc: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 18,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.cream,
  },
});

