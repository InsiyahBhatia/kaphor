import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { OrderTrackerStepper } from '../../../src/components/orders/OrderTrackerStepper';
import { EstTradeValueBadge } from '../../../src/components/orders/EstTradeValueBadge';
import { FairValueMatcher } from '../../../src/components/orders/FairValueMatcher';
import { trackingService, OrdersSummaryData, RentalItem } from '../../../src/services/trackingService';
import { TransactionOrder } from '../../../src/services/orderService';
import { messageService } from '../../../src/services/messageService';
import { useAuth } from '../../../src/context/AuthContext';
import { colors, typography } from '../../../src/theme';
import { hapticFeedback } from '../../../src/utils/haptics';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';

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

  // Data states
  const [summary, setSummary] = useState<OrdersSummaryData | null>(null);
  const [ordersList, setOrdersList] = useState<TransactionOrder[]>([]);
  const [rentalsList, setRentalsList] = useState<RentalItem[]>([]);
  const [swapsList, setSwapsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // If query params specify tab, sync it
  useEffect(() => {
    if (params.tab && ['orders', 'rentals', 'swaps'].includes(params.tab as string)) {
      setActiveTab(params.tab as any);
    }
  }, [params.tab]);

  const loadAllData = useCallback(async () => {
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
    } catch {
      // Fallback empty
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    hapticFeedback.light();
    loadAllData();
  };

  // Helper to open chat
  const handleOpenChat = async (otherUserId: string, garmentId?: string) => {
    if (!otherUserId) return;
    try {
      const conv = await messageService.getOrCreateConversation(otherUserId, garmentId);
      router.push(`/messages/${conv.id}` as any);
    } catch {
      router.push('/messages' as any);
    }
  };

  // Actions for Orders
  const handleMarkShipped = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      await trackingService.markOrderShipped(orderId);
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
      Alert.alert('Confirmed', 'Delivery confirmed! Ownership transferred.');
      loadAllData();
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
      Alert.alert('Dispatched', 'Rental is now active. Renter has been notified.');
      loadAllData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not mark rental dispatched.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReturnRental = async (rentalId: string) => {
    setActionLoadingId(rentalId);
    try {
      await trackingService.returnRental(rentalId);
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
      Alert.alert('Deposit Released', 'Security deposit has been refunded to renter.');
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
    return <DossierLoading variant="order" />;
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => safeBack('/(tabs)/profile')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>MANAGE ALL ORDERS</Text>
            <Text style={styles.headerSubtitle}>TRACKING & TRANSACTION DOSSIER</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* METRIC PILLS */}
        <View style={styles.metricRow}>
          <View style={styles.metricBadge}>
            <Text style={styles.metricCount}>{summary?.orders.buyingActive || 0}</Text>
            <Text style={styles.metricLabel}>PURCHASES</Text>
          </View>
          <View style={styles.metricBadge}>
            <Text style={styles.metricCount}>{summary?.orders.sellingActive || 0}</Text>
            <Text style={styles.metricLabel}>SALES</Text>
          </View>
          <View style={styles.metricBadge}>
            <Text style={styles.metricCount}>
              {(summary?.rentals.borrowingActive || 0) + (summary?.rentals.lendingActive || 0)}
            </Text>
            <Text style={styles.metricLabel}>RENTALS</Text>
          </View>
          <View style={styles.metricBadge}>
            <Text style={styles.metricCount}>{summary?.swaps.active || 0}</Text>
            <Text style={styles.metricLabel}>SWAPS</Text>
          </View>
        </View>

        {/* PRIMARY CATEGORY TABS */}
        <View style={styles.primaryTabs}>
          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'orders' && styles.primaryTabActive]}
            onPress={() => {
              hapticFeedback.selection();
              setActiveTab('orders');
            }}
          >
            <Text
              style={[
                styles.primaryTabText,
                activeTab === 'orders' && styles.primaryTabTextActive,
              ]}
            >
              PURCHASES & SALES
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'rentals' && styles.primaryTabActive]}
            onPress={() => {
              hapticFeedback.selection();
              setActiveTab('rentals');
            }}
          >
            <Text
              style={[
                styles.primaryTabText,
                activeTab === 'rentals' && styles.primaryTabTextActive,
              ]}
            >
              RENTALS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryTab, activeTab === 'swaps' && styles.primaryTabActive]}
            onPress={() => {
              hapticFeedback.selection();
              setActiveTab('swaps');
            }}
          >
            <Text
              style={[
                styles.primaryTabText,
                activeTab === 'swaps' && styles.primaryTabTextActive,
              ]}
            >
              SWAPS
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ═══════════════════════════════════════════════ */}
        {/* TAB 1: PURCHASES & SALES                        */}
        {/* ═══════════════════════════════════════════════ */}
        {activeTab === 'orders' && (
          <View>
            {/* ROLE TOGGLE */}
            <View style={styles.roleToggleRow}>
              <TouchableOpacity
                style={[styles.rolePill, ordersRole === 'buyer' && styles.rolePillActive]}
                onPress={() => {
                  hapticFeedback.selection();
                  setOrdersRole('buyer');
                }}
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
                onPress={() => {
                  hapticFeedback.selection();
                  setOrdersRole('seller');
                }}
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
                    ? 'Explore the Shop Deck to find curated heritage pieces.'
                    : 'List your designer archive to start receiving orders.'}
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
                          order.status === 'DELIVERED' && { backgroundColor: '#2E7D32' },
                          order.status === 'SHIPPED' && { backgroundColor: '#1C2B4A' },
                          order.status === 'CONFIRMED' && { backgroundColor: colors.charcoal },
                        ]}
                      >
                        <Text style={styles.statusTagText}>{order.status}</Text>
                      </View>
                    </View>

                    {/* ITEM ROW */}
                    <View style={styles.cardBody}>
                      <KaphorImage uri={thumb} style={styles.garmentThumb} contentFit="cover" />
                      <View style={styles.garmentInfo}>
                        <Text style={styles.garmentBrand} numberOfLines={1}>
                          {firstItem?.garment?.brand || 'ARCHIVE'}
                        </Text>
                        <Text style={styles.garmentTitle} numberOfLines={2}>
                          {firstItem?.garment?.title || 'Heritage Piece'}
                        </Text>
                        <Text style={styles.garmentPrice}>
                          ₹{(order.totalAmount || 0).toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.counterpartyText}>
                          {isBuyer ? 'SELLER' : 'BUYER'}: {otherParty?.displayName || otherParty?.username}
                        </Text>
                      </View>
                    </View>

                    {/* TRACKER STEPPER */}
                    <View style={styles.stepperContainer}>
                      <OrderTrackerStepper type="SALE" status={order.status} />
                    </View>

                    {/* ACTION BUTTONS */}
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        style={styles.chatActionBtn}
                        onPress={() => handleOpenChat(otherParty?.id, firstItem?.garment?.id)}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.charcoal} />
                        <Text style={styles.chatActionText}>CHAT</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.detailActionBtn}
                        onPress={() => router.push(`/(tabs)/shop/orders/${order.id}` as any)}
                      >
                        <Text style={styles.detailActionText}>VIEW DETAILS</Text>
                      </TouchableOpacity>

                      {/* Role Specific Fulfillment CTAs */}
                      {!isBuyer && order.status === 'CONFIRMED' && (
                        <TouchableOpacity
                          style={styles.primaryActionBtn}
                          onPress={() => handleMarkShipped(order.id)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <ActivityIndicator size="small" color={colors.cream} />
                          ) : (
                            <Text style={styles.primaryActionText}>MARK SHIPPED</Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {isBuyer && order.status === 'SHIPPED' && (
                        <TouchableOpacity
                          style={[styles.primaryActionBtn, { backgroundColor: '#2E7D32', borderColor: '#2E7D32' }]}
                          onPress={() => handleMarkDelivered(order.id)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <ActivityIndicator size="small" color={colors.cream} />
                          ) : (
                            <Text style={styles.primaryActionText}>CONFIRM DELIVERED</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* TAB 2: RENTALS (BORROWER & LENDER)              */}
        {/* ═══════════════════════════════════════════════ */}
        {activeTab === 'rentals' && (
          <View>
            {/* ROLE TOGGLE */}
            <View style={styles.roleToggleRow}>
              <TouchableOpacity
                style={[styles.rolePill, rentalsRole === 'renter' && styles.rolePillActive]}
                onPress={() => {
                  hapticFeedback.selection();
                  setRentalsRole('renter');
                }}
              >
                <Ionicons
                  name="key-outline"
                  size={14}
                  color={rentalsRole === 'renter' ? colors.cream : colors.charcoal}
                />
                <Text
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
                onPress={() => {
                  hapticFeedback.selection();
                  setRentalsRole('lender');
                }}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={14}
                  color={rentalsRole === 'lender' ? colors.cream : colors.charcoal}
                />
                <Text
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

            {currentRentals.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={44} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>NO RENTALS FOUND</Text>
                <Text style={styles.emptySub}>
                  {rentalsRole === 'renter'
                    ? 'Explore available archive pieces to lease for short term.'
                    : 'List your luxury garments for rental to earn circular revenue.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() =>
                    rentalsRole === 'renter'
                      ? router.push('/(tabs)/rental')
                      : router.push('/(tabs)/shop/sell')
                  }
                >
                  <Text style={styles.emptyBtnText}>
                    {rentalsRole === 'renter' ? 'BROWSE RENTALS →' : 'LIST FOR RENTAL →'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              currentRentals.map((rental) => {
                const isRenter = rental.renterId === user?.id;
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
                  <TouchableOpacity
                    key={rental.id}
                    style={styles.card}
                    onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}` as any)}
                    activeOpacity={0.92}
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
                          rental.status === 'ACTIVE' && { backgroundColor: '#1C2B4A' },
                          rental.status === 'RETURNED' && { backgroundColor: '#2E7D32' },
                          rental.status === 'RESERVED' && { backgroundColor: colors.copper },
                        ]}
                      >
                        <Text style={styles.statusTagText}>{rental.status}</Text>
                      </View>
                    </View>

                    {/* ITEM ROW */}
                    <View style={styles.cardBody}>
                      <KaphorImage uri={thumb} style={styles.garmentThumb} contentFit="cover" />
                      <View style={styles.garmentInfo}>
                        <Text style={styles.garmentBrand} numberOfLines={1}>
                          {rental.garment?.brand || 'CURATED LEASE'}
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
                    </View>

                    {/* STEPPER */}
                    <View style={styles.stepperContainer}>
                      <OrderTrackerStepper type="RENTAL" status={rental.status} />
                    </View>

                    {/* ESCROW GUARANTEE BANNER */}
                    <View style={styles.escrowNotice}>
                      <Ionicons name="shield-checkmark" size={14} color="#2E7D32" />
                      <Text style={styles.escrowNoticeText}>
                        ₹299 Refundable Deposit Protected in Escrow
                      </Text>
                    </View>

                    {/* ACTIONS */}
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        style={styles.chatActionBtn}
                        onPress={() =>
                          handleOpenChat(
                            isRenter ? rental.garment?.sellerId : rental.renterId,
                            rental.garmentId
                          )
                        }
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.charcoal} />
                        <Text style={styles.chatActionText}>CHAT</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.detailActionBtn}
                        onPress={() => router.push(`/(tabs)/rental/lease/${rental.id}` as any)}
                      >
                        <Text style={styles.detailActionText}>LEASE DOSSIER</Text>
                      </TouchableOpacity>

                      {/* LENDER: Mark Dispatched */}
                      {!isRenter && rental.status === 'RESERVED' && (
                        <TouchableOpacity
                          style={styles.primaryActionBtn}
                          onPress={() => handleDispatchRental(rental.id)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <ActivityIndicator size="small" color={colors.cream} />
                          ) : (
                            <Text style={styles.primaryActionText}>MARK DISPATCHED</Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {/* RENTER: Mark Returned */}
                      {isRenter && (rental.status === 'RESERVED' || rental.status === 'ACTIVE') && (
                        <TouchableOpacity
                          style={[styles.primaryActionBtn, { backgroundColor: colors.charcoal }]}
                          onPress={() => handleReturnRental(rental.id)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <ActivityIndicator size="small" color={colors.cream} />
                          ) : (
                            <Text style={styles.primaryActionText}>MARK RETURNED</Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {/* LENDER: Release Deposit */}
                      {!isRenter && rental.status === 'RETURNED' && (
                        <TouchableOpacity
                          style={[styles.primaryActionBtn, { backgroundColor: '#2E7D32', borderColor: '#2E7D32' }]}
                          onPress={() => handleReleaseDeposit(rental.id)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <ActivityIndicator size="small" color={colors.cream} />
                          ) : (
                            <Text style={styles.primaryActionText}>RELEASE DEPOSIT</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* TAB 3: SWAPS (BARTER EXCHANGES)                 */}
        {/* ═══════════════════════════════════════════════ */}
        {activeTab === 'swaps' && (
          <View>
            {/* SUB FILTER */}
            <View style={styles.roleToggleRow}>
              <TouchableOpacity
                style={[styles.rolePill, swapsFilter === 'all' && styles.rolePillActive]}
                onPress={() => {
                  hapticFeedback.selection();
                  setSwapsFilter('all');
                }}
              >
                <Text
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
                onPress={() => {
                  hapticFeedback.selection();
                  setSwapsFilter('action');
                }}
              >
                <Text
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
                onPress={() => {
                  hapticFeedback.selection();
                  setSwapsFilter('completed');
                }}
              >
                <Text
                  style={[
                    styles.rolePillText,
                    swapsFilter === 'completed' && styles.rolePillTextActive,
                  ]}
                >
                  COMPLETED
                </Text>
              </TouchableOpacity>
            </View>

            {currentSwaps.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="swap-horizontal" size={44} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>NO SWAP EXCHANGES</Text>
                <Text style={styles.emptySub}>
                  Browse the Accessory Deck to discover luxury pieces ready for cashless trade.
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push('/(tabs)/swap')}
                >
                  <Text style={styles.emptyBtnText}>BROWSE SWAPS →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              currentSwaps.map((swap) => {
                const isInitiator = swap.initiatorId === user?.id;
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
                        <Text style={styles.statusTagText}>{swap.compositeStatus || swap.status}</Text>
                      </View>
                    </View>

                    {/* DUAL ITEM COMPARISON */}
                    <View style={styles.swapComparisonRow}>
                      <View style={styles.swapItemCol}>
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
                      </View>

                      <View style={styles.swapArrowCol}>
                        <Ionicons name="swap-horizontal" size={24} color={colors.charcoal} />
                        <Text style={styles.swapCashlessBadge}>CASHLESS</Text>
                      </View>

                      <View style={styles.swapItemCol}>
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
                      </View>
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
                        onPress={() => handleOpenChat(partner?.id, wantedGarment?.id || offeredGarment?.id)}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.charcoal} />
                        <Text style={styles.chatActionText}>CHAT</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.primaryActionBtn, { flex: 2 }]}
                        onPress={() => router.push(`/(tabs)/swap/details?swapId=${swap.id}` as any)}
                      >
                        <Text style={styles.primaryActionText}>MANAGE SWAP DOSSIER →</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    backgroundColor: colors.cream,
    borderBottomWidth: 2,
    borderBottomColor: colors.charcoal,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.charcoal,
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.red,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricBadge: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  metricCount: {
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '900',
    color: colors.charcoal,
  },
  metricLabel: {
    fontFamily: typography.mono,
    fontSize: 7,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  primaryTabs: {
    flexDirection: 'row',
    backgroundColor: '#EBE7DE',
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
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  primaryTabTextActive: {
    color: colors.cream,
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
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 6,
  },
  rolePillActive: {
    backgroundColor: colors.charcoal,
  },
  rolePillText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  rolePillTextActive: {
    color: colors.cream,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9DE',
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
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusTag: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusTagText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  cardBody: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  garmentThumb: {
    width: 68,
    height: 84,
    borderRadius: 6,
    backgroundColor: '#F0ECE1',
    borderWidth: 1,
    borderColor: '#D8D4C8',
  },
  garmentInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  garmentBrand: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '800',
    letterSpacing: 0.8,
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
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.charcoal,
    fontWeight: '700',
    marginTop: 4,
  },
  stepperContainer: {
    backgroundColor: '#FAF8F3',
    borderWidth: 1,
    borderColor: '#ECE8DD',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginBottom: 12,
  },
  escrowNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 12,
  },
  escrowNoticeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: '#2E7D32',
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
    backgroundColor: '#F5F3ED',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 6,
  },
  chatActionText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  detailActionBtn: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 6,
  },
  detailActionText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  primaryActionBtn: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    backgroundColor: colors.charcoal,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 6,
  },
  primaryActionText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.8,
  },

  // Swap Comparison Styling
  swapComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#F8F6F0',
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
    backgroundColor: '#EBE7DE',
    marginBottom: 4,
  },
  swapRoleLabel: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    fontWeight: '800',
  },
  swapItemTitle: {
    fontFamily: typography.headings,
    fontSize: 13,
    color: colors.charcoal,
    textAlign: 'center',
  },
  estValueBadge: {
    backgroundColor: '#EDE9DE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  estValueText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
    color: colors.charcoal,
  },
  swapArrowCol: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  swapCashlessBadge: {
    fontFamily: typography.mono,
    fontSize: 7,
    fontWeight: '900',
    color: colors.red,
    marginTop: 2,
    letterSpacing: 0.5,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderRadius: 10,
  },
  emptyTitle: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.charcoal,
    marginTop: 12,
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  emptyBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 1,
  },
});
