import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { KaphorImage } from '../../../../src/components/KaphorImage';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DossierLoading } from '../../../../src/components/common/DossierLoading';
import { colors } from '../../../../src/theme';
import { orderService, TransactionOrder } from '../../../../src/services/orderService';
import { useAuth } from '../../../../src/context/AuthContext';

function statusLabel(s: string) {
  switch (s) {
    case 'PENDING':
      return 'AWAITING PAYMENT';
    case 'CONFIRMED':
      return 'PAID · COORDINATE';
    case 'SHIPPED':
      return 'SHIPPED';
    case 'DELIVERED':
      return 'DELIVERED';
    default:
      return s;
  }
}

export default function OrdersInboxScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<TransactionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await orderService.listTransactions();
      setOrders(data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const renderItem = ({ item }: { item: TransactionOrder }) => {
    const isBuyer = user?.id === item.buyerId;
    const other = isBuyer ? item.seller : item.buyer;
    const thumb = item.items[0]?.garment?.images?.[0];
    const preview = item.messages?.[0]?.body;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(tabs)/shop/orders/${item.id}`)}
        activeOpacity={0.85}
      >
        <KaphorImage uri={thumb} style={styles.thumb} contentFit="cover" />
        <View style={styles.cardBody}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.items[0]?.garment?.title ?? 'Order'}
          </Text>
          <Text style={styles.counterparty} numberOfLines={1}>
            {isBuyer ? 'Seller' : 'Buyer'} · {other.displayName}
          </Text>
          <View style={styles.row}>
            <Text style={styles.status}>{statusLabel(item.status)}</Text>
            {item.peerReview && isBuyer ? (
              <Text style={styles.reviewed}>REVIEWED</Text>
            ) : null}
          </View>
          {preview ? (
            <Text style={styles.preview} numberOfLines={1}>
              {preview}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <DossierLoading variant="order" compact />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ORDERS & MESSAGES</Text>
        <View style={{ width: 26 }} />
      </View>
      <Text style={styles.sub}>
        Message buyers or sellers as soon as an order exists — including before payment. After delivery, buyers can
        leave a peer review so trusted sellers stand out.
      </Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        renderItem={renderItem}
        contentContainerStyle={orders.length === 0 ? styles.emptyList : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.crimson} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No orders yet. Purchases and sales will appear here.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  sub: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: colors.textSecond,
    fontSize: 13,
    lineHeight: 18,
  },
  list: { padding: 16, paddingBottom: 100 },
  emptyList: { flexGrow: 1, padding: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 56, height: 72, borderRadius: 8, backgroundColor: colors.bgMuted },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  counterparty: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  status: { fontSize: 11, fontWeight: '800', color: colors.crimson, letterSpacing: 0.5 },
  reviewed: { fontSize: 10, fontWeight: '800', color: colors.gold },
  preview: { fontSize: 12, color: colors.textSecond, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 48, fontSize: 14 },
});
