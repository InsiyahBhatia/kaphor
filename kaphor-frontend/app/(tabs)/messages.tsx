import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../src/theme';
import { Header } from '../../src/components/common/Header';
import { EditorialPageHeader } from '../../src/components/editorial/IllustrationLayer';
import { KaphorImage } from '../../src/components/KaphorImage';
import { VerifiedBadge } from '../../src/components/common/VerifiedBadge';
import { messageService, ConversationSummary } from '../../src/services/messageService';
import { getSocket, connectSocket } from '../../src/services/socket';
import { useNotificationStore } from '../../src/store/notificationStore';
import { MessageCardsLoading } from '../../src/components/common/CardLoadingScreen';

type FilterTab = 'ALL' | 'SELL' | 'SWAP' | 'RENT';

export function getConversationCategory(c: ConversationSummary): 'SELL' | 'SWAP' | 'RENT' {
  // 1. Explicit SALE Priority (Order, Garment Listing Type, Conversation Type)
  if (c.orderId || c.order || c.garment?.listingType === 'SALE' || c.type === 'SALE') {
    return 'SELL';
  }

  // 2. Explicit RENTAL Priority
  if (c.rentalId || c.rental || c.type === 'RENTAL' || c.garment?.listingType === 'RENTAL' || (c.garment?.rentalPriceDay && c.garment.rentalPriceDay > 0)) {
    return 'RENT';
  }

  // 3. Explicit SWAP Priority
  if (c.swapId || c.swap || c.type === 'SWAP' || c.garment?.listingType === 'ACCESSORY_SWAP' || c.garment?.listingType === 'SWAP') {
    return 'SWAP';
  }

  // 4. Legacy Message Heuristic Fallback
  const text = c.lastMessageText || '';
  if (/\b(rent|rental|lease|deposit|booking)\b/i.test(text)) return 'RENT';
  if (/\b(swap|trade|exchange|proposal)\b/i.test(text)) return 'SWAP';

  // 5. Default to SELL pillar
  return 'SELL';
}

export function formatConversationSnippet(text: string | null | undefined): string {
  if (!text) return 'Tap to open conversation';
  if (text.startsWith('[[REACTION:')) {
    const match = text.match(/^\[\[REACTION:([^|]+)\|(.+)\]\]$/);
    const emoji = match ? match[2] : '❤️';
    return `Reacted ${emoji} to a message`;
  }
  return text.replace(/^\[\[REPLY:[^\]]+\]\]\s*/, '');
}

