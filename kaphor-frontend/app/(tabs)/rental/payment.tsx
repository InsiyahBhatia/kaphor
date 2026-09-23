import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRazorpay } from '@codearcade/expo-razorpay';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import paymentService from '../../../src/services/paymentService';
import { rentalService } from '../../../src/services/rentalService';
import { invalidateCache } from '../../../src/services/api';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import type { RentalPaymentBreakdown } from '../../../src/types/payment';

type PaymentMethodType = 'upi' | 'card' | 'netbanking' | 'wallet';

interface PaymentMethodOption {
  id: PaymentMethodType;
  title: string;
  subtitle: string;
  badge: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'upi',
    title: 'UPI / QR CODE',
    subtitle: 'Google Pay, PhonePe, Paytm, BHIM & UPI IDs',
    badge: 'INSTANT • ZERO FEE',
    icon: 'flash-outline',
  },
  {
    id: 'card',
    title: 'CREDIT / DEBIT CARD',
    subtitle: 'Visa, Mastercard, RuPay, Maestro & Amex',
    badge: 'ALL MAJOR CARDS',
    icon: 'card-outline',
  },
  {
    id: 'netbanking',
    title: 'NET BANKING',
    subtitle: 'HDFC, ICICI, SBI, Axis, Kotak & 50+ Banks',
    badge: 'DIRECT SECURE',
    icon: 'business-outline',
  },
  {
    id: 'wallet',
    title: 'MOBILE WALLETS',
    subtitle: 'Paytm Wallet, PhonePe, MobiKwik',
    badge: 'QUICK PAY',
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
              'This rental lease has already been paid and secured into escrow.',
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
        name: 'Kaphor Luxury Circular Fashion',
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
            invalidateCache(['/rentals', '/users/me/wardrobe', '/cart']);
            router.replace(
              `/(tabs)/rental/lease/${rentalOrderId}` as any,
            );
          } catch {
            invalidateCache(['/rentals', '/users/me/wardrobe', '/cart']);
            Alert.alert(
              'Payment Received',
              'Your rental payment was received. We are confirming your lease dossier now.',
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
          'This rental has already been paid and secured into escrow.',
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
        <Header title="RENTAL PAYMENT" showBack fallbackPath={fallbackUrl} />
        <View style={styles.center}>
          <DossierLoading variant="checkout" compact />
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
            <Ionicons name="checkmark" size={14} color={colors.cream} />
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelDone]}>DETAILS</Text>
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
          <Text style={styles.sectionTitle}>PAYMENT BREAKDOWN</Text>
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
                  <Ionicons name="checkmark" size={12} color={colors.cream} />
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
              <Text style={styles.totalLabel}>TOTAL DUE TODAY</Text>
              <Text style={styles.totalValue}>{fmt(totalAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Deposit Note */}
        <View style={styles.depositNote}>
          <Ionicons name="information-circle" size={18} color={colors.navy} />
          <Text style={styles.depositNoteText}>
            The security deposit of {fmt(breakdown?.securityDeposit ?? 0)} is
            fully refundable and will be released within 48 hours after the item
            is returned in good condition.
          </Text>
        </View>

        {/* Payment Method Selector */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>PAYMENT METHOD</Text>
            <Text style={styles.sectionTitleSubtitle}>CHOOSE PREFERENCE</Text>
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
                      <Ionicons
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
                          <Text
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
              <Ionicons name="shield-checkmark" size={14} color={colors.forest} />
              <Text style={styles.securityBadgeText}>
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
            <ActivityIndicator color={colors.cream} size="small" />
          ) : (
            <>
              <Text style={styles.payBtnText}>
                PAY VIA {selectedMethod.toUpperCase()}
              </Text>
              <Ionicons name="lock-closed" size={16} color={colors.cream} />
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
    borderBottomColor: 'rgba(30,31,34,0.1)',
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
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: 'bold',
    color: colors.cream,
  },
  stepLabel: {
    marginTop: 6,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
  },
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
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 14,
  },

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
    fontFamily: typography.mono,
    fontSize: 15.5,
    fontWeight: '700',
  },
  value: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 17,
    fontWeight: '800',
  },

  insuranceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30,59,47,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(30,59,47,0.15)',
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
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.forest,
  },
  insuranceDesc: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  insurancePrice: {
    fontFamily: typography.mono,
    fontSize: 15.5,
    fontWeight: '800',
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
    fontFamily: typography.mono,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
  },
  totalValue: {
    color: colors.charcoal,
    fontFamily: typography.headings,
    fontSize: 35,
  },

  depositNote: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    backgroundColor: 'rgba(28,43,74,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(28,43,74,0.15)',
    marginBottom: 28,
  },
  depositNoteText: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 13.5,
    color: colors.navy,
    lineHeight: 16,
  },

  // Payment Methods Selector
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  sectionTitleSubtitle: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.red,
    letterSpacing: 1,
  },
  methodsContainer: {
    gap: 10,
  },
  methodCard: {
    backgroundColor: colors.white,
    padding: 14,
    borderWidth: 2,
    borderColor: 'rgba(30,31,34,0.15)',
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
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  methodTitleActive: {
    color: colors.charcoal,
  },
  methodBadge: {
    backgroundColor: colors.cream,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.2)',
  },
  methodBadgeActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  methodBadgeText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  methodBadgeTextActive: {
    color: colors.cream,
  },
  methodSubtitle: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 13,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 10,
    backgroundColor: 'rgba(40, 54, 24, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(40, 54, 24, 0.2)',
  },
  securityBadgeText: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.forest,
    letterSpacing: 0.5,
  },

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
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bottomTotalValue: {
    color: colors.charcoal,
    fontFamily: typography.headings,
    fontSize: 32.5,
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
    fontFamily: typography.mono,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
