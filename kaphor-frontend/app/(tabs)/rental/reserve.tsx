import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, Platform, KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../../src/services/api';
import { addressService, Address } from '../../../src/services/addressService';
import { colors, typography } from '../../../src/theme';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { hapticFeedback } from '../../../src/utils/haptics';
import { telemetryService } from '../../../src/services/telemetryService';
import { useAuth } from '../../../src/context/AuthContext';

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
  const { user } = useAuth();

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Address state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  // Date picker modal state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'start' | 'end'>('start');
  const [viewDate, setViewDate] = useState<Date>(new Date(initialStart));

  const fallback = garmentId ? `/(tabs)/rental/${garmentId}` : '/(tabs)/shop';
  useBackHandler(fallback);

  // Live Availability Check State
  const [availabilityState, setAvailabilityState] = useState<{
    checking: boolean;
    isAvailable: boolean;
    sellerId?: string;
    bookedRanges: Array<{ startDate: string; endDate: string }>;
  }>({
    checking: false,
    isAvailable: true,
    bookedRanges: [],
  });

  const isOwner = Boolean(user && availabilityState.sellerId && user.id === availabilityState.sellerId);

  useEffect(() => {
    if (!garmentId) return;
    setAvailabilityState((prev) => ({ ...prev, checking: true }));
    api
      .get('/rentals/check-availability', {
        params: {
          garmentId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      })
      .then((res) => {
        const data = res.data?.data;
        setAvailabilityState({
          checking: false,
          isAvailable: data ? data.isAvailable !== false : true,
          sellerId: data?.sellerId,
          bookedRanges: data?.bookedRanges || [],
        });
      })
      .catch(() => {
        setAvailabilityState((prev) => ({ ...prev, checking: false, isAvailable: true }));
      });
  }, [garmentId, startDate, endDate]);

  // Load addresses on focus
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      (async () => {
        try {
          setLoadingAddresses(true);
          const list = await addressService.list();
          if (isMounted) {
            setAddresses(list || []);
            const activeFromService = addressService.getActiveDeliveryAddress();
            if (activeFromService && list.some((a) => a.id === activeFromService.id)) {
              setSelectedAddress(activeFromService);
            } else if (!selectedAddress || !list.some((a) => a.id === selectedAddress.id)) {
              const def = list.find((a) => a.isDefault) || list[0] || null;
              setSelectedAddress(def);
              if (def) addressService.setActiveDeliveryAddress(def);
            }
          }
        } catch (err) {
          console.warn('Failed to load addresses', err);
        } finally {
          if (isMounted) setLoadingAddresses(false);
        }
      })();
      return () => { isMounted = false; };
    }, [])
  );

  useEffect(() => {
    const unsub = addressService.onSelectedAddressChange((addr) => {
      if (addr) setSelectedAddress(addr);
    });
    if (garmentId) {
      telemetryService.trackIntent(String(garmentId), 'RENTAL');
    }
    return unsub;
  }, [garmentId]);

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
    if (isOwner) {
      setErrorMessage('You are the listed owner of this garment. Circular rentals can only be requested by other archive members.');
      Alert.alert('Owner Restriction', 'You cannot rent your own listed archive piece.');
      return;
    }

    if (!availabilityState.isAvailable) {
      setErrorMessage('These rental dates conflict with an existing lease on this piece. Please adjust your delivery or return dates.');
      Alert.alert(
        'Dates Unavailable',
        'These rental dates conflict with an existing lease on this piece. Please adjust your delivery or return dates.'
      );
      return;
    }

    if (!selectedAddress) {
      Alert.alert(
        'Delivery Address Required',
        'Please select or add a delivery address for your insured rental courier.',
        [
          { text: 'Add Address', onPress: () => router.push('/profile/addresses?selectMode=true' as any) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    setErrorMessage(null);
    hapticFeedback.medium();
    setSubmitting(true);
    try {
      const { data } = await api.post('/rentals', {
        garmentId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        message: message.trim() || undefined,
        shippingAddress: {
          id: selectedAddress.id,
          fullName: selectedAddress.fullName,
          phone: selectedAddress.phone,
          line1: selectedAddress.line1,
          line2: selectedAddress.line2,
          landmark: selectedAddress.landmark,
          city: selectedAddress.city,
          state: selectedAddress.state,
          pincode: selectedAddress.pincode,
        },
        metadata: {
          days,
          dayRate: rate,
          rentalFee,
          refundableDeposit,
          damageInsurance,
          deliveryReturnFee,
          grandTotal,
        },
      });
      const rentalOrderId = data?.id || data?.rentalOrderId || data?.data?.id || data?.data?.rentalOrderId;
      if (garmentId) {
        telemetryService.trackConversion(String(garmentId), 'RENTAL');
      }

      const targetRoute = rentalOrderId ? `/(tabs)/rental/lease/${rentalOrderId}` : '/(tabs)/rental?tab=my';

      Alert.alert(
        'Rental Request Submitted',
        'Your request has been sent to the garment owner. Once the owner approves your dates, you will be notified to proceed with payment and escrow verification.',
        [
          {
            text: 'View Request Status',
            onPress: () => router.replace(targetRoute as any),
          }
        ]
      );

      router.replace(targetRoute as any);
    } catch (err: any) {
      console.error('[Rental Reservation Failed]:', err?.response?.data || err?.message);
      const backendMsg = err?.response?.data?.message || err?.response?.data?.error;
      const msg = backendMsg || err?.message || 'Reservation failed. Please check your selected dates and address.';
      setErrorMessage(msg);
      Alert.alert('Rental Notice', msg);
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
        <Text style={styles.headerTitle}>REQUEST RENTAL & DATES</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
      >
        {/* Owner Restriction Notice */}
        {isOwner && (
          <View style={styles.ownerWarningCard}>
            <Ionicons name="information-circle" size={20} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.ownerWarningTitle}>YOUR LISTED ARCHIVE PIECE</Text>
              <Text style={styles.ownerWarningDesc}>
                You are the listed owner of this garment. Under platform rules, you cannot place a rental booking on your own archive items.
              </Text>
            </View>
          </View>
        )}

        {/* Dynamic Reservation Error Notice */}
        {errorMessage && (
          <View style={styles.errorBannerCard}>
            <Ionicons name="alert-circle" size={20} color={colors.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorBannerTitle}>RESERVATION NOTICE</Text>
              <Text style={styles.errorBannerDesc}>{errorMessage}</Text>
            </View>
            <TouchableOpacity onPress={() => setErrorMessage(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={18} color={colors.red} />
            </TouchableOpacity>
          </View>
        )}

        {/* Real-time Availability Verification Status */}
        <View style={[
          styles.availabilityVerificationCard,
          availabilityState.isAvailable ? styles.availabilityCardOk : styles.availabilityCardWarn
        ]}>
          <View style={styles.availabilityStatusRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {availabilityState.checking ? (
                <ActivityIndicator size="small" color={colors.charcoal} />
              ) : (
                <Ionicons
                  name={availabilityState.isAvailable ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={availabilityState.isAvailable ? '#2E7D32' : colors.red}
                />
              )}
              <Text style={[
                styles.availabilityStatusTitle,
                { color: availabilityState.isAvailable ? '#2E7D32' : colors.red }
              ]}>
                {availabilityState.checking
                  ? 'VERIFYING ATELIER AVAILABILITY...'
                  : availabilityState.isAvailable
                  ? '✓ DATES AVAILABLE TO RENT'
                  : '⚠ DATES CONFLICT WITH EXISTING LEASE'}
              </Text>
            </View>
            <View style={[
              styles.availabilityPill,
              availabilityState.isAvailable ? styles.availabilityPillOk : styles.availabilityPillWarn
            ]}>
              <Text style={[
                styles.availabilityPillText,
                { color: availabilityState.isAvailable ? '#2E7D32' : colors.red }
              ]}>
                {availabilityState.isAvailable ? 'AVAILABLE' : 'BOOKED'}
              </Text>
            </View>
          </View>
          <Text style={styles.availabilityStatusDesc}>
            {availabilityState.isAvailable
              ? 'Sanitized and cleared in atelier storage. Ready for courier dispatch on your selected event dates.'
              : 'This garment is already rented out for these dates. Tap either date below to pick an alternate window.'}
          </Text>
        </View>

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

        {/* Delivery Address Section */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>DELIVERY ADDRESS (INSURED COURIER)</Text>
        <View style={styles.addressCard}>
          {loadingAddresses ? (
            <ActivityIndicator size="small" color={colors.crimson} style={{ paddingVertical: 12 }} />
          ) : selectedAddress ? (
            <View>
              <View style={styles.addressHeaderRow}>
                <View style={styles.addressLabelBadge}>
                  <Ionicons name="location-sharp" size={11} color={colors.crimson} />
                  <Text style={styles.addressLabelBadgeText}>{selectedAddress.label.toUpperCase()}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    hapticFeedback.selection();
                    setAddressModalVisible(true);
                  }}
                  style={styles.changeAddressBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeAddressBtnText}>CHANGE</Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.crimson} />
                </TouchableOpacity>
              </View>

              <Text style={styles.addressRecipientText}>{selectedAddress.fullName} • {selectedAddress.phone}</Text>
              <Text style={styles.addressLinesText}>
                {selectedAddress.line1}
                {selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}
                {selectedAddress.landmark ? ` (Near ${selectedAddress.landmark})` : ''}
              </Text>
              <Text style={styles.addressCityStateText}>
                {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}
              </Text>
            </View>
          ) : (
            <View style={styles.emptyAddressBox}>
              <Ionicons name="location-outline" size={26} color={colors.crimson} />
              <Text style={styles.emptyAddressTitle}>NO DELIVERY ADDRESS SELECTED</Text>
              <Text style={styles.emptyAddressSub}>Please add the delivery destination for this rental</Text>
              <TouchableOpacity
                style={styles.addAddressCta}
                onPress={() => router.push('/profile/addresses?selectMode=true' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color={colors.white} />
                <Text style={styles.addAddressCtaText}>ADD DELIVERY ADDRESS</Text>
              </TouchableOpacity>
            </View>
          )}
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
                const isBooked = (availabilityState.bookedRanges || []).some((r: any) => {
                  const bStart = new Date(r.startDate);
                  const bEnd = new Date(r.endDate);
                  bStart.setHours(0, 0, 0, 0);
                  bEnd.setHours(23, 59, 59, 999);
                  return cellDate >= bStart && cellDate <= bEnd;
                });
                const isDisabled = isPast || (pickerMode === 'end' && cellDate <= startDate) || isBooked;

                return (
                  <TouchableOpacity
                    key={`day-${dayNum}`}
                    style={[
                      styles.calendarCell,
                      isInRange && styles.calendarCellRange,
                      (isStart || isEnd) && styles.calendarCellSelected,
                      isDisabled && styles.calendarCellDisabled,
                      isBooked && styles.calendarCellBooked,
                    ]}
                    onPress={() => !isDisabled && handleSelectDay(dayNum)}
                    disabled={isDisabled}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        (isStart || isEnd) && styles.calendarDayTextSelected,
                        isDisabled && styles.calendarDayTextDisabled,
                        isBooked && styles.calendarDayTextBooked,
                      ]}
                    >
                      {dayNum}
                    </Text>
                    {isBooked && <View style={styles.bookedDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Address Picker Modal */}
      <Modal
        visible={addressModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setAddressModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalPre}>SELECT DELIVERY DESTINATION</Text>
                <Text style={styles.modalTitle}>SAVED ADDRESSES</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setAddressModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {addresses.map((addr) => {
                const isSelected = selectedAddress?.id === addr.id;
                return (
                  <TouchableOpacity
                    key={addr.id}
                    style={[styles.addressItemRow, isSelected && styles.addressItemRowSelected]}
                    onPress={() => {
                      hapticFeedback.selection();
                      setSelectedAddress(addr);
                      addressService.setActiveDeliveryAddress(addr);
                      setAddressModalVisible(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Text style={styles.addressItemLabel}>{addr.label.toUpperCase()}</Text>
                        {addr.isDefault && <Text style={styles.defaultBadge}>DEFAULT</Text>}
                      </View>
                      <Text style={styles.addressItemName}>{addr.fullName} • {addr.phone}</Text>
                      <Text style={styles.addressItemDetails} numberOfLines={2}>
                        {addr.line1}, {addr.city}, {addr.state} - {addr.pincode}
                      </Text>
                    </View>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {addresses.length === 0 && (
                <Text style={{ textAlign: 'center', color: colors.textMuted, marginVertical: 20 }}>
                  No saved addresses found
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.manageAddressBtn}
              onPress={() => {
                setAddressModalVisible(false);
                router.push('/profile/addresses?selectMode=true' as any);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.crimson} />
              <Text style={styles.manageAddressBtnText}>ADD / MANAGE ADDRESSES</Text>
            </TouchableOpacity>
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
        <View style={styles.approvalNoticeBox}>
          <Ionicons name="hourglass-outline" size={13} color={colors.crimson} />
          <Text style={styles.approvalNoticeText}>
            Lender Approval Step: No payment taken today. The owner has 24 hours to accept your request.
          </Text>
        </View>
        <View style={styles.legalNoticeContainer}>
          <Ionicons name="shield-checkmark" size={11} color={colors.textMuted} />
          <Text style={styles.legalNoticeText}>
            Direct P2P Rental: Kaphor acts strictly as an intermediary under Sec. 79 of IT Act, 2000 and is not liable for item condition or transactions.
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.reserveBtn,
            (isOwner || !availabilityState.isAvailable) && { backgroundColor: colors.charcoal, opacity: 0.6 }
          ]}
          onPress={handleReserve}
          disabled={submitting || isOwner || !availabilityState.isAvailable}
          activeOpacity={0.88}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : isOwner ? (
            <Text style={styles.reserveBtnText}>CANNOT RENT OWN ASSET</Text>
          ) : !availabilityState.isAvailable ? (
            <Text style={styles.reserveBtnText}>DATES CONFLICT WITH LEASE</Text>
          ) : (
            <Text style={styles.reserveBtnText}>
              REQUEST RENTAL LEASE • ₹{grandTotal.toLocaleString()}
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
  content: { padding: 20, paddingBottom: 180 },
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
  legalNoticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  legalNoticeText: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    lineHeight: 12,
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

  // Delivery Address Card
  addressCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  addressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressLabelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(155, 27, 48, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  addressLabelBadgeText: {
    fontSize: 9,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.crimson,
    letterSpacing: 0.5,
  },
  changeAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  changeAddressBtnText: {
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.crimson,
    letterSpacing: 0.5,
  },
  addressRecipientText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  addressLinesText: {
    fontSize: 12,
    color: colors.textSecond,
    lineHeight: 17,
  },
  addressCityStateText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyAddressBox: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyAddressTitle: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 6,
    letterSpacing: 1,
  },
  emptyAddressSub: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 12,
  },
  addAddressCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.crimson,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addAddressCtaText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Address Picker Modal Items
  addressItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    backgroundColor: colors.bg,
  },
  addressItemRowSelected: {
    borderColor: colors.crimson,
    backgroundColor: 'rgba(155, 27, 48, 0.04)',
  },
  addressItemLabel: {
    fontSize: 9,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.crimson,
  },
  defaultBadge: {
    fontSize: 8,
    fontFamily: typography.mono,
    fontWeight: '700',
    color: colors.forest || '#2A7B4C',
    backgroundColor: 'rgba(42, 123, 76, 0.1)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  addressItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  addressItemDetails: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  radioCircleActive: {
    borderColor: colors.crimson,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.crimson,
  },
  manageAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.crimson,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 12,
  },
  manageAddressBtnText: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.crimson,
    letterSpacing: 1,
  },

  // ── Availability Verification Card ─────────────────────────────
  availabilityVerificationCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  availabilityCardOk: {
    backgroundColor: 'rgba(46, 125, 50, 0.05)',
    borderColor: '#2E7D32',
  },
  availabilityCardWarn: {
    backgroundColor: 'rgba(168, 34, 34, 0.05)',
    borderColor: colors.red,
  },
  availabilityStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  availabilityStatusTitle: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  availabilityPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  availabilityPillOk: {
    backgroundColor: 'rgba(46, 125, 50, 0.15)',
  },
  availabilityPillWarn: {
    backgroundColor: 'rgba(168, 34, 34, 0.15)',
  },
  availabilityPillText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  availabilityStatusDesc: {
    fontFamily: typography.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textMuted,
  },

  // ── Calendar Booked State ──────────────────────────────────────
  calendarCellBooked: {
    backgroundColor: 'rgba(168, 34, 34, 0.08)',
    borderColor: 'rgba(168, 34, 34, 0.25)',
  },
  calendarDayTextBooked: {
    color: colors.red,
    textDecorationLine: 'line-through',
  },
  bookedDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.red,
  },

  // ── Owner Warning Card ──────────────────────────────────────────
  ownerWarningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    borderWidth: 1.5,
    borderColor: '#D97706',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  ownerWarningTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  ownerWarningDesc: {
    fontFamily: typography.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textPrimary,
  },

  // ── Error Banner Card ───────────────────────────────────────────
  errorBannerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(168, 34, 34, 0.08)',
    borderWidth: 1.5,
    borderColor: colors.red,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  errorBannerTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.red,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  errorBannerDesc: {
    fontFamily: typography.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textPrimary,
  },
  approvalNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(155, 27, 48, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(155, 27, 48, 0.2)',
    marginBottom: 8,
  },
  approvalNoticeText: {
    flex: 1,
    fontSize: 10,
    fontFamily: typography.mono,
    color: colors.crimson,
    fontWeight: '700',
    lineHeight: 14,
  },
});
