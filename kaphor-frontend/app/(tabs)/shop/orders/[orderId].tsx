import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Keyboard,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DossierLoading } from '../../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../../src/theme';
import { orderService, TransactionOrder, OrderMessage, ShippingAddress } from '../../../../src/services/orderService';
import { messageService } from '../../../../src/services/messageService';
import paymentService from '../../../../src/services/paymentService';
import api, { invalidateCache } from '../../../../src/services/api';
import { useAuth } from '../../../../src/context/AuthContext';
import { safeBack, useBackHandler } from '../../../../src/utils/navigation';
import { KaphorImage } from '../../../../src/components/KaphorImage';
import { hapticFeedback } from '../../../../src/utils/haptics';

const statusConfig = {
  PENDING:    { label: 'AWAITING PAYMENT',   color: colors.red,        icon: 'time-outline' },
  CONFIRMED:  { label: 'PAID · COORDINATE',  color: colors.forest,     icon: 'checkmark-circle-outline' },
  SHIPPED:    { label: 'SHIPPED',             color: '#1C2B4A',        icon: 'cube-outline' },
  DELIVERED:  { label: 'DELIVERED',           color: colors.forest,    icon: 'checkmark-done-outline' },
  CANCELLED:  { label: 'CANCELLED',           color: colors.red,       icon: 'close-circle-outline' },
  REFUNDED:   { label: 'REFUNDED',            color: colors.textMuted, icon: 'cash-outline' },
} as const;

const timelineSteps = [
  { key: 'CONFIRMED',  label: 'Confirmed' },
  { key: 'SHIPPED',    label: 'Shipped' },
  { key: 'DELIVERED',  label: 'Delivered' },
];

