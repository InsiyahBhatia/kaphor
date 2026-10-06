import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SolarIcon } from '../../../src/components/common/SolarIcon';
import { useRazorpay } from '@codearcade/expo-razorpay';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import paymentService from '../../../src/services/paymentService';
import { rentalService } from '../../../src/services/rentalService';
import { invalidateCache } from '../../../src/services/api';
import type { RentalPaymentBreakdown } from '../../../src/types/payment';
import { Spinner, Loader } from '../../../src/components/common/Loader';

type PaymentMethodType = 'upi' | 'card' | 'netbanking' | 'wallet';

interface PaymentMethodOption {
  id: PaymentMethodType;
  title: string;
  subtitle: string;
  badge: string;
  icon: keyof typeof SolarIcon.glyphMap;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'upi',
    title: 'UPI / QR code',
    subtitle: 'Google Pay, PhonePe, Paytm, BHIM & UPI IDs',
    badge: 'INSTANT • ZERO FEE',
    icon: 'flash-outline',
  },
  {
    id: 'card',
    title: 'Credit / debit card',
    subtitle: 'Visa, Mastercard, RuPay, Maestro & Amex',
    badge: 'All major cards',
    icon: 'card-outline',
  },
  {
    id: 'netbanking',
    title: 'Net banking',
    subtitle: 'HDFC, ICICI, SBI, Axis, Kotak & 50+ Banks',
    badge: 'Direct secure',
    icon: 'business-outline',
  },
  {
    id: 'wallet',
    title: 'Mobile wallets',
    subtitle: 'Paytm Wallet, PhonePe, MobiKwik',
    badge: 'Quick pay',
    icon: 'wallet-outline',
  },
];

