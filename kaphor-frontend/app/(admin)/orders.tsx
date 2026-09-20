import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminService } from '../../src/services/adminService';
import { colors, typography } from '../../src/theme';
import AdminTopBar from '../../src/components/admin/AdminTopBar';
import { Chip, Empty, formatINR } from '../../src/components/admin/AdminUI';

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
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
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
          <TouchableOpacity onPress={() => setQ('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {STATUSES.map((s) => (
          <TouchableOpacity key={s} onPress={() => setStatus(s)} style={[styles.statusChip, status === s && styles.statusChipActive]}>
            <Text style={[styles.statusChipText, status === s && styles.statusChipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.ink} />
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
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.bgCard,
    gap: 8,
  },
  searchInput: { flex: 1, fontFamily: typography.mono, fontSize: 11, color: colors.textPrimary },

  chipRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
    backgroundColor: colors.bgCard,
  },
  statusChipActive: { backgroundColor: colors.ink },
  statusChipText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '700', color: colors.textSecond },
  statusChipTextActive: { color: colors.white },

  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  orderCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 14,
  },
  orderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontFamily: typography.mono, fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  orderDate: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted },
  orderTitle: { fontFamily: typography.bodyBold, fontSize: 13, color: colors.textPrimary, marginTop: 6 },
  orderParties: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, marginTop: 3 },
  orderFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  orderAmount: { fontFamily: typography.monoBold, fontSize: 13, color: colors.textPrimary },

  pager: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 8 },
  pagerBtn: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 2, backgroundColor: colors.bgCard },
  pagerText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '700', color: colors.textPrimary, letterSpacing: 1 },
  pagerInfo: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted },
});