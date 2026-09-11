import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../../src/services/api';
import { colors, typography } from '../../../src/theme';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { hapticFeedback } from '../../../src/utils/haptics';

const DURATION_PRESETS = [
  { days: 3, label: '3 DAYS', subtitle: 'Weekend Soirée', badge: 'POPULAR' },
  { days: 7, label: '7 DAYS', subtitle: 'Gala & Travel', badge: 'BEST VALUE' },
  { days: 14, label: '14 DAYS', subtitle: 'Extended Season', badge: 'VIP' },
  { days: 1, label: '1 DAY', subtitle: 'Quick Shoot', badge: 'MIN' },
];

export default function RentalReserveScreen() {
  const insets = useSafeAreaInsets();
  const { garmentId, dayRate } = useLocalSearchParams();
  const router = useRouter();
  const [days, setDays] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const fallback = garmentId ? `/(tabs)/rental/${garmentId}` : '/(tabs)/shop';
  useBackHandler(fallback);

  const rate = Number(dayRate) || 0;
  const rentalFee = rate * days;
  const refundableDeposit = 299;
  const damageInsurance = 49;
  const deliveryReturnFee = 199;
  const grandTotal = rentalFee + refundableDeposit + damageInsurance + deliveryReturnFee;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);

  const handleReserve = async () => {
    hapticFeedback.medium();
    setSubmitting(true);
    try {
      const { data } = await api.post('/rentals', {
        garmentId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        message: message.trim() || undefined,
      });
      const rentalOrderId = data.data?.id || data.data?.rentalOrderId;
      
      // Navigate to payment screen with rental details
      router.replace({
        pathname: '/(tabs)/rental/payment',
        params: {
          rentalOrderId,
          garmentId,
          days: String(days),
          dayRate: String(rate),
        },
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Reservation failed.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/shop')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BOOK RENTAL</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>SELECT DURATION PRESET</Text>
        <View style={styles.presetsGrid}>
          {DURATION_PRESETS.map((p) => {
            const isSelected = days === p.days;
            return (
              <TouchableOpacity
                key={p.days}
                style={[styles.presetCard, isSelected && styles.presetCardActive]}
                onPress={() => setDays(p.days)}
                activeOpacity={0.8}
              >
                <View style={styles.presetHeader}>
                  <Text style={[styles.presetDays, isSelected && styles.presetDaysActive]}>
                    {p.label}
                  </Text>
                  {p.badge && (
                    <View style={[styles.presetBadge, isSelected && styles.presetBadgeActive]}>
                      <Text style={[styles.presetBadgeText, isSelected && styles.presetBadgeTextActive]}>
                        {p.badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.presetSubtitle}>{p.subtitle}</Text>
                <Text style={[styles.presetPrice, isSelected && styles.presetPriceActive]}>
                  ₹{(rate * p.days).toLocaleString()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date Timeline Card */}
        <View style={styles.timelineCard}>
          <View style={styles.timelineCol}>
            <Text style={styles.timelineColLabel}>DELIVERY / START</Text>
            <Text style={styles.timelineColValue}>
              {startDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', weekday: 'short' })}
            </Text>
          </View>
          <View style={styles.timelineArrow}>
            <Ionicons name="arrow-forward" size={16} color={colors.crimson} />
            <Text style={styles.timelineDaysCount}>{days} DAYS</Text>
          </View>
          <View style={styles.timelineCol}>
            <Text style={styles.timelineColLabel}>RETURN SCAN / END</Text>
            <Text style={styles.timelineColValue}>
              {endDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', weekday: 'short' })}
            </Text>
          </View>
        </View>

        {/* Booking & Escrow Breakdown */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>PRICE & ESCROW BREAKDOWN</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>RENTAL FEE ({days} DAYS @ ₹{rate}/DAY)</Text>
            <Text style={styles.summaryValue}>₹{rentalFee.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.summaryLabel}>100% REFUNDABLE DEPOSIT</Text>
              <Ionicons name="shield-checkmark" size={13} color={colors.forest || '#2A7B4C'} />
            </View>
            <Text style={[styles.summaryValue, { color: colors.forest || '#2A7B4C' }]}>
              +₹{refundableDeposit}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>DAMAGE COVER & HYGIENIC STEAM</Text>
            <Text style={styles.summaryValue}>+₹{damageInsurance}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>TWO-WAY INSURED COURIER</Text>
            <Text style={styles.summaryValue}>+₹{deliveryReturnFee}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>PAY NOW (INCL. REFUNDABLE DEPOSIT)</Text>
            <Text style={styles.totalValue}>₹{grandTotal.toLocaleString()}</Text>
          </View>
          <Text style={styles.depositReturnNotice}>
            * ₹{refundableDeposit} refundable deposit is automatically refunded to your original payment method after return quality scan.
          </Text>
        </View>

        {/* Trust Badges */}
        <View style={styles.policyCard}>
          <Ionicons name="shield-checkmark" size={22} color={colors.crimson} />
          <View style={{ flex: 1 }}>
            <Text style={styles.policyTitle}>KAPHOR CIRCULAR ESCROW PROTECTION</Text>
            <Text style={styles.policyText}>
              Your deposit remains locked in secure escrow. Free returns with doorstep pickup included in every rental.
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={styles.sectionTitle}>MESSAGE THE OWNER (OPTIONAL)</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Add any notes about pickup, fit questions, or event timings…"
            placeholderTextColor={colors.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.reserveBtn} onPress={handleReserve} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.reserveBtnText}>PROCEED TO PAYMENT • ₹{grandTotal.toLocaleString()}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 24, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontFamily: 'BebasNeue_400Regular', letterSpacing: 2 },
  content: { padding: 20, paddingBottom: 120 },
  sectionTitle: { color: colors.textPrimary, fontSize: 12, fontFamily: typography.mono, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  
  // Presets Grid
  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  presetCard: {
    width: '48%',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
  },
  presetCardActive: {
    borderColor: colors.crimson,
    backgroundColor: 'rgba(155, 27, 48, 0.05)',
  },
  presetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  presetDays: { fontFamily: typography.mono, fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  presetDaysActive: { color: colors.crimson },
  presetBadge: { backgroundColor: 'rgba(0,0,0,0.06)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  presetBadgeActive: { backgroundColor: colors.crimson },
  presetBadgeText: { fontSize: 8, fontFamily: typography.mono, fontWeight: '800', color: colors.textMuted },
  presetBadgeTextActive: { color: colors.white },
  presetSubtitle: { fontSize: 11, color: colors.textMuted, marginBottom: 8, fontWeight: '500' },
  presetPrice: { fontFamily: typography.mono, fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  presetPriceActive: { color: colors.crimson },

  // Timeline Card
  timelineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  timelineCol: { flex: 1 },
  timelineColLabel: { fontSize: 9, fontFamily: typography.mono, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  timelineColValue: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  timelineArrow: { alignItems: 'center', paddingHorizontal: 12 },
  timelineDaysCount: { fontSize: 8, fontFamily: typography.mono, fontWeight: '800', color: colors.crimson, marginTop: 2 },

  // Summary Card
  summaryCard: { backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  summaryTitle: { color: colors.textPrimary, fontSize: 11, fontFamily: typography.mono, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 0.5, fontWeight: '600', flex: 1 },
  summaryValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', fontFamily: typography.mono },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  totalLabel: { color: colors.textPrimary, fontSize: 12, fontWeight: '800', letterSpacing: 1, flex: 1 },
  totalValue: { color: colors.crimson, fontSize: 22, fontWeight: '800', fontFamily: typography.mono },
  depositReturnNotice: { fontSize: 10, color: colors.textMuted, fontStyle: 'italic', marginTop: 10, lineHeight: 14 },

  policyCard: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: 'rgba(155, 27, 48, 0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(155, 27, 48, 0.15)' },
  policyTitle: { color: colors.crimson, fontSize: 11, fontFamily: typography.mono, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  policyText: { color: colors.textMuted, fontSize: 11, flex: 1, lineHeight: 16, fontWeight: '500' },
  
  messageInput: {
    marginTop: 10,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    fontSize: 13,
    fontWeight: '500',
  },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, position: 'absolute', bottom: 0, left: 0, right: 0 },
  reserveBtn: { 
    backgroundColor: colors.crimson, 
    height: 56, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  reserveBtnText: { color: colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
});
