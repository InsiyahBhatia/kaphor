import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { rentalService } from '../../../src/services/rentalService';
import { messageService } from '../../../src/services/messageService';
import { cachedGet, fetchFresh } from '../../../src/services/api';
import { EditorialGarmentCard } from '../../../src/components/EditorialGarmentCard';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';
import { useAuthStore } from '../../../src/store/authStore';

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

  const fetchAvailableRentals = async (fresh = false) => {
    try {
      const res = fresh
        ? await fetchFresh('/rentals/available')
        : await cachedGet('/rentals/available');
      const list = Array.isArray(res)
        ? res
        : (res?.data && Array.isArray(res.data) ? res.data : []);
      setRentals(list);
    } catch (err) {
      console.warn('Failed to load available rentals:', err);
      setRentals([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRentals = async (fresh = false) => {
    setMyRentalsLoading(true);
    try {
      const res = fresh
        ? await fetchFresh('/rentals/me')
        : await cachedGet('/rentals/me');
      const list = Array.isArray(res)
        ? res
        : (res?.data && Array.isArray(res.data) ? res.data : []);
      setMyRentals(list);
    } catch (err) {
      console.warn('Failed to load my rentals:', err);
      setMyRentals([]);
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
      await fetchAvailableRentals(true);
    } else {
      await fetchMyRentals(true);
    }
    setRefreshing(false);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'REQUESTED': return colors.gold || '#D4AF37';
      case 'APPROVED': return colors.forest || '#2A7B4C';
      case 'RESERVED': return colors.copper;
      case 'ACTIVE': return colors.forest;
      case 'RETURN_DISPATCHED': return colors.forest;
      case 'RETURNED': return colors.navy;
      case 'COMPLETED': return colors.forest;
      case 'DECLINED': return colors.red;
      case 'OVERDUE': return colors.red;
      default: return colors.textMuted;
    }
  };

  const renderMyRentals = () => {
    if (myRentalsLoading && myRentals.length === 0) return <DossierLoading variant="rental" compact />;
    if (myRentals.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={40} color={colors.charcoal} />
          <Text style={styles.emptyText}>NO ACTIVE RENTAL LEASES</Text>
          <TouchableOpacity style={styles.button} onPress={() => setActiveTab('browse')}>
            <Text style={styles.buttonText}>EXPLORE AVAILABLE PIECES →</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const filteredRentals = myRentals.filter((rental: any) => {
      const isLender = rental.userRole === 'LENDER' || rental.garment?.sellerId === currentUserId;
      if (roleFilter === 'borrowing') return !isLender;
      if (roleFilter === 'lending') return isLender;
      return true;
    });

    return (
      <View>
        {/* Role Selector Chips */}
        <View style={styles.roleFilterRow}>
          {[
            { id: 'all', label: `ALL (${myRentals.length})` },
            { id: 'borrowing', label: `BORROWING (${myRentals.filter((r: any) => r.userRole !== 'LENDER' && r.garment?.sellerId !== currentUserId).length})` },
            { id: 'lending', label: `LENDING (${myRentals.filter((r: any) => r.userRole === 'LENDER' || r.garment?.sellerId === currentUserId).length})` },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.roleFilterChip, roleFilter === item.id && styles.roleFilterChipActive]}
              onPress={() => setRoleFilter(item.id as any)}
            >
              <Text style={[styles.roleFilterChipText, roleFilter === item.id && styles.roleFilterChipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredRentals.length === 0 ? (
          <View style={[styles.emptyState, { paddingTop: 30 }]}>
            <Text style={styles.emptyText}>NO LEASES IN THIS CATEGORY</Text>
          </View>
        ) : (
          filteredRentals.map((rental: any) => {
            const isLender = rental.userRole === 'LENDER' || rental.garment?.sellerId === currentUserId;
            const counterpartyName = isLender
              ? (rental.renter?.displayName || rental.renter?.username || 'Borrower')
              : (rental.garment?.seller?.displayName || 'Lender / Owner');

            return (
              <TouchableOpacity
                key={rental.id}
                style={styles.myRentalCard}
                onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}` as any)}
                activeOpacity={0.88}
              >
                {/* Header with Role Pill & Status */}
                <View style={styles.myRentalHeader}>
                  <View style={[styles.roleBadge, isLender ? styles.roleBadgeLender : styles.roleBadgeBorrower]}>
                    <Text style={[styles.roleBadgeText, isLender ? styles.roleBadgeTextLender : styles.roleBadgeTextBorrower]}>
                      {isLender ? 'YOU ARE LENDER' : 'YOU ARE BORROWER'}
                    </Text>
                  </View>
                  <View style={[styles.myRentalStatus, { backgroundColor: statusColor(rental.status) }]}>
                    <Text style={styles.myRentalStatusText}>{rental.status}</Text>
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
                    <Text style={styles.myRentalDateLabel}>DELIVERY</Text>
                    <Text style={styles.myRentalDateValue}>
                      {new Date(rental.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                  <View style={styles.myRentalDateBlock}>
                    <Text style={styles.myRentalDateLabel}>RETURN DUE</Text>
                    <Text style={styles.myRentalDateValue}>
                      {new Date(rental.endDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.myRentalPriceLabel}>TOTAL LEASE</Text>
                    <Text style={styles.myRentalPrice}>
                      ₹{Math.round(rental.totalPrice || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                {/* Card Action Row */}
                <View style={styles.myRentalActionRow}>
                  {rental.status === 'REQUESTED' && isLender ? (
                    <TouchableOpacity
                      style={[styles.myRentalDossierBtn, { backgroundColor: '#B45309', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                      onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}` as any)}
                    >
                      <Ionicons name="time" size={13} color={colors.white} />
                      <Text style={styles.myRentalDossierText}>REVIEW & APPROVE DATES ➔</Text>
                    </TouchableOpacity>
                  ) : rental.status === 'APPROVED' && !isLender ? (
                    <TouchableOpacity
                      style={[styles.myRentalDossierBtn, { backgroundColor: colors.forest || '#2A7B4C', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                      onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}` as any)}
                    >
                      <Ionicons name="card" size={13} color={colors.white} />
                      <Text style={styles.myRentalDossierText}>PAY ESCROW DEPOSIT ➔</Text>
                    </TouchableOpacity>
                  ) : (rental.status === 'RETURNED' || rental.status === 'COMPLETED') && (!currentUserId || !rental?.metadata?.reviews?.[currentUserId]) ? (
                    <TouchableOpacity
                      style={[styles.myRentalDossierBtn, { backgroundColor: '#D97706', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                      onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}?review=true` as any)}
                    >
                      <Ionicons name="star" size={13} color={colors.white} />
                      <Text style={styles.myRentalDossierText}>RATE & REVIEW LEASE ➔</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.myRentalDossierBtn}
                      onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}` as any)}
                    >
                      <Text style={styles.myRentalDossierText}>VIEW LEASE DOSSIER ➔</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
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
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.charcoal} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'browse' && styles.tabActive]}
        onPress={() => setActiveTab('browse')}
      >
        <Text style={[styles.tabText, activeTab === 'browse' && styles.tabTextActive]}>
          BROWSE ({rentals.length})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'my' && styles.tabActive]}
        onPress={() => setActiveTab('my')}
      >
        <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
          MY RENTALS{myRentals.length > 0 ? ` (${myRentals.length})` : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.tab}
        onPress={() => router.push('/(tabs)/orders?tab=rentals' as any)}
      >
        <Text style={[styles.tabText, { color: colors.copper, fontWeight: '800' }]}>
          TRACK LEASES ➔
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderBrowseRentals = () => {
    if (loading && rentals.length === 0) {
      return <DossierLoading variant="rental" />;
    }

    if (rentals.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={styles.emptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.charcoal} />
          }
        >
          <Ionicons name="calendar-sharp" size={48} color={colors.charcoal} />
          <Text style={styles.emptyText}>NO LEASABLE ASSETS FOUND</Text>
          <TouchableOpacity style={styles.button} onPress={() => handleRefresh()}>
            <Text style={styles.buttonText}>REFRESH CATALOG ↻</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { marginTop: 12, backgroundColor: colors.white }]}
            onPress={() => router.push('/(tabs)/shop/sell')}
          >
            <Text style={[styles.buttonText, { color: colors.charcoal }]}>+ LIST A RENTAL ASSET</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.charcoal} />
        }
      >
        <View style={styles.grid}>
          {rentals.map((item: any) => {
            return (
              <View key={item.id} style={styles.cardWrapper}>
                <EditorialGarmentCard
                  item={{
                    ...item,
                    price: item.rentalPriceDay ? Math.round(item.rentalPriceDay) : (item.price ? Math.round(item.price) : 0),
                  }}
                  onPress={() => router.push(`/(tabs)/rental/${item.id}` as any)}
                  style={{ width: '100%', marginRight: 0 }}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Text style={styles.title}>RENTALS</Text>
        </View>
        <Text style={styles.subtitle}>SHORT-TERM LEASING // ARCHIVE PIECES</Text>
      </View>

      {renderTabBar()}

      {activeTab === 'my' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.myRentalsContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.charcoal} />
          }
        >
          {renderMyRentals()}
        </ScrollView>
      ) : (
        renderBrowseRentals()
      )}
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

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(26,26,26,0.1)' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.charcoal },
  tabText: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 1 },
  tabTextActive: { color: colors.charcoal, fontWeight: '900' },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between', paddingTop: 16 },
  cardWrapper: { width: '48%', marginBottom: 24 },

  // My Rentals
  myRentalsContainer: { padding: 16, gap: 12 },
  myRentalCard: {
    backgroundColor: colors.white, borderWidth: 2, borderColor: colors.charcoal,
    padding: 16, gap: 10,
    shadowColor: colors.charcoal, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  myRentalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  roleBadgeLender: {
    backgroundColor: 'rgba(155, 27, 48, 0.08)',
    borderColor: colors.crimson,
  },
  roleBadgeBorrower: {
    backgroundColor: 'rgba(42, 123, 76, 0.08)',
    borderColor: colors.forest || '#2A7B4C',
  },
  roleBadgeText: {
    fontSize: 8.5,
    fontFamily: typography.mono,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  roleBadgeTextLender: {
    color: colors.crimson,
  },
  roleBadgeTextBorrower: {
    color: colors.forest || '#2A7B4C',
  },
  myRentalCounterparty: {
    fontSize: 10,
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontWeight: '700',
    marginTop: 2,
  },
  myRentalTitle: { fontFamily: typography.headings, fontSize: 19, color: colors.charcoal, flex: 1 },
  myRentalStatus: { paddingHorizontal: 8, paddingVertical: 3 },
  myRentalStatusText: { color: colors.cream, fontFamily: typography.mono, fontSize: 8, fontWeight: '900' },
  myRentalDates: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  myRentalDateBlock: { flex: 1 },
  myRentalDateLabel: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, fontWeight: '700', marginBottom: 2 },
  myRentalDateValue: { fontFamily: typography.mono, fontSize: 12, color: colors.charcoal, fontWeight: '700' },
  myRentalPriceLabel: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, fontWeight: '700' },
  myRentalPrice: { fontFamily: typography.mono, fontSize: 14, color: colors.red, fontWeight: '800' },
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
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  myRentalChatBtn: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3ED',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  myRentalChatText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.8,
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
  myRentalReturnText: { color: colors.cream, fontFamily: typography.mono, fontSize: 10, fontWeight: '900', letterSpacing: 1 },

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
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  roleFilterChipTextActive: {
    color: colors.cream,
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: 20, paddingTop: 60 },
  emptyText: { color: colors.charcoal, fontSize: 12, fontFamily: typography.mono, fontWeight: '800', marginVertical: 24, letterSpacing: 2 },
  button: { 
    backgroundColor: colors.charcoal, paddingHorizontal: 28, paddingVertical: 14,
    borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0
  },
  buttonText: { color: colors.cream, fontFamily: typography.mono, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
});
