import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Platform, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SolarIcon } from '../../../src/components/common/SolarIcon';
import { useAuthStore } from '../../../src/store/authStore';
import { useAuth } from '../../../src/context/AuthContext';
import { EditorialGarmentCard } from '../../../src/components/EditorialGarmentCard';
import { EditorialPageHeader, HandwrittenNote } from '../../../src/components/editorial/IllustrationLayer';
import { GarmentGridSkeleton } from '../../../src/components/common/CardLoadingScreen';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { messageService } from '../../../src/services/messageService';
import { colors, typography } from '../../../src/theme';
import { isAccessoryCategory } from '../../../src/constants/market';
import api, { swrGet } from '../../../src/services/api';
import { hapticFeedback } from '../../../src/utils/haptics';
import { navigateToLiveSwapStage } from '../../../src/utils/swapNavigation';

function statusBadge(status: string) {
  const colors_map: Record<string, string> = {
    REQUESTED: colors.copper,
    ACCEPTED: colors.forest,
    REJECTED: colors.red,
    COMPLETED: colors.navy,
    CANCELLED: colors.textMuted,
  };
  return (
    <View style={[styles.statusBadge, { backgroundColor: colors_map[status] || colors.textMuted }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.statusBadgeText}>{status}</Text>
    </View>
  );
}

const SwapRequestCard = React.memo(function SwapRequestCard({
  swap,
  effectiveUserId,
  onMessage,
  onRespond,
}: {
  swap: any;
  effectiveUserId?: string | null;
  onMessage: (swap: any) => void;
  onRespond: (swapId: string, accept: boolean) => void;
}) {
  const router = useRouter();
  const handleMessagePartner = onMessage;
  const handleRespond = onRespond;
      const isIncoming = swap.receiverId === effectiveUserId;
      const partner = isIncoming ? swap.initiator : swap.receiver;

      const extractGarmentImage = (obj: any): string => {
        if (!obj) return '';
        if (typeof obj === 'string' && (obj.startsWith('http') || obj.startsWith('data:') || obj.startsWith('file:'))) {
          return obj;
        }
        return (
          obj.primaryImage ||
          obj.image ||
          obj.images?.[0] ||
          obj.imageUrl ||
          (Array.isArray(obj.images) && obj.images[0]) ||
          ''
        );
      };

      const wantedGarmentObj =
        (typeof swap.garmentWanted === 'object' && swap.garmentWanted) ||
        (typeof swap.wantedGarment === 'object' && swap.wantedGarment) ||
        null;

      const offeredGarmentObj =
        (typeof swap.garmentOffered === 'object' && swap.garmentOffered) ||
        (typeof swap.offeredGarment === 'object' && swap.offeredGarment) ||
        null;

      const wantedImg = extractGarmentImage(wantedGarmentObj);
      const offeredImg = extractGarmentImage(offeredGarmentObj);

      const wantedTitle =
        wantedGarmentObj?.title ||
        swap.garmentWanted?.title ||
        swap.wantedGarment?.title ||
        (typeof swap.garmentWanted === 'string' ? swap.garmentWanted : 'Wanted Item');

      const offeredTitle =
        offeredGarmentObj?.title ||
        swap.garmentOffered?.title ||
        swap.offeredGarment?.title ||
        (typeof swap.garmentOffered === 'string' ? swap.garmentOffered : 'Offered Item');

      return (
        <TouchableOpacity
          style={styles.swapRequestCard}
          onPress={() => navigateToLiveSwapStage(router, swap, effectiveUserId ?? undefined)}
          activeOpacity={0.88}
        >
          <View style={styles.swapRequestHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {partner?.avatar ? (
                <KaphorImage uri={partner.avatar} style={styles.partnerAvatar} contentFit="cover" fallbackIcon="person" />
              ) : (
                <View style={styles.partnerAvatarPlaceholder}>
                  <SolarIcon name="person" size={14} color={colors.textMuted} />
                </View>
              )}
              <View>
                <Text style={styles.partnerName} numberOfLines={1}>
                  {partner?.displayName || partner?.username || 'Swap Partner'}
                </Text>
                <Text style={styles.swapRequestLabel}>
                  {isIncoming ? 'Incoming request' : 'Outgoing request'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {statusBadge(swap.status)}
              <SolarIcon name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </View>

          <View style={styles.swapItemsRow}>
            <View style={styles.swapItem}>
              <View style={styles.itemThumbWrap}>
                <KaphorImage uri={wantedImg} style={styles.itemThumb} contentFit="cover" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.swapItemLabel}>YOU {isIncoming ? 'RECEIVE' : 'GIVE'}</Text>
                <Text style={styles.swapItemName} numberOfLines={1}>
                  {wantedTitle}
                </Text>
              </View>
            </View>
            <SolarIcon name="repeat" size={18} color={colors.charcoal} />
            <View style={styles.swapItem}>
              <View style={styles.itemThumbWrap}>
                <KaphorImage uri={offeredImg} style={styles.itemThumb} contentFit="cover" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.swapItemLabel}>YOU {isIncoming ? 'GIVE' : 'RECEIVE'}</Text>
                <Text style={styles.swapItemName} numberOfLines={1}>
                  {offeredTitle}
                </Text>
              </View>
            </View>
          </View>

          {swap.message && (
            <Text style={styles.swapMessage}>"{swap.message}"</Text>
          )}

          {/* Action buttons & Quick Message */}
          <View style={styles.swapActions}>
            <TouchableOpacity
              style={[styles.swapActionBtn, styles.messageBtn]}
              onPress={() => handleMessagePartner(swap)}
            >
              <SolarIcon name="chatbubbles-outline" size={14} color={colors.charcoal} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>

            {swap.status === 'REQUESTED' && isIncoming && (
              <>
                <TouchableOpacity
                  style={[styles.swapActionBtn, { backgroundColor: colors.forest, borderColor: colors.forest }]}
                  onPress={() => handleRespond(swap.id, true)}
                >
                  <SolarIcon name="checkmark" size={14} color={colors.cream} />
                  <Text style={styles.swapActionText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.swapActionBtn, { backgroundColor: colors.red, borderColor: colors.red }]}
                  onPress={() => handleRespond(swap.id, false)}
                >
                  <SolarIcon name="close" size={14} color={colors.cream} />
                  <Text style={styles.swapActionText}>Reject</Text>
                </TouchableOpacity>
              </>
            )}

            {(swap.status === 'ACCEPTED' || swap.status === 'AGREEMENT_SIGNED') && (
              <>
                <TouchableOpacity
                  style={[styles.swapActionBtn, { backgroundColor: colors.charcoal }]}
                  onPress={() => router.push(`/(tabs)/swap/agreement?swapId=${swap.id}` as any)}
                >
                  <SolarIcon name="document-text" size={12} color={colors.cream} />
                  <Text style={styles.swapActionText}>Agreement</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.swapActionBtn, { backgroundColor: colors.goldDark }]}
                  onPress={() => router.push(`/(tabs)/swap/shipping?swapId=${swap.id}` as any)}
                >
                  <SolarIcon name="cube" size={12} color={colors.cream} />
                  <Text style={styles.swapActionText}>Deposit</Text>
                </TouchableOpacity>
              </>
            )}

            {(swap.status === 'SHIPPED' || swap.status === 'BOTH_SHIPPED' || swap.status === 'DELIVERED') && (
              <TouchableOpacity
                style={[styles.swapActionBtn, { backgroundColor: colors.charcoal }]}
                onPress={() => router.push(`/(tabs)/swap/shipping?swapId=${swap.id}` as any)}
              >
                <SolarIcon name="cube" size={14} color={colors.cream} />
                <Text style={styles.swapActionText}>Track & deliver</Text>
              </TouchableOpacity>
            )}

            {swap.status === 'COMPLETED' && (
              <TouchableOpacity
                style={[styles.swapActionBtn, { backgroundColor: colors.forest, borderColor: colors.forest }]}
                onPress={() => router.push(`/(tabs)/swap/shipping?swapId=${swap.id}` as any)}
              >
                <SolarIcon name="star" size={12} color={colors.cream} />
                <Text style={styles.swapActionText}>Review</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.swapActionBtn, styles.detailsBtn]}
              onPress={() => router.push(`/(tabs)/swap/details?swapId=${swap.id}` as any)}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.detailsBtnText}>Details</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
});

