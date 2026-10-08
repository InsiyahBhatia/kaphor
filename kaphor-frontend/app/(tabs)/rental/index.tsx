import React from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Platform, TouchableOpacity, RefreshControl } from 'react-native';
import { SolarIcon } from '../../../src/components/common/SolarIcon';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { rentalService } from '../../../src/services/rentalService';
import { messageService } from '../../../src/services/messageService';
import { swrGet } from '../../../src/services/api';
import { EditorialGarmentCard } from '../../../src/components/EditorialGarmentCard';
import { EditorialPageHeader, HandwrittenNote } from '../../../src/components/editorial/IllustrationLayer';
import { GarmentGridSkeleton } from '../../../src/components/common/CardLoadingScreen';
import { colors, typography, textStyles } from '../../../src/theme';
import { useAuthStore } from '../../../src/store/authStore';
import { seedGarments } from '../../../src/store/garmentStore';
import { formatShortDate } from '../../../src/utils/dateFormatter';

function statusColor(status: string) {
  switch (status) {
    case 'REQUESTED': return colors.gold;
    case 'APPROVED': return colors.forest;
    case 'RESERVED': return colors.copper;
    case 'ACTIVE': return colors.forest;
    case 'RETURN_DISPATCHED': return colors.forest;
    case 'RETURNED': return colors.navy;
    case 'COMPLETED': return colors.forest;
    case 'DECLINED': return colors.red;
    case 'OVERDUE': return colors.red;
    default: return colors.textMuted;
  }
}

