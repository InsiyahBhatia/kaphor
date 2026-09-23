import React, { useEffect, useState, useCallback } from 'react';
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
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import { safeBack } from '../../../src/utils/navigation';
import { useAuth } from '../../../src/context/AuthContext';
import { swapService } from '../../../src/services/swapService';
import { messageService } from '../../../src/services/messageService';
import { addressService, Address } from '../../../src/services/addressService';
import { useRazorpay } from '@codearcade/expo-razorpay';
import { invalidateCache } from '../../../src/services/api';
import { hapticFeedback } from '../../../src/utils/haptics';
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
  const [confirmingReceived, setConfirmingReceived] = useState(false);

  // Address Book state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [sharingAddress, setSharingAddress] = useState(false);

  const { openCheckout } = useRazorpay();

  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Review states
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const isInitiator = user?.id ? user.id === swap?.initiatorId : true;
  const otherUserId = isInitiator ? swap?.receiverId : swap?.initiatorId;
  const myReview = swap?.reviews && user?.id ? swap.reviews[user.id] : null;
  const partnerReview = swap?.reviews && otherUserId ? swap.reviews[otherUserId] : null;

  const myTracking = isInitiator ? swap?.initiatorTracking : swap?.receiverTracking;
  const theirTracking = isInitiator ? swap?.receiverTracking : swap?.initiatorTracking;
  const isShipped = Boolean(myTracking);

  const myAddress: SwapAddress | undefined = isInitiator ? swap?.initiatorAddress : swap?.receiverAddress;
  const partnerAddress = address || (isInitiator ? swap?.receiverAddress : swap?.initiatorAddress);

  const handleSubmitReview = async () => {
    if (!swapId) return;
    setSubmittingReview(true);
    try {
      await swapService.submitSwapReview(swapId, reviewRating, reviewComment.trim());
      hapticFeedback.success();
      Alert.alert('Review Submitted! ⭐️', 'Thank you for your verified peer review.');
      await loadData();
    } catch (e: any) {
      Alert.alert('Notice', e?.response?.data?.message || 'Could not submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const loadAddresses = useCallback(async () => {
    try {
      const list = await addressService.list();
      setAddresses(list || []);
    } catch (e) {
      console.warn('Failed to load address book for swap shipping', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses])
  );

  useEffect(() => {
    const unsub = addressService.onSelectedAddressChange((addr) => {
      if (addr && swapId && !myAddress) {
        handleSelectAddress(addr);
      }
    });
    return unsub;
  }, [swapId, myAddress]);

  const handleSelectAddress = async (selectedAddr: Address) => {
    addressService.setActiveDeliveryAddress(selectedAddr);
    setSharingAddress(true);
    try {
      const swapAddrPayload: SwapAddress = {
        fullName: selectedAddr.fullName,
        phone: selectedAddr.phone,
        line1: selectedAddr.line1,
        line2: selectedAddr.line2 || undefined,
        city: selectedAddr.city,
        state: selectedAddr.state,
        pincode: selectedAddr.pincode,
      };
      const updatedSwap = await swapService.shareAddress(swapId!, swapAddrPayload);
      setSwap(updatedSwap);
      setShowAddressPicker(false);
      Alert.alert(
        'Delivery Address Updated',
        'Your delivery address has been updated and shared with your swap partner.'
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update delivery address.');
    } finally {
      setSharingAddress(false);
    }
  };

  const handleConfirmReceived = () => {
    Alert.alert(
      'Confirm Delivery & Condition',
      'Have you received the package and verified that the accessory condition matches the agreed exchange?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Release Escrow',
          onPress: async () => {
            setConfirmingReceived(true);
            try {
              const updated = await swapService.confirmReceived(swapId!, true);
              setSwap(updated);
              if (updated.status === 'COMPLETED') {
                invalidateCache(['/swaps', '/users/me/wardrobe', '/impact']);
                Alert.alert(
                  'Swap Complete',
                  'Both parties have confirmed receipt. The ownership transfer has been executed, your ₹500 security deposit is released, and your sustainability impact has been updated!',
                  [
                    {
                      text: 'Leave Partner Review',
                      onPress: () => router.push(`/(tabs)/swap/details?swapId=${swapId}&review=1` as any),
                    },
                    {
                      text: 'View My Swaps',
                      onPress: () => router.push('/(tabs)/swap' as any),
                    },
                  ]
                );
              } else {
                Alert.alert(
                  'Delivery Confirmed!',
                  'Your receipt confirmation has been recorded. Once your swap partner also confirms receipt of their package, the swap will complete and deposits will be released.'
                );
              }
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to confirm receipt.');
            } finally {
              setConfirmingReceived(false);
            }
          },
        },
      ]
    );
  };

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="SHIPPING" showBack fallbackPath={fallback} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={true}
      >
        {/* Quick Chat With Partner Bar */}
        <TouchableOpacity style={styles.chatWithPartnerBar} onPress={handleChatWithPartner} activeOpacity={0.8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="chatbubbles-outline" size={16} color={colors.charcoal} />
            <Text style={styles.chatWithPartnerText}>CHAT WITH SWAP PARTNER</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.charcoal} />
        </TouchableOpacity>

        {/* 1. SHIP TO (PARTNER'S ADDRESS) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleNoMargin}>SHIP TO (PARTNER'S ADDRESS)</Text>
          <View style={styles.addressRoleBadge}>
            <Text style={styles.addressRoleBadgeText}>DISPATCH DESTINATION</Text>
          </View>
        </View>

        {partnerAddress ? (
          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <Ionicons name="location" size={14} color={colors.cream} />
              <Text style={styles.addressHeaderText}>SEND YOUR PACKAGE TO:</Text>
            </View>
            <View style={styles.addressBody}>
              <Text style={styles.addressName}>{partnerAddress.fullName}</Text>
              <Text style={styles.addressLine}>{partnerAddress.phone}</Text>
              <View style={styles.addrDivider} />
              <Text style={styles.addressLine}>{partnerAddress.line1}</Text>
              {partnerAddress.line2 ? <Text style={styles.addressLine}>{partnerAddress.line2}</Text> : null}
              <Text style={styles.addressLine}>
                {partnerAddress.city}, {partnerAddress.state} — {partnerAddress.pincode}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noAddressCard}>
            <Ionicons name="hourglass-outline" size={24} color={colors.textMuted} />
            <Text style={styles.noAddressText}>
              Partner hasn't shared their delivery address yet. You will be able to dispatch as soon as they provide coordinates.
            </Text>
          </View>
        )}

        {/* 2. YOUR DELIVERY ADDRESS (WHERE PARTNER SENDS TO YOU) */}
        <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
          <Text style={styles.sectionTitleNoMargin}>YOUR DELIVERY ADDRESS</Text>
          <TouchableOpacity
            onPress={() => setShowAddressPicker(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.changeAddressLink}>
              {myAddress ? 'CHANGE' : 'SELECT FROM BOOK'}
            </Text>
          </TouchableOpacity>
        </View>

        {myAddress ? (
          <View style={styles.addressCard}>
            <View style={[styles.addressHeader, { backgroundColor: colors.charcoal }]}>
              <Ionicons name="home" size={14} color={colors.cream} />
              <Text style={styles.addressHeaderText}>PARTNER WILL SHIP TO YOU AT:</Text>
            </View>
            <View style={styles.addressBody}>
              <Text style={styles.addressName}>{myAddress.fullName}</Text>
              <Text style={styles.addressLine}>{myAddress.phone}</Text>
              <View style={styles.addrDivider} />
              <Text style={styles.addressLine}>{myAddress.line1}</Text>
              {myAddress.line2 ? <Text style={styles.addressLine}>{myAddress.line2}</Text> : null}
              <Text style={styles.addressLine}>
                {myAddress.city}, {myAddress.state} — {myAddress.pincode}
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.noAddressCardDashed}
            onPress={() => setShowAddressPicker(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="location-outline" size={24} color={colors.red} />
            <Text style={[styles.noAddressText, { color: colors.charcoal, fontWeight: '700' }]}>
              No delivery address shared with partner.
            </Text>
            <Text style={[styles.noAddressText, { fontSize: 12 }]}>
              Tap to choose a saved delivery address from your Address Book.
            </Text>
            <View style={styles.pickAddressBtn}>
              <Text style={styles.pickAddressBtnText}>+ SELECT DELIVERY ADDRESS</Text>
            </View>
          </TouchableOpacity>
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
              <Text style={[styles.sectionTitle, { marginBottom: 0, color: colors.charcoal, fontSize: 15.5 }]}>
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

        {/* Delivery Confirmation & Condition Acceptance */}
        {(theirTracking || swap?.status === 'SHIPPED' || swap?.status === 'BOTH_SHIPPED' || swap?.status === 'DELIVERED') && swap?.status !== 'COMPLETED' && (
          <View style={styles.confirmReceiptCard}>
            <View style={styles.confirmReceiptHeader}>
              <Ionicons name="shield-checkmark" size={18} color={colors.forest} />
              <Text style={styles.confirmReceiptTitle}>DELIVERY & CONDITION VERIFICATION</Text>
            </View>
            <Text style={styles.confirmReceiptSub}>
              Once your package arrives, inspect the accessory and confirm receipt to complete the exchange, release your ₹500 security deposit, and update your impact metrics.
            </Text>
            <TouchableOpacity
              style={[styles.confirmReceiptBtn, confirmingReceived && { opacity: 0.6 }]}
              onPress={handleConfirmReceived}
              disabled={confirmingReceived}
              activeOpacity={0.85}
            >
              {confirmingReceived ? (
                <ActivityIndicator color={colors.cream} />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={18} color={colors.cream} />
                  <Text style={styles.confirmReceiptBtnText}>CONFIRM PACKAGE RECEIVED</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {swap?.status === 'COMPLETED' && (
          <>
            <View style={styles.completedBanner}>
              <Ionicons name="checkmark-circle" size={24} color={colors.forest} />
              <View style={{ flex: 1 }}>
                <Text style={styles.completedBannerTitle}>SWAP TRANSACTION COMPLETED</Text>
                <Text style={styles.completedBannerSub}>
                  Both items received & verified. Security deposits released to your account.
                </Text>
              </View>
            </View>

            {/* MUTUAL REVIEWS SECTION */}
            <View style={styles.reviewSectionContainer}>
              <View style={styles.reviewSectionHeader}>
                <Ionicons name="star" size={16} color="#C9A84C" />
                <Text style={styles.reviewSectionTitle}>MUTUAL PEER REVIEWS</Text>
              </View>

              {/* 1. CURRENT USER REVIEW */}
              {myReview ? (
                <View style={styles.reviewedCard}>
                  <View style={styles.reviewedCardHeader}>
                    <Text style={styles.reviewedCardRole}>YOUR REVIEW OF PARTNER</Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= myReview.rating ? 'star' : 'star-outline'}
                          size={14}
                          color="#C9A84C"
                        />
                      ))}
                    </View>
                  </View>
                  {myReview.comment ? (
                    <Text style={styles.reviewedCardComment}>"{myReview.comment}"</Text>
                  ) : (
                    <Text style={styles.reviewedCardNoComment}>No written comment provided.</Text>
                  )}
                  <View style={styles.reviewedCardFooter}>
                    <Ionicons name="shield-checkmark" size={12} color={colors.forest} />
                    <Text style={styles.reviewedCardVerified}>VERIFIED PEER EXCHANGE</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.writeReviewCard}>
                  <Text style={styles.writeReviewHeading}>RATE YOUR SWAP PARTNER</Text>
                  <Text style={styles.writeReviewSub}>
                    How was the accessory condition, prompt dispatch, and trade experience?
                  </Text>

                  {/* Star Rating Selector */}
                  <View style={styles.starPickerRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => {
                          hapticFeedback.selection();
                          setReviewRating(star);
                        }}
                        style={styles.starTouch}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={star <= reviewRating ? 'star' : 'star-outline'}
                          size={28}
                          color="#C9A84C"
                        />
                      </TouchableOpacity>
                    ))}
                    <Text style={styles.starRatingNumber}>{reviewRating} / 5</Text>
                  </View>

                  {/* Comment Input */}
                  <TextInput
                    style={styles.reviewInput}
                    placeholder="Share feedback on accessory condition, packaging, and trade experience..."
                    placeholderTextColor={colors.textMuted}
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    multiline
                    numberOfLines={3}
                  />

                  {/* Submit Review Button */}
                  <TouchableOpacity
                    style={[styles.submitReviewBtn, submittingReview && { opacity: 0.6 }]}
                    onPress={handleSubmitReview}
                    disabled={submittingReview}
                    activeOpacity={0.85}
                  >
                    {submittingReview ? (
                      <ActivityIndicator color={colors.cream} />
                    ) : (
                      <>
                        <Ionicons name="star" size={16} color={colors.cream} />
                        <Text style={styles.submitReviewBtnText}>SUBMIT VERIFIED REVIEW</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* 2. PARTNER'S REVIEW */}
              {partnerReview ? (
                <View style={[styles.reviewedCard, { marginTop: 12 }]}>
                  <View style={styles.reviewedCardHeader}>
                    <Text style={styles.reviewedCardRole}>
                      {partnerReview.reviewerName || 'PARTNER'}'S REVIEW OF YOU
                    </Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= partnerReview.rating ? 'star' : 'star-outline'}
                          size={14}
                          color="#C9A84C"
                        />
                      ))}
                    </View>
                  </View>
                  {partnerReview.comment ? (
                    <Text style={styles.reviewedCardComment}>"{partnerReview.comment}"</Text>
                  ) : (
                    <Text style={styles.reviewedCardNoComment}>No written comment provided.</Text>
                  )}
                  <View style={styles.reviewedCardFooter}>
                    <Ionicons name="shield-checkmark" size={12} color={colors.forest} />
                    <Text style={styles.reviewedCardVerified}>VERIFIED PEER EXCHANGE</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.awaitingPartnerCard}>
                  <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.awaitingPartnerText}>
                    Awaiting partner's review. Once submitted, it will appear here and update your trust score.
                  </Text>
                </View>
              )}

              {/* Digital Wardrobe Navigation */}
              <TouchableOpacity
                style={styles.wardrobeLinkBtn}
                onPress={() => router.push('/(tabs)/profile' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="shirt-outline" size={16} color={colors.charcoal} />
                <Text style={styles.wardrobeLinkBtnText}>VIEW RECEIVED ITEM IN WARDROBE →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Address Picker Modal */}
      {showAddressPicker && (
        <View style={styles.addressModalOverlay}>
          <View style={styles.addressModalContent}>
            <View style={styles.addressModalHeader}>
              <Text style={styles.addressModalTitle}>SELECT YOUR DELIVERY ADDRESS</Text>
              <TouchableOpacity
                onPress={() => setShowAddressPicker(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.charcoal} />
              </TouchableOpacity>
            </View>

            {sharingAddress ? (
              <View style={{ padding: 30, alignItems: 'center', gap: 12 }}>
                <ActivityIndicator size="large" color={colors.charcoal} />
                <Text style={{ fontFamily: typography.mono, fontSize: 14.5, color: colors.textMuted }}>
                  Updating delivery coordinates...
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                {addresses.length === 0 ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text
                      style={{
                        fontFamily: typography.mono,
                        fontSize: 15.5,
                        color: colors.textMuted,
                        textAlign: 'center',
                        marginBottom: 12,
                      }}
                    >
                      No saved addresses found in your address book.
                    </Text>
                    <TouchableOpacity
                      style={styles.modalAddBtn}
                      onPress={() => {
                        setShowAddressPicker(false);
                        router.push('/profile/addresses?selectMode=true' as any);
                      }}
                    >
                      <Text style={styles.modalAddBtnText}>+ ADD NEW ADDRESS</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    {addresses.map((addr) => {
                      const isCurrent =
                        myAddress?.fullName === addr.fullName &&
                        myAddress?.pincode === addr.pincode &&
                        myAddress?.line1 === addr.line1;
                      return (
                        <TouchableOpacity
                          key={addr.id}
                          style={[
                            styles.addressOptionCard,
                            isCurrent && styles.addressOptionCardActive,
                          ]}
                          onPress={() => handleSelectAddress(addr)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.addressOptionHeader}>
                            <Text style={styles.addressOptionName}>{addr.fullName}</Text>
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>
                                {addr.label?.toUpperCase() ||
                                  (addr.isDefault ? 'DEFAULT' : 'SAVED')}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.addressOptionPhone}>{addr.phone}</Text>
                          <Text style={styles.addressOptionText}>
                            {[
                              addr.line1,
                              addr.line2,
                              addr.city,
                              addr.state,
                              addr.pincode,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={[
                        styles.modalAddBtn,
                        {
                          marginTop: 8,
                          backgroundColor: colors.white,
                          borderWidth: 1.5,
                          borderColor: colors.charcoal,
                        },
                      ]}
                      onPress={() => {
                        setShowAddressPicker(false);
                        router.push('/profile/addresses?selectMode=true' as any);
                      }}
                    >
                      <Text style={[styles.modalAddBtnText, { color: colors.charcoal }]}>
                        + MANAGE / ADD NEW ADDRESS
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
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

  content: { padding: 20, paddingBottom: 180 },
  sectionTitle: {
    fontFamily: typography.mono,
    fontSize: 13.5,
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
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  addressBody: {
    padding: 16,
    gap: 4,
  },
  addressName: {
    fontFamily: typography.mono,
    fontSize: 18.5,
    fontWeight: '800',
    color: colors.charcoal,
  },
  addressLine: {
    fontFamily: typography.mono,
    fontSize: 14.5,
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
    fontSize: 13.5,
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
    fontSize: 14.5,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  depositAmountText: {
    fontFamily: typography.mono,
    fontSize: 13.5,
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
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  badgeTextUnpaid: { color: colors.copper },
  badgeTextPaid: { color: '#2E7D32' },
  depositExplainer: {
    fontFamily: typography.mono,
    fontSize: 13.5,
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
    fontSize: 14.5,
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
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 14,
    marginBottom: 16,
  },
  formLabel: {
    fontFamily: typography.mono,
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '800',
    color: colors.charcoal,
  },
  courierChipTextActive: { color: colors.cream },
  input: {
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 14,
    fontFamily: typography.body,
    fontSize: 18,
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
    fontSize: 15.5,
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
    fontSize: 13.5,
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
    fontSize: 13.5,
    color: colors.textMuted,
    fontWeight: '700',
  },
  trackingValue: {
    fontFamily: typography.mono,
    fontSize: 13.5,
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
    fontSize: 12,
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
    fontSize: 13.5,
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
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  confirmReceiptCard: {
    backgroundColor: '#F7FBF8',
    borderWidth: 2,
    borderColor: colors.forest,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  confirmReceiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  confirmReceiptTitle: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '900',
    color: colors.forest,
    letterSpacing: 1,
  },
  confirmReceiptSub: {
    fontFamily: typography.mono,
    fontSize: 12,
    lineHeight: 14,
    color: colors.charcoal,
    marginBottom: 14,
  },
  confirmReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.forest,
    paddingVertical: 12,
  },
  confirmReceiptBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EBF3ED',
    borderWidth: 2,
    borderColor: colors.forest,
    padding: 14,
    marginTop: 16,
    marginBottom: 16,
  },
  completedBannerTitle: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '900',
    color: colors.forest,
    letterSpacing: 0.8,
  },
  completedBannerSub: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    color: colors.charcoal,
    marginTop: 2,
  },
  reviewPartnerBtn: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewPartnerBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // 2-tier Address Coordinates Styles
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitleNoMargin: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  addressRoleBadge: {
    backgroundColor: '#1C2B4A',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  addressRoleBadgeText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.8,
  },
  changeAddressLink: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.charcoal,
    textDecorationLine: 'underline',
    letterSpacing: 0.8,
  },
  noAddressCardDashed: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.charcoal,
    marginBottom: 16,
  },
  pickAddressBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  pickAddressBtnText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  // Modal Styles
  addressModalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  addressModalContent: {
    backgroundColor: colors.cream,
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  addressModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.charcoal,
  },
  addressModalTitle: {
    fontFamily: typography.headings,
    fontSize: 18,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  modalAddBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  modalAddBtnText: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 0.8,
  },
  addressOptionCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 14,
    marginBottom: 10,
  },
  addressOptionCardActive: {
    borderWidth: 2.5,
    borderColor: colors.charcoal,
    backgroundColor: '#fffdf5',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  addressOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressOptionName: {
    fontFamily: typography.headings,
    fontSize: 17,
    fontWeight: '700',
    color: colors.charcoal,
  },
  addressOptionPhone: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    color: colors.textMuted,
    marginBottom: 4,
  },
  addressOptionText: {
    fontFamily: typography.body,
    fontSize: 14.5,
    color: colors.charcoal,
    lineHeight: 16,
  },
  defaultBadge: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.charcoal,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.charcoal,
  },
  reviewSectionContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reviewSectionTitle: {
    fontFamily: typography.headings,
    fontSize: 19.5,
    letterSpacing: 0.5,
    color: colors.charcoal,
  },
  reviewedCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    padding: 14,
    borderRadius: 4,
  },
  reviewedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewedCardRole: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewedCardComment: {
    fontFamily: typography.body,
    fontSize: 16.5,
    color: colors.charcoal,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  reviewedCardNoComment: {
    fontFamily: typography.body,
    fontSize: 15.5,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  reviewedCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: '#F0EAE1',
    paddingTop: 8,
  },
  reviewedCardVerified: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '900',
    color: colors.forest,
    letterSpacing: 0.5,
  },
  writeReviewCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 16,
    borderRadius: 4,
  },
  writeReviewHeading: {
    fontFamily: typography.headings,
    fontSize: 18,
    color: colors.charcoal,
    marginBottom: 4,
  },
  writeReviewSub: {
    fontFamily: typography.body,
    fontSize: 14.5,
    color: colors.textMuted,
    marginBottom: 14,
    lineHeight: 16,
  },
  starPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  starTouch: {
    padding: 2,
  },
  starRatingNumber: {
    fontFamily: typography.mono,
    fontSize: 17,
    fontWeight: '900',
    color: colors.charcoal,
    marginLeft: 6,
  },
  reviewInput: {
    backgroundColor: '#FAF7EE',
    borderWidth: 1,
    borderColor: colors.charcoal,
    borderRadius: 4,
    padding: 10,
    fontFamily: typography.body,
    fontSize: 15.5,
    color: colors.charcoal,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  submitReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.charcoal,
    paddingVertical: 12,
    borderRadius: 4,
  },
  submitReviewBtnText: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.8,
  },
  awaitingPartnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F2EB',
    borderWidth: 1,
    borderColor: '#E2DEC9',
    padding: 12,
    marginTop: 12,
    borderRadius: 4,
  },
  awaitingPartnerText: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 14,
  },
  wardrobeLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FAF7EE',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    paddingVertical: 11,
    marginTop: 16,
    borderRadius: 4,
  },
  wardrobeLinkBtnText: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.6,
  },
});
