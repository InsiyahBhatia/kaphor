import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/services/api';
import { colors, typography } from '../../../src/theme';

export default function RentalReserveScreen() {
  const { garmentId, dayRate } = useLocalSearchParams();
  const router = useRouter();
  const [days, setDays] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const rate = Number(dayRate) || 0;
  const total = rate * days;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);

  const handleReserve = async () => {
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BOOK RENTAL</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>SELECT DURATION</Text>
        <View style={styles.durationRow}>
          {[1, 3, 5, 7].map((d) => (
            <TouchableOpacity key={d} style={[styles.durationChip, days === d && styles.durationActive]} onPress={() => setDays(d)}>
              <Text style={[styles.durationText, days === d && styles.durationTextActive]}>{d} {d === 1 ? 'DAY' : 'DAYS'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>BOOKING SUMMARY</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>START</Text>
            <Text style={styles.summaryValue}>{startDate.toLocaleDateString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>END</Text>
            <Text style={styles.summaryValue}>{endDate.toLocaleDateString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>RATE</Text>
            <Text style={styles.summaryValue}>₹{rate.toLocaleString()} / day</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>₹{total.toLocaleString()}</Text>
          </View>
        </View>

        {/* Security Deposit Note */}
        <View style={styles.policyCard}>
          <Ionicons name="shield-checkmark" size={20} color={colors.crimson} />
          <View style={{ flex: 1 }}>
            <Text style={styles.policyTitle}>SECURITY DEPOSIT REQUIRED</Text>
            <Text style={styles.policyText}>
              A refundable deposit of 2× the rental fee will be charged and returned within 48 hours after item is returned in good condition.
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 18 }}>
          <Text style={styles.sectionTitle}>MESSAGE THE OWNER (OPTIONAL)</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Add any notes about pickup, care instructions, or preferred delivery timing…"
            placeholderTextColor={colors.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.reserveBtn} onPress={handleReserve} disabled={submitting}>
          {submitting ? <ActivityIndicator color={colors.white} /> :          <Text style={styles.reserveBtnText}>PROCEED TO PAYMENT</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 24, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontFamily: 'BebasNeue_400Regular', letterSpacing: 2 },
  content: { padding: 24, paddingBottom: 100 },
  sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 16 },
  durationRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  durationChip: { flex: 1, paddingVertical: 18, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.bgCard },
  durationActive: { borderColor: colors.crimson, backgroundColor: 'rgba(155, 27, 48, 0.05)' },
  durationText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  durationTextActive: { color: colors.crimson, fontWeight: '800' },
  summaryCard: { backgroundColor: colors.bgCard, borderRadius: 20, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: colors.border },
  summaryTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 2, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  summaryLabel: { color: colors.textMuted, fontSize: 12, letterSpacing: 1, fontWeight: '700' },
  summaryValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  totalLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  totalValue: { color: colors.crimson, fontSize: 24, fontWeight: '800' },
  policyCard: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: 'rgba(155, 27, 48, 0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(155, 27, 48, 0.1)' },
  policyTitle: { color: colors.crimson, fontSize: 11, fontFamily: typography.mono, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  policyText: { color: colors.textMuted, fontSize: 12, flex: 1, lineHeight: 18, fontWeight: '500' },
  messageInput: {
    marginTop: 10,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 90,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: { padding: 24, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, position: 'absolute', bottom: 0, left: 0, right: 0 },
  reserveBtn: { 
    backgroundColor: colors.crimson, 
    height: 60, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  reserveBtnText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
});
