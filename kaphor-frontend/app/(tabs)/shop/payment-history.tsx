import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import paymentService from '../../../src/services/paymentService';
import type { PaymentTransaction } from '../../../src/types/payment';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentTransaction | null>(null);

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

  // Ledger summary calculations
  const { totalInflows, totalOutflows, activeEscrow } = useMemo(() => {
    let inflows = 0;
    let outflows = 0;
    let escrow = 0;

    for (const t of transactions) {
      if (t.type === 'SELLER_PAYOUT' || t.type === 'RENTAL_REFUND') {
        if (t.status === 'PAID' || t.status === 'REFUNDED') {
          inflows += t.amount;
        }
      } else if (t.type === 'PURCHASE' || t.type === 'RENTAL_FEE') {
        if (t.status === 'PAID' || t.status === 'RELEASED_TO_SELLER') {
          outflows += t.amount;
        }
      } else if (t.type === 'RENTAL_DEPOSIT') {
        if (t.status === 'HELD_IN_ESCROW' || t.status === 'PAID') {
          escrow += t.amount;
        }
      }
    }

    return { totalInflows: inflows, totalOutflows: outflows, activeEscrow: escrow };
  }, [transactions]);

  const filtered = filterType
    ? transactions.filter((t) => t.type === filterType)
    : transactions;

  const types = ['PURCHASE', 'RENTAL_FEE', 'RENTAL_DEPOSIT', 'RENTAL_REFUND', 'SELLER_PAYOUT'];
  const typeCounts = transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.type] = (acc[t.type] || 0) + 1;
    return acc;
  }, {});

  const handleNavigateToReference = (tx: PaymentTransaction) => {
    setSelectedReceipt(null);
    if (tx.linkType === 'rental' || tx.type.includes('RENTAL')) {
      router.push(`/(tabs)/rental/lease/${tx.referenceId}` as any);
    } else if (tx.type === 'PURCHASE' || tx.type === 'SELLER_PAYOUT' || tx.linkType === 'order') {
      router.push(`/(tabs)/shop/orders/${tx.referenceId}` as any);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="PAYMENT LEDGER" showBack fallbackPath="/(tabs)/profile" />

      {/* Top Ledger Financial Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryGrid}>
          {/* Total Inflows */}
          <View style={[styles.summaryCard, { borderColor: colors.forest }]}>
            <View style={styles.summaryCardTop}>
              <Text style={styles.summaryCardLabel}>TOTAL INFLOWS</Text>
              <Ionicons name="arrow-down-circle" size={14} color={colors.forest} />
            </View>
            <Text style={[styles.summaryCardAmount, { color: colors.forest }]}>
              +{paymentService.formatAmount(totalInflows)}
            </Text>
            <Text style={styles.summaryCardSub}>Payouts & Refunds</Text>
          </View>

          {/* Total Outflows */}
          <View style={[styles.summaryCard, { borderColor: colors.charcoal }]}>
            <View style={styles.summaryCardTop}>
              <Text style={styles.summaryCardLabel}>TOTAL SPENT</Text>
              <Ionicons name="arrow-up-circle" size={14} color={colors.charcoal} />
            </View>
            <Text style={[styles.summaryCardAmount, { color: colors.charcoal }]}>
              −{paymentService.formatAmount(totalOutflows)}
            </Text>
            <Text style={styles.summaryCardSub}>Purchases & Rentals</Text>
          </View>

          {/* Active Escrow */}
          <View style={[styles.summaryCard, { borderColor: '#8C6D3B' }]}>
            <View style={styles.summaryCardTop}>
              <Text style={styles.summaryCardLabel}>ESCROW HELD</Text>
              <Ionicons name="lock-closed" size={13} color="#8C6D3B" />
            </View>
            <Text style={[styles.summaryCardAmount, { color: '#8C6D3B' }]}>
              {paymentService.formatAmount(activeEscrow)}
            </Text>
            <Text style={styles.summaryCardSub}>Security Deposits</Text>
          </View>
        </View>
      </View>

      {/* Type Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[styles.filterChip, filterType === null && styles.filterChipActive]}
          onPress={() => setFilterType(null)}
          activeOpacity={0.7}
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
            activeOpacity={0.7}
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
          <Text style={styles.emptyText}>NO TRANSACTIONS RECORDED</Text>
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
            const isCredit = tx.type === 'SELLER_PAYOUT' || tx.type === 'RENTAL_REFUND';

            return (
              <TouchableOpacity
                key={tx.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => setSelectedReceipt(tx)}
              >
                <View style={styles.cardLeft}>
                  <View style={[styles.iconWrap, { backgroundColor: meta.color }]}>
                    <Ionicons name={meta.icon} size={18} color={colors.cream} />
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{tx.description}</Text>
                  <View style={styles.cardCategoryRow}>
                    <Text style={styles.cardType}>
                      {tx.type.replace(/_/g, ' ')}
                    </Text>
                    <Text style={styles.cardRefText}>
                      REF: #{tx.referenceId.slice(0, 8).toUpperCase()}
                    </Text>
                  </View>
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
                      isCredit ? styles.creditAmount : styles.debitAmount,
                    ]}
                  >
                    {isCredit ? '+' : '−'}
                    {paymentService.formatAmount(tx.amount)}
                  </Text>
                  <TouchableOpacity
                    style={styles.receiptActionBtn}
                    onPress={() => setSelectedReceipt(tx)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="receipt-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.receiptActionText}>Receipt</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Transaction Receipt Detail Modal */}
      {selectedReceipt && (
        <Modal
          visible={!!selectedReceipt}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedReceipt(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <Ionicons name="receipt-outline" size={18} color={colors.charcoal} />
                  <Text style={styles.modalHeaderTitle}>TRANSACTION RECEIPT</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedReceipt(null)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={22} color={colors.charcoal} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
                {/* Status Hero */}
                <View style={styles.receiptStatusBox}>
                  <View style={[styles.receiptIconCircle, { backgroundColor: paymentService.getStatusMeta(selectedReceipt.status).color }]}>
                    <Ionicons name="checkmark" size={20} color={colors.cream} />
                  </View>
                  <Text style={styles.receiptAmountHero}>
                    {selectedReceipt.type === 'SELLER_PAYOUT' || selectedReceipt.type === 'RENTAL_REFUND' ? '+' : '−'}
                    {paymentService.formatAmount(selectedReceipt.amount)}
                  </Text>
                  <Text style={styles.receiptStatusLabel}>
                    {paymentService.getStatusMeta(selectedReceipt.status).label}
                  </Text>
                </View>

                {/* Ledger Info Table */}
                <View style={styles.receiptTable}>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Transaction Type</Text>
                    <Text style={styles.tableValue}>{selectedReceipt.type.replace(/_/g, ' ')}</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Description</Text>
                    <Text style={[styles.tableValue, { flex: 1, textAlign: 'right' }]}>{selectedReceipt.description}</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Transaction ID</Text>
                    <Text style={styles.tableValueMono}>#{selectedReceipt.id.slice(0, 16).toUpperCase()}</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Reference ID</Text>
                    <Text style={styles.tableValueMono}>#{selectedReceipt.referenceId.slice(0, 16).toUpperCase()}</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Date & Time</Text>
                    <Text style={styles.tableValue}>
                      {new Date(selectedReceipt.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Settlement Currency</Text>
                    <Text style={styles.tableValue}>{selectedReceipt.currency || 'INR'}</Text>
                  </View>
                </View>

                {/* Escrow & Security Assurance */}
                <View style={styles.escrowNotice}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.forest} />
                  <Text style={styles.escrowNoticeText}>
                    Kaphor Escrow Ledger Protection. All rental security deposits and payments are held in verified escrow until successful completion.
                  </Text>
                </View>

                {/* Navigation Button */}
                <TouchableOpacity
                  style={styles.modalActionBtn}
                  onPress={() => handleNavigateToReference(selectedReceipt)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalActionBtnText}>
                    {selectedReceipt.linkType === 'rental' || selectedReceipt.type.includes('RENTAL')
                      ? 'VIEW RENTAL LEASE DOSSIER →'
                      : 'VIEW ASSOCIATED ORDER →'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedReceipt(null)}
                >
                  <Text style={styles.modalCloseText}>CLOSE</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },

  // Top Ledger Summary
  summaryContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    padding: 10,
    borderRadius: 4,
  },
  summaryCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryCardLabel: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  summaryCardAmount: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 2,
  },
  summaryCardSub: {
    fontFamily: typography.mono,
    fontSize: 7,
    color: colors.textMuted,
  },

  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    borderRadius: 3,
  },
  filterChipActive: { backgroundColor: colors.charcoal },
  filterChipText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.4,
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

  list: { padding: 16, gap: 10 },

  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 14,
    borderRadius: 4,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 0,
    elevation: 2,
  },
  cardLeft: { marginRight: 12, justifyContent: 'center' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  cardBody: { flex: 1 },
  cardTitle: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.charcoal,
    marginBottom: 2,
  },
  cardCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  cardType: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.copper,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardRefText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    color: colors.textMuted,
    fontWeight: '700',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  statusText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  cardRight: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  cardAmount: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '900',
    marginBottom: 4,
  },
  creditAmount: {
    color: colors.forest,
  },
  debitAmount: {
    color: colors.charcoal,
  },
  receiptActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  receiptActionText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalContainer: {
    width: Math.min(SCREEN_WIDTH - 36, 420),
    maxHeight: '85%',
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalHeaderTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  modalScroll: {
    padding: 16,
    gap: 14,
  },
  receiptStatusBox: {
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: 18,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 4,
    gap: 6,
  },
  receiptIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  receiptAmountHero: {
    fontFamily: typography.mono,
    fontSize: 24,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  receiptStatusLabel: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  receiptTable: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 4,
    padding: 12,
    gap: 10,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableLabel: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '700',
  },
  tableValue: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.charcoal,
  },
  tableValueMono: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  escrowNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF4EC',
    borderWidth: 1,
    borderColor: colors.forest,
    padding: 10,
    borderRadius: 4,
  },
  escrowNoticeText: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.forest,
    lineHeight: 12,
    flex: 1,
  },
  modalActionBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  modalActionBtnText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.8,
  },
  modalCloseBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalCloseText: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
  },
});
