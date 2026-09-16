import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import paymentService from '../../../src/services/paymentService';
import type { PaymentTransaction } from '../../../src/types/payment';

const TYPE_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  PURCHASE: { icon: 'cart', color: colors.charcoal },
  RENTAL_FEE: { icon: 'calendar', color: colors.navy },
  RENTAL_DEPOSIT: { icon: 'shield-checkmark', color: colors.teal },
  RENTAL_REFUND: { icon: 'return-down-back', color: colors.forest },
  SELLER_PAYOUT: { icon: 'wallet', color: colors.copper },
};

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await paymentService.getPaymentHistory();
      setTransactions(data);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filterType
    ? transactions.filter((t) => t.type === filterType)
    : transactions;

  const types = ['PURCHASE', 'RENTAL_FEE', 'RENTAL_DEPOSIT', 'RENTAL_REFUND', 'SELLER_PAYOUT'];
  const typeCounts = transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.type] = (acc[t.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <Header title="PAYMENTS" showBack fallbackPath="/(tabs)/profile" />

      {/* Type Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[styles.filterChip, filterType === null && styles.filterChipActive]}
          onPress={() => setFilterType(null)}
        >
          <Text
            style={[
              styles.filterChipText,
              filterType === null && styles.filterChipTextActive,
            ]}
          >
            ALL ({transactions.length})
          </Text>
        </TouchableOpacity>
        {types.map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterChip,
              filterType === type && styles.filterChipActive,
            ]}
            onPress={() => setFilterType(type)}
          >
            <Text
              style={[
                styles.filterChipText,
                filterType === type && styles.filterChipTextActive,
              ]}
            >
              {type.replace(/_/g, ' ')} ({typeCounts[type] || 0})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.charcoal} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="card-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>NO TRANSACTIONS YET</Text>
          {filterType && (
            <TouchableOpacity onPress={() => setFilterType(null)}>
              <Text style={styles.clearFilter}>Clear filter</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {filtered.map((tx) => {
            const meta = TYPE_ICONS[tx.type] ?? {
              icon: 'card' as keyof typeof Ionicons.glyphMap,
              color: colors.textMuted,
            };
            const statusMeta = paymentService.getStatusMeta(tx.status);

            return (
              <TouchableOpacity
                key={tx.id}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => {
                  // Navigate to the related order/rental.
                  // referenceId is the internal ID; linkType disambiguates order vs rental.
                  if (tx.linkType === 'rental') {
                    router.push(`/(tabs)/rental/lease/${tx.referenceId}` as any);
                  } else if (tx.type === 'PURCHASE' || tx.type === 'SELLER_PAYOUT') {
                    router.push(`/(tabs)/shop/orders/${tx.referenceId}` as any);
                  }
                }}
              >
                <View style={styles.cardLeft}>
                  <View style={[styles.iconWrap, { backgroundColor: meta.color }]}>
                    <Ionicons name={meta.icon} size={18} color={colors.cream} />
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{tx.description}</Text>
                  <Text style={styles.cardType}>
                    {tx.type.replace(/_/g, ' ')}
                  </Text>
                  <View style={styles.cardMeta}>
                    <Text style={styles.cardDate}>
                      {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusMeta.color },
                      ]}
                    >
                      <Text style={styles.statusText}>{statusMeta.label}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <Text
                    style={[
                      styles.cardAmount,
                      tx.type === 'RENTAL_REFUND' && styles.refundAmount,
                      tx.type === 'SELLER_PAYOUT' && styles.earningsAmount,
                      (tx.type === 'PURCHASE' || tx.type === 'RENTAL_FEE') && styles.spendAmount,
                    ]}
                  >
                    {tx.type === 'SELLER_PAYOUT' || tx.type === 'RENTAL_REFUND' ? '+' : '−'}
                    {paymentService.formatAmount(tx.amount)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },

  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  filterChipActive: { backgroundColor: colors.charcoal },
  filterChipText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  filterChipTextActive: { color: colors.cream },

  emptyText: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 2,
  },
  clearFilter: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.red,
    fontWeight: '800',
    textDecorationLine: 'underline',
    marginTop: 8,
  },

  list: { padding: 16, gap: 12 },

  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  cardLeft: { marginRight: 14, justifyContent: 'center' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.charcoal,
    marginBottom: 3,
  },
  cardType: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: {
    fontFamily: typography.mono,
    fontSize: 7,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  cardRight: { justifyContent: 'center', marginLeft: 12 },
  cardAmount: {
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '800',
    color: colors.charcoal,
  },
  refundAmount: {
    color: colors.forest,
  },
  earningsAmount: {
    color: colors.forest,
  },
  spendAmount: {
    color: colors.charcoal,
  },
});
