import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, Platform, KeyboardAvoidingView } from 'react-native';
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

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function RentalReserveScreen() {
  const insets = useSafeAreaInsets();
  const { garmentId, dayRate } = useLocalSearchParams();
  const router = useRouter();

  // Initialize dates
  const initialStart = new Date();
  initialStart.setDate(initialStart.getDate() + 1);
  initialStart.setHours(10, 0, 0, 0);

  const initialEnd = new Date(initialStart);
  initialEnd.setDate(initialEnd.getDate() + 3);

  const [startDate, setStartDate] = useState<Date>(initialStart);
  const [endDate, setEndDate] = useState<Date>(initialEnd);
  const [days, setDays] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // Date picker modal state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'start' | 'end'>('start');
  const [viewDate, setViewDate] = useState<Date>(new Date(initialStart));

  const fallback = garmentId ? `/(tabs)/rental/${garmentId}` : '/(tabs)/shop';
  useBackHandler(fallback);

  const rate = Number(dayRate) || 0;
  const rentalFee = rate * days;
  const refundableDeposit = 299;
  const damageInsurance = 49;
  const deliveryReturnFee = 199;
  const grandTotal = rentalFee + refundableDeposit + damageInsurance + deliveryReturnFee;

  // Handle Duration Preset Selection
  const handleSelectPreset = (presetDays: number) => {
    hapticFeedback.selection();
    setDays(presetDays);
    const newEnd = new Date(startDate);
    newEnd.setDate(newEnd.getDate() + presetDays);
    setEndDate(newEnd);
  };

  // Stepper increment/decrement
  const handleAdjustDays = (delta: number) => {
    const nextDays = Math.max(1, Math.min(30, days + delta));
    hapticFeedback.selection();
    setDays(nextDays);
    const newEnd = new Date(startDate);
    newEnd.setDate(newEnd.getDate() + nextDays);
    setEndDate(newEnd);
  };

  // Open Calendar Picker
  const openDatePicker = (mode: 'start' | 'end') => {
    hapticFeedback.light();
    setPickerMode(mode);
    setViewDate(new Date(mode === 'start' ? startDate : endDate));
    setPickerVisible(true);
  };

  // Calendar Day Clicked
  const handleSelectDay = (day: number) => {
    hapticFeedback.selection();
    const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, 10, 0, 0, 0);

    if (pickerMode === 'start') {
      setStartDate(selected);
      // Keep duration, shift end date
      const newEnd = new Date(selected);
      newEnd.setDate(newEnd.getDate() + days);
      setEndDate(newEnd);
      setPickerVisible(false);
    } else {
      // Picked end date
      if (selected <= startDate) {
        Alert.alert('Invalid Return Date', 'Return date must be after the delivery start date.');
        return;
      }
      setEndDate(selected);
      const diffTime = Math.abs(selected.getTime() - startDate.getTime());
      const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
      setDays(diffDays);
      setPickerVisible(false);
    }
  };

  // Quick Date Jump helper
  const handleQuickJump = (daysAhead: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysAhead);
    target.setHours(10, 0, 0, 0);
    hapticFeedback.selection();

    if (pickerMode === 'start') {
      setStartDate(target);
      const newEnd = new Date(target);
      newEnd.setDate(newEnd.getDate() + days);
      setEndDate(newEnd);
    } else {
      if (target <= startDate) {
        Alert.alert('Invalid Return Date', 'Return date must be after the start date.');
        return;
      }
      setEndDate(target);
      const diffTime = Math.abs(target.getTime() - startDate.getTime());
      const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
      setDays(diffDays);
    }
    setPickerVisible(false);
  };

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

  // Calendar rendering helpers
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevMonth = () => {
    const prev = new Date(year, month - 1, 1);
    if (prev >= new Date(today.getFullYear(), today.getMonth(), 1)) {
      setViewDate(prev);
    }
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/shop')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BOOK RENTAL DATES</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Interactive Date Timeline / Schedule Card */}
        <Text style={styles.sectionTitle}>RENTAL SCHEDULE (TAP DATE TO EDIT)</Text>
        <View style={styles.timelineCard}>
          {/* Start Date Column */}
          <TouchableOpacity 
            style={styles.timelineCol} 
            onPress={() => openDatePicker('start')}
            activeOpacity={0.8}
          >
            <View style={styles.colHeader}>
              <Ionicons name="calendar" size={13} color={colors.crimson} />
              <Text style={styles.timelineColLabel}>DELIVERY / START</Text>
            </View>
            <Text style={styles.timelineColValue}>
              {startDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', weekday: 'short' })}
            </Text>
            <View style={styles.editBadge}>
              <Ionicons name="pencil" size={10} color={colors.crimson} />
              <Text style={styles.editBadgeText}>EDIT</Text>
            </View>
          </TouchableOpacity>

          {/* Center Duration Indicator */}
          <View style={styles.timelineArrow}>
            <Ionicons name="arrow-forward" size={16} color={colors.crimson} />
            <Text style={styles.timelineDaysCount}>{days} DAYS</Text>
          </View>

          {/* End Date Column */}
          <TouchableOpacity 
            style={styles.timelineCol} 
            onPress={() => openDatePicker('end')}
            activeOpacity={0.8}
          >
            <View style={styles.colHeader}>
              <Ionicons name="calendar" size={13} color={colors.forest || '#2A7B4C'} />
              <Text style={styles.timelineColLabel}>RETURN / END</Text>
            </View>
            <Text style={styles.timelineColValue}>
              {endDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', weekday: 'short' })}
            </Text>
            <View style={[styles.editBadge, { backgroundColor: 'rgba(42,123,76,0.1)' }]}>
              <Ionicons name="pencil" size={10} color={colors.forest || '#2A7B4C'} />
              <Text style={[styles.editBadgeText, { color: colors.forest || '#2A7B4C' }]}>EDIT</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Duration Adjuster Stepper */}
        <View style={styles.stepperCard}>
          <View>
            <Text style={styles.stepperTitle}>CUSTOM DURATION</Text>
            <Text style={styles.stepperSubtitle}>Fine-tune exact rental days</Text>
          </View>
          <View style={styles.stepperControls}>
            <TouchableOpacity 
              style={[styles.stepperBtn, days <= 1 && { opacity: 0.3 }]} 
              onPress={() => handleAdjustDays(-1)}
              disabled={days <= 1}
            >
              <Ionicons name="remove" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{days} {days === 1 ? 'DAY' : 'DAYS'}</Text>
            <TouchableOpacity 
              style={[styles.stepperBtn, days >= 30 && { opacity: 0.3 }]} 
              onPress={() => handleAdjustDays(1)}
              disabled={days >= 30}
            >
              <Ionicons name="add" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Presets */}
        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>POPULAR DURATION PACKAGES</Text>
        <View style={styles.presetsGrid}>
          {DURATION_PRESETS.map((p) => {
            const isSelected = days === p.days;
            return (
              <TouchableOpacity
                key={p.days}
                style={[styles.presetCard, isSelected && styles.presetCardActive]}
                onPress={() => handleSelectPreset(p.days)}
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

        {/* Price & Escrow Breakdown */}
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

        {/* Protection & Trust Policy */}
        <View style={styles.policyCard}>
          <Ionicons name="shield-checkmark" size={22} color={colors.crimson} />
          <View style={{ flex: 1 }}>
            <Text style={styles.policyTitle}>KAPHOR CIRCULAR ESCROW PROTECTION</Text>
            <Text style={styles.policyText}>
              Your deposit remains locked in secure escrow. Free returns with doorstep pickup included in every rental.
            </Text>
          </View>
        </View>

        {/* Message / Notes */}
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

      {/* Interactive Date Picker Modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => setPickerVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalPre}>SELECT CALENDAR DATE</Text>
                <Text style={styles.modalTitle}>
                  {pickerMode === 'start' ? 'DELIVERY START DATE' : 'RETURN END DATE'}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.closeBtn} 
                onPress={() => setPickerVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Quick Jumps */}
            <View style={styles.quickJumpsRow}>
              <TouchableOpacity style={styles.quickJumpChip} onPress={() => handleQuickJump(1)}>
                <Text style={styles.quickJumpText}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickJumpChip} onPress={() => handleQuickJump(3)}>
                <Text style={styles.quickJumpText}>In 3 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickJumpChip} onPress={() => handleQuickJump(7)}>
                <Text style={styles.quickJumpText}>Next Week</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickJumpChip} onPress={() => handleQuickJump(14)}>
                <Text style={styles.quickJumpText}>In 2 Weeks</Text>
              </TouchableOpacity>
            </View>

            {/* Month Header */}
            <View style={styles.monthHeader}>
              <TouchableOpacity onPress={prevMonth} style={styles.monthNavBtn}>
                <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>
                {viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase()}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.monthNavBtn}>
                <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Days of Week Row */}
            <View style={styles.weekDaysRow}>
              {DAYS_OF_WEEK.map((d) => (
                <Text key={d} style={styles.weekDayText}>{d}</Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {/* Leading Empty Cells */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.calendarCell} />
              ))}

              {/* Day Cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const cellDate = new Date(year, month, dayNum, 0, 0, 0, 0);
                const isPast = cellDate < today;

                const isStart = (
                  cellDate.getFullYear() === startDate.getFullYear() &&
                  cellDate.getMonth() === startDate.getMonth() &&
                  cellDate.getDate() === startDate.getDate()
                );

                const isEnd = (
                  cellDate.getFullYear() === endDate.getFullYear() &&
                  cellDate.getMonth() === endDate.getMonth() &&
                  cellDate.getDate() === endDate.getDate()
                );

                const isInRange = cellDate >= startDate && cellDate <= endDate;
                const isDisabled = isPast || (pickerMode === 'end' && cellDate <= startDate);

                return (
                  <TouchableOpacity
                    key={`day-${dayNum}`}
                    style={[
                      styles.calendarCell,
                      isInRange && styles.calendarCellRange,
                      (isStart || isEnd) && styles.calendarCellSelected,
                      isDisabled && styles.calendarCellDisabled,
                    ]}
                    onPress={() => !isDisabled && handleSelectDay(dayNum)}
                    disabled={isDisabled}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        (isStart || isEnd) && styles.calendarDayTextSelected,
                        isDisabled && styles.calendarDayTextDisabled,
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Fixed Footer with Safe Bottom Padding */}
      <View style={[
        styles.footer,
        {
          paddingBottom: Math.max(
            insets.bottom + 12,
            Platform.OS === 'android' ? 24 : 16
          )
        }
      ]}>
        <TouchableOpacity 
          style={styles.reserveBtn} 
          onPress={handleReserve} 
          disabled={submitting}
          activeOpacity={0.88}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.reserveBtnText}>
              PROCEED TO PAYMENT • ₹{grandTotal.toLocaleString()}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { 
    paddingTop: 24, 
    paddingHorizontal: 24, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontFamily: 'BebasNeue_400Regular', letterSpacing: 2 },
  content: { padding: 20, paddingBottom: 130 },
  sectionTitle: { 
    color: colors.textPrimary, 
    fontSize: 11, 
    fontFamily: typography.mono, 
    fontWeight: '800', 
    letterSpacing: 1.5, 
    marginBottom: 12 
  },
  
  // Timeline Card
  timelineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  timelineCol: { 
    flex: 1,
    backgroundColor: colors.bg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  timelineColLabel: { 
    fontSize: 8.5, 
    fontFamily: typography.mono, 
    fontWeight: '800', 
    color: colors.textMuted, 
    letterSpacing: 0.5, 
  },
  timelineColValue: { fontSize: 13, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(155, 27, 48, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  editBadgeText: {
    fontSize: 8.5,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.crimson,
    letterSpacing: 0.5,
  },
  timelineArrow: { alignItems: 'center', paddingHorizontal: 10 },
  timelineDaysCount: { 
    fontSize: 9, 
    fontFamily: typography.mono, 
    fontWeight: '900', 
    color: colors.crimson, 
    marginTop: 2 
  },

  // Stepper
  stepperCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  stepperTitle: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  stepperSubtitle: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperValue: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: colors.crimson,
    minWidth: 56,
    textAlign: 'center',
  },

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

  // Summary Card
  summaryCard: { 
    backgroundColor: colors.bgCard, 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: colors.border 
  },
  summaryTitle: { 
    color: colors.textPrimary, 
    fontSize: 11, 
    fontFamily: typography.mono, 
    fontWeight: '800', 
    letterSpacing: 1.5, 
    marginBottom: 16 
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 0.5, fontWeight: '600', flex: 1 },
  summaryValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', fontFamily: typography.mono },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  totalLabel: { color: colors.textPrimary, fontSize: 12, fontWeight: '800', letterSpacing: 1, flex: 1 },
  totalValue: { color: colors.crimson, fontSize: 22, fontWeight: '800', fontFamily: typography.mono },
  depositReturnNotice: { fontSize: 10, color: colors.textMuted, fontStyle: 'italic', marginTop: 10, lineHeight: 14 },

  policyCard: { 
    flexDirection: 'row', 
    gap: 12, 
    padding: 16, 
    backgroundColor: 'rgba(155, 27, 48, 0.04)', 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: 'rgba(155, 27, 48, 0.15)' 
  },
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
  footer: { 
    padding: 20, 
    borderTopWidth: 1, 
    borderTopColor: colors.border, 
    backgroundColor: colors.bg, 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0 
  },
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

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalPre: {
    fontSize: 9,
    fontFamily: typography.mono,
    color: colors.crimson,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modalTitle: {
    fontSize: 14,
    fontFamily: typography.mono,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickJumpsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickJumpChip: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  quickJumpText: {
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 8,
  },
  monthNavBtn: {
    padding: 6,
  },
  monthLabel: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekDayText: {
    width: 36,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: '700',
    color: colors.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calendarCell: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 8,
  },
  calendarCellRange: {
    backgroundColor: 'rgba(155, 27, 48, 0.08)',
  },
  calendarCellSelected: {
    backgroundColor: colors.crimson,
    borderRadius: 10,
  },
  calendarCellDisabled: {
    opacity: 0.25,
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.mono,
  },
  calendarDayTextSelected: {
    color: colors.white,
    fontWeight: '900',
  },
  calendarDayTextDisabled: {
    color: colors.textMuted,
  },
});