const SwapBrowseCard = React.memo(function SwapBrowseCard({ item, onPress }: { item: any; onPress: (item: any) => void }) {
  const data = useMemo(
    () => ({
      ...item,
      price: item.price ? Math.round(item.price) : item.estimatedValue ? Math.round(item.estimatedValue) : 0,
    }),
    [item]
  );
  const press = useCallback(() => onPress(item), [onPress, item]);
  return (
    <View style={styles.cardWrapper}>
      <EditorialGarmentCard item={data} onPress={press} style={CARD_STYLE} />
    </View>
  );
});

const CARD_STYLE = { width: '100%', marginRight: 0 } as const;

export default function SwapFeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const authStoreUserId = useAuthStore((s) => s.user?.id);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [mySwaps, setMySwaps] = useState<any[]>([]);
  const [browseItems, setBrowseItems] = useState<any[]>([]);
  const [swapsLoading, setSwapsLoading] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'requests'>('browse');

  const effectiveUserId = user?.id || resolvedUserId || authStoreUserId;

  // Stale-while-revalidate: cached swaps/feed paint instantly, then refresh in the background
  const fetchBrowseItems = async () => {
    setBrowseLoading(true);
    try {
      await Promise.all([
        swrGet('/swaps/feed', (res: any) => {
          const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
          setBrowseItems(list);
          setBrowseLoading(false);
        }).catch(() => {}),
        api
          .get('/users/me')
          .then((meRes) => {
            if (meRes.data?.data?.id) setResolvedUserId(meRes.data.data.id);
          })
          .catch(() => {}),
      ]);
    } finally {
      setBrowseLoading(false);
    }
  };

  const fetchMySwaps = async () => {
    setSwapsLoading(true);
    try {
      await swrGet('/swaps', (res: any) => {
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setMySwaps(list);
        setSwapsLoading(false);
      });
    } catch {
      // keep whatever we already show
    } finally {
      setSwapsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hapticFeedback.light();
    await Promise.all([
      fetchBrowseItems(),
      fetchMySwaps(),
    ]);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBrowseItems();
      fetchMySwaps();
    }, [])
  );

  // Use items from /swaps/feed.
  // ALWAYS strictly filter out any item that belongs to the current user!
  const rawCandidateItems = browseItems;
  const swappableItems = useMemo(() => rawCandidateItems.filter((g) => {
    const isAcc = isAccessoryCategory(g.category, g.subCategory) || g.listingType === 'ACCESSORY_SWAP';
    if (!isAcc) return false;
    if (effectiveUserId) {
      if (g.sellerId === effectiveUserId || (g as any).seller?.id === effectiveUserId) {
        return false;
      }
    }
    return true;
  }), [rawCandidateItems, effectiveUserId]);

  const handleCardPress = useCallback((item: any) => {
    if (effectiveUserId && (item.sellerId === effectiveUserId || item.seller?.id === effectiveUserId)) {
      Alert.alert('Your Item', 'You own this accessory and cannot swap with yourself. Browse items listed by other members.', [
        { text: 'OK' }
      ]);
      return;
    }
    // Show swap item detail screen first then the user can tap "Initiate accessory swap" to open the offer screen
    router.push(`/(tabs)/shop/${item.id}` as any);
  }, [effectiveUserId, router]);

  // ── Message Partner handler ───────────────────────────────────
  const handleMessagePartner = useCallback(async (swap: any) => {
    const isIncoming = swap.receiverId === effectiveUserId;
    const partner = isIncoming ? swap.initiator : swap.receiver;
    if (!partner?.id) {
      Alert.alert('Notice', 'Partner profile information is currently unavailable.');
      return;
    }
    try {
      const garmentId = (swap.garmentWanted as any)?.id || (swap.garmentOffered as any)?.id;
      const conversation = await messageService.getOrCreateConversation(partner.id, garmentId);
      router.push(`/messages/${conversation.id}` as any);
    } catch (err) {
      Alert.alert('Error', 'Could not open conversation with partner.');
    }
  }, [effectiveUserId, router]);

  // ── Accept/Reject handlers ────────────────────────────────────
  const handleRespond = useCallback(async (swapId: string, accept: boolean) => {
    try {
      await api.patch(`/swaps/${swapId}`, { action: accept ? 'ACCEPTED' : 'REJECTED' });
      if (accept) {
        // Navigate to agreement screen
        router.push(`/(tabs)/swap/agreement?swapId=${swapId}`);
      } else {
        Alert.alert('Declined', 'The swap request has been declined.');
        fetchMySwaps();
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to respond.');
    }
  }, [router]);

  const handleComplete = async (swapId: string) => {
    try {
      await api.post(`/swaps/${swapId}/complete`);
      Alert.alert('Completed!', 'Garment ownership has been transferred.');
      fetchMySwaps();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to complete swap.');
    }
  };

  const handleConfirmReceived = async (swapId: string) => {
    try {
      await api.post(`/swaps/${swapId}/confirm-received`, { conditionSatisfied: true });
      Alert.alert('Confirmed!', 'You have confirmed receipt. Waiting for the other party to confirm.');
      fetchMySwaps();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to confirm receipt.');
    }
  };

  const requestKey = useCallback((x: any) => x.id, []);
  const renderRequest = useCallback(
    ({ item }: { item: any }) => (
      <SwapRequestCard swap={item} effectiveUserId={effectiveUserId} onMessage={handleMessagePartner} onRespond={handleRespond} />
    ),
    [effectiveUserId, handleMessagePartner, handleRespond]
  );
  const renderBrowse = useCallback(({ item }: { item: any }) => <SwapBrowseCard item={item} onPress={handleCardPress} />, [handleCardPress]);

  const renderRequestsEmpty = () => {
    if (swapsLoading) return <GarmentGridSkeleton count={4} />;
    return (
      <View style={styles.emptyState}>
        <SolarIcon name="swap-horizontal-outline" size={40} color={colors.charcoal} />
        <Text style={styles.emptyText}>No swap requests</Text>
        <Text style={styles.emptySubtext}>Go to Browse to find items to swap</Text>
      </View>
    );
  };

  const renderBrowseEmpty = () =>
    browseLoading && browseItems.length === 0 ? (
      <GarmentGridSkeleton count={6} />
    ) : (
      <View style={styles.emptyState}>
        <SolarIcon name="swap-horizontal-outline" size={40} color={colors.charcoal} />
        <Text style={styles.emptyText}>No swappable assets</Text>
      </View>
    );

  // ── Tab Bar ────────────────────────────────────────────────────
  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'browse' && styles.tabActive]}
        onPress={() => setActiveTab('browse')}
      >
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabText, activeTab === 'browse' && styles.tabTextActive]}>
          Browse
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
        onPress={() => setActiveTab('requests')}
      >
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
          MY SWAPS {mySwaps.length > 0 ? `(${mySwaps.length})` : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.tab}
        onPress={() => router.push('/(tabs)/orders?tab=swaps' as any)}
      >
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabText, { color: colors.copper, fontWeight: '800' }]}>
          TRACK SWAPS ➔
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <EditorialPageHeader
        title="SWAP"
        subtitle="Swap with members"
        eyebrow="Cashless barter"
        variant="swap"
        style={styles.header}
      >
        <View style={styles.headerActions}>
          <HandwrittenNote>trade value, not waste.</HandwrittenNote>
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Add"
            style={styles.sellBtn}
            onPress={() => router.push({ pathname: '/(tabs)/shop/sell', params: { prefillListingType: 'ACCESSORY_SWAP', listingType: 'ACCESSORY_SWAP', fresh: Date.now().toString() } } as any)}
          >
            <SolarIcon name="add" size={20} color={colors.cream} />
          </TouchableOpacity>
        </View>
      </EditorialPageHeader>

      {renderTabBar()}

      {activeTab === 'requests' ? (
        <FlatList
          key="requests"
          data={mySwaps}
          keyExtractor={requestKey}
          renderItem={renderRequest}
          ListEmptyComponent={renderRequestsEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.requestsList}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.crimson}
              colors={[colors.crimson]}
            />
          }
        />
      ) : (
        <FlatList
          key="browse"
          data={swappableItems}
          keyExtractor={requestKey}
          renderItem={renderBrowse}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={renderBrowseEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.browseList}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.crimson}
              colors={[colors.crimson]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    marginBottom: 0,
  },
  headerActions: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 42, fontFamily: typography.headings, color: colors.charcoal, letterSpacing: 2 },
  subtitle: { fontFamily: typography.handBold, fontSize: 16, color: colors.red, includeFontPadding: false, },
  sellBtn: { width: 40, height: 40, backgroundColor: colors.charcoal, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.charcoal },

  // Tab bar
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.overlayLight, backgroundColor: colors.cream },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.charcoal },
  tabText: { fontFamily: typography.handSemi, fontSize: 16, color: colors.textMuted, includeFontPadding: false, },
  tabTextActive: { color: colors.charcoal, fontWeight: '900' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between', paddingTop: 16 },
  gridRow: { justifyContent: 'space-between', paddingHorizontal: 16 },
  browseList: { paddingBottom: 120, paddingTop: 16 },
  requestsList: { paddingBottom: 120, paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  cardWrapper: { width: '48%', marginBottom: 24 },

  // Swap Requests
  requestsContainer: { padding: 16, gap: 12 },
  swapRequestCard: {
    backgroundColor: colors.white, borderWidth: 2, borderColor: colors.charcoal,
    padding: 16, gap: 12,
    shadowColor: colors.charcoal, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  swapRequestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  partnerAvatar: { width: 32, height: 32, borderWidth: 1, borderColor: colors.charcoal },
  partnerAvatarPlaceholder: {
    width: 32, height: 32, borderWidth: 1, borderColor: colors.charcoal,
    backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center',
  },
  partnerName: { fontFamily: typography.headings, fontSize: 14, color: colors.charcoal, letterSpacing: 0.5 },
  swapRequestLabel: { fontFamily: typography.handBold, fontSize: 16, color: colors.textMuted, includeFontPadding: false, },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { color: colors.cream, fontFamily: typography.handBold, fontSize: 16, includeFontPadding: false, },
  swapItemsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swapItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemThumbWrap: { width: 36, height: 36, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgMuted },
  itemThumb: { width: '100%', height: '100%' },
  swapItemLabel: { fontFamily: typography.handSemi, fontSize: 16, color: colors.textMuted, marginBottom: 2, includeFontPadding: false, },
  swapItemName: { fontFamily: typography.headings, fontSize: 14, color: colors.charcoal },
  swapMessage: { fontFamily: typography.handwritten, fontSize: 16, color: colors.textMuted, fontStyle: 'italic', paddingLeft: 4, includeFontPadding: false, },
  swapActions: { flexDirection: 'row', gap: 6, marginTop: 4 },
  swapActionBtn: {
    flex: 1, flexDirection: 'row', height: 36, justifyContent: 'center', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: colors.charcoal,
  },
  swapActionText: { color: colors.cream, fontFamily: typography.handBold, fontSize: 16, includeFontPadding: false, },
  messageBtn: { backgroundColor: colors.white, borderColor: colors.charcoal },
  messageBtnText: { color: colors.charcoal, fontFamily: typography.bodyBold, fontSize: 11, letterSpacing: 0.2 },
  detailsBtn: { backgroundColor: colors.bgMuted, borderColor: colors.charcoal },
  detailsBtnText: { color: colors.charcoal, fontFamily: typography.bodyBold, fontSize: 11, letterSpacing: 0.2 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: typography.handBold, fontSize: 17, color: colors.charcoal, includeFontPadding: false, },
  emptySubtext: { fontFamily: typography.handwritten, fontSize: 16, color: colors.textMuted, includeFontPadding: false, },
});

