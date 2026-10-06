import { useListStore, hydrateLists, refreshOrders, loadMoreOrders } from '../../../src/store/listStore';

const EMPTY_ORDERS: TransactionOrder[] = [];
const EMPTY_RENTALS: RentalItem[] = [];
const EMPTY_SWAPS: any[] = [];
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SolarIcon } from '../../../src/components/common/SolarIcon';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { OrderTrackerStepper } from '../../../src/components/orders/OrderTrackerStepper';
import { EstTradeValueBadge } from '../../../src/components/orders/EstTradeValueBadge';
import { FairValueMatcher } from '../../../src/components/orders/FairValueMatcher';
import { trackingService, OrdersSummaryData, RentalItem } from '../../../src/services/trackingService';
import { TransactionOrder } from '../../../src/services/orderService';
import { messageService } from '../../../src/services/messageService';
import { useAuth } from '../../../src/context/AuthContext';
import { colors, typography } from '../../../src/theme';
import { invalidateCache } from '../../../src/services/api';
import { hapticFeedback } from '../../../src/utils/haptics';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { navigateToLiveSwapStage } from '../../../src/utils/swapNavigation';
import { Spinner, Loader } from '../../../src/components/common/Loader';


type RowHandlers = Record<string, (...args: any[]) => any>;

