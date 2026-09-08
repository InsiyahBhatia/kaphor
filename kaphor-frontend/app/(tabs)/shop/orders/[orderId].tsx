import React, { useCallback, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DossierLoading } from '../../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../../src/theme';
import { orderService, TransactionOrder, OrderMessage, ShippingAddress } from '../../../../src/services/orderService';
import paymentService from '../../../../src/services/paymentService';
import api from '../../../../src/services/api';
import { useAuth } from '../../../../src/context/AuthContext';

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
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<TransactionOrder | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [addressExpanded, setAddressExpanded] = useState(true);

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
      Alert.alert('Delivered', 'Thank you. You can now review the seller below.');
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
      Alert.alert('Thank you', 'Your review helps other buyers trust great sellers.');
    } catch (e: any) {
      Alert.alert('Review', e?.response?.data?.message ?? 'Could not submit review');
    } finally {
      setReviewSubmitting(false);
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
        <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
          <Text style={styles.goBackText}>GO BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isBuyer = user.id === order.buyerId;
  const isSeller = user.id === order.sellerId;
  const other = isBuyer ? order.seller : order.buyer;
  const canMessage = order.status !== 'CANCELLED' && order.status !== 'REFUNDED';
  const showCancel = isBuyer && (order.status === 'PENDING' || order.status === 'CONFIRMED');
  const showShip = isSeller && order.status === 'CONFIRMED';
  const showDeliver = isBuyer && (order.status === 'SHIPPED' || order.status === 'CONFIRMED');
  const showReview = isBuyer && order.status === 'DELIVERED' && !order.peerReview;
  const cfg = statusConfig[order.status] || statusConfig.PENDING;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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

      {/* ── Action Buttons ──────────────────────────────────── */}
      {(showShip || showDeliver || showCancel) && (
        <View style={styles.actionBar}>
          {showCancel ? (
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
                  ₹{(order.totalAmount / 100).toLocaleString('en-IN')}
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
              <View style={styles.itemSummaryRow}>
                {order.items.slice(0, 3).map((item) => (
                  <View key={item.id} style={styles.itemChip}>
                    <Text style={styles.itemChipText} numberOfLines={1}>
                      {item.garment?.title || 'Item'}
                    </Text>
                    <Text style={styles.itemChipQty}>×{item.quantity || 1}</Text>
                  </View>
                ))}
                {order.items.length > 3 && (
                  <Text style={styles.moreItems}>+{order.items.length - 3} more</Text>
                )}
              </View>
            </View>

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

            {/* ── Messages Header ───────────────────────────────── */}
            <Text style={[styles.sectionTitle, { marginTop: order.shippingAddress ? 0 : 20 }]}>
              MESSAGES
            </Text>
            {messages.length === 0 && (
              <Text style={styles.hint}>
                {canMessage
                  ? 'Ask questions, negotiate details, or coordinate shipping — even before payment completes.'
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

      {/* ── Review Section ────────────────────────────────── */}
      {showReview ? (
        <ScrollView style={styles.reviewBox} keyboardShouldPersistTaps="handled">
          <Text style={styles.reviewTitle}>RATE THE SELLER</Text>
          <Text style={styles.reviewHint}>
            Peer reviews help the community spot reliable sellers. One review per order.
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setRating(n)}>
                <Ionicons
                  name={n <= rating ? 'star' : 'star-outline'}
                  size={32}
                  color={n <= rating ? '#C95F12' : colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.reviewInput}
            placeholder="Optional note for other buyers…"
            placeholderTextColor={colors.textMuted}
            value={reviewComment}
            onChangeText={setReviewComment}
            multiline
          />
          <TouchableOpacity
            style={[styles.reviewSubmit, reviewSubmitting && styles.disabled]}
            onPress={submitReview}
            disabled={reviewSubmitting}
          >
            {reviewSubmitting ? (
              <ActivityIndicator color={colors.cream} />
            ) : (
              <Text style={styles.reviewSubmitText}>SUBMIT REVIEW</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : null}

      {/* ── Message Composer ───────────────────────────────── */}
      {canMessage ? (
        <View style={styles.composer}>
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
});
