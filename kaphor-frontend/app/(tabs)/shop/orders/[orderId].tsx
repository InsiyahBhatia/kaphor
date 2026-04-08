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
import { colors } from '../../../../src/theme';
import { orderService, TransactionOrder, OrderMessage } from '../../../../src/services/orderService';
import { useAuth } from '../../../../src/context/AuthContext';

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
        <ActivityIndicator size="large" color={colors.crimson} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.miss}>Order not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isBuyer = user.id === order.buyerId;
  const isSeller = user.id === order.sellerId;
  const other = isBuyer ? order.seller : order.buyer;
  const canMessage = order.status !== 'CANCELLED' && order.status !== 'REFUNDED';
  const showShip = isSeller && order.status === 'CONFIRMED';
  const showDeliver =
    isBuyer && (order.status === 'SHIPPED' || order.status === 'CONFIRMED');
  const showReview = isBuyer && order.status === 'DELIVERED' && !order.peerReview;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {order.items[0]?.garment?.title ?? 'Order'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            with {other.displayName}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/(tabs)/shop/seller/${other.id}`)}
          style={styles.trustBtn}
        >
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.crimson} />
        </TouchableOpacity>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{order.status.replace('_', ' ')}</Text>
        {showShip ? (
          <TouchableOpacity style={styles.miniBtn} onPress={ship}>
            <Text style={styles.miniBtnText}>MARK SHIPPED</Text>
          </TouchableOpacity>
        ) : null}
        {showDeliver ? (
          <TouchableOpacity style={styles.miniBtn} onPress={deliver}>
            <Text style={styles.miniBtnText}>CONFIRM DELIVERED</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        style={styles.msgList}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.thread}
        ListEmptyComponent={
          <Text style={styles.hint}>
            {canMessage
              ? 'Ask questions, negotiate details, or coordinate shipping — even before payment completes.'
              : 'This order was cancelled or refunded; messaging is closed.'}
          </Text>
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
                  color={n <= rating ? colors.gold : colors.textMuted}
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
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.reviewSubmitText}>SUBMIT REVIEW</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : null}

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
          <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending || !draft.trim()}>
            {sending ? <ActivityIndicator color={colors.white} /> : <Ionicons name="send" size={20} color={colors.white} />}
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  miss: { color: colors.textMuted },
  link: { color: colors.crimson, marginTop: 12, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 52,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 8 },
  headerMid: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  headerSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  trustBtn: { padding: 10 },
  statusBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusText: { fontSize: 11, fontWeight: '800', color: colors.crimson, letterSpacing: 0.5 },
  miniBtn: {
    backgroundColor: colors.crimson,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  miniBtnText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  msgList: { flex: 1 },
  thread: { padding: 16, paddingBottom: 24 },
  hint: { color: colors.textMuted, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 },
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#F5E6E9', borderColor: '#E8CCD2' },
  bubbleTheirs: { alignSelf: 'flex-start' },
  bubbleMeta: { fontSize: 10, fontWeight: '800', color: colors.textMuted, marginBottom: 4 },
  bubbleText: { fontSize: 15, color: colors.textPrimary },
  bubbleTextMine: { color: colors.textPrimary },
  time: { fontSize: 10, color: colors.textMuted, marginTop: 6 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.bgCard,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.crimson,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewBox: {
    maxHeight: 220,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.bgCard,
  },
  reviewTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 20, color: colors.textPrimary },
  reviewHint: { fontSize: 12, color: colors.textSecond, marginTop: 4, marginBottom: 8 },
  stars: { flexDirection: 'row', gap: 6, marginVertical: 8 },
  reviewInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    minHeight: 56,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  reviewSubmit: {
    backgroundColor: colors.gold,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewSubmitText: { color: colors.white, fontWeight: '800', letterSpacing: 1 },
  disabled: { opacity: 0.6 },
});