<<<<<<< HEAD
const OrderCard = React.memo(function OrderCard({ order, userId, actionLoadingId, h, router }: { order: TransactionOrder; userId?: string; actionLoadingId: string | null; h: RowHandlers; router: ReturnType<typeof useRouter> }) {
  const { handleOpenChat, handleMarkShipped, handleMarkDelivered, handleDispatchRental, handleReturnRental, handleReleaseDeposit } = h;
                const isBuyer = order.buyerId === userId;
=======
  // Sub-roles
  const [ordersRole, setOrdersRole] = useState<'buyer' | 'seller'>('buyer');
  const [rentalsRole, setRentalsRole] = useState<'renter' | 'lender'>('renter');
  const [swapsFilter, setSwapsFilter] = useState<'all' | 'action' | 'completed'>('all');

  // Data states
  const cached = peek<any>('orders:all');
  const [summary, setSummary] = useState<OrdersSummaryData | null>(cached?.sum ?? null);
  const [ordersList, setOrdersList] = useState<TransactionOrder[]>(cached?.ords ?? []);
  const [rentalsList, setRentalsList] = useState<RentalItem[]>(cached?.rents ?? []);
  const [swapsList, setSwapsList] = useState<any[]>(cached?.swps ?? []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const isTabSwitching = false;
  // Track last fetch time to avoid redundant re-fetches on tab focus
  const lastFetchedAt = React.useRef<number>(cached ? Date.now() : 0);
  const FETCH_TTL_MS = 30_000; // 30 seconds — don't re-fetch if data is this fresh

  const handleSelectTab = (tab: 'orders' | 'rentals' | 'swaps') => {
    if (tab === activeTab) return;
    hapticFeedback.selection();
    setActiveTab(tab);
  };

  const handleSelectRole = (action: () => void) => {
    hapticFeedback.selection();
    action();
  };

  // If query params specify tab, sync it
  useEffect(() => {
    if (params.tab && ['orders', 'rentals', 'swaps'].includes(params.tab as string)) {
      setActiveTab(params.tab as any);
    }
  }, [params.tab]);

  const loadAllData = useCallback(async (force = false) => {
    // Skip if data is fresh and this isn't a manual refresh
    if (!force && Date.now() - lastFetchedAt.current < FETCH_TTL_MS) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [sum, ords, rents, swps] = await Promise.all([
        trackingService.getSummary(),
        trackingService.getOrders(),
        trackingService.getRentals('all'),
        trackingService.getSwaps(),
      ]);
      setSummary(sum);
      setOrdersList(ords);
      setRentalsList(rents);
      setSwapsList(swps);
      remember('orders:all', { sum, ords, rents, swps });
      lastFetchedAt.current = Date.now();
    } catch {
      // Fallback — keep existing cached data visible
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Show the last persisted copy instantly on a cold start, then refresh in the background
  useEffect(() => {
    if (cached) return;
    hydrate<any>('orders:all').then((c) => {
      if (!c) return;
      setSummary((v) => v ?? c.sum);
      setOrdersList((v) => (v.length ? v : c.ords ?? []));
      setRentalsList((v) => (v.length ? v : c.rents ?? []));
      setSwapsList((v) => (v.length ? v : c.swps ?? []));
      setLoading(false);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    hapticFeedback.light();
    loadAllData(true); // force=true bypasses TTL
  };

  // Helper to open chat
  const handleOpenChat = async (
    otherUserId: string,
    garmentId?: string,
    extra?: { orderId?: string; swapId?: string; rentalId?: string; type?: string }
  ) => {
    if (!otherUserId) return;
    try {
      const conv = await messageService.getOrCreateConversation(otherUserId, garmentId, extra);
      router.push(`/messages/${conv.id}` as any);
    } catch {
      router.push('/(tabs)/messages' as any);
    }
  };

  // Actions for Orders
  const handleMarkShipped = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      await trackingService.markOrderShipped(orderId);
      invalidateCache(['/orders', '/users/me/wardrobe']);
      Alert.alert('Success', 'Order marked as shipped. Buyer has been notified!');
      loadAllData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not mark order shipped.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      await trackingService.markOrderDelivered(orderId);
      invalidateCache(['/orders', '/users/me/wardrobe', '/impact']);
      loadAllData();
      Alert.alert(
        'Delivery Confirmed',
        'Garment delivery confirmed! Would you like to review and rate the seller now?',
        [
          { text: 'LATER', style: 'cancel' },
          {
            text: 'REVIEW SELLER',
            onPress: () => router.push(`/(tabs)/shop/orders/${orderId}?review=true` as any),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not confirm delivery.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Actions for Rentals
  const handleDispatchRental = async (rentalId: string) => {
    setActionLoadingId(rentalId);
    try {
      await trackingService.dispatchRental(rentalId);
      invalidateCache(['/rentals', '/users/me/wardrobe']);
      Alert.alert('Shipped', 'Rental is now active. The renter has been told.');
      loadAllData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not mark the rental as shipped.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReturnRental = async (rentalId: string) => {
    setActionLoadingId(rentalId);
    try {
      await trackingService.returnRental(rentalId);
      invalidateCache(['/rentals', '/users/me/wardrobe']);
      Alert.alert('Returned', 'Garment marked as returned. Lender will inspect and release deposit.');
      loadAllData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not mark rental returned.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReleaseDeposit = async (rentalId: string) => {
    setActionLoadingId(rentalId);
    try {
      await trackingService.releaseRentalDeposit(rentalId);
      invalidateCache(['/rentals', '/users/me/wardrobe']);
      Alert.alert('Released', 'Security deposit has been refunded to borrower.');
      loadAllData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not release deposit.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered Orders
  const currentOrders = ordersList.filter((o) => {
    if (ordersRole === 'buyer') return o.buyerId === user?.id;
    return o.sellerId === user?.id;
  });

  // Filtered Rentals
  const currentRentals = rentalsList.filter((r) => {
    if (rentalsRole === 'renter') return r.renterId === user?.id;
    return r.garment?.sellerId === user?.id;
  });

  // Filtered Swaps
  const currentSwaps = swapsList.filter((s) => {
    const isDone = s.status === 'COMPLETED' || s.status === 'REJECTED' || s.status === 'CANCELLED';
    if (swapsFilter === 'completed') return isDone;
    if (swapsFilter === 'action') return !isDone;
    return true;
  });

  if (loading) {
    return <Loader variant="order" />;
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back"
            style={styles.backButton}
            onPress={() => safeBack('/(tabs)/profile')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.charcoal} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>MY ORDERS</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* PRIMARY CATEGORY TABS */}
        <View style={styles.primaryTabs}>
          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'orders' && styles.primaryTabActive]}
            onPress={() => handleSelectTab('orders')}
          >
            <Ionicons name="bag-check-outline" size={13} color={activeTab === 'orders' ? colors.cream : colors.charcoal} />
            <Text style={[styles.primaryTabText, activeTab === 'orders' && styles.primaryTabTextActive]}>
              SALES
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'rentals' && styles.primaryTabActive]}
            onPress={() => handleSelectTab('rentals')}
          >
            <Ionicons name="calendar-outline" size={13} color={activeTab === 'rentals' ? colors.cream : colors.charcoal} />
            <Text style={[styles.primaryTabText, activeTab === 'rentals' && styles.primaryTabTextActive]}>
              RENTALS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'swaps' && styles.primaryTabActive]}
            onPress={() => handleSelectTab('swaps')}
          >
            <Ionicons name="swap-horizontal-outline" size={13} color={activeTab === 'swaps' ? colors.cream : colors.charcoal} />
            <Text style={[styles.primaryTabText, activeTab === 'swaps' && styles.primaryTabTextActive]}>
              SWAPS
            </Text>
          </TouchableOpacity>
        </View>

        {/* SLIM SUMMARY STRIP */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{summary?.orders.buyingActive || 0}</Text>
            <Text style={styles.summaryLbl}>Buying</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{summary?.orders.sellingActive || 0}</Text>
            <Text style={styles.summaryLbl}>Selling</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{(summary?.rentals.borrowingActive || 0) + (summary?.rentals.lendingActive || 0)}</Text>
            <Text style={styles.summaryLbl}>Rentals</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{summary?.swaps.active || 0}</Text>
            <Text style={styles.summaryLbl}>Swaps</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading || isTabSwitching ? (
          <OrderCardsLoading count={4} />
        ) : (
          <>
            {/* ═══════════════════════════════════════════════ */}
            {/* TAB 1: PURCHASES & SALES                        */}
            {/* ═══════════════════════════════════════════════ */}
            {activeTab === 'orders' && (
          <View>
            {/* ROLE TOGGLE */}
            <View style={styles.roleToggleRow}>
              <TouchableOpacity
                style={[styles.rolePill, ordersRole === 'buyer' && styles.rolePillActive]}
                onPress={() => handleSelectRole(() => setOrdersRole('buyer'))}
              >
                <Ionicons
                  name="bag-handle-outline"
                  size={14}
                  color={ordersRole === 'buyer' ? colors.cream : colors.charcoal}
                />
                <Text
                  style={[
                    styles.rolePillText,
                    ordersRole === 'buyer' && styles.rolePillTextActive,
                  ]}
                >
                  I'M BUYING ({ordersList.filter((o) => o.buyerId === user?.id).length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rolePill, ordersRole === 'seller' && styles.rolePillActive]}
                onPress={() => handleSelectRole(() => setOrdersRole('seller'))}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={14}
                  color={ordersRole === 'seller' ? colors.cream : colors.charcoal}
                />
                <Text
                  style={[
                    styles.rolePillText,
                    ordersRole === 'seller' && styles.rolePillTextActive,
                  ]}
                >
                  I'M SELLING ({ordersList.filter((o) => o.sellerId === user?.id).length})
                </Text>
              </TouchableOpacity>
            </View>

            {currentOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={44} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>NO ORDERS FOUND</Text>
                <Text style={styles.emptySub}>
                  {ordersRole === 'buyer'
                    ? 'Browse the shop to find something you like.'
                    : 'List your items to start getting orders.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() =>
                    ordersRole === 'buyer'
                      ? router.push('/(tabs)/shop')
                      : router.push('/(tabs)/shop/sell')
                  }
                >
                  <Text style={styles.emptyBtnText}>
                    {ordersRole === 'buyer' ? 'EXPLORE SHOP →' : 'LIST A GARMENT →'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              currentOrders.map((order) => {
                const isBuyer = order.buyerId === user?.id;
>>>>>>> c057d22 (fix: install react-native-webview peer dep, fix AI stylist button, fix for-you listing filter (SALE only), fix orders screen load TTL)
                const otherParty = isBuyer ? order.seller : order.buyer;
                const firstItem = order.items?.[0];
                const thumb = firstItem?.garment?.images?.[0];
                const isLoading = actionLoadingId === order.id;

                return (
                  <View key={order.id} style={styles.card}>
                    {/* TOP STATUS BAR */}
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderIdLabel}>ORDER #{order.id.slice(0, 8).toUpperCase()}</Text>
                        <Text style={styles.orderDate}>
                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusTag,
                          order.status === 'DELIVERED' && { backgroundColor: colors.forest },
                          order.status === 'SHIPPED' && { backgroundColor: colors.ink },
                          order.status === 'CONFIRMED' && { backgroundColor: colors.charcoal },
                        ]}
                      >
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.statusTagText}>{order.status}</Text>
                      </View>
                    </View>

                    {/* ITEM ROW (Tappable to view transaction item details) */}
                    <TouchableOpacity
                      style={styles.cardBody}
                      onPress={() => {
                        const gid = firstItem?.garment?.id || firstItem?.garmentId;
                        if (gid) router.push(`/(tabs)/shop/${gid}` as any);
                      }}
                      activeOpacity={0.85}
                    >
                      <KaphorImage uri={thumb} style={styles.garmentThumb} contentFit="cover" />
                      <View style={styles.garmentInfo}>
                        <Text style={styles.garmentBrand} numberOfLines={1}>
                          {firstItem?.garment?.brand || 'KAPHOR'}
                        </Text>
                        <Text style={styles.garmentTitle} numberOfLines={2}>
                          {firstItem?.garment?.title || 'Classic Piece'}
                        </Text>
                        <Text style={styles.garmentPrice}>
                          ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.counterpartyText}>
                          {isBuyer ? 'SELLER' : 'BUYER'}: {otherParty?.displayName || otherParty?.username}
                        </Text>
                      </View>
                      <View style={styles.viewChevronCol}>
                        <SolarIcon name="chevron-forward" size={16} color={colors.textMuted} />
                      </View>
                    </TouchableOpacity>

                    {/* TRACKER STEPPER */}
                    <View style={styles.stepperContainer}>
                      <OrderTrackerStepper type="SALE" status={order.status} />
                    </View>

                    {/* ACTION BUTTONS */}
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        style={styles.chatActionBtn}
                        onPress={() =>
                          handleOpenChat(otherParty?.id, firstItem?.garment?.id, {
                            orderId: order.id,
                            type: 'SALE',
                          })
                        }
                        activeOpacity={0.8}
                      >
                        <SolarIcon name="chatbubble-ellipses-outline" size={14} color={colors.charcoal} />
                        <Text style={styles.chatActionText}>CHAT</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.detailActionBtn}
                        onPress={() => {
                          const gid = firstItem?.garment?.id || firstItem?.garmentId;
                          if (gid) router.push(`/(tabs)/shop/${gid}` as any);
                        }}
                        activeOpacity={0.8}
                      >
                        <SolarIcon name="eye-outline" size={14} color={colors.charcoal} />
                        <Text style={styles.detailActionText}>ITEM</Text>
                      </TouchableOpacity>

                      {/* Primary CTA based on status */}
                      {isBuyer && order.status === 'DELIVERED' && !(order as any).peerReview ? (
                        <TouchableOpacity
                          style={styles.reviewActionBtn}
                          onPress={() => router.push(`/(tabs)/shop/orders/${order.id}?review=true` as any)}
                          activeOpacity={0.85}
                        >
                          <SolarIcon name="star" size={13} color={colors.orange} />
                          <Text style={styles.reviewActionText}>REVIEW ★</Text>
                        </TouchableOpacity>
                      ) : !isBuyer && order.status === 'CONFIRMED' ? (
                        <TouchableOpacity
                          style={styles.primaryActionBtn}
                          onPress={() => handleMarkShipped(order.id)}
                          disabled={isLoading}
                          activeOpacity={0.85}
                        >
                          {isLoading ? (
                            <Spinner size="small" color={colors.cream} />
                          ) : (
                            <Text style={styles.primaryActionText}>MARK SHIPPED</Text>
                          )}
                        </TouchableOpacity>
                      ) : isBuyer && order.status === 'SHIPPED' ? (
                        <TouchableOpacity
                          style={[styles.primaryActionBtn, { backgroundColor: colors.forest, borderColor: colors.forest }]}
                          onPress={() => handleMarkDelivered(order.id)}
                          disabled={isLoading}
                          activeOpacity={0.85}
                        >
                          {isLoading ? (
                            <Spinner size="small" color={colors.cream} />
                          ) : (
                            <Text style={styles.primaryActionText}>CONFIRM DELIVERED</Text>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.trackActionBtn}
                          onPress={() => router.push(`/(tabs)/shop/orders/${order.id}` as any)}
                          activeOpacity={0.85}
                        >
                          <SolarIcon name="navigate-outline" size={13} color={colors.cream} />
                          <Text style={styles.trackActionText}>TRACK ORDER →</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
});

const RentalCard = React.memo(function RentalCard({ rental, userId, actionLoadingId, h, router }: { rental: RentalItem; userId?: string; actionLoadingId: string | null; h: RowHandlers; router: ReturnType<typeof useRouter> }) {
  const { handleOpenChat, handleMarkShipped, handleMarkDelivered, handleDispatchRental, handleReturnRental, handleReleaseDeposit } = h;
                const isRenter = rental.renterId === userId;
                const counterpart = isRenter ? rental.garment?.seller : rental.renter;
                const thumb = rental.garment?.images?.[0];
                const isLoading = actionLoadingId === rental.id;

                const startFormatted = new Date(rental.startDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                });
                const endFormatted = new Date(rental.endDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <View
                    key={rental.id}
                    style={styles.card}
                  >
                    {/* TOP STATUS */}
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderIdLabel}>LEASE #{rental.id.slice(0, 8).toUpperCase()}</Text>
                        <Text style={styles.orderDate}>
                          {startFormatted} ➔ {endFormatted}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusTag,
                          rental.status === 'ACTIVE' && { backgroundColor: colors.ink },
                          rental.status === 'RETURNED' && { backgroundColor: colors.forest },
                          rental.status === 'RESERVED' && { backgroundColor: colors.copper },
                        ]}
                      >
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.statusTagText}>{rental.status}</Text>
                      </View>
                    </View>

                    {/* ITEM ROW (Tappable to view transaction item details) */}
                    <TouchableOpacity
                      style={styles.cardBody}
                      onPress={() => {
                        const gid = rental.garmentId || rental.garment?.id;
                        if (gid) router.push(`/(tabs)/shop/${gid}` as any);
                      }}
                      activeOpacity={0.85}
                    >
                      <KaphorImage uri={thumb} style={styles.garmentThumb} contentFit="cover" />
                      <View style={styles.garmentInfo}>
                        <Text style={styles.garmentBrand} numberOfLines={1}>
                          {rental.garment?.brand || 'RENTAL'}
                        </Text>
                        <Text style={styles.garmentTitle} numberOfLines={2}>
                          {rental.garment?.title || 'Rental Asset'}
                        </Text>
                        <Text style={styles.garmentPrice}>
                          ₹{(rental.totalPrice || 0).toLocaleString('en-IN')} total
                        </Text>
                        <Text style={styles.counterpartyText}>
                          {isRenter ? 'LENDER' : 'RENTER'}: {counterpart?.displayName || counterpart?.username || 'Member'}
                        </Text>
                      </View>
                      <View style={styles.viewChevronCol}>
                        <SolarIcon name="chevron-forward" size={16} color={colors.textMuted} />
                      </View>
                    </TouchableOpacity>

                    {/* STEPPER */}
                    <View style={styles.stepperContainer}>
                      <OrderTrackerStepper type="RENTAL" status={rental.status} />
                    </View>

                    {/* ESCROW GUARANTEE BANNER */}
                    <View style={styles.escrowNotice}>
                      <SolarIcon name="shield-checkmark" size={14} color={colors.forest} />
                      <Text style={styles.escrowNoticeText}>
                        ₹299 refundable deposit, held safely
                      </Text>
                    </View>

                    {/* ACTIONS */}
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        style={styles.chatActionBtn}
                        onPress={() =>
                          handleOpenChat(
                            isRenter ? rental.garment?.sellerId : rental.renterId,
                            rental.garmentId,
                            { rentalId: rental.id, type: 'RENTAL' }
                          )
                        }
                        activeOpacity={0.8}
                      >
                        <SolarIcon name="chatbubble-ellipses-outline" size={14} color={colors.charcoal} />
                        <Text style={styles.chatActionText}>CHAT</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.detailActionBtn}
                        onPress={() => {
                          const gid = rental.garmentId || rental.garment?.id;
                          if (gid) router.push(`/(tabs)/shop/${gid}` as any);
                        }}
                        activeOpacity={0.8}
                      >
                        <SolarIcon name="eye-outline" size={14} color={colors.charcoal} />
                        <Text style={styles.detailActionText}>ITEM</Text>
                      </TouchableOpacity>

                      {/* Primary CTA based on rental status */}
                      {!isRenter && rental.status === 'RESERVED' ? (
                        <TouchableOpacity
                          style={styles.primaryActionBtn}
                          onPress={() => handleDispatchRental(rental.id)}
                          disabled={isLoading}
                          activeOpacity={0.85}
                        >
                          {isLoading ? (
                            <Spinner size="small" color={colors.cream} />
                          ) : (
                            <Text style={styles.primaryActionText}>MARK SHIPPED</Text>
                          )}
                        </TouchableOpacity>
                      ) : isRenter && (rental.status === 'RESERVED' || rental.status === 'ACTIVE') ? (
                        <TouchableOpacity
                          style={[styles.primaryActionBtn, { backgroundColor: colors.charcoal }]}
                          onPress={() => handleReturnRental(rental.id)}
                          disabled={isLoading}
                          activeOpacity={0.85}
                        >
                          {isLoading ? (
                            <Spinner size="small" color={colors.cream} />
                          ) : (
                            <Text style={styles.primaryActionText}>MARK RETURNED</Text>
                          )}
                        </TouchableOpacity>
                      ) : !isRenter && rental.status === 'RETURNED' ? (
                        <TouchableOpacity
                          style={[styles.primaryActionBtn, { backgroundColor: colors.forest, borderColor: colors.forest }]}
                          onPress={() => handleReleaseDeposit(rental.id)}
                          disabled={isLoading}
                          activeOpacity={0.85}
                        >
                          {isLoading ? (
                            <Spinner size="small" color={colors.cream} />
                          ) : (
                            <Text style={styles.primaryActionText}>RELEASE DEPOSIT</Text>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.trackActionBtn}
                          onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}` as any)}
                          activeOpacity={0.85}
                        >
                          <SolarIcon name="navigate-outline" size={13} color={colors.cream} />
                          <Text style={styles.trackActionText}>TRACK LEASE →</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
});

const SwapCard = React.memo(function SwapCard({ swap, userId, actionLoadingId, h, router }: { swap: any; userId?: string; actionLoadingId: string | null; h: RowHandlers; router: ReturnType<typeof useRouter> }) {
  const { handleOpenChat, handleMarkShipped, handleMarkDelivered, handleDispatchRental, handleReturnRental, handleReleaseDeposit } = h;
                const isInitiator = swap.initiatorId === userId;
                const partner = isInitiator ? swap.receiver : swap.initiator;

                const extractGarmentImage = (obj: any): string => {
                  if (!obj) return '';
                  if (typeof obj === 'string' && (obj.startsWith('http') || obj.startsWith('data:'))) return obj;
                  return obj.primaryImage || obj.image || obj.images?.[0] || '';
                };

                const wantedGarment =
                  (typeof swap.garmentWanted === 'object' && swap.garmentWanted) ||
                  (typeof swap.wantedGarment === 'object' && swap.wantedGarment) ||
                  null;

                const offeredGarment =
                  (typeof swap.garmentOffered === 'object' && swap.garmentOffered) ||
                  (typeof swap.offeredGarment === 'object' && swap.offeredGarment) ||
                  null;

                const myGarment = isInitiator ? offeredGarment : wantedGarment;
                const theirGarment = isInitiator ? wantedGarment : offeredGarment;

                const myImg = extractGarmentImage(myGarment);
                const theirImg = extractGarmentImage(theirGarment);

                const myValuation = myGarment?.price || myGarment?.estimatedValue || 3500;
                const theirValuation = theirGarment?.price || theirGarment?.estimatedValue || 3200;

                return (
                  <View key={swap.id} style={styles.card}>
                    {/* HEADER */}
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderIdLabel}>SWAP #{swap.id.slice(0, 8).toUpperCase()}</Text>
                        <Text style={styles.orderDate}>
                          WITH @{partner?.username || partner?.displayName || 'member'}
                        </Text>
                      </View>
                      <View style={[styles.statusTag, { backgroundColor: colors.copper }]}>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.statusTagText}>{swap.compositeStatus || swap.status}</Text>
                      </View>
                    </View>

                    {/* DUAL ITEM COMPARISON (Interactive to view piece details) */}
                    <View style={styles.swapComparisonRow}>
                      <TouchableOpacity
                        style={styles.swapItemCol}
                        onPress={() => myGarment?.id && router.push(`/(tabs)/shop/${myGarment.id}` as any)}
                        activeOpacity={0.8}
                      >
                        <KaphorImage uri={myImg} style={styles.swapThumb} contentFit="cover" />
                        <Text style={styles.swapRoleLabel}>YOUR ITEM</Text>
                        <Text style={styles.swapItemTitle} numberOfLines={1}>
                          {myGarment?.title || 'Offered Item'}
                        </Text>
                        <EstTradeValueBadge
                          value={myValuation}
                          size="sm"
                          variant="dark"
                          style={{ marginTop: 4 }}
                        />
                        <Text style={styles.itemInspectHint}>VIEW ITEM →</Text>
                      </TouchableOpacity>

                      <View style={styles.swapArrowCol}>
                        <SolarIcon name="swap-horizontal" size={24} color={colors.charcoal} />
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.swapCashlessBadge}>CASHLESS</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.swapItemCol}
                        onPress={() => theirGarment?.id && router.push(`/(tabs)/shop/${theirGarment.id}` as any)}
                        activeOpacity={0.8}
                      >
                        <KaphorImage uri={theirImg} style={styles.swapThumb} contentFit="cover" />
                        <Text style={styles.swapRoleLabel}>THEIR ITEM</Text>
                        <Text style={styles.swapItemTitle} numberOfLines={1}>
                          {theirGarment?.title || 'Wanted Item'}
                        </Text>
                        <EstTradeValueBadge
                          value={theirValuation}
                          size="sm"
                          variant="copper"
                          style={{ marginTop: 4 }}
                        />
                        <Text style={styles.itemInspectHint}>VIEW ITEM →</Text>
                      </TouchableOpacity>
                    </View>

                    {/* FAIR VALUE MATCHER */}
                    <FairValueMatcher
                      myGarment={myGarment}
                      theirGarment={theirGarment}
                      myValuation={myValuation}
                      theirValuation={theirValuation}
                      compact={true}
                      style={{ marginTop: 10 }}
                    />

                    {/* STEPPER */}
                    <View style={styles.stepperContainer}>
                      <OrderTrackerStepper type="SWAP" status={swap.compositeStatus || swap.status} />
                    </View>

                    {/* ACTIONS */}
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        style={styles.chatActionBtn}
                        onPress={() =>
                          handleOpenChat(partner?.id, wantedGarment?.id || offeredGarment?.id, {
                            swapId: swap.id,
                            type: 'SWAP',
                          })
                        }
                        activeOpacity={0.8}
                      >
                        <SolarIcon name="chatbubble-ellipses-outline" size={14} color={colors.charcoal} />
                        <Text style={styles.chatActionText}>CHAT</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.detailActionBtn}
                        onPress={() => {
                          const targetGid = theirGarment?.id || myGarment?.id;
                          if (targetGid) router.push(`/(tabs)/shop/${targetGid}` as any);
                        }}
                        activeOpacity={0.8}
                      >
                        <SolarIcon name="eye-outline" size={14} color={colors.charcoal} />
                        <Text style={styles.detailActionText}>ITEM</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.trackActionBtn}
                        onPress={() => navigateToLiveSwapStage(router, swap, userId)}
                        activeOpacity={0.85}
                      >
                        <SolarIcon name="navigate-outline" size={13} color={colors.cream} />
                        <Text style={styles.trackActionText}>TRACK STAGE →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
});

const rowKey = (it: any) => it.id;

export default function OrdersManagementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  useBackHandler('/(tabs)/profile');

  // Main Category Tab: 'orders' (Sale) | 'rentals' | 'swaps'
  const [activeTab, setActiveTab] = useState<'orders' | 'rentals' | 'swaps'>(
    (params.tab as any) || 'orders'
  );

  // Sub-roles
  const [ordersRole, setOrdersRole] = useState<'buyer' | 'seller'>('buyer');
  const [rentalsRole, setRentalsRole] = useState<'renter' | 'lender'>('renter');
  const [swapsFilter, setSwapsFilter] = useState<'all' | 'action' | 'completed'>('all');

  // Cache-first data: persisted store warmed after login; skeleton only when nothing is cached
  const bundle = useListStore((s) => s.orders);
  const hydrated = useListStore((s) => s.hydrated);
  const hasMoreOrders = useListStore((s) => s.ordersCursor !== null);
  const summary = bundle?.sum ?? null;
  const ordersList = bundle?.ords ?? EMPTY_ORDERS;
  const rentalsList = bundle?.rents ?? EMPTY_RENTALS;
  const swapsList = bundle?.swps ?? EMPTY_SWAPS;
  const [fetchSettled, setFetchSettled] = useState(false);
  const loading = bundle === null && (!hydrated || !fetchSettled);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleSelectTab = (tab: 'orders' | 'rentals' | 'swaps') => {
    if (tab === activeTab) return;
    hapticFeedback.selection();
    setActiveTab(tab);
  };

  const handleSelectRole = (action: () => void) => {
    hapticFeedback.selection();
    action();
  };

  // If query params specify tab, sync it
  useEffect(() => {
    if (params.tab && ['orders', 'rentals', 'swaps'].includes(params.tab as string)) {
      setActiveTab(params.tab as any);
    }
  }, [params.tab]);

  const loadAllData = useCallback(async (force = false) => {
    try {
      await hydrateLists();
      await refreshOrders(force);
    } catch {
      // keep whatever is on screen
    } finally {
      setFetchSettled(true);
      setRefreshing(false);
    }
  }, []);

  // Skips the network when the data is < 30s old (mutations below force a refresh)
  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    hapticFeedback.light();
    loadAllData(true);
  };

  // Helper to open chat
  const handleOpenChat = async (
    otherUserId: string,
    garmentId?: string,
    extra?: { orderId?: string; swapId?: string; rentalId?: string; type?: string }
  ) => {
    if (!otherUserId) return;
    try {
      const conv = await messageService.getOrCreateConversation(otherUserId, garmentId, extra);
      router.push(`/messages/${conv.id}` as any);
    } catch {
      router.push('/(tabs)/messages' as any);
    }
  };

  // Actions for Orders
  const handleMarkShipped = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      await trackingService.markOrderShipped(orderId);
      invalidateCache(['/orders', '/users/me/wardrobe']);
      Alert.alert('Success', 'Order marked as shipped. Buyer has been notified!');
      loadAllData(true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not mark order shipped.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      await trackingService.markOrderDelivered(orderId);
      invalidateCache(['/orders', '/users/me/wardrobe', '/impact']);
      loadAllData(true);
      Alert.alert(
        'Delivery Confirmed',
        'Garment delivery confirmed! Would you like to review and rate the seller now?',
        [
          { text: 'LATER', style: 'cancel' },
          {
            text: 'REVIEW SELLER',
            onPress: () => router.push(`/(tabs)/shop/orders/${orderId}?review=true` as any),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not confirm delivery.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Actions for Rentals
  const handleDispatchRental = async (rentalId: string) => {
    setActionLoadingId(rentalId);
    try {
      await trackingService.dispatchRental(rentalId);
      invalidateCache(['/rentals', '/users/me/wardrobe']);
      Alert.alert('Shipped', 'Rental is now active. The renter has been told.');
      loadAllData(true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not mark the rental as shipped.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReturnRental = async (rentalId: string) => {
    setActionLoadingId(rentalId);
    try {
      await trackingService.returnRental(rentalId);
      invalidateCache(['/rentals', '/users/me/wardrobe']);
      Alert.alert('Returned', 'Garment marked as returned. Lender will inspect and release deposit.');
      loadAllData(true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not mark rental returned.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReleaseDeposit = async (rentalId: string) => {
    setActionLoadingId(rentalId);
    try {
      await trackingService.releaseRentalDeposit(rentalId);
      invalidateCache(['/rentals', '/users/me/wardrobe']);
      Alert.alert('Released', 'Security deposit has been refunded to borrower.');
      loadAllData(true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not release deposit.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered Orders
  const currentOrders = ordersList.filter((o) => {
    if (ordersRole === 'buyer') return o.buyerId === user?.id;
    return o.sellerId === user?.id;
  });

  // Filtered Rentals
  const currentRentals = rentalsList.filter((r) => {
    if (rentalsRole === 'renter') return r.renterId === user?.id;
    return r.garment?.sellerId === user?.id;
  });

  // Filtered Swaps
  const currentSwaps = swapsList.filter((s) => {
    const isDone = s.status === 'COMPLETED' || s.status === 'REJECTED' || s.status === 'CANCELLED';
    if (swapsFilter === 'completed') return isDone;
    if (swapsFilter === 'action') return !isDone;
    return true;
  });


  const latest = useRef<Record<string, any>>({});
  latest.current = { handleOpenChat, handleMarkShipped, handleMarkDelivered, handleDispatchRental, handleReturnRental, handleReleaseDeposit };
  const rowHandlers = useMemo<RowHandlers>(() => ({
      handleOpenChat: (...a: any[]) => (latest.current as any).handleOpenChat(...a),
      handleMarkShipped: (...a: any[]) => (latest.current as any).handleMarkShipped(...a),
      handleMarkDelivered: (...a: any[]) => (latest.current as any).handleMarkDelivered(...a),
      handleDispatchRental: (...a: any[]) => (latest.current as any).handleDispatchRental(...a),
      handleReturnRental: (...a: any[]) => (latest.current as any).handleReturnRental(...a),
      handleReleaseDeposit: (...a: any[]) => (latest.current as any).handleReleaseDeposit(...a),
  }), []);

  const listData: any[] = activeTab === 'orders' ? currentOrders : activeTab === 'rentals' ? currentRentals : currentSwaps;

  const renderCard = useCallback(
    ({ item }: { item: any }) => {
      const busy = actionLoadingId === item.id ? item.id : null;
      if (activeTab === 'orders') return <OrderCard order={item} userId={user?.id} actionLoadingId={busy} h={rowHandlers} router={router} />;
      if (activeTab === 'rentals') return <RentalCard rental={item} userId={user?.id} actionLoadingId={busy} h={rowHandlers} router={router} />;
      return <SwapCard swap={item} userId={user?.id} actionLoadingId={busy} h={rowHandlers} router={router} />;
    },
    [activeTab, actionLoadingId, user?.id, rowHandlers, router]
  );

  const listHeader = activeTab === 'orders' ? (
            <View style={styles.roleToggleRow}>
              <TouchableOpacity
                style={[styles.rolePill, ordersRole === 'buyer' && styles.rolePillActive]}
                onPress={() => handleSelectRole(() => setOrdersRole('buyer'))}
              >
                <SolarIcon
                  name="bag-handle-outline"
                  size={14}
                  color={ordersRole === 'buyer' ? colors.cream : colors.charcoal}
                />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                  style={[
                    styles.rolePillText,
                    ordersRole === 'buyer' && styles.rolePillTextActive,
                  ]}
                >
                  I'M BUYING ({ordersList.filter((o) => o.buyerId === user?.id).length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rolePill, ordersRole === 'seller' && styles.rolePillActive]}
                onPress={() => handleSelectRole(() => setOrdersRole('seller'))}
              >
                <SolarIcon
                  name="pricetag-outline"
                  size={14}
                  color={ordersRole === 'seller' ? colors.cream : colors.charcoal}
                />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                  style={[
                    styles.rolePillText,
                    ordersRole === 'seller' && styles.rolePillTextActive,
                  ]}
                >
                  I'M SELLING ({ordersList.filter((o) => o.sellerId === user?.id).length})
                </Text>
              </TouchableOpacity>
            </View>
  ) : activeTab === 'rentals' ? (
            <View style={styles.roleToggleRow}>
              <TouchableOpacity
                style={[styles.rolePill, rentalsRole === 'renter' && styles.rolePillActive]}
                onPress={() => handleSelectRole(() => setRentalsRole('renter'))}
              >
                <SolarIcon
                  name="key-outline"
                  size={14}
                  color={rentalsRole === 'renter' ? colors.cream : colors.charcoal}
                />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                  style={[
                    styles.rolePillText,
                    rentalsRole === 'renter' && styles.rolePillTextActive,
                  ]}
                >
                  BORROWED (I'M RENTING) (
                  {rentalsList.filter((r) => r.renterId === user?.id).length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rolePill, rentalsRole === 'lender' && styles.rolePillActive]}
                onPress={() => handleSelectRole(() => setRentalsRole('lender'))}
              >
                <SolarIcon
                  name="shield-checkmark-outline"
                  size={14}
                  color={rentalsRole === 'lender' ? colors.cream : colors.charcoal}
                />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                  style={[
                    styles.rolePillText,
                    rentalsRole === 'lender' && styles.rolePillTextActive,
                  ]}
                >
                  LENT OUT (MY PIECES) (
                  {rentalsList.filter((r) => r.garment?.sellerId === user?.id).length})
                </Text>
              </TouchableOpacity>
            </View>

  ) : (
            <View style={styles.roleToggleRow}>
              <TouchableOpacity
                style={[styles.rolePill, swapsFilter === 'all' && styles.rolePillActive]}
                onPress={() => handleSelectRole(() => setSwapsFilter('all'))}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                  style={[
                    styles.rolePillText,
                    swapsFilter === 'all' && styles.rolePillTextActive,
                  ]}
                >
                  ALL ({swapsList.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rolePill, swapsFilter === 'action' && styles.rolePillActive]}
                onPress={() => handleSelectRole(() => setSwapsFilter('action'))}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                  style={[
                    styles.rolePillText,
                    swapsFilter === 'action' && styles.rolePillTextActive,
                  ]}
                >
                  IN PROGRESS
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rolePill, swapsFilter === 'completed' && styles.rolePillActive]}
                onPress={() => handleSelectRole(() => setSwapsFilter('completed'))}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                  style={[
                    styles.rolePillText,
                    swapsFilter === 'completed' && styles.rolePillTextActive,
                  ]}
                >
                  COMPLETED
                </Text>
              </TouchableOpacity>
            </View>

  );

  const listEmpty = activeTab === 'orders' ? (
              <View style={styles.emptyState}>
                <SolarIcon name="receipt-outline" size={44} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>NO ORDERS FOUND</Text>
                <Text style={styles.emptySub}>
                  {ordersRole === 'buyer'
                    ? 'Browse the shop to find something you like.'
                    : 'List your items to start getting orders.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() =>
                    ordersRole === 'buyer'
                      ? router.push('/(tabs)/shop')
                      : router.push('/(tabs)/shop/sell')
                  }
                >
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.emptyBtnText}>
                    {ordersRole === 'buyer' ? 'EXPLORE SHOP →' : 'LIST A GARMENT →'}
                  </Text>
                </TouchableOpacity>
              </View>
  ) : activeTab === 'rentals' ? (
              <View style={styles.emptyState}>
                <SolarIcon name="calendar-outline" size={44} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>NO RENTALS FOUND</Text>
                <Text style={styles.emptySub}>
                  {rentalsRole === 'renter'
                    ? 'Browse items you can rent for a few days.'
                    : 'List your clothes for rent to earn money.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() =>
                    rentalsRole === 'renter'
                      ? router.push('/(tabs)/rental')
                      : router.push('/(tabs)/shop/sell')
                  }
                >
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.emptyBtnText}>
                    {rentalsRole === 'renter' ? 'BROWSE RENTALS →' : 'LIST FOR RENTAL →'}
                  </Text>
                </TouchableOpacity>
              </View>
  ) : (
              <View style={styles.emptyState}>
                <SolarIcon name="swap-horizontal" size={44} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>NO SWAP EXCHANGES</Text>
                <Text style={styles.emptySub}>
                  Browse accessories you can swap. No cash needed.
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push('/(tabs)/swap')}
                >
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.emptyBtnText}>BROWSE SWAPS →</Text>
                </TouchableOpacity>
              </View>
  );

  if (loading) {
    return <Loader variant="order" />;
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back"
            style={styles.backButton}
            onPress={() => safeBack('/(tabs)/profile')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <SolarIcon name="arrow-back" size={22} color={colors.charcoal} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>MY ORDERS</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* PRIMARY CATEGORY TABS */}
        <View style={styles.primaryTabs}>
          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'orders' && styles.primaryTabActive]}
            onPress={() => handleSelectTab('orders')}
          >
            <SolarIcon name="bag-check-outline" size={13} color={activeTab === 'orders' ? colors.cream : colors.charcoal} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.primaryTabText, activeTab === 'orders' && styles.primaryTabTextActive]}>
              SALES
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'rentals' && styles.primaryTabActive]}
            onPress={() => handleSelectTab('rentals')}
          >
            <SolarIcon name="calendar-outline" size={13} color={activeTab === 'rentals' ? colors.cream : colors.charcoal} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.primaryTabText, activeTab === 'rentals' && styles.primaryTabTextActive]}>
              RENTALS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'swaps' && styles.primaryTabActive]}
            onPress={() => handleSelectTab('swaps')}
          >
            <SolarIcon name="swap-horizontal-outline" size={13} color={activeTab === 'swaps' ? colors.cream : colors.charcoal} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.primaryTabText, activeTab === 'swaps' && styles.primaryTabTextActive]}>
              SWAPS
            </Text>
          </TouchableOpacity>
        </View>

        {/* SLIM SUMMARY STRIP */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{summary?.orders.buyingActive || 0}</Text>
            <Text style={styles.summaryLbl}>Buying</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{summary?.orders.sellingActive || 0}</Text>
            <Text style={styles.summaryLbl}>Selling</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{(summary?.rentals.borrowingActive || 0) + (summary?.rentals.lendingActive || 0)}</Text>
            <Text style={styles.summaryLbl}>Rentals</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{summary?.swaps.active || 0}</Text>
            <Text style={styles.summaryLbl}>Swaps</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={listData as any[]}
        keyExtractor={rowKey}
        renderItem={renderCard}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        onEndReached={activeTab === 'orders' && hasMoreOrders ? loadMoreOrders : undefined}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
    paddingBottom: 0,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: typography.headings,
    fontSize: 20,
    color: colors.charcoal,
    letterSpacing: 1,
  },
  primaryTabs: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  primaryTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  primaryTabActive: {
    backgroundColor: colors.charcoal,
  },
  primaryTabText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
  },
  primaryTabTextActive: {
    color: colors.cream,
  },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.paperLight,
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNum: {
    fontFamily: typography.mono,
    fontSize: 16,
    fontWeight: '900',
    color: colors.charcoal,
  },
  summaryLbl: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.textMuted,
    marginTop: 1,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.overlayLight,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  roleToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  rolePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    borderRadius: 8,
  },
  rolePillActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  rolePillText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
  },
  rolePillTextActive: {
    color: colors.cream,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.paper,
    paddingBottom: 10,
    marginBottom: 12,
  },
  orderIdLabel: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  orderDate: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusTag: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusTagText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.cream,
  },
  cardBody: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  garmentThumb: {
    width: 68,
    height: 84,
    borderRadius: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.overlayLight,
  },
  garmentInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  garmentBrand: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.textMuted,
  },
  garmentTitle: {
    fontFamily: typography.headings,
    fontSize: 16,
    color: colors.charcoal,
    marginVertical: 2,
  },
  garmentPrice: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '900',
    color: colors.red,
  },
  counterpartyText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
    marginTop: 4,
  },
  stepperContainer: {
    backgroundColor: colors.paperLight,
    borderWidth: 1,
    borderColor: colors.paper,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginBottom: 12,
  },
  escrowNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.emeraldLight,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  escrowNoticeText: {
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: '800',
    color: colors.forest,
    letterSpacing: 0.5,
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chatActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    backgroundColor: colors.paperLight,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    borderRadius: 8,
  },
  chatActionText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
  },
  detailActionBtn: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    borderRadius: 8,
  },
  detailActionText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
  },
  primaryActionBtn: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.charcoal,
    borderRadius: 8,
  },
  primaryActionText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.cream,
  },
  trackActionBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 38,
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.charcoal,
    borderRadius: 8,
  },
  trackActionText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.cream,
  },
  reviewActionBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 38,
    backgroundColor: colors.terracottaLight,
    borderWidth: 1,
    borderColor: colors.orange,
    borderRadius: 8,
  },
  reviewActionText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.orange,
  },
  viewChevronCol: {
    justifyContent: 'center',
    paddingLeft: 4,
  },
  itemInspectHint: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.red,
    marginTop: 4,
  },

  // Swap Comparison Styling
  swapComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: colors.paperLight,
    padding: 10,
    borderRadius: 8,
  },
  swapItemCol: {
    flex: 1,
    alignItems: 'center',
  },
  swapThumb: {
    width: 60,
    height: 72,
    borderRadius: 6,
    backgroundColor: colors.paperDark,
    marginBottom: 4,
  },
  swapRoleLabel: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.textMuted,
  },
  swapItemTitle: {
    fontFamily: typography.headings,
    fontSize: 13,
    color: colors.charcoal,
    textAlign: 'center',
  },
  estValueBadge: {
    backgroundColor: colors.paper,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  estValueText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
  },
  swapArrowCol: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  swapCashlessBadge: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.red,
    marginTop: 2,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    borderRadius: 12,
  },
  emptyTitle: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.charcoal,
    marginTop: 12,
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyBtnText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.cream,
  },
});
