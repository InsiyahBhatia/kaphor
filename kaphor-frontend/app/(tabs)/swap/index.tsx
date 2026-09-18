import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGarmentStore } from '../../../src/store/garmentStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useAuth } from '../../../src/context/AuthContext';
import { EditorialGarmentCard } from '../../../src/components/EditorialGarmentCard';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { messageService } from '../../../src/services/messageService';
import { colors, typography } from '../../../src/theme';
import { isAccessoryCategory } from '../../../src/constants/market';
import api from '../../../src/services/api';
import { swapService } from '../../../src/services/swapService';
import type { BarterRing } from '../../../src/types/swap';
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
  const [barterRings, setBarterRings] = useState<BarterRing[]>([]);
  const [swapsLoading, setSwapsLoading] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [ringsLoading, setRingsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'rings' | 'requests'>('browse');

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

  // Discover circular 2-way and 3-way barter loops
  const fetchBarterRings = async () => {
    setRingsLoading(true);
    try {
      const rings = await swapService.getBarterRings();
      setBarterRings(Array.isArray(rings) ? rings : []);
    } catch {
      setBarterRings([]);
    } finally {
      setRingsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hapticFeedback.light();
    await Promise.all([
      fetchBrowseItems(),
      fetchFeed({ listingType: 'ACCESSORY_SWAP' }),
      fetchMySwaps(),
      fetchBarterRings(),
    ]);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBrowseItems();
      fetchFeed({ listingType: 'ACCESSORY_SWAP' });
      fetchMySwaps();
      fetchBarterRings();
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
    if (swapsLoading) return <DossierLoading variant="swap" compact />;
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

  // ── 3-Way Barter Rings (Circular Multi-Party Matches) ─────────
  const renderBarterRings = () => {
    if (ringsLoading) return <DossierLoading variant="swap" compact />;

    return (
      <View style={{ gap: 16 }}>
        {/* Editorial AI Matcher Banner */}
        <View style={styles.ringsHeaderBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Ionicons name="git-network-outline" size={14} color={colors.emerald} />
            <Text style={styles.ringsBadgeText}>AI GRAPH MATCHER // ZERO CASH</Text>
          </View>
          <Text style={styles.ringsHeaderTitle}>CIRCULAR BARTER RINGS</Text>
          <Text style={styles.ringsHeaderSub}>
            Multi-party circular trades. Member A gives to B, B gives to C, and C gives to A so all closets receive their wishlist pieces simultaneously.
          </Text>
        </View>

        {barterRings.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyRingIconCircle}>
              <Ionicons name="repeat-outline" size={36} color={colors.charcoal} />
            </View>
            <Text style={styles.emptyText}>NO ACTIVE BARTER RINGS</Text>
            <Text style={styles.emptySubtext}>
              As members add garments to wishlists and list accessories for swap, our AI graph engine continuously searches for 2-way and 3-way circular trade loops.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => setActiveTab('browse')}
            >
              <Text style={styles.emptyActionBtnText}>BROWSE SWAPPABLE ASSETS</Text>
            </TouchableOpacity>
          </View>
        ) : (
          barterRings.map((ring, ringIdx) => {
            const isUserInRing = effectiveUserId && ring.participants.some((p) => p.userId === effectiveUserId);

            return (
              <View key={ring.ringId || `ring-${ringIdx}`} style={styles.ringCard}>
                {/* Ring Card Header */}
                <View style={styles.ringCardHeader}>
                  <View style={styles.ringTypeBadge}>
                    <Ionicons name="infinite-outline" size={13} color={colors.cream} />
                    <Text style={styles.ringTypeBadgeText}>
                      {ring.ringType === '3_WAY' ? '3-PARTY CIRCULAR LOOP' : '2-WAY BILATERAL LOOP'}
                    </Text>
                  </View>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      {Math.round(ring.confidenceScore * 100)}% MATCH
                    </Text>
                  </View>
                </View>

                {isUserInRing && (
                  <View style={styles.userInRingNotice}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.emerald} />
                    <Text style={styles.userInRingNoticeText}>YOU ARE IN THIS TRADE LOOP!</Text>
                  </View>
                )}

                {/* Participants Chain */}
                <View style={styles.participantsChain}>
                  {ring.participants.map((participant, pIdx) => {
                    const isMe = effectiveUserId && participant.userId === effectiveUserId;

                    return (
                      <View key={`${participant.userId}-${pIdx}`}>
                        <View style={[styles.participantBox, isMe && styles.participantBoxMe]}>
                          {/* Participant Top Row */}
                          <View style={styles.participantTopRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View style={styles.participantAvatar}>
                                <Ionicons name="person" size={12} color={colors.cream} />
                              </View>
                              <Text style={styles.participantName} numberOfLines={1}>
                                @{participant.userName}
                              </Text>
                            </View>
                            {isMe && (
                              <View style={styles.meTag}>
                                <Text style={styles.meTagText}>YOU</Text>
                              </View>
                            )}
                          </View>

                          {/* Garment Exchange Visual */}
                          <View style={styles.garmentExchangeRow}>
                            {/* Gives */}
                            <TouchableOpacity
                              style={styles.garmentTradeColumn}
                              onPress={() => participant.giveGarmentId && router.push(`/(tabs)/shop/${participant.giveGarmentId}` as any)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.tradeRoleLabel}>GIVES</Text>
                              <View style={styles.tradeThumbWrap}>
                                <KaphorImage uri={participant.giveGarmentImage} style={styles.tradeThumb} contentFit="cover" />
                              </View>
                              <Text style={styles.tradeGarmentTitle} numberOfLines={1}>
                                {participant.giveGarmentTitle}
                              </Text>
                            </TouchableOpacity>

                            {/* Arrow */}
                            <View style={styles.tradeArrowWrap}>
                              <Ionicons name="arrow-forward" size={16} color={colors.charcoal} />
                            </View>

                            {/* Receives */}
                            <TouchableOpacity
                              style={styles.garmentTradeColumn}
                              onPress={() => participant.receiveGarmentId && router.push(`/(tabs)/shop/${participant.receiveGarmentId}` as any)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.tradeRoleLabel}>RECEIVES</Text>
                              <View style={styles.tradeThumbWrap}>
                                <KaphorImage uri={participant.receiveGarmentImage} style={styles.tradeThumb} contentFit="cover" />
                              </View>
                              <Text style={styles.tradeGarmentTitle} numberOfLines={1}>
                                {participant.receiveGarmentTitle}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Connector */}
                        {pIdx < ring.participants.length - 1 ? (
                          <View style={styles.loopConnector}>
                            <Ionicons name="arrow-down" size={14} color={colors.textMuted} />
                            <Text style={styles.loopConnectorText}>PASSES TO NEXT COLLECTOR</Text>
                          </View>
                        ) : (
                          <View style={styles.loopConnector}>
                            <Ionicons name="return-up-back" size={14} color={colors.emerald} />
                            <Text style={[styles.loopConnectorText, { color: colors.emerald, fontWeight: '900' }]}>
                              CLOSES THE LOOP BACK TO FIRST COLLECTOR
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Card Action */}
                <View style={styles.ringCardFooter}>
                  <TouchableOpacity
                    style={styles.inspectLoopBtn}
                    onPress={() => {
                      const targetId = isUserInRing
                        ? ring.participants.find((p) => p.userId === effectiveUserId)?.receiveGarmentId
                        : ring.participants[0]?.giveGarmentId;
                      if (targetId) {
                        router.push(`/(tabs)/shop/${targetId}` as any);
                      }
                    }}
                    activeOpacity={0.88}
                  >
                    <Ionicons name={isUserInRing ? 'sparkles' : 'eye-outline'} size={14} color={colors.cream} />
                    <Text style={styles.inspectLoopBtnText}>
                      {isUserInRing ? 'INSPECT YOUR TARGET PIECE' : 'EXPLORE GARMENTS IN THIS LOOP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    );
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
        style={[styles.tab, activeTab === 'rings' && styles.tabActive]}
        onPress={() => setActiveTab('rings')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[styles.tabText, activeTab === 'rings' && styles.tabTextActive]}>
            3-WAY RINGS
          </Text>
          {barterRings.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{barterRings.length}</Text>
            </View>
          )}
        </View>
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
          TRACK ➔
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Text style={styles.title}>SWAP</Text>
          <TouchableOpacity
            style={styles.sellBtn}
            onPress={() => router.push({ pathname: '/(tabs)/shop/sell', params: { prefillListingType: 'ACCESSORY_SWAP', listingType: 'ACCESSORY_SWAP', fresh: Date.now().toString() } } as any)}
          >
            <Ionicons name="add" size={20} color={colors.cream} />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>PEER-TO-PEER EXCHANGE</Text>
      </View>

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
        ) : activeTab === 'rings' ? (
          <View style={styles.ringsContainer}>
            {renderBarterRings()}
          </View>
        ) : (
          <>
            {isLoading ? (
              <DossierLoading variant="swap" />
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
    paddingTop: 24, paddingHorizontal: 20,
    borderBottomWidth: 2, borderBottomColor: colors.charcoal,
    paddingBottom: 16, backgroundColor: colors.cream,
  },
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

  tabBadge: {
    backgroundColor: colors.crimson,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
  },

  // Barter Rings
  ringsContainer: { padding: 16, gap: 16 },
  ringsHeaderBanner: {
    backgroundColor: colors.charcoal,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  ringsBadgeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.cream,
    fontWeight: '800',
    letterSpacing: 1,
  },
  ringsHeaderTitle: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.cream,
    letterSpacing: 1,
    marginVertical: 4,
  },
  ringsHeaderSub: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: 'rgba(245, 241, 232, 0.75)',
    lineHeight: 15,
  },
  emptyRingIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.bgMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyActionBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.charcoal,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  emptyActionBtnText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.cream,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Ring Card
  ringCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 16,
    gap: 12,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  ringCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ringTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ringTypeBadgeText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  confidenceBadge: {
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confidenceText: {
    color: colors.forest,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
  },
  userInRingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: colors.forest,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  userInRingNoticeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.forest,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  participantsChain: { gap: 8 },
  participantBox: {
    backgroundColor: colors.bgMuted,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 12,
    gap: 10,
  },
  participantBoxMe: {
    backgroundColor: '#F7F4EC',
    borderColor: colors.gold,
    borderWidth: 2,
  },
  participantTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantName: {
    fontFamily: typography.headings,
    fontSize: 14,
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  meTag: {
    backgroundColor: colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  meTagText: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
  },
  garmentExchangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  garmentTradeColumn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(20,20,20,0.15)',
    padding: 8,
  },
  tradeRoleLabel: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  tradeThumbWrap: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: colors.charcoal,
    backgroundColor: colors.bgMuted,
    marginBottom: 4,
  },
  tradeThumb: { width: '100%', height: '100%' },
  tradeGarmentTitle: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.charcoal,
    textAlign: 'center',
  },
  tradeArrowWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loopConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  loopConnectorText: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  ringCardFooter: {
    marginTop: 4,
  },
  inspectLoopBtn: {
    flexDirection: 'row',
    height: 38,
    backgroundColor: colors.charcoal,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  inspectLoopBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
