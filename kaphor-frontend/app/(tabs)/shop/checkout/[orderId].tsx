import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRazorpay } from '@codearcade/expo-razorpay';
import api from '../../../../src/services/api';
import { useAuth } from '../../../../src/context/AuthContext';
import { DossierLoading } from '../../../../src/components/common/DossierLoading';
import { colors, typography, spacing } from '../../../../src/theme';
import { Header } from '../../../../src/components/common/Header';
import { KaphorImage } from '../../../../src/components/KaphorImage';
import { safeBack } from '../../../../src/utils/navigation';

const { width } = Dimensions.get('window');

type OrderItem = {
  id: string;
  garmentId: string;
  price: number;
  quantity: number;
  garment: {
    id: string;
    title: string;
    brand: string;
    images: string[];
  };
};

type OrderData = {
  id: string;
  buyerId: string;
  sellerId: string;
  status: string;
  totalAmount: number;
  currency: string;
  items: OrderItem[];
  razorpayOrderId?: string;
};

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
    badge: 'ONE-CLICK',
    icon: 'wallet-outline',
  },
];

export default function CheckoutScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('upi');

  const { openCheckout, RazorpayUI } = useRazorpay();

  const loadOrder = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${orderId}`);
      const orderData = data.data as OrderData;
      setOrder(orderData);

      // If we already have a Razorpay order ID, we can go straight to payment
      if (orderData.razorpayOrderId) {
        setRazorpayOrderId(orderData.razorpayOrderId);
        setRazorpayReady(true);
      }
    } catch (e: any) {
      console.error('Failed to load order', e);
      Alert.alert('Error', 'Could not load checkout details', [
        { text: 'Go Back', onPress: () => safeBack('/(tabs)/shop') },
      ]);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // Prepare Razorpay order — creates one on the backend if not already created
  const prepareRazorpayOrder = async () => {
    if (razorpayReady) return true;
    setProcessing(true);
    try {
      const { data } = await api.post('/payments/razorpay/create-order-for-order', {
        orderId: order!.id,
      });
      setRazorpayOrderId(data.data.razorpayOrderId);
      setRazorpayReady(true);
      setProcessing(false);
      return true;
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to initialize payment.';
      Alert.alert('Error', msg);
      setProcessing(false);
      return false;
    }
  };

  const handlePayment = async () => {
    if (!order) return;
    setProcessing(true);

    const keyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
    if (!keyId) {
      Alert.alert(
        'Razorpay Not Configured',
        'Add EXPO_PUBLIC_RAZORPAY_KEY_ID to your .env file to process payments.'
      );
      setProcessing(false);
      return;
    }

    // Ensure Razorpay order is created
    const ready = await prepareRazorpayOrder();
    if (!ready) return;

    if (!razorpayOrderId) {
      Alert.alert('Error', 'Payment could not be initialized.');
      setProcessing(false);
      return;
    }

    // Delivery charge: ₹199 (19,900 paise) if subtotal under ₹5,000 (500,000 paise)
    const deliveryCharge = order.totalAmount < 500000 ? 19900 : 0;
    const totalInPaise = order.totalAmount + deliveryCharge;

    const options = {
      key: keyId,
      amount: totalInPaise,
      currency: order.currency || 'INR',
      order_id: razorpayOrderId,
      name: 'Kaphor Luxury Circular Fashion',
      description: `Order ${orderId?.slice(0, 8)}...`,
      prefill: {
        contact: (user as any)?.phone || '',
        email: user?.email || '',
        method: selectedMethod,
      },
      theme: {
        color: colors.red,
      },
    };

    openCheckout(options, {
      onSuccess: async (success: any) => {
        try {
          await api.post('/payments/razorpay/verify', {
            orderId: order.id,
            razorpay_order_id: success.razorpay_order_id,
            razorpay_payment_id: success.razorpay_payment_id,
            razorpay_signature: success.razorpay_signature,
          });
          router.replace(`/(tabs)/shop/order-confirmed?orderId=${order.id}`);
        } catch (verifyErr: any) {
          console.error('Verification call threw error, checking status fallback...', verifyErr);
          try {
            // Fast fallback: server may have finished verification before connection drop
            const statusCheck = await api.get(`/orders/${order.id}`);
            const confirmedStatus = statusCheck?.data?.data?.status;
            if (confirmedStatus === 'CONFIRMED' || confirmedStatus === 'PAID') {
              router.replace(`/(tabs)/shop/order-confirmed?orderId=${order.id}`);
              return;
            }
          } catch (statusErr) {
            console.error('Order status fallback check failed:', statusErr);
          }

          Alert.alert(
            'Payment Received',
            'Your payment of ₹' +
              (totalInPaise / 100).toLocaleString('en-IN') +
              ' was received. If confirmation takes a moment, check your orders list.',
            [
              {
                text: 'View Orders',
                onPress: () => router.replace('/(tabs)/shop/orders'),
              },
            ]
          );
        } finally {
          setProcessing(false);
        }
      },
      onFailure: (error: any) => {
        const msg =
          error?.description || error?.message || 'Payment was cancelled or failed.';
        Alert.alert('Payment', msg);
        setProcessing(false);
      },
      onClose: () => {
        console.log('Payment checkout closed');
        setProcessing(false);
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="CHECKOUT" showBack />
        <View style={styles.center}>
          <DossierLoading variant="checkout" compact />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <Header title="CHECKOUT" showBack />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Order not found</Text>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => safeBack('/(tabs)/shop')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backBtnText}>GO BACK</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const subtotal = order.totalAmount;
  // subtotal is in paise; free delivery for orders ₹5,000+ (500,000 paise)
  const deliveryCharge = subtotal < 500000 ? 19900 : 0; // ₹199 if under ₹5,000
  const total = subtotal + deliveryCharge;
  const itemCount = order.items?.length || 0;

  return (
    <View style={styles.container}>
      <Header title="PAYMENT" showBack />

      {/* Progress Steps */}
      <View style={styles.progressBar}>
        <View style={styles.step}>
          <View style={[styles.stepCircle, styles.stepDone]}>
            <Ionicons name="checkmark" size={14} color={colors.cream} />
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelDone]}>CART</Text>
        </View>
        <View style={[styles.progressLine, styles.progressLineDone]} />
        <View style={styles.step}>
          <View style={[styles.stepCircle, styles.stepDone]}>
            <Ionicons name="checkmark" size={14} color={colors.cream} />
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelDone]}>DELIVERY</Text>
        </View>
        <View style={[styles.progressLine, styles.progressLineDone]} />
        <View style={styles.step}>
          <View style={[styles.stepCircle, styles.stepActive]}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
          <Text style={[styles.stepLabel, styles.stepLabelActive]}>PAY</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            ORDER ITEMS ({itemCount})
          </Text>
          {order.items?.map((item, idx) => (
            <View key={item.id} style={styles.itemCard}>
              <KaphorImage
                uri={item.garment?.images?.[0]}
                style={styles.itemImage}
                contentFit="cover"
              />
              <View style={styles.itemInfo}>
                <Text style={styles.itemBrand}>{item.garment?.brand}</Text>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {item.garment?.title}
                </Text>
                <Text style={styles.itemPrice}>
                  ₹{(item.price / 100).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Price Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRICE DETAILS</Text>
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</Text>
              <Text style={styles.priceValue}>
                ₹{(subtotal / 100).toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Delivery</Text>
              <Text style={[styles.priceValue, deliveryCharge === 0 && styles.priceFree]}>
                {deliveryCharge === 0 ? 'FREE' : `₹${(deliveryCharge / 100).toLocaleString('en-IN')}`}
              </Text>
            </View>
            {deliveryCharge > 0 && (
              <View style={styles.freeDeliveryNote}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={styles.freeDeliveryText}>
                  Free delivery on orders above ₹5,000
                </Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>
                ₹{(total / 100).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
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

        {/* Impact Note */}
        <View style={styles.impactCard}>
          <View style={styles.impactIconCol}>
            <Ionicons name="leaf" size={20} color={colors.cream} />
          </View>
          <View style={styles.impactBody}>
            <Text style={styles.impactTitle}>CARBON-NEUTRAL DELIVERY</Text>
            <Text style={styles.impactText}>
              Every purchase on Kaphor offsets its delivery carbon through verified
              circular economy credits.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Razorpay UI Overlay */}
      {RazorpayUI}

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomTotal}>
          <Text style={styles.bottomTotalLabel}>Total</Text>
          <Text style={styles.bottomTotalValue}>
            ₹{(total / 100).toLocaleString('en-IN')}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.payButton, processing && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={processing}
          activeOpacity={0.8}
        >
          {processing ? (
            <ActivityIndicator color={colors.cream} size="small" />
          ) : (
            <>
              <Text style={styles.payButtonText}>
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
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  loadingText: {
    fontFamily: typography.mono,
    color: colors.charcoal,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 14,
  },
  backBtn: {
    borderWidth: 2,
    borderColor: colors.charcoal,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backBtnText: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
  },

  // Progress Bar
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
  stepDone: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  stepActive: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  stepNumber: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.cream,
  },
  stepLabel: {
    marginTop: 6,
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  stepLabelDone: { color: colors.charcoal },
  stepLabelActive: { color: colors.red },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.charcoal,
    marginHorizontal: 6,
    marginBottom: 18,
    opacity: 0.2,
  },
  progressLineDone: { opacity: 0.6, backgroundColor: colors.charcoal },

  // Content
  scrollContent: {
    padding: 20,
    paddingBottom: 140,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 14,
  },

  // Items
  itemCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: 14,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 12,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  itemImage: {
    width: 80,
    height: 100,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  itemBrand: {
    color: colors.red,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  itemTitle: {
    color: colors.charcoal,
    fontFamily: typography.headings,
    fontSize: 22,
    lineHeight: 24,
    marginBottom: 6,
  },
  itemPrice: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '800',
  },

  // Price Card
  priceCard: {
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
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  priceLabel: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  priceValue: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '800',
  },
  priceFree: {
    color: colors.forest,
    fontSize: 12,
  },
  freeDeliveryNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
    marginBottom: 14,
  },
  freeDeliveryText: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 9,
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
    color: colors.red,
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  totalValue: {
    color: colors.charcoal,
    fontFamily: typography.headings,
    fontSize: 32,
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
    fontSize: 9,
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
    fontSize: 11,
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
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  methodBadgeTextActive: {
    color: colors.cream,
  },
  methodSubtitle: {
    fontFamily: typography.mono,
    fontSize: 9,
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
    fontSize: 8.5,
    fontWeight: '700',
    color: colors.forest,
    letterSpacing: 0.5,
  },
  impactCard: {
    flexDirection: 'row',
    backgroundColor: colors.forest,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    marginBottom: 20,
  },
  impactIconCol: {
    width: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 2,
    borderRightColor: 'rgba(255,255,255,0.2)',
  },
  impactBody: {
    flex: 1,
    padding: 16,
  },
  impactTitle: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  impactText: {
    color: 'rgba(247,245,240,0.85)',
    fontFamily: typography.mono,
    fontSize: 10,
    lineHeight: 16,
  },

  // Bottom Bar
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
  bottomTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomTotalLabel: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bottomTotalValue: {
    color: colors.charcoal,
    fontFamily: typography.headings,
    fontSize: 28,
  },
  payButton: {
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
  payButtonDisabled: {
    opacity: 0.7,
  },
  payButtonText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
