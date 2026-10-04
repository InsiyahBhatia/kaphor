import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGarmentStore } from '../../../src/store/garmentStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useAuth } from '../../../src/context/AuthContext';
import { EditorialGarmentCard } from '../../../src/components/EditorialGarmentCard';
import { EditorialPageHeader, HandwrittenNote } from '../../../src/components/editorial/IllustrationLayer';
import { GarmentGridSkeleton } from '../../../src/components/common/CardLoadingScreen';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { messageService } from '../../../src/services/messageService';
import { colors, typography } from '../../../src/theme';
import { isAccessoryCategory } from '../../../src/constants/market';
import api from '../../../src/services/api';
import { hapticFeedback } from '../../../src/utils/haptics';
import { navigateToLiveSwapStage } from '../../../src/utils/swapNavigation';

export default function SwapFeedScreen() {
  const router = useRouter();
  const { garments, isLoading, fetchFeed } = useGarmentStore();
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

  // Fetch available swappable accessories directly from backend
  const fetchBrowseItems = async () => {
    setBrowseLoading(true);
    try {
      const [feedRes, meRes] = await Promise.all([
        api.get('/swaps/feed').catch(() => ({ data: { data: [] } })),
        api.get('/users/me').catch(() => ({ data: { data: null } })),
      ]);
      const list = Array.isArray(feedRes.data?.data) ? feedRes.data.data : [];
      setBrowseItems(list);
      if (meRes.data?.data?.id) {
        setResolvedUserId(meRes.data.data.id);
      }
    } catch {
      setBrowseItems([]);
    } finally {
      setBrowseLoading(false);
    }
  };

  // Fetch user's swap requests (fresh live data)
  const fetchMySwaps = async () => {
    setSwapsLoading(true);
    try {
      const { data } = await api.get('/swaps');
      const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      setMySwaps(list);
    } catch {
      setMySwaps([]);
    } finally {
      setSwapsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hapticFeedback.light();
    await Promise.all([
      fetchBrowseItems(),
      fetchFeed({ listingType: 'ACCESSORY_SWAP' }),
      fetchMySwaps(),
    ]);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBrowseItems();
      fetchFeed({ listingType: 'ACCESSORY_SWAP' });
      fetchMySwaps();
    }, [])
  );

  // Use items from /swaps/feed first; fallback to store garments.
  // ALWAYS strictly filter out any item that belongs to the current user!
  const rawCandidateItems = browseItems.length > 0 ? browseItems : (browseLoading ? [] : garments);
  const swappableItems = rawCandidateItems.filter((g) => {
    const isAcc = isAccessoryCategory(g.category, g.subCategory) || g.listingType === 'ACCESSORY_SWAP';
    if (!isAcc) return false;
    if (effectiveUserId) {
      if (g.sellerId === effectiveUserId || (g as any).seller?.id === effectiveUserId) {
        return false;
      }
    }
    return true;
  });

  const handleCardPress = (item: any) => {
    if (effectiveUserId && (item.sellerId === effectiveUserId || item.seller?.id === effectiveUserId)) {
      Alert.alert('Your Archive Item', 'You own this accessory and cannot swap with yourself. Browse items listed by other members.', [
        { text: 'OK' }
      ]);
      return;
    }
    // Show swap item detail screen first then the user can tap "INITIATE ACCESSORY SWAP" to open the offer screen
    router.push(`/(tabs)/shop/${item.id}` as any);
  };

  // ── Message Partner handler ───────────────────────────────────
  const handleMessagePartner = async (swap: any) => {
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
  };

  // ── Accept/Reject handlers ────────────────────────────────────
  const handleRespond = async (swapId: string, accept: boolean) => {
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
  };

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

  const statusBadge = (status: string) => {
    const colors_map: Record<string, string> = {
      REQUESTED: colors.copper,
      ACCEPTED: colors.forest,
      REJECTED: colors.red,
      COMPLETED: colors.navy,
      CANCELLED: colors.textMuted,
    };
    return (
      <View style={[styles.statusBadge, { backgroundColor: colors_map[status] || colors.textMuted }]}>
        <Text style={styles.statusBadgeText}>{status}</Text>
      </View>
    );
  };

  const renderSwapRequests = () => {
    if (swapsLoading) return <GarmentGridSkeleton count={4} />;
    if (mySwaps.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="swap-horizontal-outline" size={40} color={colors.charcoal} />
          <Text style={styles.emptyText}>NO SWAP REQUESTS</Text>
          <Text style={styles.emptySubtext}>Go to Browse to find items to swap</Text>
        </View>
      );
    }
    return mySwaps.map((swap: any) => {
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
          key={swap.id}
          style={styles.swapRequestCard}
          onPress={() => navigateToLiveSwapStage(router, swap, effectiveUserId)}
          activeOpacity={0.88}
        >
          <View style={styles.swapRequestHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {partner?.avatar ? (
                <KaphorImage uri={partner.avatar} style={styles.partnerAvatar} contentFit="cover" fallbackIcon="person" />
              ) : (
                <View style={styles.partnerAvatarPlaceholder}>
                  <Ionicons name="person" size={14} color={colors.textMuted} />
                </View>
              )}
              <View>
                <Text style={styles.partnerName} numberOfLines={1}>
                  {partner?.displayName || partner?.username || 'Swap Partner'}
                </Text>
                <Text style={styles.swapRequestLabel}>
                  {isIncoming ? 'INCOMING REQUEST' : 'OUTGOING REQUEST'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {statusBadge(swap.status)}
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
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
            <Ionicons name="repeat" size={18} color={colors.charcoal} />
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
              <Ionicons name="chatbubbles-outline" size={14} color={colors.charcoal} />
              <Text style={styles.messageBtnText}>MESSAGE</Text>
            </TouchableOpacity>

            {swap.status === 'REQUESTED' && isIncoming && (
              <>
                <TouchableOpacity
                  style={[styles.swapActionBtn, { backgroundColor: colors.forest, borderColor: colors.forest }]}
                  onPress={() => handleRespond(swap.id, true)}
                >
                  <Ionicons name="checkmark" size={14} color={colors.cream} />
                  <Text style={styles.swapActionText}>ACCEPT</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.swapActionBtn, { backgroundColor: colors.red, borderColor: colors.red }]}
                  onPress={() => handleRespond(swap.id, false)}
                >
                  <Ionicons name="close" size={14} color={colors.cream} />
                  <Text style={styles.swapActionText}>REJECT</Text>
                </TouchableOpacity>
              </>
            )}

            {(swap.status === 'ACCEPTED' || swap.status === 'AGREEMENT_SIGNED') && (
              <>
                <TouchableOpacity
                  style={[styles.swapActionBtn, { backgroundColor: colors.charcoal }]}
                  onPress={() => router.push(`/(tabs)/swap/agreement?swapId=${swap.id}` as any)}
                >
                  <Ionicons name="document-text" size={12} color={colors.cream} />
                  <Text style={styles.swapActionText}>AGREEMENT</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.swapActionBtn, { backgroundColor: '#8C6D3B' }]}
                  onPress={() => router.push(`/(tabs)/swap/shipping?swapId=${swap.id}` as any)}
                >
                  <Ionicons name="cube" size={12} color={colors.cream} />
                  <Text style={styles.swapActionText}>ESCROW</Text>
                </TouchableOpacity>
              </>
            )}

            {(swap.status === 'SHIPPED' || swap.status === 'BOTH_SHIPPED' || swap.status === 'DELIVERED') && (
              <TouchableOpacity
                style={[styles.swapActionBtn, { backgroundColor: colors.charcoal }]}
                onPress={() => router.push(`/(tabs)/swap/shipping?swapId=${swap.id}` as any)}
              >
                <Ionicons name="cube" size={14} color={colors.cream} />
                <Text style={styles.swapActionText}>TRACK & DELIVER</Text>
              </TouchableOpacity>
            )}

            {swap.status === 'COMPLETED' && (
              <TouchableOpacity
                style={[styles.swapActionBtn, { backgroundColor: colors.forest, borderColor: colors.forest }]}
                onPress={() => router.push(`/(tabs)/swap/shipping?swapId=${swap.id}` as any)}
              >
                <Ionicons name="star" size={12} color={colors.cream} />
                <Text style={styles.swapActionText}>REVIEW</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.swapActionBtn, styles.detailsBtn]}
              onPress={() => router.push(`/(tabs)/swap/details?swapId=${swap.id}` as any)}
            >
              <Text style={styles.detailsBtnText}>DETAILS</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    });
  };

  // ── Tab Bar ────────────────────────────────────────────────────
  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'browse' && styles.tabActive]}
        onPress={() => setActiveTab('browse')}
      >
        <Text style={[styles.tabText, activeTab === 'browse' && styles.tabTextActive]}>
          BROWSE
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
        onPress={() => setActiveTab('requests')}
      >
        <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
          MY SWAPS {mySwaps.length > 0 ? `(${mySwaps.length})` : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.tab}
        onPress={() => router.push('/(tabs)/orders?tab=swaps' as any)}
      >
        <Text style={[styles.tabText, { color: colors.copper, fontWeight: '800' }]}>
          TRACK SWAPS ➔
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <EditorialPageHeader
        title="SWAP"
        subtitle="PEER-TO-PEER EXCHANGE"
        eyebrow="CASHLESS BARTER"
        variant="swap"
        style={styles.header}
      >
        <View style={styles.headerActions}>
          <HandwrittenNote>trade value, not waste.</HandwrittenNote>
          <TouchableOpacity
            style={styles.sellBtn}
            onPress={() => router.push({ pathname: '/(tabs)/shop/sell', params: { prefillListingType: 'ACCESSORY_SWAP', listingType: 'ACCESSORY_SWAP', fresh: Date.now().toString() } } as any)}
          >
            <Ionicons name="add" size={20} color={colors.cream} />
          </TouchableOpacity>
        </View>
      </EditorialPageHeader>

      {renderTabBar()}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.crimson}
            colors={[colors.crimson]}
          />
        }
      >
        {activeTab === 'requests' ? (
          <View style={styles.requestsContainer}>
            {renderSwapRequests()}
          </View>
        ) : (
          <>
            {isLoading ? (
              <GarmentGridSkeleton count={6} />
            ) : (
              <View style={styles.grid}>
                {swappableItems.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="swap-horizontal-outline" size={40} color={colors.charcoal} />
                    <Text style={styles.emptyText}>NO SWAPPABLE ASSETS</Text>
                  </View>
                ) : (
                  swappableItems.map((item) => {
                    return (
                      <View key={item.id} style={styles.cardWrapper}>
                        <EditorialGarmentCard
                          item={{
                            ...item,
                            price: item.price ? Math.round(item.price) : (item.estimatedValue ? Math.round(item.estimatedValue) : 0),
                          }}
                          onPress={() => handleCardPress(item)}
                          style={{ width: '100%', marginRight: 0 }}
                        />
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  subtitle: { fontFamily: typography.mono, fontSize: 10, color: colors.red, fontWeight: '800', letterSpacing: 1 },
  sellBtn: { width: 40, height: 40, backgroundColor: colors.charcoal, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.charcoal },

  // Tab bar
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(26,26,26,0.1)', backgroundColor: colors.cream },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.charcoal },
  tabText: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 1 },
  tabTextActive: { color: colors.charcoal, fontWeight: '900' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between', paddingTop: 16 },
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
  swapRequestLabel: { fontFamily: typography.mono, fontSize: 8, fontWeight: '800', color: colors.textMuted, letterSpacing: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { color: colors.cream, fontFamily: typography.mono, fontSize: 8, fontWeight: '900' },
  swapItemsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swapItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemThumbWrap: { width: 36, height: 36, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgMuted },
  itemThumb: { width: '100%', height: '100%' },
  swapItemLabel: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, fontWeight: '700', marginBottom: 2 },
  swapItemName: { fontFamily: typography.headings, fontSize: 14, color: colors.charcoal },
  swapMessage: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, fontStyle: 'italic', paddingLeft: 4 },
  swapActions: { flexDirection: 'row', gap: 6, marginTop: 4 },
  swapActionBtn: {
    flex: 1, flexDirection: 'row', height: 36, justifyContent: 'center', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: colors.charcoal,
  },
  swapActionText: { color: colors.cream, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  messageBtn: { backgroundColor: colors.white, borderColor: colors.charcoal },
  messageBtnText: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  detailsBtn: { backgroundColor: colors.bgMuted, borderColor: colors.charcoal },
  detailsBtnText: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: typography.mono, fontSize: 12, color: colors.charcoal, fontWeight: '800', letterSpacing: 1 },
  emptySubtext: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted },
});

