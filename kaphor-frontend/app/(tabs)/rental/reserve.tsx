import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/services/api';

export default function RentalReserveScreen() {
  const { garmentId, dayRate } = useLocalSearchParams();
  const router = useRouter();
  const [days, setDays] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  const rate = Number(dayRate) || 0;
  const total = rate * days;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);

  const handleReserve = async () => {
    setSubmitting(true);
    try {
      await api.post('/rentals', {
        garmentId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      Alert.alert('Reserved!', `Your rental is confirmed for ${days} days.`, [
        { text: 'VIEW RENTALS', onPress: () => router.replace('/(tabs)/rental/index') },
      ]);
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
          <Ionicons name="chevron-back" size={28} color="white" />
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

        <View style={styles.policyCard}>
          <Ionicons name="shield-checkmark" size={20} color="#C9A84C" />
          <Text style={styles.policyText}>
            Free returns within 24h of delivery. Insurance included for heritage pieces.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.reserveBtn} onPress={handleReserve} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#1A0C10" /> : <Text style={styles.reserveBtnText}>CONFIRM RESERVATION</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0C10' },
  header: { paddingTop: 60, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { color: '#C9A84C', fontSize: 16, fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 2 },
  content: { padding: 24, paddingBottom: 120 },
  sectionTitle: { color: '#C9A84C', fontSize: 14, fontWeight: '700', letterSpacing: 2, marginBottom: 16 },
  durationRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  durationChip: { flex: 1, paddingVertical: 16, borderRadius: 8, borderWidth: 1, borderColor: '#3A2C30', alignItems: 'center' },
  durationActive: { borderColor: '#C9A84C', backgroundColor: 'rgba(201,168,76,0.12)' },
  durationText: { color: '#6B5C52', fontSize: 12, fontWeight: '700' },
  durationTextActive: { color: '#C9A84C' },
  summaryCard: { backgroundColor: '#2A1C20', borderRadius: 12, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(201,168,76,0.1)' },
  summaryTitle: { color: '#C9A84C', fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  summaryLabel: { color: '#6B5C52', fontSize: 12, letterSpacing: 1 },
  summaryValue: { color: 'white', fontSize: 14 },
  divider: { height: 1, backgroundColor: '#3A2C30', marginVertical: 14 },
  totalLabel: { color: '#C9A84C', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  totalValue: { color: '#C9A84C', fontSize: 20, fontWeight: '700' },
  policyCard: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: 'rgba(201,168,76,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(201,168,76,0.1)' },
  policyText: { color: '#6B5C52', fontSize: 12, flex: 1, lineHeight: 18 },
  footer: { padding: 24, borderTopWidth: 1, borderTopColor: '#3A2C30', backgroundColor: '#1A0C10' },
  reserveBtn: { backgroundColor: '#C9A84C', height: 56, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  reserveBtnText: { color: '#1A0C10', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
});
