import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { adminService } from '../../../src/services/adminService';
import { colors, typography } from '../../../src/theme';
import AdminTopBar from '../../../src/components/admin/AdminTopBar';
import { Card, SectionLabel, InfoRow, Chip, formatINR } from '../../../src/components/admin/AdminUI';
import { Loader } from '../../../src/components/common/Loader';

const REFUNDABLE = ['CONFIRMED', 'SHIPPED', 'DELIVERED'];

export default function AdminOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const o = await adminService.getOrder(id);
      setOrder(o);
    } catch (e) {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefund = () => {
    Alert.alert('Process Refund', `Refund ${formatINR(order.totalAmount)} for this order? The item will be relisted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Refund',
        style: 'destructive',
        onPress: async () => {
          setRefunding(true);
          try {
            await adminService.refundOrder(order.id, 'Admin-initiated refund');
            await load();
          } catch (e: any) {
            Alert.alert('Refund Failed', e?.response?.data?.message || 'Unable to process refund.');
          } finally {
            setRefunding(false);
          }
        },
      },
    ]);
  };

  if (loading && !order) {
    return (
      <View style={styles.centered}>
        <Loader variant="order" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>ORDER NOT FOUND</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminTopBar title={`ORDER ${order.id.slice(0, 8).toUpperCase()}`} subtitle={new Date(order.createdAt).toLocaleString('en-IN')} onRefresh={load} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.statusRow}>
            <Chip color={order.status === 'REFUNDED' ? colors.textMuted : colors.ink}>{order.status}</Chip>
            {REFUNDABLE.includes(order.status) && <Text style={styles.refundNote}>PAID</Text>}
          </View>
          <InfoRow label="Amount" value={formatINR(order.totalAmount)} />
          <InfoRow label="Currency" value={order.currency} />
          <InfoRow label="Placed" value={new Date(order.createdAt).toLocaleDateString('en-IN')} />
          {order.razorpayPaymentId && <InfoRow label="Payment" value={order.razorpayPaymentId.slice(0, 14)} />}
          {order.trackingNumber && <InfoRow label="Tracking" value={order.trackingNumber} />}
          {order.carrier && <InfoRow label="Carrier" value={order.carrier} />}
          {order.notes && <InfoRow label="Notes" value={order.notes} />}
        </Card>

        <SectionLabel>Buyer</SectionLabel>
        <Card>
          <InfoRow label="Name" value={order.buyer?.displayName ?? '—'} />
          <InfoRow label="Email" value={order.buyer?.email ?? '—'} />
        </Card>

        <SectionLabel>Seller</SectionLabel>
        <Card>
          <InfoRow label="Name" value={order.seller?.displayName ?? '—'} />
          <InfoRow label="Email" value={order.seller?.email ?? '—'} />
        </Card>

        <SectionLabel>Items</SectionLabel>
        {order.items?.map((it: any) => (
          <Card key={it.id}>
            <Text style={styles.itemTitle}>{it.garment?.title ?? 'Garment'}</Text>
            <Text style={styles.itemMeta}>
              {(it.garment?.brand || '—').toUpperCase()} · SIZE {it.garment?.size?.toUpperCase() ?? '—'} · QTY {it.quantity}
            </Text>
            <View style={styles.itemFoot}>
              <Text style={styles.itemPrice}>{formatINR(it.price)}</Text>
            </View>
          </Card>
        ))}
        {!order.items?.length && (
          <Card><Text style={styles.muted}>No items recorded.</Text></Card>
        )}

        {order.messages?.length > 0 && (
          <>
            <SectionLabel>Order messages</SectionLabel>
            <Card>
              {order.messages.slice(0, 3).map((m: any) => (
                <View key={m.id} style={styles.msgRow}>
                  <Text style={styles.msgMeta}>
                    {m.sender?.displayName ?? 'User'} · {new Date(m.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </Text>
                  <Text style={styles.msgBody}>{m.body}</Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {REFUNDABLE.includes(order.status) && (
          <TouchableOpacity style={[styles.refundBtn, refunding && { opacity: 0.6 }]} onPress={handleRefund} disabled={refunding}>
            <Text style={styles.refundBtnText}>{refunding ? 'PROCESSING…' : 'PROCESS REFUND'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  notFound: { fontFamily: typography.monoBold, fontSize: 12, color: colors.textMuted, letterSpacing: 1 },
  content: { padding: 16, paddingBottom: 48 },

  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  refundNote: { fontFamily: typography.monoBold, fontSize: 11, color: colors.emerald, letterSpacing: 1 },

  itemTitle: { fontFamily: typography.bodyBold, fontSize: 15, color: colors.ink },
  itemMeta: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted, marginTop: 4, letterSpacing: 1 },
  itemFoot: { marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' },
  itemPrice: { fontFamily: typography.monoBold, fontSize: 13, color: colors.ink },

  muted: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted },

  msgRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight || colors.borderLight },
  msgMeta: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted, letterSpacing: 0.5 },
  msgBody: { fontFamily: typography.body, fontSize: 12, color: colors.ink, marginTop: 3 },

  refundBtn: {
    backgroundColor: colors.crimson,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 2,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  refundBtnText: { fontFamily: typography.monoBold, fontSize: 11, color: colors.white, letterSpacing: 2 },
});