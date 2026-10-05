import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Keyboard,
  Modal,
} from 'react-native';
import { getOrderSeed } from '../../../../src/store/listStore';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SolarIcon } from '../../../../src/components/common/SolarIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../../../../src/theme';
import { orderService, TransactionOrder, OrderMessage, ShippingAddress } from '../../../../src/services/orderService';
import { messageService } from '../../../../src/services/messageService';
import paymentService from '../../../../src/services/paymentService';
import api, { invalidateCache } from '../../../../src/services/api';
import { useAuth } from '../../../../src/context/AuthContext';
import { safeBack, useBackHandler } from '../../../../src/utils/navigation';
import { KaphorImage } from '../../../../src/components/KaphorImage';
import { hapticFeedback } from '../../../../src/utils/haptics';
import { Spinner, Loader } from '../../../../src/components/common/Loader';
import { peek, hydrate } from '../../../../src/utils/swrCache';

const statusConfig = {
  PENDING:    { label: 'AWAITING PAYMENT',   color: colors.red,        icon: 'time-outline' },
  CONFIRMED:  { label: 'PAID · COORDINATE',  color: colors.forest,     icon: 'checkmark-circle-outline' },
  SHIPPED:    { label: 'SHIPPED',             color: colors.ink,        icon: 'cube-outline' },
  DELIVERED:  { label: 'DELIVERED',           color: colors.forest,    icon: 'checkmark-done-outline' },
  CANCELLED:  { label: 'CANCELLED',           color: colors.red,       icon: 'close-circle-outline' },
  REFUNDED:   { label: 'REFUNDED',            color: colors.textMuted, icon: 'cash-outline' },
} as const;

const timelineSteps = [
  { key: 'CONFIRMED',  label: 'Confirmed' },
  { key: 'SHIPPED',    label: 'Shipped' },
  { key: 'DELIVERED',  label: 'Delivered' },
];

// ── Instant-paint session cache ─────────────────────────────────
// The last viewed copy of each order thread is kept in memory so reopening a
// tracking screen paints immediately and revalidates in the background
// (stale-while-revalidate), instead of staring at a full-screen spinner.
const orderThreadCache = new Map<string, { order: TransactionOrder; messages: OrderMessage[]; ts: number }>();

