import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SolarIcon } from '../../src/components/common/SolarIcon';
import { colors, typography } from '../../src/theme';
import { Header } from '../../src/components/common/Header';
import { EditorialPageHeader } from '../../src/components/editorial/IllustrationLayer';
import { KaphorImage } from '../../src/components/KaphorImage';
import { VerifiedBadge } from '../../src/components/common/VerifiedBadge';
import { messageService, ConversationSummary } from '../../src/services/messageService';
import { getSocket, connectSocket } from '../../src/services/socket';
import { useNotificationStore } from '../../src/store/notificationStore';
import { MessageCardsLoading } from '../../src/components/common/CardLoadingScreen';
import { useListStore, hydrateLists, refreshInbox, loadMoreInbox, seedConversation } from '../../src/store/listStore';
import { getErrorMessage } from '../../src/utils/errors';

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

const EMPTY_INBOX: ConversationSummary[] = [];

export default function MessagesScreen() {
  const router = useRouter();
  // Cache-first: the inbox lives in a persisted store that is warmed after login
  const inbox = useListStore((s) => s.inbox);
  const hydrated = useListStore((s) => s.hydrated);
  const hasMore = useListStore((s) => s.inboxCursor !== null);
  const conversations = inbox ?? EMPTY_INBOX;
  const [fetchSettled, setFetchSettled] = useState(false);
  const loading = inbox === null && (!hydrated || !fetchSettled);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  const handleSelectTab = (tab: FilterTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
  };

  const loadConversations = useCallback(async (force = false) => {
    try {
      await hydrateLists();
      await refreshInbox(force);
    } catch (e) {
      // keep whatever is on screen
    } finally {
      setFetchSettled(true);
      setRefreshing(false);
    }
  }, []);

  // Runs on mount and when the tab gains focus; refreshInbox skips when data is < 30s old
  useFocusEffect(
    useCallback(() => {
      loadConversations();

      // Listen for incoming live socket events to update inbox instantly in real time
      const socket = getSocket() || connectSocket();
      if (socket) {
        let debounce: ReturnType<typeof setTimeout> | null = null;
        const handler = () => {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => loadConversations(true), 400);
        };
        const handleDeleted = ({ conversationId }: { conversationId: string }) => {
          useListStore.getState().setInbox((prev) => prev.filter((c) => c.id !== conversationId));
        };
        socket.on('new_direct_message', handler);
        socket.on('direct_message', handler);
        socket.on('conversation_deleted', handleDeleted);
        socket.on('connect', handler);
        return () => {
          if (debounce) clearTimeout(debounce);
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
              useListStore.getState().setInbox((prev) => prev.filter((c) => c.id !== item.id));
              const remainingUnread = conversations
                .filter((c) => c.id !== item.id)
                .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
              useNotificationStore.getState().setUnreadMessageCount(remainingUnread);
            } catch (err: any) {
              Alert.alert('Error', getErrorMessage(err, 'Could not delete conversation.'));
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations(true);
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
        return { bg: colors.emeraldLight, color: colors.forest, label: 'ORDER PAID' };
      case 'SHIPPED':
        return { bg: colors.overlayLight, color: colors.navy, label: 'IN TRANSIT' };
      case 'DELIVERED':
        return { bg: colors.goldLight, color: colors.gold, label: 'DELIVERED' };
      case 'PENDING':
        return { bg: colors.terracottaLight, color: colors.orange, label: 'ORDER PENDING' };
      default:
        return { bg: colors.overlayLight, color: colors.charcoal, label: status };
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
    let contextBg: string = colors.overlayLight;
    let contextColor: string = colors.charcoal;
    let contextIcon: any = 'chatbubble-outline';

    if (hasOrder && orderStyle) {
      contextLabel = `ORDER · #${item.order!.id.slice(0, 6).toUpperCase()} · ${orderStyle.label}`;
      contextBg = orderStyle.bg;
      contextColor = orderStyle.color;
      contextIcon = 'bag-check';
    } else if (category === 'SWAP') {
      contextLabel = `SWAP · ${item.garment?.title || 'Accessory Trade'}`;
      contextBg = colors.goldLight;
      contextColor = colors.goldDark;
      contextIcon = 'swap-horizontal';
    } else if (category === 'RENT') {
      contextLabel = `RENTAL · ${item.garment?.title || 'Garment Hire'}`;
      contextBg = colors.overlayLight;
      contextColor = colors.ink;
      contextIcon = 'calendar';
    } else if (isGarmentInquiry) {
      contextLabel = `${item.garment?.brand ? `${item.garment.brand} · ` : ''}${item.garment?.title || 'Garment'}`;
      contextBg = colors.crimsonLight;
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
        onPress={() => {
          seedConversation(item);
          router.push(`/messages/${item.id}` as any);
        }}
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
              <SolarIcon name="shield-checkmark" size={11} color={colors.gold} />
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
            <SolarIcon name={contextIcon} size={11} color={contextColor} />
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
                <SolarIcon name="swap-horizontal" size={8} color={colors.white} />
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
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.unreadPillText}>{item.unreadCount}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => handleDeleteConversation(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.delIconBtn}
              accessibilityLabel="Delete Conversation"
            >
              <SolarIcon name="trash-outline" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <EditorialPageHeader
        title="MESSAGES"
        subtitle="YOUR CHATS"
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
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabText, activeTab === 'ALL' && styles.tabTextActive]}>
              ALL ({conversations.length})
            </Text>
            {allUnread > 0 && (
              <View style={[styles.tabUnreadBadge, activeTab === 'ALL' && styles.tabUnreadBadgeActive]}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabUnreadBadgeText, activeTab === 'ALL' && styles.tabUnreadBadgeTextActive]}>
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
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabText, activeTab === 'SELL' && styles.tabTextActive]}>
              SELL ({sellCount})
            </Text>
            {sellUnread > 0 && (
              <View style={[styles.tabUnreadBadge, activeTab === 'SELL' && styles.tabUnreadBadgeActive]}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabUnreadBadgeText, activeTab === 'SELL' && styles.tabUnreadBadgeTextActive]}>
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
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabText, activeTab === 'SWAP' && styles.tabTextActive]}>
              SWAP ({swapCount})
            </Text>
            {swapUnread > 0 && (
              <View style={[styles.tabUnreadBadge, activeTab === 'SWAP' && styles.tabUnreadBadgeActive]}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabUnreadBadgeText, activeTab === 'SWAP' && styles.tabUnreadBadgeTextActive]}>
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
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabText, activeTab === 'RENT' && styles.tabTextActive]}>
              RENT ({rentCount})
            </Text>
            {rentUnread > 0 && (
              <View style={[styles.tabUnreadBadge, activeTab === 'RENT' && styles.tabUnreadBadgeActive]}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabUnreadBadgeText, activeTab === 'RENT' && styles.tabUnreadBadgeTextActive]}>
                  {rentUnread}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {loading && conversations.length === 0 ? (
        <MessageCardsLoading count={6} />
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
          onEndReached={hasMore ? loadMoreInbox : undefined}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={
            filteredConversations.length === 0 ? styles.emptyContainer : styles.listContent
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.charcoal} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <SolarIcon
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
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.exploreBtnText}>
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
    borderBottomColor: colors.gold,
  },
  safetyBarText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.cream,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
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
    backgroundColor: colors.paperLight,
  },
  tabBtnActive: {
    backgroundColor: colors.charcoal,
  },
  tabText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.textMuted,
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
    fontSize: 11,
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
    backgroundColor: colors.paperLight,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 10,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  convCardUnread: {
    borderColor: colors.ink,
    backgroundColor: colors.white,
  },
  convCardOrder: {
    borderLeftWidth: 3,
    borderLeftColor: colors.forest,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.borderLight,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13.5,
    color: colors.charcoal,
  },
  userNameUnread: {
    fontWeight: '900',
  },
  timeText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.textMuted,
  },
  unifiedContextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginVertical: 2,
    maxWidth: '94%',
  },
  unifiedContextText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
  },
  messageSnippet: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
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
    borderColor: colors.white,
  },
  swapThumbFront: {
    width: 36,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.paper,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 1,
    borderColor: colors.white,
  },
  swapThumbBadge: {
    position: 'absolute',
    bottom: 16,
    right: 12,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.goldDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.white,
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
    fontSize: 11,
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
    backgroundColor: colors.overlayLight,
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
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
    marginBottom: 8,
  },
  emptyDesc: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  exploreBtn: {
    backgroundColor: colors.charcoal,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  exploreBtnText: {
    color: colors.cream,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
  },
});
