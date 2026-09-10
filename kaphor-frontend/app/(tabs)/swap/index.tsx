import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGarmentStore } from '../../../src/store/garmentStore';
import { useAuthStore } from '../../../src/store/authStore';
import { PlayingCard } from '../../../src/components/PlayingCard';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { messageService } from '../../../src/services/messageService';
import { colors, typography } from '../../../src/theme';
import { isAccessoryCategory } from '../../../src/constants/market';
import api, { cachedGet, invalidateCache } from '../../../src/services/api';

export default function SwapFeedScreen() {
  const router = useRouter();
  const { garments, isLoading, fetchFeed } = useGarmentStore();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [mySwaps, setMySwaps] = useState<any[]>([]);
  const [swapsLoading, setSwapsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'requests'>('browse');

  // Fetch swap feed
  useEffect(() => {
    fetchFeed({ listingType: 'ACCESSORY_SWAP' });
  }, []);

  // Fetch user's swap requests (cached, stale-while-revalidate)
  const fetchMySwaps = async () => {
    setSwapsLoading(true);
    try {
      const data = await cachedGet('/swaps');
      setMySwaps(Array.isArray(data) ? data : []);
    } catch { setMySwaps([]); }
    finally { setSwapsLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'requests') fetchMySwaps();
  }, [activeTab]);

  const swappableItems = garments.filter(
    (g) =>
      g.listingType === 'ACCESSORY_SWAP' &&
      isAccessoryCategory(g.category, g.subCategory) &&
      g.sellerId !== currentUserId &&
      (g as any).seller?.id !== currentUserId
  );

  // ── Message Partner handler ───────────────────────────────────
  const handleMessagePartner = async (swap: any) => {
    const isIncoming = swap.receiverId === currentUserId;
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
      const isIncoming = swap.receiverId === currentUserId;
      const partner = isIncoming ? swap.initiator : swap.receiver;
      const wantedImg = swap.garmentWanted?.primaryImage || swap.garmentWanted?.images?.[0];
      const offeredImg = swap.garmentOffered?.primaryImage || swap.garmentOffered?.images?.[0];

      return (
        <TouchableOpacity
          key={swap.id}
          style={styles.swapRequestCard}
          onPress={() => router.push(`/(tabs)/swap/details?swapId=${swap.id}` as any)}
          activeOpacity={0.88}
        >
          <View style={styles.swapRequestHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {partner?.avatar ? (
                <KaphorImage uri={partner.avatar} style={styles.partnerAvatar} contentFit="cover" />
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
                <KaphorImage uri={wantedImg || ''} style={styles.itemThumb} contentFit="cover" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.swapItemLabel}>YOU {isIncoming ? 'RECEIVE' : 'GIVE'}</Text>
                <Text style={styles.swapItemName} numberOfLines={1}>
                  {swap.garmentWanted?.title || swap.wantedGarment?.title || (typeof swap.garmentWanted === 'string' ? swap.garmentWanted : 'Wanted Item')}
                </Text>
              </View>
            </View>
            <Ionicons name="repeat" size={18} color={colors.charcoal} />
            <View style={styles.swapItem}>
              <View style={styles.itemThumbWrap}>
                <KaphorImage uri={offeredImg || ''} style={styles.itemThumb} contentFit="cover" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.swapItemLabel}>YOU {isIncoming ? 'GIVE' : 'RECEIVE'}</Text>
                <Text style={styles.swapItemName} numberOfLines={1}>
                  {swap.garmentOffered?.title || swap.offeredGarment?.title || (typeof swap.garmentOffered === 'string' ? swap.garmentOffered : 'Offered Item')}
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

            {swap.status === 'SHIPPED' && (
              <TouchableOpacity
                style={[styles.swapActionBtn, { backgroundColor: colors.charcoal }]}
                onPress={() => router.push(`/(tabs)/swap/shipping?swapId=${swap.id}` as any)}
              >
                <Ionicons name="cube" size={14} color={colors.cream} />
                <Text style={styles.swapActionText}>TRACK</Text>
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
            onPress={() => router.push('/(tabs)/shop/sell')}
          >
            <Ionicons name="add" size={20} color={colors.cream} />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>PEER-TO-PEER EXCHANGE</Text>
      </View>

      {renderTabBar()}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {activeTab === 'requests' ? (
          <View style={styles.requestsContainer}>
            {renderSwapRequests()}
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
                  swappableItems.map((item, index) => {
                    const suits: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];
                    const ranks = ['J', 'Q', 'K', 'A', '8', '7'];
                    const itemImage: string | undefined = item.images?.[0] as string | undefined;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.cardWrapper}
                        onPress={() => router.push(`/(tabs)/swap/${item.id}` as any)}
                      >
                        <PlayingCard
                          rank={ranks[index % ranks.length]}
                          suit={suits[index % 4]}
                          productName={item.title}
                          size="M"
                          category={item.category}
                          subCategory={item.subCategory}
                          price={item.price ? item.price / 100 : 0}
                          imageUrl={itemImage}
                          condition="Like New"
                          buttonText="SWAP REQUEST"
                          onSwapRequest={() => router.push(`/(tabs)/swap/${item.id}` as any)}
                          style={{ width: '100%' }}
                        />
                      </TouchableOpacity>
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
});