function AddressCard({ address }: { address: ShippingAddress }) {
  return (
    <View style={styles.addressCard}>
      {/* Top accent + label */}
      <View style={styles.addressHeader}>
        <View style={styles.addressAccent} />
        <View style={styles.addressTopRow}>
          <View style={styles.addressLabelBadge}>
            <SolarIcon name="location" size={12} color={colors.cream} />
            <Text style={styles.addressLabelText}>
              {address.label?.toUpperCase() || 'SHIPPING ADDRESS'}
            </Text>
          </View>
        </View>
      </View>

      {/* Body */}
      <View style={styles.addressBody}>
        {/* Full name + phone row */}
        <View style={styles.nameRow}>
          <SolarIcon name="person-outline" size={14} color={colors.charcoal} style={{ marginRight: 6 }} />
          <Text style={styles.nameText}>{address.fullName}</Text>
        </View>
        {address.phone && (
          <View style={styles.detailRow}>
            <SolarIcon name="call-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={styles.detailText}>{address.phone}</Text>
          </View>
        )}

        {/* Divider */}
        <View style={styles.addressDivider} />

        {/* Address lines */}
        <View style={styles.detailRow}>
          <SolarIcon name="home-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailText}>{address.line1}</Text>
            {address.line2 ? <Text style={styles.detailText}>{address.line2}</Text> : null}
          </View>
        </View>
        {address.landmark && (
          <View style={styles.detailRow}>
            <SolarIcon name="compass-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={styles.detailText}>Near {address.landmark}</Text>
          </View>
        )}

        {/* City, State, Pincode */}
        <View style={styles.detailRow}>
          <SolarIcon name="map-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.detailText}>
            {address.city}, {address.state} — {address.pincode}
          </Text>
        </View>
      </View>
    </View>
  );
}

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const statusOrder = ['CONFIRMED', 'SHIPPED', 'DELIVERED'];
  const currentIdx = statusOrder.indexOf(currentStatus);

  return (
    <View style={styles.timelineContainer}>
      {timelineSteps.map((step, idx) => {
        const isCompleted = currentIdx >= idx;
        const isCurrent = step.key === currentStatus;
        const isLast = idx === timelineSteps.length - 1;
        return (
          <View key={step.key} style={styles.timelineRow}>
            <View style={styles.timelineCol}>
              {!isLast && (
                <View style={[styles.timelineVertLine, isCompleted && styles.timelineVertLineDone]} />
              )}
              <View
                style={[
                  styles.timelineDot,
                  isCompleted && styles.timelineDotDone,
                  isCurrent && styles.timelineDotCurrent,
                ]}
              >
                {isCompleted ? (
                  <SolarIcon name="checkmark" size={10} color={colors.cream} />
                ) : (
                  <View style={styles.timelineDotEmpty} />
                )}
              </View>
            </View>
            <View style={styles.timelineContent}>
              <Text style={[styles.timelineLabel, isCompleted && styles.timelineLabelDone]}>
                {step.label}
              </Text>
              {isCurrent && currentStatus !== 'DELIVERED' && (
                <Text style={styles.timelineHint}>In progress</Text>
              )}
              {isCompleted && (
                <Text style={styles.timelineDate}>Completed</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function OrderThreadScreen() {
  const { orderId, review } = useLocalSearchParams<{ orderId: string; review?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  useBackHandler('/(tabs)/orders');
  // Seed from the session cache so a revisit renders the thread with zero network wait
  const cachedThread = orderId ? orderThreadCache.get(orderId) : undefined;
  const [order, setOrder] = useState<TransactionOrder | null>(cachedThread?.order ?? getOrderSeed(orderId) ?? null);
  const [messages, setMessages] = useState<OrderMessage[]>(cachedThread?.messages ?? []);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(!cachedThread && !getOrderSeed(orderId));
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(review === 'true');
  const [addressExpanded, setAddressExpanded] = useState(true);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (review === 'true') {
      setReviewModalVisible(true);
    }
  }, [review]);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadAll = useCallback(async (force = false) => {
    if (!orderId) return;
    const hit = orderThreadCache.get(orderId);
    if (!force && hit && Date.now() - hit.ts < 30_000) {
      setLoading(false);
      return;
    }
    try {
      const [o, msgs] = await Promise.all([
        orderService.getOrder(orderId),
        orderService.getMessages(orderId).catch(() => [] as OrderMessage[]),
      ]);
      setOrder(o);
      setMessages(msgs);
      orderThreadCache.set(orderId, { order: o, messages: msgs, ts: Date.now() });
    } catch {
      // Only show the error state when we have nothing cached to display
      if (!orderThreadCache.has(orderId)) setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Cold-start seed: reuse the order copy cached by the orders tracking hub so the
  // screen renders its data immediately, then loadAll() revalidates over the network.
  useEffect(() => {
    if (!orderId || order) return;
    const seed = (c: any) => {
      const hit = (c?.ords as TransactionOrder[] | undefined)?.find((x) => x.id === orderId);
      if (hit) {
        setOrder((cur) => cur ?? hit);
        setLoading(false);
        return true;
      }
      return false;
    };
    if (seed(peek<any>('orders:all'))) return;
    hydrate<any>('orders:all').then((c) => {
      if (c) seed(c);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleApprove = async () => {
    if (!orderId || actionLoading) return;
    setActionLoading(true);
    try {
      await orderService.approveOrder(orderId);
      Alert.alert('Request Approved', 'Buyer has been notified and can now proceed with payment.');
      await loadAll(true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not approve order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = () => {
    if (!orderId || actionLoading) return;
    Alert.alert(
      'Decline Request',
      'Are you sure you want to decline this purchase request? The garment reservation will be released.',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'DECLINE',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await orderService.rejectOrder(orderId);
              Alert.alert('Request Declined', 'Purchase request has been declined.');
              await loadAll(true);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message || 'Could not decline order.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleProceedToPayment = () => {
    if (!order) return;
    if (order.shippingAddress) {
      router.push(`/(tabs)/shop/checkout/${order.id}` as any);
    } else {
      router.push(`/(tabs)/shop/checkout/delivery?orderId=${order.id}` as any);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !orderId) return;
    setSending(true);
    try {
      const msg = await orderService.sendMessage(orderId, text);
      setMessages((m) => [...m, msg]);
      setDraft('');
    } catch (e: any) {
      Alert.alert('Message', e?.response?.data?.message ?? 'Could not send');
    } finally {
      setSending(false);
    }
  };

  const ship = async () => {
    if (!orderId) return;
    try {
      const o = await orderService.markShipped(orderId);
      setOrder(o);
      invalidateCache(['/orders', '/users/me/wardrobe']);
      Alert.alert('Updated', 'Marked as shipped.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not update');
    }
  };

  const deliver = async () => {
    if (!orderId) return;
    try {
      const o = await orderService.markDelivered(orderId);
      setOrder(o);
      invalidateCache(['/orders', '/users/me/wardrobe', '/impact']);
      setReviewModalVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not update');
    }
  };

  const handleCancelRefund = () => {
    if (!order) return;
    const isPaid = order.status === 'CONFIRMED';
    const title = isPaid ? 'Cancel & Refund' : 'Cancel Order';
    const message = isPaid
      ? 'This will cancel the order and start a full refund. The amount will be returned to your original payment method.'
      : 'Are you sure you want to cancel this order?';

    Alert.alert(title, message, [
      { text: 'Keep Order', style: 'cancel' },
      {
        text: isPaid ? 'REFUND' : 'CANCEL',
        style: 'destructive',
        onPress: () => executeCancelRefund(isPaid),
      },
    ]);
  };

  const executeCancelRefund = async (isPaid: boolean) => {
    setLoading(true);
    try {
      if (isPaid) {
        await paymentService.requestRefund({
          orderId: orderId!,
          reason: 'Buyer requested cancellation',
        });
      } else {
        await api.patch(`/orders/${orderId}/cancel`);
      }
      await loadAll(true);
      Alert.alert('Cancelled', isPaid
        ? 'The order has been cancelled and a refund has been started. Funds should appear within 5–7 business days.'
        : 'The order has been cancelled.');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Could not cancel order.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async () => {
    if (!orderId) return;
    setReviewSubmitting(true);
    try {
      await orderService.submitPeerReview(orderId, rating, reviewComment.trim() || undefined);
      await loadAll(true);
      setReviewModalVisible(false);
      Alert.alert('Thank you', 'Your review helps other buyers trust great sellers.');
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || '';
      if (status === 409 || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
        await loadAll(true);
        setReviewModalVisible(false);
        Alert.alert('Review Saved', 'Your review has been saved for this transaction.');
      } else {
        Alert.alert('Review', msg || 'Could not submit review');
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openUnifiedChat = async () => {
    if (!orderId) return;
    try {
      const conv = await messageService.getOrCreateOrderConversation(orderId);
      if (conv?.id) {
        router.push(`/messages/${conv.id}` as any);
      } else {
        router.push('/(tabs)/messages');
      }
    } catch {
      router.push('/(tabs)/messages');
    }
  };

  if ((loading && !order) || !user) {
    return (
      <View style={styles.centered}>
        <Loader variant="order" compact />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <SolarIcon name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.miss, { marginTop: 12 }]}>Order not found</Text>
        <TouchableOpacity 
          style={styles.goBackBtn} 
          onPress={() => safeBack('/(tabs)/orders')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.goBackText}>GO BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isBuyer = user.id === order.buyerId;
  const isSeller = user.id === order.sellerId;
  const other = isBuyer ? order.seller : order.buyer;
  const canMessage = order.status !== 'CANCELLED' && order.status !== 'REFUNDED';
  const isApproved = Boolean(order.isApproved || order.approvalStatus === 'APPROVED');
  const isPendingApproval = order.status === 'PENDING' && order.approvalStatus === 'REQUESTED';
  const isRejected = order.approvalStatus === 'REJECTED';
  const showCancel = isBuyer && (order.status === 'PENDING' || order.status === 'CONFIRMED');
  const showShip = isSeller && order.status === 'CONFIRMED';
  const showDeliver = isBuyer && (order.status === 'SHIPPED' || order.status === 'CONFIRMED');
  const showReview = isBuyer && order.status === 'DELIVERED' && !order.peerReview;
  
  let cfg = (statusConfig as any)[order.status] || statusConfig.PENDING;
  if (isPendingApproval) {
    cfg = { label: 'AWAITING SELLER APPROVAL', color: colors.orange, icon: 'hourglass-outline' };
  } else if (isRejected) {
    cfg = { label: 'REQUEST DECLINED', color: colors.red, icon: 'close-circle-outline' };
  } else if (order.status === 'PENDING' && isApproved) {
    cfg = { label: 'APPROVED · AWAITING PAYMENT', color: colors.forest, icon: 'checkmark-circle-outline' };
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" 
          onPress={() => safeBack('/(tabs)/orders')} 
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <SolarIcon name="arrow-back" size={24} color={colors.charcoal} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {order.items[0]?.garment?.title ?? 'Order'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {isBuyer ? 'Seller' : 'Buyer'} · {other.displayName}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Shield checkmark" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => router.push(`/(tabs)/shop/seller/${other.id}`)} style={styles.trustBtn}>
          <SolarIcon name="shield-checkmark-outline" size={22} color={colors.charcoal} />
        </TouchableOpacity>
      </View>

      {/* ── Status Bar ──────────────────────────────────────── */}
      <View style={styles.statusBar}>
        <SolarIcon name={cfg.icon} size={18} color={cfg.color} />
        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.orderIdText}>#{order.id.slice(0, 8)}</Text>
      </View>

      {/* ── Seller Approval Action Bar ─────────────────────── */}
      {isSeller && isPendingApproval && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionBtnDanger, actionLoading && styles.disabled]}
            onPress={handleReject}
            disabled={actionLoading}
          >
            <SolarIcon name="close-circle-outline" size={16} color={colors.cream} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>DECLINE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtnSuccess, actionLoading && styles.disabled]}
            onPress={handleApprove}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <Spinner size="small" color={colors.cream} />
            ) : (
              <>
                <SolarIcon name="checkmark-circle-outline" size={16} color={colors.cream} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>APPROVE PURCHASE</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Buyer Proceed to Payment Action Bar ─────────────── */}
      {isBuyer && order.status === 'PENDING' && isApproved && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionBtnSuccess}
            onPress={handleProceedToPayment}
          >
            <SolarIcon name="card-outline" size={16} color={colors.cream} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>
              PROCEED TO PAYMENT (₹{Math.round(order.totalAmount).toLocaleString('en-IN')})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Standard Action Buttons ──────────────────────────── */}
      {(showShip || showDeliver || (showCancel && !isSeller)) && (
        <View style={styles.actionBar}>
          {showCancel && !isSeller ? (
            <TouchableOpacity style={styles.actionBtnDanger} onPress={handleCancelRefund}>
              <SolarIcon name="close-circle-outline" size={16} color={colors.cream} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>
                {order.status === 'CONFIRMED' ? 'REFUND' : 'CANCEL'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {showShip ? (
            <TouchableOpacity style={styles.actionBtnPrimary} onPress={ship}>
              <SolarIcon name="cube-outline" size={16} color={colors.cream} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>MARK SHIPPED</Text>
            </TouchableOpacity>
          ) : null}
          {showDeliver ? (
            <TouchableOpacity style={styles.actionBtnSuccess} onPress={deliver}>
              <SolarIcon name="checkmark-done-outline" size={16} color={colors.cream} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>CONFIRM DELIVERED</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* ── Next Steps Instructions (Approval / Seller / Buyer Specific) ─────── */}
      {isPendingApproval && (
        <View style={[styles.nextStepsBanner, { backgroundColor: colors.goldLight, borderLeftWidth: 4, borderLeftColor: colors.orange }]}>
          <View style={styles.nextStepsHeader}>
            <SolarIcon
              name={isSeller ? "alert-circle" : "hourglass"}
              size={18}
              color={colors.orange}
            />
            <Text style={[styles.nextStepsTitle, { color: colors.orange }]}>
              {isSeller ? 'PURCHASE APPROVAL REQUIRED' : 'AWAITING SELLER APPROVAL'}
            </Text>
          </View>
          <Text style={styles.nextStepsBody}>
            {isSeller
              ? `The buyer has requested to purchase this piece for ₹${Math.round(order.totalAmount).toLocaleString('en-IN')}. Please approve above to allow the buyer to complete payment and arrange shipping.`
              : `Your purchase request has been submitted to ${other.displayName}. Once they approve your request, you can proceed directly to secure payment.`}
          </Text>
        </View>
      )}

      {order.status === 'PENDING' && isApproved && (
        <View style={[styles.nextStepsBanner, { backgroundColor: colors.paperLight, borderLeftWidth: 4, borderLeftColor: colors.forest }]}>
          <View style={styles.nextStepsHeader}>
            <SolarIcon name="checkmark-circle" size={18} color={colors.forest} />
            <Text style={[styles.nextStepsTitle, { color: colors.forest }]}>
              {isBuyer ? 'PURCHASE APPROVED · READY FOR PAYMENT' : 'PURCHASE APPROVED · AWAITING BUYER PAYMENT'}
            </Text>
          </View>
          <Text style={styles.nextStepsBody}>
            {isBuyer
              ? 'The seller has accepted your purchase request! Tap "PROCEED TO PAYMENT" to complete checkout and secure this garment.'
              : 'You approved this order. The buyer has been notified to complete payment.'}
          </Text>
        </View>
      )}

      {isRejected && (
        <View style={[styles.nextStepsBanner, { backgroundColor: colors.crimsonLight, borderLeftWidth: 4, borderLeftColor: colors.red }]}>
          <View style={styles.nextStepsHeader}>
            <SolarIcon name="close-circle" size={18} color={colors.red} />
            <Text style={[styles.nextStepsTitle, { color: colors.red }]}>
              REQUEST DECLINED
            </Text>
          </View>
          <Text style={styles.nextStepsBody}>
            This purchase request was declined. Any garment reservation has been released.
          </Text>
        </View>
      )}

      {/* ── Next Steps Instructions (Seller / Buyer Specific) ───────────────── */}
      {order.status === 'CONFIRMED' && (
        <View style={styles.nextStepsBanner}>
          <View style={styles.nextStepsHeader}>
            <SolarIcon
              name={isSeller ? 'cube' : 'time'}
              size={18}
              color={isSeller ? colors.ink : colors.forest}
            />
            <Text style={styles.nextStepsTitle}>
              {isSeller ? 'NEXT STEPS: SHIP THE ITEM' : 'NEXT STEPS: WAITING FOR SHIPPING'}
            </Text>
          </View>
          <Text style={styles.nextStepsBody}>
            {isSeller
              ? 'Payment is held safely. 1) Check the buyer address below. 2) Pack and send the item. 3) Tap "MARK SHIPPED" above.'
              : 'Payment confirmed! The seller has been notified to pack and ship your item. You can track progress or message the seller below.'}
          </Text>
        </View>
      )}
      {order.status === 'SHIPPED' && (
        <View style={styles.nextStepsBanner}>
          <View style={styles.nextStepsHeader}>
            <SolarIcon name="airplane" size={18} color={colors.ink} />
            <Text style={styles.nextStepsTitle}>
              {isBuyer ? 'ITEM IN TRANSIT' : 'ITEM SHIPPED'}
            </Text>
          </View>
          <Text style={styles.nextStepsBody}>
            {isBuyer
              ? 'Your package is on its way! Once it arrives, check the item and tap "CONFIRM DELIVERED" to release the payment.'
              : 'Package marked as shipped. Once the buyer receives and verifies the garment, the order will complete and funds will settle.'}
          </Text>
        </View>
      )}

      <FlatList
        style={styles.msgList}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.thread}
        ListHeaderComponent={
          <>
            {/* ── Order Summary Card ────────────────────────────── */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <SolarIcon name="bag-outline" size={16} color={colors.charcoal} />
                <Text style={styles.summaryLabel}>ORDER TOTAL</Text>
                <Text style={styles.summaryValue}>
                  ₹{Math.round(order.totalAmount).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <SolarIcon name="calendar-outline" size={16} color={colors.charcoal} />
                <Text style={styles.summaryLabel}>PLACED ON</Text>
                <Text style={styles.summaryDate}>
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>

            {/* ── Transaction Items Dossier (Request 9: Show transaction items detail) ── */}
            <View style={styles.itemsDossierCard}>
              <View style={styles.itemsDossierHeader}>
                <SolarIcon name="shirt-outline" size={15} color={colors.charcoal} />
                <Text style={styles.itemsDossierTitle}>ORDER ITEMS ({order.items.length})</Text>
              </View>
              {order.items.map((item) => {
                const garmentId = item.garment?.id || item.garmentId;
                const thumb = item.garment?.images?.[0];
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.orderGarmentRow}
                    onPress={() => garmentId && router.push(`/(tabs)/shop/${garmentId}` as any)}
                    activeOpacity={0.85}
                  >
                    <KaphorImage
                      uri={thumb}
                      style={styles.orderGarmentThumb}
                      contentFit="cover"
                      fallbackIcon="shirt-outline"
                    />
                    <View style={styles.orderGarmentDetails}>
                      <Text style={styles.orderGarmentBrand} numberOfLines={1}>
                        {item.garment?.brand || 'KAPHOR'}
                      </Text>
                      <Text style={styles.orderGarmentTitle} numberOfLines={2}>
                        {item.garment?.title || 'Classic Piece'}
                      </Text>
                      <View style={styles.orderGarmentMetaRow}>
                        <Text style={styles.orderGarmentPrice}>
                          ₹{Math.round(item.price || 0).toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.orderGarmentQty}>Qty: {item.quantity || 1}</Text>
                        {(item.garment as any)?.size && (
                          <View style={styles.orderGarmentSizeChip}>
                            <Text style={styles.orderGarmentSizeText}>{(item.garment as any).size}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.viewItemActionCol}>
                      <View style={styles.viewItemPill}>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.viewItemPillText}>VIEW →</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Prompt Review Banner (Review after confirm delivery) ── */}
            {showReview && (
              <TouchableOpacity
                style={styles.reviewPromptCard}
                onPress={() => setReviewModalVisible(true)}
                activeOpacity={0.88}
              >
                <View style={styles.reviewPromptHeader}>
                  <View style={styles.reviewPromptStarBox}>
                    <SolarIcon name="star" size={20} color={colors.orange} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewPromptTitle}>RATE & REVIEW SELLER</Text>
                    <Text style={styles.reviewPromptSub}>
                      Delivery confirmed! Tap to leave a rating and share your experience.
                    </Text>
                  </View>
                </View>
                <View style={styles.reviewPromptBtn}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.reviewPromptBtnText}>RATE NOW ★</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* ── Completed Review Display (Visible to both Buyer & Seller) ── */}
            {Boolean(order.peerReview) && (
              <View style={styles.completedReviewCard}>
                <View style={styles.completedReviewTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <SolarIcon name="star" size={18} color={colors.orange} />
                    <Text style={styles.completedReviewTitle}>
                      {isBuyer ? 'YOUR PEER REVIEW' : "BUYER'S PEER REVIEW"}
                    </Text>
                  </View>
                  <View style={styles.reviewRatingBadge}>
                    <Text style={styles.reviewRatingScore}>{order.peerReview?.rating || 5}.0 ★</Text>
                  </View>
                </View>

                {order.peerReview?.comment ? (
                  <Text style={styles.completedReviewComment}>"{order.peerReview.comment}"</Text>
                ) : null}

                <View style={styles.completedReviewFooter}>
                  <SolarIcon name="shield-checkmark" size={12} color={colors.forest} />
                  <Text style={styles.completedReviewMeta}>
                    Verified Transaction Review · Order #{order.id.slice(0, 8).toUpperCase()}
                  </Text>
                </View>
              </View>
            )}

            {/* ── Timeline (for CONFIRMED and beyond) ───────────── */}
            {order.status !== 'PENDING' && order.status !== 'CANCELLED' && order.status !== 'REFUNDED' && (
              <View style={styles.timelineCard}>
                <Text style={styles.sectionTitle}>TRACKING</Text>
                <StatusTimeline currentStatus={order.status} />
              </View>
            )}

            {/* ── Shipping Address Card ─────────────────────────── */}
            {order.shippingAddress && (
              <>
                <TouchableOpacity
                  style={styles.sectionHeaderRow}
                  onPress={() => setAddressExpanded(!addressExpanded)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sectionTitle}>DELIVERY ADDRESS</Text>
                  <SolarIcon
                    name={addressExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
                {addressExpanded && <AddressCard address={order.shippingAddress} />}
              </>
            )}

            {/* ── Unified Messages & Coordination Card ───────── */}
            <View style={styles.chatActionCard}>
              <View style={styles.chatActionIconBox}>
                <SolarIcon name="chatbubbles" size={20} color={colors.cream} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatActionTitle}>
                  {isBuyer ? 'COORDINATE WITH SELLER' : 'COORDINATE WITH BUYER'}
                </Text>
                <Text style={styles.chatActionSub}>
                  Chat about shipping, photos and address changes here.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.openChatBtn}
                onPress={openUnifiedChat}
                activeOpacity={0.8}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.openChatBtnText}>OPEN CHAT →</Text>
              </TouchableOpacity>
            </View>

            {/* ── Messages Header ───────────────────────────────── */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
              ORDER HISTORY & LOG
            </Text>
            {messages.length === 0 && (
              <Text style={styles.hint}>
                {canMessage
                  ? 'You can chat about shipping here.'
                  : 'This order was cancelled or refunded; messaging is closed.'}
              </Text>
            )}
          </>
        }
        renderItem={({ item }) => {
          const mine = item.senderId === user.id;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={styles.bubbleMeta}>{mine ? 'You' : item.sender.displayName}</Text>
              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
              <Text style={styles.time}>
                {new Date(item.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          );
        }}
      />

      {/* ── Message Composer ───────────────────────────────── */}
      {canMessage ? (
        <View
          style={[
            styles.composer,
            {
              paddingBottom: isKeyboardVisible
                ? (Platform.OS === 'ios' ? 10 : 8)
                : Math.max(insets.bottom + (Platform.OS === 'ios' ? 4 : 8), Platform.OS === 'android' ? 28 : 16),
            },
          ]}
        >
          <TextInput accessibilityLabel="Message"
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Send" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={sending || !draft.trim()}
          >
            {sending ? (
              <Spinner color={colors.cream} />
            ) : (
              <SolarIcon name="send" size={18} color={colors.cream} />
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Review Modal Sheet (Request 11: Review after confirm delivery) ── */}
      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.reviewModalOverlay}
        >
          <TouchableOpacity
            style={styles.reviewModalBackdrop}
            activeOpacity={1}
            onPress={() => setReviewModalVisible(false)}
          />
          <View style={styles.reviewModalSheet}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <View style={styles.reviewModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewModalTitle}>RATE THE SELLER</Text>
                  <Text style={styles.reviewModalSub}>
                    Order #{order.id.slice(0, 8).toUpperCase()} · {other.displayName}
                  </Text>
                </View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
                  onPress={() => setReviewModalVisible(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.modalCloseBtn}
                >
                  <SolarIcon name="close" size={20} color={colors.charcoal} />
                </TouchableOpacity>
              </View>

              <Text style={styles.reviewRatingHelp}>SELECT STAR RATING (1–5)</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    key={n}
                    onPress={() => {
                      hapticFeedback.selection();
                      setRating(n);
                    }}
                    style={styles.starHitTarget}
                  >
                    <SolarIcon
                      name={n <= rating ? 'star' : 'star-outline'}
                      size={36}
                      color={n <= rating ? colors.orange : colors.borderLight}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.starLabel}>
                {rating === 5 ? '★★★★★ EXCEPTIONAL' :
                 rating === 4 ? '★★★★☆ GREAT' :
                 rating === 3 ? '★★★☆☆ GOOD' :
                 rating === 2 ? '★★☆☆☆ SUBPAR' : '★☆☆☆☆ POOR'}
              </Text>

              <TextInput accessibilityLabel="How was the seller, the item and the shipping speed?"
                style={styles.reviewModalInput}
                placeholder="How was the seller, the item and the shipping speed?"
                placeholderTextColor={colors.textMuted}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={[styles.submitReviewBtn, reviewSubmitting && styles.disabled]}
                onPress={submitReview}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting ? (
                  <Spinner color={colors.cream} />
                ) : (
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.submitReviewBtnText}>SUBMIT PEER REVIEW ★</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelReviewBtn}
                onPress={() => setReviewModalVisible(false)}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.cancelReviewBtnText}>MAYBE LATER</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream, gap: 8 },
  miss: { color: colors.textMuted, fontFamily: typography.handwritten, fontSize: 14, includeFontPadding: false },
  goBackBtn: { borderWidth: 2, borderColor: colors.charcoal, paddingVertical: 10, paddingHorizontal: 20, marginTop: 8 },
  goBackText: { fontFamily: typography.handBold, fontSize: 12, color: colors.charcoal, includeFontPadding: false },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  backBtn: { padding: 6, marginRight: 4 },
  headerMid: { flex: 1 },
  headerTitle: { fontFamily: typography.headings, fontSize: 18, color: colors.charcoal, letterSpacing: 0.5 },
  headerSub: { fontFamily: typography.handwritten, fontSize: 13, color: colors.textMuted, marginTop: 3, includeFontPadding: false },
  trustBtn: { padding: 8, borderWidth: 1.5, borderColor: colors.charcoal },

  // Status Bar
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
    backgroundColor: colors.white,
  },
  statusText: { fontFamily: typography.handBold, fontSize: 13, includeFontPadding: false },
  orderIdText: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted, letterSpacing: 0.5 },

  // Action Buttons
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
    backgroundColor: colors.white,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.ink,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  actionBtnDanger: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.red,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: colors.red,
    shadowColor: colors.red,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  actionBtnSuccess: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.forest,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: colors.forest,
    shadowColor: colors.forest,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  actionBtnText: { color: colors.cream, fontFamily: typography.handBold, fontSize: 13, includeFontPadding: false },

  // List
  msgList: { flex: 1 },
  thread: { padding: 20, paddingBottom: 24, gap: 0 },

  // Unified Chat Action Card
  chatActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperLight,
    borderWidth: 2,
    borderColor: colors.forest,
    padding: 14,
    gap: 12,
    marginTop: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  chatActionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: colors.forest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatActionTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.forest,
  },
  chatActionSub: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 16,
    marginTop: 2,
  },
  openChatBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  openChatBtnText: {
    color: colors.cream,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
  },

  // Section Title
  sectionTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 12,
    marginTop: 20,
    letterSpacing: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  summaryLabel: {
    flex: 1,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontFamily: typography.headings,
    fontSize: 17,
    color: colors.charcoal,
  },
  summaryDate: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.charcoal,
    fontWeight: '600',
  },
  itemSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
  },
  itemChip: {
    flexDirection: 'row',
    backgroundColor: colors.cream,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.charcoal,
    alignItems: 'center',
    gap: 4,
  },
  itemChipText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.charcoal,
    maxWidth: 120,
  },
  itemChipQty: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.textMuted,
  },
  moreItems: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.textMuted,
    alignSelf: 'center',
  },

  // Timeline Card
  timelineCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderTopWidth: 0,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    marginBottom: 20,
  },
  timelineContainer: {
    paddingVertical: 4,
    paddingLeft: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 52,
  },
  timelineCol: {
    alignItems: 'center',
    width: 28,
    height: '100%',
  },
  timelineVertLine: {
    position: 'absolute',
    top: 24,
    left: 13,
    width: 2,
    height: 40,
    backgroundColor: colors.overlayLight,
    zIndex: 0,
  },
  timelineVertLineDone: {
    backgroundColor: colors.forest,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    zIndex: 1,
  },
  timelineDotDone: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  timelineDotCurrent: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  timelineDotEmpty: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.overlayLight,
  },
  timelineContent: {
    marginLeft: 14,
    flex: 1,
    paddingTop: 4,
    paddingBottom: 16,
  },
  timelineLabel: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.textMuted,
  },
  timelineLabelDone: {
    color: colors.charcoal,
    fontWeight: '800',
  },
  timelineHint: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.red,
    marginTop: 3,
  },
  timelineDate: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
  },

  // Address Card
  addressCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    marginBottom: 20,
    overflow: 'hidden',
  },
  addressHeader: {
    position: 'relative',
  },
  addressAccent: {
    height: 4,
    backgroundColor: colors.ink,
  },
  addressTopRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
  },
  addressLabelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  addressLabelText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 10.5,
    color: colors.cream,
    letterSpacing: 0.5,
  },
  addressBody: {
    padding: 16,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 18,
    flex: 1,
  },
  addressDivider: {
    height: 1,
    backgroundColor: colors.overlayLight,
    marginVertical: 2,
  },

  // Messages
  hint: { color: colors.textMuted, fontFamily: typography.handwritten, fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 20, marginTop: 8, includeFontPadding: false },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 12,
    backgroundColor: colors.white,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.paperLight, borderColor: colors.charcoal },
  bubbleTheirs: { alignSelf: 'flex-start' },
  bubbleMeta: { fontFamily: typography.handBold, fontSize: 10.5, color: colors.textMuted, marginBottom: 6, includeFontPadding: false },
  bubbleText: { fontFamily: typography.body, fontSize: 15, color: colors.charcoal, lineHeight: 22 },
  bubbleTextMine: { color: colors.charcoal },
  time: { fontFamily: typography.handwritten, fontSize: 11, color: colors.textMuted, marginTop: 8, includeFontPadding: false },

  // Composer
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
    gap: 10,
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
    backgroundColor: colors.cream,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 2,
    borderColor: colors.charcoal,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.charcoal,
    backgroundColor: colors.white,
    fontFamily: typography.body,
  },
  sendBtn: {
    width: 48,
    height: 48,
    backgroundColor: colors.charcoal,
    borderWidth: 2,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  sendBtnDisabled: { opacity: 0.5 },

  // Review
  reviewBox: {
    maxHeight: 240,
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: colors.white,
  },
  reviewTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
  },
  reviewHint: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 16,
  },
  stars: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  reviewInput: {
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 12,
    minHeight: 60,
    color: colors.charcoal,
    marginBottom: 12,
    fontFamily: typography.body,
    fontSize: 13,
    backgroundColor: colors.cream,
  },
  reviewSubmit: {
    backgroundColor: colors.charcoal,
    borderWidth: 2,
    borderColor: colors.charcoal,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  reviewSubmitText: { color: colors.cream, fontFamily: typography.handBold, fontSize: 13, includeFontPadding: false },
  disabled: { opacity: 0.6 },

  // Next Steps Guidance Banner
  nextStepsBanner: {
    backgroundColor: colors.paperLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  nextStepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  nextStepsTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.charcoal,
  },
  nextStepsBody: {
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.charcoal,
  },

  // Items Dossier Card
  itemsDossierCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  itemsDossierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.paper,
    marginBottom: 10,
  },
  itemsDossierTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  orderGarmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.paper,
    gap: 12,
  },
  orderGarmentThumb: {
    width: 54,
    height: 64,
    borderRadius: 6,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  orderGarmentDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  orderGarmentBrand: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 10.5,
    color: colors.textMuted,
  },
  orderGarmentTitle: {
    fontFamily: typography.headings,
    fontSize: 14,
    color: colors.charcoal,
    marginVertical: 2,
  },
  orderGarmentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  orderGarmentPrice: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: colors.red,
  },
  orderGarmentQty: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.textMuted,
  },
  orderGarmentSizeChip: {
    backgroundColor: colors.paper,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  orderGarmentSizeText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 10,
    color: colors.charcoal,
  },
  viewItemActionCol: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  viewItemPill: {
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  viewItemPillText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 9.5,
    color: colors.charcoal,
  },

  // Prompt Review Card
  reviewPromptCard: {
    backgroundColor: colors.goldLight,
    borderWidth: 2,
    borderColor: colors.orange,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    shadowColor: colors.orange,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 0,
    elevation: 3,
  },
  reviewPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  reviewPromptStarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.paperDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewPromptTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.terracottaDark,
  },
  reviewPromptSub: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.charcoal,
    marginTop: 2,
    lineHeight: 15,
  },
  reviewPromptBtn: {
    backgroundColor: colors.orange,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 4,
  },
  reviewPromptBtnText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.cream,
  },

  // Completed Review Card
  completedReviewCard: {
    backgroundColor: colors.paperLight,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
  },
  completedReviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completedReviewTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.charcoal,
  },
  reviewRatingBadge: {
    backgroundColor: colors.paperDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  reviewRatingScore: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.terracottaDark,
  },
  completedReviewComment: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  completedReviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.paper,
  },
  completedReviewMeta: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 10.5,
    color: colors.forest,
  },

  // Review Modal Sheet
  reviewModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  reviewModalBackdrop: {
    flex: 1,
  },
  reviewModalSheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  reviewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.paperDark,
    marginBottom: 14,
  },
  reviewModalTitle: {
    fontFamily: typography.headings,
    fontSize: 18,
    color: colors.charcoal,
    letterSpacing: 1,
  },
  reviewModalSub: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.paperDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewRatingHelp: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.charcoal,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  starHitTarget: {
    padding: 6,
  },
  starLabel: {
    textAlign: 'center',
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.orange,
    marginBottom: 14,
  },
  reviewModalInput: {
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 6,
    padding: 12,
    minHeight: 80,
    maxHeight: 140,
    backgroundColor: colors.white,
    color: colors.charcoal,
    fontFamily: typography.body,
    fontSize: 13,
    marginBottom: 16,
  },
  submitReviewBtn: {
    backgroundColor: colors.charcoal,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  submitReviewBtnText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.cream,
  },
  cancelReviewBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelReviewBtnText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.textMuted,
  },
});
