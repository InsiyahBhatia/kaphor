import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SolarIcon } from '../../src/components/common/SolarIcon';
import { adminService } from '../../src/services/adminService';
import { colors, typography } from '../../src/theme';
import AdminTopBar from '../../src/components/admin/AdminTopBar';
import { Chip, Empty, formatINR } from '../../src/components/admin/AdminUI';
import { Loader } from '../../src/components/common/Loader';

const STATUSES = ['ALL', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'REFUNDED', 'CANCELLED'];

export default function AdminOrdersScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>({ data: [], meta: { total: 0, pages: 1, page: 1 } });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.listOrders({
        ...(status !== 'ALL' ? { status } : {}),
        ...(q ? { q } : {}),
        page,
        limit: 20,
      });
      setData(res);
    } catch (e) {
      setData({ data: [], meta: { total: 0, pages: 1, page: 1 } });
    } finally {
      setLoading(false);
    }
  }, [status, q, page]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
  }, [load]);

  const meta = data?.meta ?? { total: 0, pages: 1, page: 1 };

  return (
    <View style={styles.container}>
      <AdminTopBar title="ORDERS" subtitle={`${meta.total} TRANSACTIONS · PAGE ${meta.page}/${meta.pages}`} onRefresh={load} />

      <View style={styles.searchBar}>
        <SolarIcon name="search" size={16} color={colors.textMuted} />
        <TextInput accessibilityLabel="Order id, buyer, seller, garment"
          style={styles.searchInput}
          placeholder="ORDER ID, BUYER, SELLER, GARMENT…"
          placeholderTextColor={colors.textMuted}
          value={q}
          onChangeText={(v) => {
            setQ(v);
            setPage(1);
          }}
        />
        {q !== '' && (
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Remove" onPress={() => setQ('')}>
            <SolarIcon name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {STATUSES.map((s) => (
          <TouchableOpacity key={s} onPress={() => setStatus(s)} style={[styles.statusChip, status === s && styles.statusChipActive]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.statusChipText, status === s && styles.statusChipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && !data ? (
        <View style={styles.centered}>
          <Loader compact />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {data?.data?.length === 0 && <Empty text="No orders match this filter" />}
          {data?.data?.map((o: any) => (
            <TouchableOpacity key={o.id} style={styles.orderCard} onPress={() => router.push(`/(admin)/order/${o.id}` as any)}>
              <View style={styles.orderHead}>
                <Text style={styles.orderId}>{o.id.slice(0, 8).toUpperCase()}</Text>
                <Text style={styles.orderDate}>{new Date(o.createdAt).toLocaleDateString('en-IN')}</Text>
              </View>
              <Text style={styles.orderTitle} numberOfLines={1}>
                {o.items?.[0]?.garment?.title ?? '—'}
                {o.items?.length > 1 ? ` +${o.items.length - 1}` : ''}
              </Text>
              <Text style={styles.orderParties} numberOfLines={1}>
                {o.buyer?.displayName ?? 'Buyer'} ← {o.seller?.displayName ?? 'Seller'}
              </Text>
              <View style={styles.orderFoot}>
                <Chip>{o.status}</Chip>
                <Text style={styles.orderAmount}>{formatINR(o.totalAmount)}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {meta.pages > 1 && (
            <View style={styles.pager}>
              <TouchableOpacity
                style={[styles.pagerBtn, page <= 1 && { opacity: 0.4 }]}
                disabled={page <= 1}
                onPress={() => setPage((p) => p - 1)}
              >
                <Text style={styles.pagerText}>PREV</Text>
              </TouchableOpacity>
              <Text style={styles.pagerInfo}>{meta.page} / {meta.pages}</Text>
              <TouchableOpacity
                style={[styles.pagerBtn, page >= meta.pages && { opacity: 0.4 }]}
                disabled={page >= meta.pages}
                onPress={() => setPage((p) => p + 1)}
              >
                <Text style={styles.pagerText}>NEXT</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 2,
    backgroundColor: colors.white,
    gap: 8,
    shadowColor: colors.ink,
    shadowOffset: { width: 2.5, height: 2.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  searchInput: { flex: 1, fontFamily: typography.mono, fontSize: 11, color: colors.textPrimary },

  chipRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 2,
    backgroundColor: colors.white,
  },
  statusChipActive: { backgroundColor: colors.ink },
  statusChipText: { fontFamily: typography.monoBold, fontSize: 11, color: colors.ink, letterSpacing: 0.8 },
  statusChipTextActive: { color: colors.cream },

  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  orderCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 2,
    padding: 15,
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  orderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontFamily: typography.monoBold, fontSize: 11, color: colors.ink, letterSpacing: 1 },
  orderDate: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted },
  orderTitle: { fontFamily: typography.bodyBold, fontSize: 14, color: colors.ink, marginTop: 6 },
  orderParties: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted, marginTop: 4 },
  orderFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight || colors.borderLight },
  orderAmount: { fontFamily: typography.monoBold, fontSize: 14, color: colors.ink },

  pager: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 12 },
  pagerBtn: {
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 2,
    backgroundColor: colors.white,
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  pagerText: { fontFamily: typography.monoBold, fontSize: 11, color: colors.ink, letterSpacing: 1 },
  pagerInfo: { fontFamily: typography.monoBold, fontSize: 11, color: colors.textMuted },
});