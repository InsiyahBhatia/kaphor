import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../src/theme';
import { Header } from '../../src/components/common/Header';
import { KaphorImage } from '../../src/components/KaphorImage';
import { VerifiedBadge } from '../../src/components/common/VerifiedBadge';
import { messageService, ConversationSummary } from '../../src/services/messageService';
import { getSocket, connectSocket } from '../../src/services/socket';

type FilterTab = 'ALL' | 'ORDERS' | 'INQUIRIES';

export default function MessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  const loadConversations = useCallback(async () => {
    try {
      const list = await messageService.listConversations();
      setConversations(list);
    } catch (e) {
      console.error('Failed to load conversations', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();

      // Listen for incoming live socket events to update inbox instantly in real time
      const socket = connectSocket() || getSocket();
      if (socket) {
        const handler = () => {
          loadConversations();
        };
        socket.on('new_direct_message', handler);
        socket.on('direct_message', handler);
        socket.on('connect', handler);
        return () => {
          socket.off('new_direct_message', handler);
          socket.off('direct_message', handler);
          socket.off('connect', handler);
        };
      }
    }, [loadConversations])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const filteredConversations = useMemo(() => {
    if (activeTab === 'ORDERS') {
      return conversations.filter((c) => !!c.order);
    }
    if (activeTab === 'INQUIRIES') {
      return conversations.filter((c) => !c.order);
    }
    return conversations;
  }, [conversations, activeTab]);

  const ordersCount = useMemo(() => conversations.filter((c) => !!c.order).length, [conversations]);
  const inquiriesCount = useMemo(() => conversations.filter((c) => !c.order).length, [conversations]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const getOrderStatusStyle = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'PAID':
        return { bg: 'rgba(40,54,24,0.12)', color: colors.forest, label: 'ORDER PAID' };
      case 'SHIPPED':
        return { bg: 'rgba(30,58,138,0.12)', color: colors.navy, label: 'IN TRANSIT' };
      case 'DELIVERED':
        return { bg: 'rgba(201,168,76,0.18)', color: '#997300', label: 'DELIVERED' };
      case 'PENDING':
        return { bg: 'rgba(201,95,18,0.12)', color: colors.orange, label: 'ORDER PENDING' };
      default:
        return { bg: 'rgba(30,31,34,0.08)', color: colors.charcoal, label: status };
    }
  };

  const renderItem = ({ item }: { item: ConversationSummary }) => {
    const isUnread = item.unreadCount > 0;
    const isGarmentInquiry = !!item.garment;
    const hasOrder = !!item.order;
    const orderStyle = hasOrder ? getOrderStatusStyle(item.order!.status) : null;

    return (
      <TouchableOpacity
        style={[
          styles.convCard,
          isUnread && styles.convCardUnread,
          hasOrder && styles.convCardOrder,
        ]}
        onPress={() => router.push(`/messages/${item.id}` as any)}
        activeOpacity={0.75}
      >
        {/* User Avatar */}
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={() => item.otherUser?.id && router.push(`/(tabs)/shop/seller/${item.otherUser.id}` as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <KaphorImage
            uri={item.otherUser.avatar || ''}
            style={styles.avatar}
            contentFit="cover"
          />
          {item.otherUser.isVerified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="shield-checkmark" size={12} color="#C9A84C" />
            </View>
          )}
        </TouchableOpacity>

        {/* Conversation Info */}
        <View style={styles.convInfo}>
          <View style={styles.convHeader}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, isUnread && styles.userNameUnread]} numberOfLines={1}>
                {item.otherUser.displayName}
              </Text>
              {item.otherUser.isVerified && <VerifiedBadge size="compact" />}
            </View>
            <Text style={styles.timeText}>{formatTime(item.lastMessageAt)}</Text>
          </View>

          {/* Context Badges */}
          <View style={styles.badgeRow}>
            {hasOrder && orderStyle && (
              <View style={[styles.orderBadge, { backgroundColor: orderStyle.bg }]}>
                <Ionicons name="bag-check" size={10} color={orderStyle.color} />
                <Text style={[styles.orderBadgeText, { color: orderStyle.color }]}>
                  {orderStyle.label} · #{item.order!.id.slice(0, 6).toUpperCase()}
                </Text>
              </View>
            )}

            {isGarmentInquiry && !hasOrder && (
              <View style={styles.garmentBadge}>
                <Ionicons name="pricetag" size={10} color={colors.red} />
                <Text style={styles.garmentBadgeText} numberOfLines={1}>
                  {item.garment?.brand} · {item.garment?.title}
                </Text>
              </View>
            )}

            {!isGarmentInquiry && !hasOrder && (
              <View style={styles.directBadge}>
                <Ionicons name="person" size={10} color={colors.forest || '#2D5A27'} />
                <Text style={styles.directBadgeText} numberOfLines={1}>
                  Direct Seller Chat
                </Text>
              </View>
            )}
          </View>

          {/* Message snippet */}
          <Text
            style={[styles.messageSnippet, isUnread && styles.messageSnippetUnread]}
            numberOfLines={1}
          >
            {item.lastMessageText || 'Tap to start conversation'}
          </Text>
        </View>

        {/* Garment Thumbnail if inquiry */}
        {isGarmentInquiry && item.garment?.image && (
          <KaphorImage
            uri={item.garment.image}
            style={styles.garmentThumb}
            contentFit="cover"
          />
        )}

        {/* Unread Pill */}
        {isUnread && (
          <View style={styles.unreadPill}>
            <Text style={styles.unreadPillText}>{item.unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="MESSAGES" />

      {/* Unified Secure Coordination Notice */}
      <View style={styles.safetyBar}>
        <Ionicons name="shield-checkmark" size={13} color="#C9A84C" />
        <Text style={styles.safetyBarText}>
          Kaphor Unified Threads • Pre-purchase Q&A & Shipping Coordination
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ALL' && styles.tabBtnActive]}
          onPress={() => setActiveTab('ALL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'ALL' && styles.tabTextActive]}>
            ALL ({conversations.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ORDERS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('ORDERS')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'ORDERS' && styles.tabTextActive]}>
            ACTIVE ORDERS ({ordersCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'INQUIRIES' && styles.tabBtnActive]}
          onPress={() => setActiveTab('INQUIRIES')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'INQUIRIES' && styles.tabTextActive]}>
            INQUIRIES ({inquiriesCount})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator color={colors.charcoal} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            filteredConversations.length === 0 ? styles.emptyContainer : styles.listContent
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.charcoal} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name={activeTab === 'ORDERS' ? 'bag-check-outline' : 'chatbubbles-outline'}
                  size={42}
                  color={colors.charcoal}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'ORDERS'
                  ? 'NO ACTIVE ORDER CHATS'
                  : activeTab === 'INQUIRIES'
                  ? 'NO GENERAL INQUIRIES'
                  : 'NO CONVERSATIONS YET'}
              </Text>
              <Text style={styles.emptyDesc}>
                {activeTab === 'ORDERS'
                  ? 'When you buy or sell items, your paid order dispatch & tracking threads appear here.'
                  : activeTab === 'INQUIRIES'
                  ? 'Pre-purchase questions and general seller chats will appear here.'
                  : 'When you message sellers or coordinate deliveries, your unified conversation threads appear here.'}
              </Text>
              <TouchableOpacity
                style={styles.exploreBtn}
                onPress={() => router.push('/(tabs)/shop')}
                activeOpacity={0.8}
              >
                <Text style={styles.exploreBtnText}>EXPLORE MARKETPLACE →</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  safetyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    backgroundColor: colors.charcoal,
    borderBottomWidth: 1,
    borderBottomColor: '#C9A84C',
  },
  safetyBarText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  tabText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tabTextActive: {
    color: colors.cream,
    fontWeight: '900',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 14,
    borderWidth: 2,
    borderColor: 'rgba(30,31,34,0.15)',
    gap: 12,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 0,
    elevation: 2,
  },
  convCardUnread: {
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    elevation: 3,
  },
  convCardOrder: {
    borderLeftWidth: 5,
    borderLeftColor: colors.forest,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.charcoal,
    padding: 2,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  convInfo: {
    flex: 1,
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.charcoal,
  },
  userNameUnread: {
    fontWeight: '900',
  },
  timeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  orderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(40,54,24,0.3)',
  },
  orderBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  garmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(193,65,58,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(193,65,58,0.25)',
  },
  garmentBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: colors.red,
  },
  directBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(45,90,39,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(45,90,39,0.25)',
  },
  directBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: colors.forest || '#2D5A27',
  },
  messageSnippet: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
  },
  messageSnippetUnread: {
    color: colors.charcoal,
    fontWeight: '800',
  },
  garmentThumb: {
    width: 44,
    height: 50,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  unreadPill: {
    backgroundColor: colors.red,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadPillText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    maxWidth: 320,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  emptyTitle: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptyDesc: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
  },
  exploreBtn: {
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.charcoal,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  exploreBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
