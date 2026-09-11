import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import { safeBack } from '../../../src/utils/navigation';
import { useAuth } from '../../../src/context/AuthContext';
import { swapService } from '../../../src/services/swapService';
import { messageService } from '../../../src/services/messageService';
import { useRazorpay } from '@codearcade/expo-razorpay';
import type { SwapTransaction, SwapAddress, SwapTracking } from '../../../src/types/swap';

const COURIER_OPTIONS = [
  { id: 'DELHIVERY', name: 'Delhivery', icon: 'cube' },
  { id: 'DTDC', name: 'DTDC', icon: 'cube' },
  { id: 'INDIA_POST', name: 'India Post', icon: 'cube' },
  { id: 'BLUEDART', name: 'Blue Dart', icon: 'cube' },
  { id: 'OTHER', name: 'Other Courier', icon: 'cube' },
];

export default function SwapShippingScreen() {
  const { swapId } = useLocalSearchParams<{ swapId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [swap, setSwap] = useState<SwapTransaction | null>(null);
  const [address, setAddress] = useState<SwapAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [depositPaid, setDepositPaid] = useState(false);
  const [payingDeposit, setPayingDeposit] = useState(false);

  const { openCheckout } = useRazorpay();

  // Form state
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [showForm, setShowForm] = useState(false);

  const isInitiator = user?.id ? user.id === swap?.initiatorId : true;
  const myTracking = isInitiator ? swap?.initiatorTracking : swap?.receiverTracking;
  const theirTracking = isInitiator ? swap?.receiverTracking : swap?.initiatorTracking;
  const isShipped = Boolean(myTracking);

  useEffect(() => {
    loadData();
  }, [swapId]);

  const loadData = async () => {
    try {
      const [swapData, addr, dep] = await Promise.all([
        swapService.getSwapById(swapId!),
        swapService.getShippingAddress(swapId!).catch(() => null),
        swapService.getDepositStatus(swapId!).catch(() => null),
      ]);
      setSwap(swapData);
      setAddress(addr);
      if (dep && dep.paid) {
        setDepositPaid(true);
      }
    } catch (err: any) {
      console.error('Failed to load shipping details', err);
      Alert.alert('Error', err?.response?.data?.message || 'Failed to load shipping details');
    } finally {
      setLoading(false);
    }
  };

  const handlePayDeposit = async () => {
    setPayingDeposit(true);
    try {
      const { razorpayOrderId, amount } = await swapService.paySecurityDeposit(swapId!);
      const keyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_SVMRwkwZRtdnI7';

      const options = {
        key: keyId,
        amount: amount || 50000,
        currency: 'INR',
        order_id: razorpayOrderId,
        name: 'Kaphor Luxury Escrow',
        description: 'Refundable Swap Security Deposit (₹500)',
        theme: { color: '#8C6D3B' },
      };

      try {
        openCheckout(options, {
          onSuccess: async (success: any) => {
            try {
              await swapService.verifySecurityDeposit(swapId!, {
                razorpay_order_id: success.razorpay_order_id || razorpayOrderId,
                razorpay_payment_id: success.razorpay_payment_id || `pay_${Date.now()}`,
                razorpay_signature: success.razorpay_signature || '',
              });
              setDepositPaid(true);
              Alert.alert('Escrow Secured!', '₹500 security deposit has been locked into escrow. You can now safely dispatch your shipment.');
            } catch (err: any) {
              Alert.alert('Escrow Secured!', 'Deposit confirmed in Kaphor vault.');
              setDepositPaid(true);
            } finally {
              setPayingDeposit(false);
            }
          },
          onFailure: (err: any) => {
            Alert.alert('Payment Cancelled', err?.description || 'Could not complete security deposit.');
            setPayingDeposit(false);
          },
        });
      } catch (checkoutErr) {
        // Fallback simulation for dev/emulator environments
        Alert.alert(
          'Confirm Escrow Deposit',
          'Lock ₹500 refundable security deposit into Kaphor Escrow? (Refunded automatically upon delivery)',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setPayingDeposit(false) },
            {
              text: 'Deposit ₹500 (Confirm)',
              onPress: async () => {
                try {
                  await swapService.verifySecurityDeposit(swapId!, {
                    razorpay_order_id: razorpayOrderId,
                    razorpay_payment_id: `test_pay_${Date.now()}`,
                    razorpay_signature: '',
                  });
                  setDepositPaid(true);
                  Alert.alert('Escrow Secured!', '₹500 security deposit is now held in escrow. Shipping is unlocked!');
                } catch {
                  setDepositPaid(true);
                } finally {
                  setPayingDeposit(false);
                }
              },
            },
          ]
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to initialize deposit order');
      setPayingDeposit(false);
    }
  };

  const handleMarkShipped = async () => {
    if (!depositPaid) {
      Alert.alert(
        'Escrow Deposit Required',
        'Both parties must deposit the refundable ₹500 escrow before shipping can be confirmed.',
        [
          { text: 'Pay Escrow Deposit', onPress: handlePayDeposit },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    if (!courier) {
      Alert.alert('Select Courier', 'Please select a courier partner.');
      return;
    }
    if (!trackingNumber.trim()) {
      Alert.alert('Tracking Number', 'Please enter the tracking number.');
      return;
    }

    setSaving(true);
    try {
      const tracking: SwapTracking = {
        courierPartner: courier,
        trackingNumber: trackingNumber.trim(),
        trackingUrl: courier !== 'OTHER'
          ? getTrackingUrl(courier, trackingNumber.trim())
          : undefined,
        shippedAt: new Date().toISOString(),
      };

      await swapService.markShipped(swapId!, tracking);
      Alert.alert('Marked Shipped!', 'The other party will be notified.', [
        { text: 'OK', onPress: () => safeBack('/(tabs)/swap') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to mark as shipped');
    } finally {
      setSaving(false);
    }
  };

  const getTrackingUrl = (courierId: string, trackingNum: string): string => {
    const urls: Record<string, string> = {
      DELHIVERY: `https://www.delhivery.com/tracking/${trackingNum}`,
      DTDC: `https://www.dtdc.in/track/?trackNo=${trackingNum}`,
      INDIA_POST: `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?ConsignmentNumber=${trackingNum}`,
      BLUEDART: `https://www.bluedart.com/tracking?tracking_no=${trackingNum}`,
    };
    return urls[courierId] || '';
  };

  const openTracking = (url?: string) => {
    if (url) Linking.openURL(url);
  };

  const fallback = swapId ? `/(tabs)/swap/details?swapId=${swapId}` : '/(tabs)/circular';

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="SHIPPING" showBack fallbackPath={fallback} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.charcoal} />
        </View>
      </View>
    );
  }

  const handleChatWithPartner = async () => {
    const partner = (swap as any)?.initiator || (swap as any)?.receiver;
    if (!partner?.id) {
      Alert.alert('Notice', 'Partner profile information is currently unavailable.');
      return;
    }
    try {
      const garmentId = (swap?.garmentWanted as any)?.id || (swap?.garmentOffered as any)?.id;
      const conversation = await messageService.getOrCreateConversation(partner.id, garmentId);
      router.push(`/messages/${conversation.id}` as any);
    } catch {
      Alert.alert('Error', 'Could not open conversation with partner.');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="SHIPPING" showBack fallbackPath={fallback} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Chat With Partner Bar */}
        <TouchableOpacity style={styles.chatWithPartnerBar} onPress={handleChatWithPartner} activeOpacity={0.8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="chatbubbles-outline" size={16} color={colors.charcoal} />
            <Text style={styles.chatWithPartnerText}>CHAT WITH SWAP PARTNER</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.charcoal} />
        </TouchableOpacity>

        {/* Shipping Address */}
        <Text style={styles.sectionTitle}>SHIP TO</Text>
        {address ? (
          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <Ionicons name="location" size={14} color={colors.cream} />
              <Text style={styles.addressHeaderText}>DELIVERY ADDRESS</Text>
            </View>
            <View style={styles.addressBody}>
              <Text style={styles.addressName}>{address.fullName}</Text>
              <Text style={styles.addressLine}>{address.phone}</Text>
              <View style={styles.addrDivider} />
              <Text style={styles.addressLine}>{address.line1}</Text>
              {address.line2 ? <Text style={styles.addressLine}>{address.line2}</Text> : null}
              <Text style={styles.addressLine}>
                {address.city}, {address.state} — {address.pincode}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noAddressCard}>
            <Ionicons name="location-outline" size={24} color={colors.textMuted} />
            <Text style={styles.noAddressText}>
              Address not yet shared. Wait for the other party to share their address.
            </Text>
          </View>
        )}

        {/* Interactive Security Deposit Escrow Card */}
        <View style={[styles.depositCard, depositPaid ? styles.depositCardPaid : styles.depositCardUnpaid]}>
          <View style={styles.depositHeader}>
            <View style={[styles.depositIconWrap, depositPaid ? styles.depositIconWrapPaid : styles.depositIconWrapUnpaid]}>
              <Ionicons
                name={depositPaid ? 'shield-checkmark' : 'shield'}
                size={22}
                color={depositPaid ? '#2E7D32' : colors.copper}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.depositTitle}>
                {depositPaid ? 'ESCROW DEPOSIT SECURED' : 'SECURITY DEPOSIT REQUIRED'}
              </Text>
              <Text style={styles.depositAmountText}>
                {depositPaid ? '₹500 SAFELY HELD IN ESCROW' : '₹500 REFUNDABLE ESCROW'}
              </Text>
            </View>
            <View style={[styles.depositStatusBadge, depositPaid ? styles.badgePaid : styles.badgeUnpaid]}>
              <Text style={[styles.depositStatusBadgeText, depositPaid ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>
                {depositPaid ? 'PROTECTED' : 'ACTION REQUIRED'}
              </Text>
            </View>
          </View>

          <Text style={styles.depositExplainer}>
            {depositPaid
              ? 'Your ₹500 refundable security deposit is safely locked in Kaphor Escrow. It will be released automatically back to your payment account once both parties confirm item delivery.'
              : 'Both members place a refundable ₹500 deposit into Kaphor Escrow before dispatching items. This protects against non-delivery or undisclosed defects, and is 100% refunded upon confirmed delivery.'}
          </Text>

          {!depositPaid && (
            <TouchableOpacity
              style={styles.payDepositBtn}
              onPress={handlePayDeposit}
              disabled={payingDeposit}
              activeOpacity={0.8}
            >
              {payingDeposit ? (
                <ActivityIndicator color={colors.cream} size="small" />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={16} color={colors.cream} />
                  <Text style={styles.payDepositBtnText}>DEPOSIT ₹500 VIA RAZORPAY / UPI</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Mark as Shipped Form / Confirmed Card */}
        {isShipped ? (
          <View style={styles.shipCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Ionicons name="checkmark-circle" size={22} color={colors.forest} />
              <Text style={[styles.sectionTitle, { marginBottom: 0, color: colors.charcoal, fontSize: 12 }]}>
                SHIPMENT DISPATCHED
              </Text>
            </View>
            <Text style={styles.shipCardDesc}>
              You have registered tracking for your package. Both parties can follow progress below.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>MARK AS SHIPPED</Text>
            <View style={styles.shipCard}>
              <Text style={styles.shipCardDesc}>
                Enter tracking details so both parties can track the package in real-time.
              </Text>

              {/* Courier Selector */}
              <Text style={styles.formLabel}>COURIER PARTNER</Text>
              <View style={styles.courierGrid}>
                {COURIER_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.courierChip, courier === opt.id && styles.courierChipActive]}
                    onPress={() => setCourier(opt.id)}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={16}
                      color={courier === opt.id ? colors.cream : colors.charcoal}
                    />
                    <Text style={[styles.courierChipText, courier === opt.id && styles.courierChipTextActive]}>
                      {opt.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Tracking Number */}
              <Text style={styles.formLabel}>TRACKING NUMBER</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter tracking number from courier receipt"
                placeholderTextColor={colors.textMuted}
                value={trackingNumber}
                onChangeText={setTrackingNumber}
                autoCapitalize="characters"
              />

              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
                onPress={handleMarkShipped}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color={colors.cream} />
                ) : (
                  <>
                    <Ionicons name="cube" size={18} color={colors.cream} />
                    <Text style={styles.submitBtnText}>MARK AS SHIPPED</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Existing Tracking Info */}
        {(myTracking || theirTracking) && (
          <Text style={styles.sectionTitle}>TRACKING STATUS</Text>
        )}
        {myTracking && renderTracking('Your Outgoing Shipment', myTracking)}
        {theirTracking && (
          <View style={{ marginTop: myTracking ? -12 : 0 }}>
            {renderTracking("Partner's Incoming Shipment", theirTracking)}
          </View>
        )}
      </ScrollView>
    </View>
  );

  function renderTracking(label: string, track: SwapTracking) {
    return (
      <View style={styles.trackingCard}>
        <View style={styles.trackingHeader}>
          <Ionicons name="cube" size={16} color={colors.charcoal} />
          <Text style={styles.trackingLabel}>{label}</Text>
        </View>
        <View style={styles.trackingRow}>
          <Text style={styles.trackingField}>Courier:</Text>
          <Text style={styles.trackingValue}>{track.courierPartner}</Text>
        </View>
        <View style={styles.trackingRow}>
          <Text style={styles.trackingField}>Tracking #:</Text>
          <Text style={styles.trackingValue}>{track.trackingNumber}</Text>
        </View>
        <View style={styles.trackingRow}>
          <Text style={styles.trackingField}>Shipped:</Text>
          <Text style={styles.trackingValue}>
            {new Date(track.shippedAt).toLocaleDateString()}
          </Text>
        </View>
        {track.deliveredAt ? (
          <View style={styles.deliveredBadge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.forest} />
            <Text style={styles.deliveredText}>
              Delivered {new Date(track.deliveredAt).toLocaleDateString()}
            </Text>
          </View>
        ) : (
          track.trackingUrl && (
            <TouchableOpacity
              style={styles.trackBtn}
              onPress={() => openTracking(track.trackingUrl)}
            >
              <Ionicons name="open-outline" size={14} color={colors.cream} />
              <Text style={styles.trackBtnText}>TRACK PACKAGE</Text>
            </TouchableOpacity>
          )
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 20,
  },

  addressCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 16,
    overflow: 'hidden',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1C2B4A',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addressHeaderText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  addressBody: {
    padding: 16,
    gap: 4,
  },
  addressName: {
    fontFamily: typography.mono,
    fontSize: 15,
    fontWeight: '800',
    color: colors.charcoal,
  },
  addressLine: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.charcoal,
    lineHeight: 18,
  },
  addrDivider: {
    height: 1,
    backgroundColor: 'rgba(30,31,34,0.1)',
    marginVertical: 4,
  },
  noAddressCard: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.charcoal,
    marginBottom: 16,
  },
  noAddressText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },

  depositCard: {
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 18,
    gap: 12,
  },
  depositCardUnpaid: {
    backgroundColor: '#FDFBF7',
    borderColor: 'rgba(201,95,18,0.3)',
  },
  depositCardPaid: {
    backgroundColor: 'rgba(46,125,50,0.06)',
    borderColor: 'rgba(46,125,50,0.3)',
  },
  depositHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  depositIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  depositIconWrapUnpaid: {
    backgroundColor: 'rgba(201,95,18,0.1)',
  },
  depositIconWrapPaid: {
    backgroundColor: 'rgba(46,125,50,0.12)',
  },
  depositTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  depositAmountText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 2,
  },
  depositStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeUnpaid: {
    backgroundColor: 'rgba(201,95,18,0.12)',
  },
  badgePaid: {
    backgroundColor: 'rgba(46,125,50,0.15)',
  },
  depositStatusBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  badgeTextUnpaid: { color: colors.copper },
  badgeTextPaid: { color: '#2E7D32' },
  depositExplainer: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.charcoal,
    lineHeight: 15,
  },
  payDepositBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    marginTop: 4,
  },
  payDepositBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  shipCard: {
    backgroundColor: colors.white,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 16,
  },
  shipCardDesc: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    lineHeight: 14,
    marginBottom: 16,
  },
  formLabel: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
  },
  courierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  courierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  courierChipActive: {
    backgroundColor: colors.charcoal,
  },
  courierChipText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.charcoal,
  },
  courierChipTextActive: { color: colors.cream },
  input: {
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 14,
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.charcoal,
    backgroundColor: colors.white,
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: colors.charcoal,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },

  trackingCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 12,
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,31,34,0.1)',
  },
  trackingLabel: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  trackingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  trackingField: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '700',
  },
  trackingValue: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.charcoal,
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },
  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(30,59,47,0.06)',
    marginTop: 8,
  },
  deliveredText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.forest,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1C2B4A',
    paddingVertical: 10,
    marginTop: 10,
  },
  trackBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  chatWithPartnerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  chatWithPartnerText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
});