function AddressCard({ address }: { address: ShippingAddress }) {
  return (
    <View style={styles.addressCard}>
      {/* Top accent + label */}
      <View style={styles.addressHeader}>
        <View style={styles.addressAccent} />
        <View style={styles.addressTopRow}>
          <View style={styles.addressLabelBadge}>
            <Ionicons name="location" size={12} color={colors.cream} />
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
          <Ionicons name="person-outline" size={14} color={colors.charcoal} style={{ marginRight: 6 }} />
          <Text style={styles.nameText}>{address.fullName}</Text>
        </View>
        {address.phone && (
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={styles.detailText}>{address.phone}</Text>
          </View>
        )}

        {/* Divider */}
        <View style={styles.addressDivider} />

        {/* Address lines */}
        <View style={styles.detailRow}>
          <Ionicons name="home-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailText}>{address.line1}</Text>
            {address.line2 ? <Text style={styles.detailText}>{address.line2}</Text> : null}
          </View>
        </View>
        {address.landmark && (
          <View style={styles.detailRow}>
            <Ionicons name="compass-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={styles.detailText}>Near {address.landmark}</Text>
          </View>
        )}

        {/* City, State, Pincode */}
        <View style={styles.detailRow}>
          <Ionicons name="map-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
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
                  <Ionicons name="checkmark" size={10} color={colors.cream} />
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
  const [order, setOrder] = useState<TransactionOrder | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
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

  const loadAll = useCallback(async () => {
    if (!orderId) return;
    try {
      const [o, msgs] = await Promise.all([
        orderService.getOrder(orderId),
        orderService.getMessages(orderId).catch(() => []),
      ]);
      setOrder(o);
      setMessages(msgs);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
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
      await loadAll();
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
              await loadAll();
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
      ? 'This will cancel the order and initiate a full refund. The amount will be returned to your original payment method.'
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
      await loadAll();
      Alert.alert('Cancelled', isPaid
        ? 'The order has been cancelled and a refund has been initiated. Funds should appear within 5–7 business days.'
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
      await loadAll();
      setReviewModalVisible(false);
      Alert.alert('Thank you', 'Your review helps other buyers trust great sellers.');
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || '';
      if (status === 409 || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
        await loadAll();
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

  if (loading || !user) {
    return (
      <View style={styles.centered}>
        <DossierLoading variant="order" compact />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
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
    cfg = { label: 'AWAITING SELLER APPROVAL', color: '#C95F12', icon: 'hourglass-outline' };
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
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/orders')} 
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {order.items[0]?.garment?.title ?? 'Order'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {isBuyer ? 'Seller' : 'Buyer'} · {other.displayName}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push(`/(tabs)/shop/seller/${other.id}`)} style={styles.trustBtn}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.charcoal} />
        </TouchableOpacity>
      </View>

      {/* ── Status Bar ──────────────────────────────────────── */}
      <View style={styles.statusBar}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
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
            <Ionicons name="close-circle-outline" size={16} color={colors.cream} />
            <Text style={styles.actionBtnText}>DECLINE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtnSuccess, actionLoading && styles.disabled]}
            onPress={handleApprove}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={colors.cream} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.cream} />
                <Text style={styles.actionBtnText}>APPROVE PURCHASE</Text>
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
            <Ionicons name="card-outline" size={16} color={colors.cream} />
            <Text style={styles.actionBtnText}>
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
              <Ionicons name="close-circle-outline" size={16} color={colors.cream} />
              <Text style={styles.actionBtnText}>
                {order.status === 'CONFIRMED' ? 'REFUND' : 'CANCEL'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {showShip ? (
            <TouchableOpacity style={styles.actionBtnPrimary} onPress={ship}>
              <Ionicons name="cube-outline" size={16} color={colors.cream} />
              <Text style={styles.actionBtnText}>MARK SHIPPED</Text>
            </TouchableOpacity>
          ) : null}
          {showDeliver ? (
            <TouchableOpacity style={styles.actionBtnSuccess} onPress={deliver}>
              <Ionicons name="checkmark-done-outline" size={16} color={colors.cream} />
              <Text style={styles.actionBtnText}>CONFIRM DELIVERED</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* ── Next Steps Instructions (Approval / Seller / Buyer Specific) ─────── */}
      {isPendingApproval && (
        <View style={[styles.nextStepsBanner, { backgroundColor: '#FDF7EB', borderLeftWidth: 4, borderLeftColor: '#C95F12' }]}>
          <View style={styles.nextStepsHeader}>
            <Ionicons
              name={isSeller ? "alert-circle" : "hourglass"}
              size={18}
              color="#C95F12"
            />
            <Text style={[styles.nextStepsTitle, { color: '#C95F12' }]}>
              {isSeller ? 'PURCHASE APPROVAL REQUIRED' : 'AWAITING SELLER APPROVAL'}
            </Text>
          </View>
          <Text style={styles.nextStepsBody}>
            {isSeller
              ? `The buyer has requested to purchase this piece for ₹${Math.round(order.totalAmount).toLocaleString('en-IN')}. Please approve above to allow the buyer to complete payment and arrange dispatch.`
              : `Your purchase request has been submitted to ${other.displayName}. Once they approve your request, you can proceed directly to secure payment.`}
          </Text>
        </View>
      )}

      {order.status === 'PENDING' && isApproved && (
        <View style={[styles.nextStepsBanner, { backgroundColor: '#F2F8F4', borderLeftWidth: 4, borderLeftColor: colors.forest }]}>
          <View style={styles.nextStepsHeader}>
            <Ionicons name="checkmark-circle" size={18} color={colors.forest} />
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
        <View style={[styles.nextStepsBanner, { backgroundColor: '#FCEDEC', borderLeftWidth: 4, borderLeftColor: colors.red }]}>
          <View style={styles.nextStepsHeader}>
            <Ionicons name="close-circle" size={18} color={colors.red} />
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
            <Ionicons
              name={isSeller ? 'cube' : 'time'}
              size={18}
              color={isSeller ? '#1C2B4A' : colors.forest}
            />
            <Text style={styles.nextStepsTitle}>
              {isSeller ? 'NEXT STEPS: DISPATCH ITEM' : 'NEXT STEPS: AWAITING DISPATCH'}
            </Text>
          </View>
          <Text style={styles.nextStepsBody}>
            {isSeller
              ? 'Payment is secured in escrow. 1) Check the buyer delivery address below. 2) Pack and courier the item. 3) Tap "MARK SHIPPED" above when dispatched.'
              : 'Payment confirmed! The seller has been notified to pack and ship your item. You can track progress or message the seller below.'}
          </Text>
        </View>
      )}
      {order.status === 'SHIPPED' && (
        <View style={styles.nextStepsBanner}>
          <View style={styles.nextStepsHeader}>
            <Ionicons name="airplane" size={18} color="#1C2B4A" />
            <Text style={styles.nextStepsTitle}>
              {isBuyer ? 'ITEM IN TRANSIT' : 'ITEM DISPATCHED'}
            </Text>
          </View>
          <Text style={styles.nextStepsBody}>
            {isBuyer
              ? 'Your package is on its way! Once delivered to your door, inspect the garment condition and tap "CONFIRM DELIVERED" to release escrow funds.'
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
                <Ionicons name="bag-outline" size={16} color={colors.charcoal} />
                <Text style={styles.summaryLabel}>ORDER TOTAL</Text>
                <Text style={styles.summaryValue}>
                  ₹{Math.round(order.totalAmount).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.charcoal} />
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
                <Ionicons name="shirt-outline" size={15} color={colors.charcoal} />
                <Text style={styles.itemsDossierTitle}>ORDER PIECES ({order.items.length})</Text>
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
                        {item.garment?.brand || 'ARCHIVE'}
                      </Text>
                      <Text style={styles.orderGarmentTitle} numberOfLines={2}>
                        {item.garment?.title || 'Heritage Piece'}
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
                        <Text style={styles.viewItemPillText}>VIEW →</Text>
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
                    <Ionicons name="star" size={20} color="#C95F12" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewPromptTitle}>RATE & REVIEW SELLER</Text>
                    <Text style={styles.reviewPromptSub}>
                      Delivery confirmed! Tap to leave a rating and share your experience.
                    </Text>
                  </View>
                </View>
                <View style={styles.reviewPromptBtn}>
                  <Text style={styles.reviewPromptBtnText}>RATE NOW ★</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* ── Completed Review Display (Visible to both Buyer & Seller) ── */}
            {Boolean(order.peerReview) && (
              <View style={styles.completedReviewCard}>
                <View style={styles.completedReviewTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="star" size={18} color="#C95F12" />
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
                  <Ionicons name="shield-checkmark" size={12} color={colors.forest} />
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
                  <Ionicons
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
                <Ionicons name="chatbubbles" size={20} color={colors.cream} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatActionTitle}>
                  {isBuyer ? 'COORDINATE WITH SELLER' : 'COORDINATE WITH BUYER'}
                </Text>
                <Text style={styles.chatActionSub}>
                  Direct shipping coordination, dispatch photos & address updates in your unified messages thread.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.openChatBtn}
                onPress={openUnifiedChat}
                activeOpacity={0.8}
              >
                <Text style={styles.openChatBtnText}>OPEN CHAT →</Text>
              </TouchableOpacity>
            </View>

            {/* ── Messages Header ───────────────────────────────── */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
              ORDER HISTORY & LOG
            </Text>
            {messages.length === 0 && (
              <Text style={styles.hint}>
                {canMessage
                  ? 'All communication and dispatch coordination can be managed in your unified chat.'
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
          <TextInput
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={sending || !draft.trim()}
          >
            {sending ? (
              <ActivityIndicator color={colors.cream} />
            ) : (
              <Ionicons name="send" size={18} color={colors.cream} />
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
                <TouchableOpacity
                  onPress={() => setReviewModalVisible(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color={colors.charcoal} />
                </TouchableOpacity>
              </View>

              <Text style={styles.reviewRatingHelp}>SELECT STAR RATING (1–5)</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => {
                      hapticFeedback.selection();
                      setRating(n);
                    }}
                    style={styles.starHitTarget}
                  >
                    <Ionicons
                      name={n <= rating ? 'star' : 'star-outline'}
                      size={36}
                      color={n <= rating ? '#C95F12' : '#C8C4BA'}
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

              <TextInput
                style={styles.reviewModalInput}
                placeholder="How was the seller's communication, garment condition, and dispatch speed?"
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
                  <ActivityIndicator color={colors.cream} />
                ) : (
                  <Text style={styles.submitReviewBtnText}>SUBMIT PEER REVIEW ★</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelReviewBtn}
                onPress={() => setReviewModalVisible(false)}
              >
                <Text style={styles.cancelReviewBtnText}>MAYBE LATER</Text>
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
  miss: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 14 },
  goBackBtn: { borderWidth: 2, borderColor: colors.charcoal, paddingVertical: 10, paddingHorizontal: 20, marginTop: 8 },
  goBackText: { fontFamily: typography.mono, fontSize: 11, fontWeight: '800', color: colors.charcoal, letterSpacing: 1 },

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
  headerSub: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, marginTop: 3 },
  trustBtn: { padding: 8, borderWidth: 1.5, borderColor: colors.charcoal },

  // Status Bar
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
    backgroundColor: colors.white,
  },
  statusText: { fontFamily: typography.mono, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  orderIdText: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, letterSpacing: 0.5 },

  // Action Buttons
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
    backgroundColor: colors.white,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1C2B4A',
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#1C2B4A',
    shadowColor: '#1C2B4A',
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
  actionBtnText: { color: colors.cream, fontFamily: typography.mono, fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  // List
  msgList: { flex: 1 },
  thread: { padding: 20, paddingBottom: 24, gap: 0 },

  // Unified Chat Action Card
  chatActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F4EB',
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
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.forest,
    letterSpacing: 0.5,
  },
  chatActionSub: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.charcoal,
    lineHeight: 12,
    marginTop: 2,
  },
  openChatBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  openChatBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Section Title
  sectionTitle: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 20,
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
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  summaryValue: {
    fontFamily: typography.headings,
    fontSize: 22,
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
    borderTopColor: 'rgba(30,31,34,0.1)',
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
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.charcoal,
    maxWidth: 120,
  },
  itemChipQty: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
  },
  moreItems: {
    fontFamily: typography.mono,
    fontSize: 9,
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
    backgroundColor: 'rgba(30,31,34,0.15)',
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
    borderColor: 'rgba(30,31,34,0.2)',
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
    backgroundColor: '#1C2B4A',
    borderColor: '#1C2B4A',
    shadowColor: '#1C2B4A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  timelineDotEmpty: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(30,31,34,0.2)',
  },
  timelineContent: {
    marginLeft: 14,
    flex: 1,
    paddingTop: 4,
    paddingBottom: 16,
  },
  timelineLabel: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  timelineLabelDone: {
    color: colors.charcoal,
    fontWeight: '800',
  },
  timelineHint: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.red,
    marginTop: 3,
    letterSpacing: 0.5,
  },
  timelineDate: {
    fontFamily: typography.mono,
    fontSize: 9,
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
    backgroundColor: '#1C2B4A',
  },
  addressTopRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
  },
  addressLabelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1C2B4A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  addressLabelText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 1,
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
    fontFamily: typography.mono,
    fontSize: 15,
    fontWeight: '800',
    color: colors.charcoal,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailText: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.charcoal,
    lineHeight: 18,
    flex: 1,
  },
  addressDivider: {
    height: 1,
    backgroundColor: 'rgba(30,31,34,0.1)',
    marginVertical: 2,
  },

  // Messages
  hint: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 11, lineHeight: 18, textAlign: 'center', paddingHorizontal: 20, marginTop: 8 },
  bubble: {
    maxWidth: '85%',
    padding: 14,
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
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#F7F5F0', borderColor: colors.charcoal },
  bubbleTheirs: { alignSelf: 'flex-start' },
  bubbleMeta: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', color: colors.textMuted, marginBottom: 6, letterSpacing: 0.5 },
  bubbleText: { fontFamily: typography.body, fontSize: 15, color: colors.charcoal, lineHeight: 22 },
  bubbleTextMine: { color: colors.charcoal },
  time: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, marginTop: 8 },

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
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  reviewHint: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 14,
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
  reviewSubmitText: { color: colors.cream, fontFamily: typography.mono, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  disabled: { opacity: 0.6 },

  // Next Steps Guidance Banner
  nextStepsBanner: {
    backgroundColor: '#F7F4EB',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.12)',
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
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
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
    borderBottomColor: '#ECE8DD',
    marginBottom: 10,
  },
  itemsDossierTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  orderGarmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3EC',
    gap: 12,
  },
  orderGarmentThumb: {
    width: 54,
    height: 64,
    borderRadius: 6,
    backgroundColor: '#F0ECE1',
    borderWidth: 1,
    borderColor: '#D8D4C8',
  },
  orderGarmentDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  orderGarmentBrand: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
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
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
  },
  orderGarmentSizeChip: {
    backgroundColor: '#EDE9DE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  orderGarmentSizeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
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
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },

  // Prompt Review Card
  reviewPromptCard: {
    backgroundColor: '#FFF9E6',
    borderWidth: 2,
    borderColor: '#C95F12',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    shadowColor: '#C95F12',
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
    backgroundColor: '#FFE8B3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewPromptTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#8A3E00',
    letterSpacing: 1,
  },
  reviewPromptSub: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.charcoal,
    marginTop: 2,
    lineHeight: 15,
  },
  reviewPromptBtn: {
    backgroundColor: '#C95F12',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 4,
  },
  reviewPromptBtnText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 1,
  },

  // Completed Review Card
  completedReviewCard: {
    backgroundColor: '#FAF8F2',
    borderWidth: 1.5,
    borderColor: '#C9A84C',
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
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  reviewRatingBadge: {
    backgroundColor: '#FFE8B3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E6B800',
  },
  reviewRatingScore: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#8A3E00',
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
    borderTopColor: '#ECE8DD',
  },
  completedReviewMeta: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.forest,
    letterSpacing: 0.5,
  },

  // Review Modal Sheet
  reviewModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    shadowColor: '#000',
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
    borderBottomColor: '#E6E2D5',
    marginBottom: 14,
  },
  reviewModalTitle: {
    fontFamily: typography.headings,
    fontSize: 18,
    color: colors.charcoal,
    letterSpacing: 1,
  },
  reviewModalSub: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '800',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBE7DC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewRatingHelp: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.8,
    marginBottom: 8,
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
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#C95F12',
    letterSpacing: 1,
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
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 1,
  },
  cancelReviewBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelReviewBtnText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
});