const MyRentalCard = React.memo(function MyRentalCard({ rental, currentUserId }: { rental: any; currentUserId?: string }) {
  const router = useRouter();
  if (!rental) return null;
  const isLender = rental.userRole === 'LENDER' || rental.garment?.sellerId === currentUserId;
  const counterpartyName = isLender
    ? (rental.renter?.displayName || rental.renter?.username || 'Borrower')
    : (rental.garment?.seller?.displayName || 'Lender / Owner');
  const priceDisplay = String(Math.round(rental.totalPrice || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (
              <TouchableOpacity
                style={styles.myRentalCard}
                onPress={() => rental.id && router.push(`/(tabs)/rental/lease/${rental.id}` as any)}
                activeOpacity={0.88}
              >
                {/* Header with Role Pill & Status */}
                <View style={styles.myRentalHeader}>
                  <View style={[styles.roleBadge, isLender ? styles.roleBadgeLender : styles.roleBadgeBorrower]}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.roleBadgeText, isLender ? styles.roleBadgeTextLender : styles.roleBadgeTextBorrower]}>
                      {isLender ? 'You are lender' : 'You are borrower'}
                    </Text>
                  </View>
                  <View style={[styles.myRentalStatus, { backgroundColor: statusColor(rental.status) }]}>
                    <Text style={styles.myRentalStatusText}>{rental.status || 'LEASE'}</Text>
                  </View>
                </View>

                {/* Garment Title & Counterparty */}
                <View>
                  <Text style={styles.myRentalTitle} numberOfLines={1}>
                    {rental.garment?.title || 'Rental Item'}
                  </Text>
                  <Text style={styles.myRentalCounterparty}>
                    {isLender ? 'Borrower: ' : 'Lender: '}{counterpartyName}
                  </Text>
                </View>

                {/* Dates Timeline */}
                <View style={styles.myRentalDates}>
                  <View style={styles.myRentalDateBlock}>
                    <Text style={styles.myRentalDateLabel}>Delivery</Text>
                    <Text style={styles.myRentalDateValue}>
                      {formatShortDate(rental.startDate)}
                    </Text>
                  </View>
                  <SolarIcon name="arrow-forward" size={14} color={colors.textMuted} />
                  <View style={styles.myRentalDateBlock}>
                    <Text style={styles.myRentalDateLabel}>Return due</Text>
                    <Text style={styles.myRentalDateValue}>
                      {formatShortDate(rental.endDate)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.myRentalPriceLabel}>Total lease</Text>
                    <Text style={styles.myRentalPrice}>
                      ₹{priceDisplay}
                    </Text>
                  </View>
                </View>

                {/* Card Action Row */}
                <View style={styles.myRentalActionRow}>
                  {rental.status === 'REQUESTED' && isLender ? (
                    <TouchableOpacity
                      style={[styles.myRentalDossierBtn, { backgroundColor: colors.terracottaDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                      onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}` as any)}
                    >
                      <SolarIcon name="time" size={13} color={colors.white} />
                      <Text style={styles.myRentalDossierText}>REVIEW & APPROVE DATES ➔</Text>
                    </TouchableOpacity>
                  ) : rental.status === 'APPROVED' && !isLender ? (
                    <TouchableOpacity
                      style={[styles.myRentalDossierBtn, { backgroundColor: colors.forest || colors.forest, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                      onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}` as any)}
                    >
                      <SolarIcon name="card" size={13} color={colors.white} />
                      <Text style={styles.myRentalDossierText}>PAY DEPOSIT ➔</Text>
                    </TouchableOpacity>
                  ) : (rental.status === 'RETURNED' || rental.status === 'COMPLETED') && (!currentUserId || !rental?.metadata?.reviews?.[currentUserId]) ? (
                    <TouchableOpacity
                      style={[styles.myRentalDossierBtn, { backgroundColor: colors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                      onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}?review=true` as any)}
                    >
                      <SolarIcon name="star" size={13} color={colors.white} />
                      <Text style={styles.myRentalDossierText}>RATE & REVIEW LEASE ➔</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.myRentalDossierBtn}
                      onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}` as any)}
                    >
                      <Text style={styles.myRentalDossierText}>VIEW LEASE DETAILS ➔</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Chat"
                    style={styles.myRentalChatBtn}
                    onPress={async () => {
                      const otherId = isLender ? rental.renterId : (rental.garment?.sellerId || rental.sellerId);
                      if (otherId) {
                        try {
                          const conv = await messageService.getOrCreateConversation(
                            otherId,
                            rental.garmentId
                          );
                          router.push(`/messages/${conv?.id || ''}` as any);
                        } catch {
                          router.push('/messages');
                        }
                      } else {
                        router.push('/messages');
                      }
                    }}
                  >
                    <SolarIcon name="chatbubble-ellipses-outline" size={15} color={colors.charcoal} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
  );
});

const RentalGridCard = React.memo(function RentalGridCard({ item }: { item: any }) {
  const router = useRouter();
  const data = useMemo(
    () => ({
      ...item,
      price: item.rentalPriceDay ? Math.round(item.rentalPriceDay) : item.price ? Math.round(item.price) : 0,
    }),
    [item]
  );
  const onPress = useCallback(() => router.push(`/(tabs)/rental/${item.id}` as any), [router, item.id]);
  return (
    <View style={styles.cardWrapper}>
      <EditorialGarmentCard item={data} onPress={onPress} style={CARD_STYLE} />
    </View>
  );
});

const Separator = () => <View style={{ height: 12 }} />;
const CARD_STYLE = { width: '100%', marginRight: 0 } as const;

export default function RentalScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [rentals, setRentals] = useState<any[]>([]);
  const [myRentals, setMyRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myRentalsLoading, setMyRentalsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'my'>(tab === 'my' ? 'my' : 'browse');
  const [roleFilter, setRoleFilter] = useState<'all' | 'borrowing' | 'lending'>('all');

  useEffect(() => {
    if (tab === 'my') {
      setActiveTab('my');
    }
  }, [tab]);

  const toList = (res: any): any[] =>
    Array.isArray(res) ? res : res?.data && Array.isArray(res.data) ? res.data : [];

  // Stale-while-revalidate: cached rentals paint instantly, fresh data replaces them
  const fetchAvailableRentals = async () => {
    try {
      await swrGet('/rentals/available', (res) => {
        const list = toList(res);
        seedGarments(list);
        setRentals(list);
        setLoading(false);
      });
    } catch (err) {
      console.warn('Failed to load available rentals:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRentals = async () => {
    setMyRentalsLoading(true);
    try {
      await swrGet('/rentals/me', (res) => {
        setMyRentals(toList(res));
        setMyRentalsLoading(false);
      });
    } catch (err) {
      console.warn('Failed to load my rentals:', err);
    } finally {
      setMyRentalsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAvailableRentals();
      if (activeTab === 'my') {
        fetchMyRentals();
      }
    }, [activeTab])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'browse') {
      await fetchAvailableRentals();
    } else {
      await fetchMyRentals();
    }
    setRefreshing(false);
  };

  const filteredRentals = useMemo(
    () =>
      myRentals
        .filter((rental: any) => Boolean(rental && typeof rental === 'object' && rental.id))
        .filter((rental: any) => {
          const isLender = rental.userRole === 'LENDER' || rental.garment?.sellerId === currentUserId;
          if (roleFilter === 'borrowing') return !isLender;
          if (roleFilter === 'lending') return isLender;
          return true;
        }),
    [myRentals, roleFilter, currentUserId]
  );

  const roleChips = useMemo(() => {
    const valid = myRentals.filter((r: any) => Boolean(r && typeof r === 'object' && r.id));
    const isLenderOf = (r: any) => r.userRole === 'LENDER' || r.garment?.sellerId === currentUserId;
    return [
      { id: 'all', label: `ALL (${valid.length})` },
      { id: 'borrowing', label: `BORROWING (${valid.filter((r: any) => !isLenderOf(r)).length})` },
      { id: 'lending', label: `LENDING (${valid.filter(isLenderOf).length})` },
    ];
  }, [myRentals, currentUserId]);

  const myRentalKey = useCallback((r: any, idx: number) => r?.id || `my-rental-${idx}`, []);
  const renderMyRental = useCallback(
    ({ item }: { item: any }) => <MyRentalCard rental={item} currentUserId={currentUserId} />,
    [currentUserId]
  );
  const rentalKey = myRentalKey;
  const renderRentalCard = useCallback(({ item }: { item: any }) => <RentalGridCard item={item} />, []);

  const renderMyHeader = () =>
    myRentals.length === 0 ? null : (
      <View style={styles.roleFilterRow}>
        {roleChips.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.roleFilterChip, roleFilter === item.id && styles.roleFilterChipActive]}
            onPress={() => setRoleFilter(item.id as any)}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.roleFilterChipText, roleFilter === item.id && styles.roleFilterChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );

  const renderMyEmpty = () => {
    if (myRentalsLoading) return <GarmentGridSkeleton count={4} />;
    if (myRentals.length === 0) {
      return (
        <View style={styles.emptyState}>
          <SolarIcon name="calendar-outline" size={40} color={colors.charcoal} />
          <Text style={styles.emptyText}>No active rental leases</Text>
          <TouchableOpacity style={styles.button} onPress={() => setActiveTab('browse')}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.buttonText}>Explore available pieces →</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={[styles.emptyState, { paddingTop: 30 }]}>
        <Text style={styles.emptyText}>No leases in this category</Text>
      </View>
    );
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'browse' && styles.tabActive]}
        onPress={() => setActiveTab('browse')}
      >
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabText, activeTab === 'browse' && styles.tabTextActive]}>
          BROWSE ({rentals.length})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'my' && styles.tabActive]}
        onPress={() => setActiveTab('my')}
      >
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
          MY RENTALS{myRentals.length > 0 ? ` (${myRentals.length})` : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.tab}
        onPress={() => router.push('/(tabs)/orders?tab=rentals' as any)}
      >
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabText, { color: colors.copper, fontWeight: '800' }]}>
          TRACK LEASES ➔
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderBrowseRentals = () => {
    if (loading && rentals.length === 0) {
      return <GarmentGridSkeleton count={6} />;
    }

    if (rentals.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={styles.emptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.charcoal} />
          }
        >
          <SolarIcon name="calendar-sharp" size={48} color={colors.charcoal} />
          <Text style={styles.emptyText}>No leasable assets found</Text>
          <TouchableOpacity style={styles.button} onPress={() => handleRefresh()}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.buttonText}>REFRESH CATALOG ↻</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { marginTop: 12, backgroundColor: colors.white }]}
            onPress={() => router.push('/(tabs)/shop/sell')}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.buttonText, { color: colors.charcoal }]}>+ LIST A RENTAL ITEM</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return (
      <FlatList
        data={rentals}
        keyExtractor={rentalKey}
        renderItem={renderRentalCard}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.browseContent}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.charcoal} />
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      <EditorialPageHeader
        title="RENTALS"
        subtitle="Rent outfits for events"
        eyebrow="Lease the look"
        variant="rental"
        style={styles.header}
      >
        <HandwrittenNote>occasion pieces without permanent closets.</HandwrittenNote>
      </EditorialPageHeader>

      {renderTabBar()}

      {activeTab === 'my' ? (
        <FlatList
          data={filteredRentals}
          keyExtractor={myRentalKey}
          renderItem={renderMyRental}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={renderMyHeader()}
          ListEmptyComponent={renderMyEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.myRentalsContainer}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.charcoal} />
          }
        />
      ) : (
        renderBrowseRentals()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    marginBottom: 0,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: {
    ...textStyles.pageTitle,
    color: colors.charcoal,
  },
  subtitle: { fontFamily: typography.bodyBold, fontSize: 11, color: colors.red, letterSpacing: 1.2 },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.overlayLight },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.charcoal },
  tabText: { fontFamily: typography.bodyBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.2 },
  tabTextActive: { color: colors.charcoal },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between', paddingTop: 16 },
  cardWrapper: { width: '48%', marginBottom: 24 },
  gridRow: { justifyContent: 'space-between', paddingHorizontal: 16 },
  browseContent: { paddingBottom: 100, paddingTop: 16 },

  // My Rentals
  myRentalsContainer: { padding: 16 },
  myRentalCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    padding: 16,
    gap: 10,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  myRentalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  roleBadgeLender: {
    backgroundColor: colors.crimsonLight,
    borderColor: colors.crimson,
  },
  roleBadgeBorrower: {
    backgroundColor: colors.emeraldLight,
    borderColor: colors.forest || colors.forest,
  },
  roleBadgeText: {
    fontSize: 13,
    fontFamily: typography.handBold, includeFontPadding: false, },
  roleBadgeTextLender: {
    color: colors.crimson,
  },
  roleBadgeTextBorrower: {
    color: colors.forest || colors.forest,
  },
  myRentalCounterparty: {
    fontSize: 13,
    fontFamily: typography.handSemi,
    color: colors.textMuted,
    marginTop: 2, includeFontPadding: false, },
  myRentalTitle: { fontFamily: typography.headings, fontSize: 18, color: colors.charcoal },
  myRentalStatus: { paddingHorizontal: 8, paddingVertical: 3 },
  myRentalStatusText: { color: colors.cream, fontFamily: typography.handBold, fontSize: 13, includeFontPadding: false, },
  myRentalDates: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  myRentalDateBlock: { flex: 1 },
  myRentalDateLabel: { fontFamily: typography.handSemi, fontSize: 13, color: colors.textMuted, marginBottom: 2, includeFontPadding: false, },
  myRentalDateValue: { fontFamily: typography.bodyBold, fontSize: 12, color: colors.charcoal, },
  myRentalPriceLabel: { fontFamily: typography.bodyBold, fontSize: 11, color: colors.textMuted, },
  myRentalPrice: { fontFamily: typography.bodyBold, fontSize: 14, color: colors.red, },
  myRentalActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  myRentalDossierBtn: {
    flex: 1,
    backgroundColor: colors.charcoal,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  myRentalDossierText: {
    color: colors.cream,
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  myRentalChatBtn: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  myRentalChatText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.charcoal,
    letterSpacing: 0.2,
  },
  myRentalReturnBtn: {
    flex: 1,
    backgroundColor: colors.charcoal,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  myRentalReturnText: { color: colors.cream, fontFamily: typography.handBold, fontSize: 13, includeFontPadding: false, },

  // Role filter chips
  roleFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  roleFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  roleFilterChipActive: {
    backgroundColor: colors.charcoal,
  },
  roleFilterChipText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  roleFilterChipTextActive: {
    color: colors.cream,
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: 20, paddingTop: 60 },
  emptyText: { color: colors.charcoal, fontSize: 13, fontFamily: typography.handBold, marginVertical: 24, includeFontPadding: false, },
  button: { 
    backgroundColor: colors.charcoal, paddingHorizontal: 28, paddingVertical: 14,
    borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0
  },
  buttonText: { color: colors.cream, fontFamily: typography.handBold, fontSize: 13, includeFontPadding: false, },
});