export default function MessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [isTabSwitching, setIsTabSwitching] = useState(false);

  const handleSelectTab = (tab: FilterTab) => {
    if (tab === activeTab) return;
    setIsTabSwitching(true);
    setActiveTab(tab);
    setTimeout(() => {
      setIsTabSwitching(false);
    }, 180);
  };

  const loadConversations = useCallback(async () => {
    try {
      const list = await messageService.listConversations();
      setConversations(list);
      const totalUnread = list.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      useNotificationStore.getState().setUnreadMessageCount(totalUnread);
    } catch (e) {
      console.error('Failed to load conversations', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // useFocusEffect executes on initial mount and when the tab gains focus
  useFocusEffect(
    useCallback(() => {
      loadConversations();

      // Listen for incoming live socket events to update inbox instantly in real time
      const socket = connectSocket() || getSocket();
      if (socket) {
        const handler = () => {
          loadConversations();
        };
        const handleDeleted = ({ conversationId }: { conversationId: string }) => {
          setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        };
        socket.on('new_direct_message', handler);
        socket.on('direct_message', handler);
        socket.on('conversation_deleted', handleDeleted);
        socket.on('connect', handler);
        return () => {
          socket.off('new_direct_message', handler);
          socket.off('direct_message', handler);
          socket.off('conversation_deleted', handleDeleted);
          socket.off('connect', handler);
        };
      }
    }, [loadConversations])
  );

  const handleDeleteConversation = (item: ConversationSummary) => {
    Alert.alert(
      'Delete Conversation',
      `Permanently delete your conversation with ${item.otherUser?.displayName || 'this user'}? All messages will be erased.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await messageService.deleteConversation(item.id);
              setConversations((prev) => prev.filter((c) => c.id !== item.id));
              const remainingUnread = conversations
                .filter((c) => c.id !== item.id)
                .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
              useNotificationStore.getState().setUnreadMessageCount(remainingUnread);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Could not delete conversation.');
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const filteredConversations = useMemo(() => {
    if (activeTab === 'ALL') return conversations;
    return conversations.filter((c) => getConversationCategory(c) === activeTab);
  }, [conversations, activeTab]);

  const allUnread = useMemo(() => conversations.filter((c) => (c.unreadCount || 0) > 0).length, [conversations]);
  const sellCount = useMemo(() => conversations.filter((c) => getConversationCategory(c) === 'SELL').length, [conversations]);
  const swapCount = useMemo(() => conversations.filter((c) => getConversationCategory(c) === 'SWAP').length, [conversations]);
  const rentCount = useMemo(() => conversations.filter((c) => getConversationCategory(c) === 'RENT').length, [conversations]);

  const sellUnread = useMemo(() => conversations.filter((c) => getConversationCategory(c) === 'SELL' && (c.unreadCount || 0) > 0).length, [conversations]);
  const swapUnread = useMemo(() => conversations.filter((c) => getConversationCategory(c) === 'SWAP' && (c.unreadCount || 0) > 0).length, [conversations]);
  const rentUnread = useMemo(() => conversations.filter((c) => getConversationCategory(c) === 'RENT' && (c.unreadCount || 0) > 0).length, [conversations]);

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
    const category = getConversationCategory(item);

    // Single concise, unified context pill
    let contextLabel = 'DIRECT CHAT';
    let contextBg = 'rgba(0,0,0,0.05)';
    let contextColor: string = colors.charcoal;
    let contextIcon: any = 'chatbubble-outline';

    if (hasOrder && orderStyle) {
      contextLabel = `ORDER · #${item.order!.id.slice(0, 6).toUpperCase()} · ${orderStyle.label}`;
      contextBg = orderStyle.bg;
      contextColor = orderStyle.color;
      contextIcon = 'bag-check';
    } else if (category === 'SWAP') {
      contextLabel = `SWAP · ${item.garment?.title || 'Accessory Trade'}`;
      contextBg = 'rgba(140,109,59,0.12)';
      contextColor = '#8C6D3B';
      contextIcon = 'swap-horizontal';
    } else if (category === 'RENT') {
      contextLabel = `RENTAL · ${item.garment?.title || 'Garment Hire'}`;
      contextBg = 'rgba(107,70,193,0.1)';
      contextColor = '#6B46C1';
      contextIcon = 'calendar';
    } else if (isGarmentInquiry) {
      contextLabel = `${item.garment?.brand ? `${item.garment.brand} · ` : ''}${item.garment?.title || 'Garment'}`;
      contextBg = 'rgba(193,65,58,0.08)';
      contextColor = colors.red;
      contextIcon = 'pricetag';
    }

    return (
      <TouchableOpacity
        style={[
          styles.convCard,
          isUnread && styles.convCardUnread,
          hasOrder && styles.convCardOrder,
        ]}
        onPress={() => router.push(`/messages/${item.id}` as any)}
        onLongPress={() => handleDeleteConversation(item)}
        delayLongPress={350}
        activeOpacity={0.8}
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
              <Ionicons name="shield-checkmark" size={11} color="#C9A84C" />
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

          {/* Unified single context pill */}
          <View style={[styles.unifiedContextPill, { backgroundColor: contextBg }]}>
            <Ionicons name={contextIcon} size={11} color={contextColor} />
            <Text style={[styles.unifiedContextText, { color: contextColor }]} numberOfLines={1}>
              {contextLabel}
            </Text>
          </View>

          {/* Message snippet */}
          <Text
            style={[styles.messageSnippet, isUnread && styles.messageSnippetUnread]}
            numberOfLines={1}
          >
            {formatConversationSnippet(item.lastMessageText)}
          </Text>
        </View>

        {/* Right side: Swap dual thumbnails OR single garment thumb, unread badge, delete */}
        <View style={styles.convRightCol}>
          {category === 'SWAP' && item.swapGarments && item.swapGarments.length >= 2 ? (
            <View style={styles.swapDualThumbWrap}>
              <KaphorImage
                uri={item.swapGarments[0]?.image || item.swapGarments[0]?.images?.[0] || ''}
                style={styles.swapThumbBack}
                contentFit="cover"
              />
              <KaphorImage
                uri={item.swapGarments[1]?.image || item.swapGarments[1]?.images?.[0] || ''}
                style={styles.swapThumbFront}
                contentFit="cover"
              />
              <View style={styles.swapThumbBadge}>
                <Ionicons name="swap-horizontal" size={8} color="#fff" />
              </View>
            </View>
          ) : category === 'SWAP' && (item.garment?.image || item.garment?.images?.[0]) ? (
            <KaphorImage
              uri={item.garment.image || item.garment.images?.[0] || ''}
              style={styles.garmentThumb}
              contentFit="cover"
            />
          ) : isGarmentInquiry && (item.garment?.image || item.garment?.images?.[0]) ? (
            <KaphorImage
              uri={item.garment?.image || item.garment?.images?.[0] || ''}
              style={styles.garmentThumb}
              contentFit="cover"
            />
          ) : null}
          <View style={styles.rightActionRow}>
            {isUnread && (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadPillText}>{item.unreadCount}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => handleDeleteConversation(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.delIconBtn}
              accessibilityLabel="Delete Conversation"
            >
              <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <EditorialPageHeader
        title="CORRESPONDENCE"
        subtitle="ARCHIVAL INBOX // PEER EXCHANGE"
        eyebrow="MESSAGES"
        variant="messages"
      />

      {/* Categories: ALL, SELL, SWAP, RENT */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ALL' && styles.tabBtnActive]}
          onPress={() => handleSelectTab('ALL')}
          activeOpacity={0.8}
        >
          <View style={styles.tabContentRow}>
            <Text style={[styles.tabText, activeTab === 'ALL' && styles.tabTextActive]}>
              ALL ({conversations.length})
            </Text>
            {allUnread > 0 && (
              <View style={[styles.tabUnreadBadge, activeTab === 'ALL' && styles.tabUnreadBadgeActive]}>
                <Text style={[styles.tabUnreadBadgeText, activeTab === 'ALL' && styles.tabUnreadBadgeTextActive]}>
                  {allUnread}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'SELL' && styles.tabBtnActive]}
          onPress={() => handleSelectTab('SELL')}
          activeOpacity={0.8}
        >
          <View style={styles.tabContentRow}>
            <Text style={[styles.tabText, activeTab === 'SELL' && styles.tabTextActive]}>
              SELL ({sellCount})
            </Text>
            {sellUnread > 0 && (
              <View style={[styles.tabUnreadBadge, activeTab === 'SELL' && styles.tabUnreadBadgeActive]}>
                <Text style={[styles.tabUnreadBadgeText, activeTab === 'SELL' && styles.tabUnreadBadgeTextActive]}>
                  {sellUnread}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'SWAP' && styles.tabBtnActive]}
          onPress={() => handleSelectTab('SWAP')}
          activeOpacity={0.8}
        >
          <View style={styles.tabContentRow}>
            <Text style={[styles.tabText, activeTab === 'SWAP' && styles.tabTextActive]}>
              SWAP ({swapCount})
            </Text>
            {swapUnread > 0 && (
              <View style={[styles.tabUnreadBadge, activeTab === 'SWAP' && styles.tabUnreadBadgeActive]}>
                <Text style={[styles.tabUnreadBadgeText, activeTab === 'SWAP' && styles.tabUnreadBadgeTextActive]}>
                  {swapUnread}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'RENT' && styles.tabBtnActive]}
          onPress={() => handleSelectTab('RENT')}
          activeOpacity={0.8}
        >
          <View style={styles.tabContentRow}>
            <Text style={[styles.tabText, activeTab === 'RENT' && styles.tabTextActive]}>
              RENT ({rentCount})
            </Text>
            {rentUnread > 0 && (
              <View style={[styles.tabUnreadBadge, activeTab === 'RENT' && styles.tabUnreadBadgeActive]}>
                <Text style={[styles.tabUnreadBadgeText, activeTab === 'RENT' && styles.tabUnreadBadgeTextActive]}>
                  {rentUnread}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {loading || isTabSwitching ? (
        <MessageCardsLoading count={6} />
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
                  name={
                    activeTab === 'SWAP'
                      ? 'swap-horizontal-outline'
                      : activeTab === 'RENT'
                      ? 'calendar-outline'
                      : activeTab === 'SELL'
                      ? 'bag-check-outline'
                      : 'chatbubbles-outline'
                  }
                  size={42}
                  color={colors.charcoal}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'SWAP'
                  ? 'NO SWAP CHATS'
                  : activeTab === 'RENT'
                  ? 'NO RENT CHATS'
                  : activeTab === 'SELL'
                  ? 'NO SELL OR ORDER CHATS'
                  : 'NO MESSAGES YET'}
              </Text>
              <Text style={styles.emptyDesc}>
                {activeTab === 'SWAP'
                  ? 'Accessory trade proposals and swap negotiations will appear here.'
                  : activeTab === 'RENT'
                  ? 'Garment rentals, reservations, and lease booking chats will appear here.'
                  : activeTab === 'SELL'
                  ? 'Garment sales, purchases, and order tracking threads will appear here.'
                  : 'Your direct messages, inquiries, and transaction chats will appear here.'}
              </Text>
              <TouchableOpacity
                style={styles.exploreBtn}
                onPress={() =>
                  router.push(
                    activeTab === 'SWAP'
                      ? ('/(tabs)/swap' as any)
                      : activeTab === 'RENT'
                      ? ('/(tabs)/rental' as any)
                      : ('/(tabs)/shop' as any)
                  )
                }
                activeOpacity={0.8}
              >
                <Text style={styles.exploreBtnText}>
                  {activeTab === 'SWAP'
                    ? 'EXPLORE SWAPS →'
                    : activeTab === 'RENT'
                    ? 'EXPLORE RENTALS →'
                    : activeTab === 'SELL'
                    ? 'EXPLORE MARKETPLACE →'
                    : 'EXPLORE KAPHOR →'}
                </Text>
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#F5F4F0',
  },
  tabBtnActive: {
    backgroundColor: colors.charcoal,
  },
  tabText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  tabTextActive: {
    color: colors.white,
    fontWeight: '900',
  },
  tabContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabUnreadBadge: {
    backgroundColor: colors.red,
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabUnreadBadgeActive: {
    backgroundColor: colors.white,
  },
  tabUnreadBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.white,
  },
  tabUnreadBadgeTextActive: {
    color: colors.charcoal,
  },
  listContent: {
    padding: 14,
    gap: 10,
    paddingBottom: 100,
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  convCardUnread: {
    borderColor: colors.charcoal,
    backgroundColor: '#FFFEFB',
  },
  convCardOrder: {
    borderLeftWidth: 4,
    borderLeftColor: colors.forest,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.cream,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 1,
  },
  convInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
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
  unifiedContextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginVertical: 3,
    maxWidth: '94%',
  },
  unifiedContextText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  messageSnippet: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  messageSnippetUnread: {
    color: colors.charcoal,
    fontWeight: '700',
  },
  convRightCol: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  garmentThumb: {
    width: 40,
    height: 48,
    borderRadius: 6,
    backgroundColor: colors.cream,
  },
  swapDualThumbWrap: {
    width: 52,
    height: 52,
    position: 'relative',
    marginBottom: 2,
  },
  swapThumbBack: {
    width: 36,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.cream,
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 1,
    borderColor: '#fff',
  },
  swapThumbFront: {
    width: 36,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#EDE8DD',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  swapThumbBadge: {
    position: 'absolute',
    bottom: 16,
    right: 12,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#8C6D3B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
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
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
  },
  rightActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  delIconBtn: {
    padding: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.03)',
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