export default function RentalPaymentScreen() {
  const { rentalOrderId, garmentId, days: daysParam, dayRate: dayRateParam } =
    useLocalSearchParams<{
      rentalOrderId: string;
      garmentId: string;
      days: string;
      dayRate: string;
    }>();
  const router = useRouter();
  const { openCheckout, RazorpayUI } = useRazorpay();

  const [breakdown, setBreakdown] = useState<RentalPaymentBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [includeInsurance, setIncludeInsurance] = useState(true);
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('upi');

  const days = Number(daysParam) || 3;
  const dayRate = Number(dayRateParam) || 0;

  useEffect(() => {
    loadBreakdown();
  }, []);

  const loadBreakdown = async () => {
    try {
      if (rentalOrderId) {
        try {
          const rental = await rentalService.getRentalById(rentalOrderId);
          if (rental?.paidAt || ['RESERVED', 'DISPATCHED', 'ACTIVE', 'COMPLETED'].includes(rental?.status)) {
            Alert.alert(
              'Already Paid',
              'This rental lease has already been paid.',
              [
                {
                  text: 'View Lease',
                  onPress: () => router.replace(`/(tabs)/rental/lease/${rentalOrderId}` as any),
                },
              ],
            );
            return;
          }
        } catch (rErr) {
          console.warn('Could not verify rental pre-payment status', rErr);
        }
      }

      const bd = await paymentService.getRentalBreakdown(garmentId!, days);
      setBreakdown(bd);
    } catch {
      // Fallback calculation if backend is unavailable (minimal thrift rates in pure Rupees)
      const dailyRateInRupees = dayRate || 149;
      const rentalFee = dailyRateInRupees * days;
      const securityDeposit = 299; // Flat ₹299 minimal refundable deposit
      const insuranceFee = 49; // Flat ₹49
      const deliveryFee = 199; // ₹199 standard insured delivery
      setBreakdown({
        rentalDays: days,
        dailyRate: dailyRateInRupees,
        rentalFee,
        securityDeposit,
        insuranceFee,
        deliveryFee,
        totalAmount: rentalFee + securityDeposit + insuranceFee + deliveryFee,
      });
    } finally {
      setLoading(false);
    }
  };

  const totalAmount =
    breakdown
      ? breakdown.rentalFee +
        breakdown.securityDeposit +
        (includeInsurance ? breakdown.insuranceFee : 0) +
        breakdown.deliveryFee
      : 0;

  const handlePay = async () => {
    if (!rentalOrderId) return;
    setProcessing(true);

    const keyId = paymentService.getRazorpayKey();
    if (!keyId) {
      Alert.alert(
        'Payment Not Configured',
        'Add EXPO_PUBLIC_RAZORPAY_KEY_ID to your .env file.',
      );
      setProcessing(false);
      return;
    }

    try {
      const rp = await paymentService.createRentalPayment(rentalOrderId);
      setRazorpayOrderId(rp.razorpayOrderId);

      const amountRupees = (rp as any).amount || totalAmount;
      const options = {
        key: keyId,
        amount: Math.round(amountRupees * 100), // convert to paise for Razorpay checkout
        currency: rp.currency || 'INR',
        order_id: rp.razorpayOrderId,
        name: 'Kaphor Circular Fashion',
        description: `Rental (${days} days) + Security Deposit`,
        prefill: { contact: '', email: '' },
        theme: { color: colors.charcoal },
      };

      openCheckout(options, {
        onSuccess: async (success: any) => {
          try {
            await paymentService.verifyPayment({
              orderId: rentalOrderId,
              razorpay_order_id: success.razorpay_order_id,
              razorpay_payment_id: success.razorpay_payment_id,
              razorpay_signature: success.razorpay_signature,
            });
            invalidateCache(['/rentals', '/users/me/wardrobe']);
            router.replace(
              `/(tabs)/rental/lease/${rentalOrderId}` as any,
            );
          } catch {
            invalidateCache(['/rentals', '/users/me/wardrobe']);
            Alert.alert(
              'Payment Received',
              'Your rental payment was received. We are confirming your rental now.',
            );
            router.replace(`/(tabs)/rental/lease/${rentalOrderId}` as any);
          } finally {
            setProcessing(false);
          }
        },
        onFailure: (error: any) => {
          Alert.alert(
            'Payment Failed',
            error?.description || 'Payment was cancelled.',
          );
          setProcessing(false);
        },
        onClose: () => setProcessing(false),
      });
    } catch (e: any) {
      if (e?.response?.data?.error === 'ALREADY_PAID' || e?.response?.data?.message?.includes('already been paid')) {
        Alert.alert(
          'Payment Completed',
          'This rental has already been paid.',
          [
            {
              text: 'View Lease',
              onPress: () => router.replace(`/(tabs)/rental/lease/${rentalOrderId}` as any),
            },
          ],
        );
        return;
      }
      Alert.alert(
        'Error',
        e?.response?.data?.message || 'Failed to start payment.',
      );
      setProcessing(false);
    }
  };

  const fallbackUrl = garmentId ? `/(tabs)/rental/reserve?garmentId=${garmentId}&dayRate=${dayRate}` : '/(tabs)/shop';

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Rental payment" showBack fallbackPath={fallbackUrl} />
        <View style={styles.center}>
          <Loader variant="checkout" compact />
        </View>
      </View>
    );
  }

  const fmt = (rupees: number) => `₹${Math.round(rupees).toLocaleString('en-IN')}`;

  return (
    <View style={styles.container}>
      <Header title="PAYMENT" showBack fallbackPath={fallbackUrl} />

      {/* Progress Steps */}
      <View style={styles.progressBar}>
        <View style={styles.step}>
          <View style={[styles.stepCircle, styles.stepDone]}>
            <SolarIcon name="checkmark" size={14} color={colors.cream} />
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelDone]}>Details</Text>
        </View>
        <View style={[styles.progressLine, styles.progressLineDone]} />
        <View style={styles.step}>
          <View style={[styles.stepCircle, styles.stepActive]}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelActive]}>PAY</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Payment Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment breakdown</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Rental Fee ({days} days)</Text>
              <Text style={styles.value}>
                {fmt(breakdown?.rentalFee ?? 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Refundable Deposit</Text>
              <Text style={styles.value}>
                {fmt(breakdown?.securityDeposit ?? 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Delivery</Text>
              <Text style={styles.value}>
                {fmt(breakdown?.deliveryFee ?? 0)}
              </Text>
            </View>

            {/* Insurance Toggle */}
            <TouchableOpacity
              style={styles.insuranceRow}
              onPress={() => setIncludeInsurance((p) => !p)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  includeInsurance && styles.checkboxActive,
                ]}
              >
                {includeInsurance && (
                  <SolarIcon name="checkmark" size={12} color={colors.cream} />
                )}
              </View>
              <View style={styles.insuranceInfo}>
                <Text style={styles.insuranceLabel}>
                  Rental Insurance (recommended)
                </Text>
                <Text style={styles.insuranceDesc}>
                  Covers accidental damage up to ₹5,000
                </Text>
              </View>
              <Text style={styles.insurancePrice}>
                {fmt(breakdown?.insuranceFee ?? 0)}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total due today</Text>
              <Text style={styles.totalValue}>{fmt(totalAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Deposit Note */}
        <View style={styles.depositNote}>
          <SolarIcon name="information-circle" size={18} color={colors.navy} />
          <Text style={styles.depositNoteText}>
            The security deposit of {fmt(breakdown?.securityDeposit ?? 0)} is
            fully refundable and will be released within 48 hours after the item
            is returned in good condition.
          </Text>
        </View>

        {/* Payment Method Selector */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Payment method</Text>
            <Text style={styles.sectionTitleSubtitle}>Choose preference</Text>
          </View>
          <View style={styles.methodsContainer}>
            {PAYMENT_METHODS.map((item) => {
              const isSelected = selectedMethod === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.methodCard,
                    isSelected && styles.methodCardActive,
                  ]}
                  onPress={() => setSelectedMethod(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.methodCardHeader}>
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleActive,
                      ]}
                    >
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                    <View style={[styles.methodIconBox, isSelected && styles.methodIconBoxActive]}>
                      <SolarIcon
                        name={item.icon}
                        size={18}
                        color={isSelected ? colors.cream : colors.charcoal}
                      />
                    </View>
                    <View style={styles.methodTextContainer}>
                      <View style={styles.methodTitleRow}>
                        <Text
                          style={[
                            styles.methodTitle,
                            isSelected && styles.methodTitleActive,
                          ]}
                        >
                          {item.title}
                        </Text>
                        <View
                          style={[
                            styles.methodBadge,
                            isSelected && styles.methodBadgeActive,
                          ]}
                        >
                          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
                            style={[
                              styles.methodBadgeText,
                              isSelected && styles.methodBadgeTextActive,
                            ]}
                          >
                            {item.badge}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.methodSubtitle} numberOfLines={2}>
                        {item.subtitle}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={styles.securityBadge}>
              <SolarIcon name="shield-checkmark" size={14} color={colors.forest} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.securityBadgeText}>
                Razorpay 256-bit SSL Encrypted • PCI-DSS Level 1 Certified
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {RazorpayUI}

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomTotalRow}>
          <Text style={styles.bottomTotalLabel}>Total Due</Text>
          <Text style={styles.bottomTotalValue}>{fmt(totalAmount)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payBtn, processing && styles.payBtnDisabled]}
          onPress={handlePay}
          disabled={processing}
          activeOpacity={0.8}
        >
          {processing ? (
            <Spinner color={colors.cream} size="small" />
          ) : (
            <>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.payBtnText}>
                PAY VIA {selectedMethod.toUpperCase()}
              </Text>
              <SolarIcon name="lock-closed" size={16} color={colors.cream} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
  },
  step: { alignItems: 'center' },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cream,
  },
  stepDone: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  stepActive: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  stepNumber: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.cream,
  },
  stepLabel: {
    marginTop: 6,
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.textMuted, includeFontPadding: false, },
  stepLabelDone: { color: colors.charcoal },
  stepLabelActive: { color: colors.charcoal },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.charcoal,
    marginHorizontal: 6,
    marginBottom: 18,
    opacity: 0.2,
  },
  progressLineDone: { opacity: 0.6, backgroundColor: colors.charcoal },

  scrollContent: { padding: 20, paddingBottom: 160 },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 14, includeFontPadding: false, },

  card: {
    backgroundColor: colors.white,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  label: {
    color: colors.charcoal,
    fontFamily: typography.handSemi,
    fontSize: 13, includeFontPadding: false, },
  value: {
    color: colors.charcoal,
    fontFamily: typography.bodyBold,
    fontSize: 13,
  },

  insuranceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    marginBottom: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  insuranceInfo: { flex: 1 },
  insuranceLabel: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.forest, includeFontPadding: false, },
  insuranceDesc: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2, includeFontPadding: false, },
  insurancePrice: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    color: colors.forest,
  },

  divider: {
    height: 2,
    backgroundColor: colors.charcoal,
    marginBottom: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: colors.charcoal,
    fontFamily: typography.handBold,
    fontSize: 14, includeFontPadding: false, },
  totalValue: {
    color: colors.charcoal,
    fontFamily: typography.headings,
    fontSize: 28,
  },

  depositNote: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    marginBottom: 28,
  },
  depositNoteText: {
    flex: 1,
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.navy,
    lineHeight: 23, includeFontPadding: false, },

  // Payment Methods Selector
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  sectionTitleSubtitle: {
    fontFamily: typography.handSemi,
    fontSize: 13,
    color: colors.red, includeFontPadding: false, },
  methodsContainer: {
    gap: 10,
  },
  methodCard: {
    backgroundColor: colors.white,
    padding: 14,
    borderWidth: 2,
    borderColor: colors.overlayLight,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 2,
  },
  methodCardActive: {
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  methodCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cream,
  },
  radioCircleActive: {
    borderColor: colors.red,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.red,
  },
  methodIconBox: {
    width: 34,
    height: 34,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodIconBoxActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  methodTextContainer: {
    flex: 1,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 2,
  },
  methodTitle: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  methodTitleActive: {
    color: colors.charcoal,
  },
  methodBadge: {
    backgroundColor: colors.cream,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.overlay,
  },
  methodBadgeActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  methodBadgeText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.textMuted, includeFontPadding: false, },
  methodBadgeTextActive: {
    color: colors.cream,
  },
  methodSubtitle: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19, includeFontPadding: false, },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 10,
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.overlay,
  },
  securityBadgeText: {
    fontFamily: typography.handSemi,
    fontSize: 13,
    color: colors.forest, includeFontPadding: false, },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    backgroundColor: colors.cream,
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
    gap: 14,
  },
  bottomTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomTotalLabel: {
    color: colors.textMuted,
    fontFamily: typography.handBold,
    fontSize: 13, includeFontPadding: false, },
  bottomTotalValue: {
    color: colors.charcoal,
    fontFamily: typography.headings,
    fontSize: 28,
  },
  payBtn: {
    backgroundColor: colors.charcoal,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  payBtnDisabled: { opacity: 0.7 },
  payBtnText: {
    color: colors.cream,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    letterSpacing: 0.2,
  },
});
