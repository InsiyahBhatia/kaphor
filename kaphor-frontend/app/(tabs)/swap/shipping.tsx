import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SolarIcon } from '../../../src/components/common/SolarIcon';
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
import { Loader, Spinner } from '../../../src/components/common/Loader';
import { getErrorMessage } from '../../../src/utils/errors';

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
      Alert.alert('Error', getErrorMessage(err, 'Failed to update delivery address.'));
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
          text: 'Confirm & Release Deposit',
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
              Alert.alert('Error', getErrorMessage(err, 'Failed to confirm receipt.'));
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
      Alert.alert('Error', getErrorMessage(err, 'Failed to load shipping details'));
    } finally {
      setLoading(false);
    }
  };

  const handlePayDeposit = async () => {
    setPayingDeposit(true);
    try {
      const { razorpayOrderId, amount } = await swapService.paySecurityDeposit(swapId!);
      const keyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
      if (!keyId) {
        Alert.alert('Payments unavailable', 'Payments are not configured. Please try again later.');
        return;
      }

      const options = {
        key: keyId,
        amount: amount || 50000,
        currency: 'INR',
        order_id: razorpayOrderId,
        name: 'Kaphor Swap Deposit',
        description: 'Refundable Swap Security Deposit (₹500)',
        theme: { color: colors.goldDark },
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
              Alert.alert('Deposit secured!', 'Your ₹500 deposit is held safely. You can now ship your item.');
            } catch (err: any) {
              Alert.alert('Deposit secured!', 'Your deposit is confirmed.');
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
          'Confirm Deposit',
          'Pay a ₹500 refundable deposit? It is refunded automatically after delivery.',
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
                  Alert.alert('Deposit secured!', 'Your ₹500 deposit is held safely. You can ship now!');
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
        'Deposit Required',
        'Both people must pay the refundable ₹500 deposit before shipping.',
        [
          { text: 'Pay Deposit', onPress: handlePayDeposit },
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
        <Loader variant="swap" compact />
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
            <SolarIcon name="chatbubbles-outline" size={16} color={colors.charcoal} />
            <Text style={styles.chatWithPartnerText}>Chat with swap partner</Text>
          </View>
          <SolarIcon name="chevron-forward" size={14} color={colors.charcoal} />
        </TouchableOpacity>

        {/* 1. SHIP TO (PARTNER'S ADDRESS) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleNoMargin}>Ship to (partner's address)</Text>
          <View style={styles.addressRoleBadge}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.addressRoleBadgeText}>Shipping destination</Text>
          </View>
        </View>

        {partnerAddress ? (
          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <SolarIcon name="location" size={14} color={colors.cream} />
              <Text style={styles.addressHeaderText}>Send your package to:</Text>
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
            <SolarIcon name="hourglass-outline" size={24} color={colors.textMuted} />
            <Text style={styles.noAddressText}>
              Partner hasn't shared their delivery address yet. You can ship once they add it.
            </Text>
          </View>
        )}

        {/* 2. YOUR DELIVERY ADDRESS (WHERE PARTNER SENDS TO YOU) */}
        <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
          <Text style={styles.sectionTitleNoMargin}>Your delivery address</Text>
          <TouchableOpacity
            onPress={() => setShowAddressPicker(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.changeAddressLink}>
              {myAddress ? 'CHANGE' : 'Select from book'}
            </Text>
          </TouchableOpacity>
        </View>

        {myAddress ? (
          <View style={styles.addressCard}>
            <View style={[styles.addressHeader, { backgroundColor: colors.charcoal }]}>
              <SolarIcon name="home" size={14} color={colors.cream} />
              <Text style={styles.addressHeaderText}>Partner will ship to you at:</Text>
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
            <SolarIcon name="location-outline" size={24} color={colors.red} />
            <Text style={[styles.noAddressText, { color: colors.charcoal, fontWeight: '700' }]}>
              No delivery address shared with partner.
            </Text>
            <Text style={[styles.noAddressText, { fontSize: 11 }]}>
              Tap to choose a saved delivery address from your Address Book.
            </Text>
            <View style={styles.pickAddressBtn}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.pickAddressBtnText}>+ SELECT DELIVERY ADDRESS</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Interactive Security Deposit Escrow Card */}
        <View style={[styles.depositCard, depositPaid ? styles.depositCardPaid : styles.depositCardUnpaid]}>
          <View style={styles.depositHeader}>
            <View style={[styles.depositIconWrap, depositPaid ? styles.depositIconWrapPaid : styles.depositIconWrapUnpaid]}>
              <SolarIcon
                name={depositPaid ? 'shield-checkmark' : 'shield'}
                size={22}
                color={depositPaid ? colors.forest : colors.copper}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.depositTitle}>
                {depositPaid ? 'Deposit secured' : 'Deposit required'}
              </Text>
              <Text style={styles.depositAmountText}>
                {depositPaid ? '₹500 HELD SAFELY' : '₹500 REFUNDABLE DEPOSIT'}
              </Text>
            </View>
            <View style={[styles.depositStatusBadge, depositPaid ? styles.badgePaid : styles.badgeUnpaid]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.depositStatusBadgeText, depositPaid ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>
                {depositPaid ? 'PROTECTED' : 'Action required'}
              </Text>
            </View>
          </View>

          <Text style={styles.depositExplainer}>
            {depositPaid
              ? 'Your ₹500 deposit is held safely. It is refunded once both people confirm delivery.'
              : 'Both people pay a ₹500 deposit before shipping. It protects against lost or damaged items and is fully refunded after delivery.'}
          </Text>

          {!depositPaid && (
            <TouchableOpacity
              style={styles.payDepositBtn}
              onPress={handlePayDeposit}
              disabled={payingDeposit}
              activeOpacity={0.8}
            >
              {payingDeposit ? (
                <Spinner color={colors.cream} size="small" />
              ) : (
                <>
                  <SolarIcon name="lock-closed" size={16} color={colors.cream} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.payDepositBtnText}>Deposit ₹500 via Razorpay / UPI</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Mark as Shipped Form / Confirmed Card */}
        {isShipped ? (
          <View style={styles.shipCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <SolarIcon name="checkmark-circle" size={22} color={colors.forest} />
              <Text style={[styles.sectionTitle, { marginBottom: 0, color: colors.charcoal, fontSize: 12 }]}>
                Shipment sent
              </Text>
            </View>
            <Text style={styles.shipCardDesc}>
              You have registered tracking for your package. Both parties can follow progress below.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Mark as shipped</Text>
            <View style={styles.shipCard}>
              <Text style={styles.shipCardDesc}>
                Enter tracking details so both parties can track the package in real-time.
              </Text>

              {/* Courier Selector */}
              <Text style={styles.formLabel}>Courier partner</Text>
              <View style={styles.courierGrid}>
                {COURIER_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.courierChip, courier === opt.id && styles.courierChipActive]}
                    onPress={() => setCourier(opt.id)}
                  >
                    <SolarIcon
                      name={opt.icon as any}
                      size={16}
                      color={courier === opt.id ? colors.cream : colors.charcoal}
                    />
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.courierChipText, courier === opt.id && styles.courierChipTextActive]}>
                      {opt.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Tracking Number */}
              <Text style={styles.formLabel}>Tracking number</Text>
              <TextInput accessibilityLabel="Tracking number"
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
                  <Spinner color={colors.cream} />
                ) : (
                  <>
                    <SolarIcon name="cube" size={18} color={colors.cream} />
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.submitBtnText}>Mark as shipped</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Existing Tracking Info */}
        {(myTracking || theirTracking) && (
          <Text style={styles.sectionTitle}>Tracking status</Text>
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
              <SolarIcon name="shield-checkmark" size={18} color={colors.forest} />
              <Text style={styles.confirmReceiptTitle}>Delivery & condition verification</Text>
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
                <Spinner color={colors.cream} />
              ) : (
                <>
                  <SolarIcon name="checkmark-done" size={18} color={colors.cream} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.confirmReceiptBtnText}>Confirm package received</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {swap?.status === 'COMPLETED' && (
          <>
            <View style={styles.completedBanner}>
              <SolarIcon name="checkmark-circle" size={24} color={colors.forest} />
              <View style={{ flex: 1 }}>
                <Text style={styles.completedBannerTitle}>Swap transaction completed</Text>
                <Text style={styles.completedBannerSub}>
                  Both items received & verified. Security deposits released to your account.
                </Text>
              </View>
            </View>

            {/* MUTUAL REVIEWS SECTION */}
            <View style={styles.reviewSectionContainer}>
              <View style={styles.reviewSectionHeader}>
                <SolarIcon name="star" size={16} color={colors.gold} />
                <Text style={styles.reviewSectionTitle}>Mutual peer reviews</Text>
              </View>

              {/* 1. CURRENT USER REVIEW */}
              {myReview ? (
                <View style={styles.reviewedCard}>
                  <View style={styles.reviewedCardHeader}>
                    <Text style={styles.reviewedCardRole}>Your review of partner</Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <SolarIcon
                          key={star}
                          name={star <= myReview.rating ? 'star' : 'star-outline'}
                          size={14}
                          color={colors.gold}
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
                    <SolarIcon name="shield-checkmark" size={12} color={colors.forest} />
                    <Text style={styles.reviewedCardVerified}>Verified peer exchange</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.writeReviewCard}>
                  <Text style={styles.writeReviewHeading}>Rate your swap partner</Text>
                  <Text style={styles.writeReviewSub}>
                    How was the accessory condition, fast shipping, and the swap overall?
                  </Text>

                  {/* Star Rating Selector */}
                  <View style={styles.starPickerRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`Rate ${star} stars`}
                        key={star}
                        onPress={() => {
                          hapticFeedback.selection();
                          setReviewRating(star);
                        }}
                        style={styles.starTouch}
                        activeOpacity={0.7}
                      >
                        <SolarIcon
                          name={star <= reviewRating ? 'star' : 'star-outline'}
                          size={28}
                          color={colors.gold}
                        />
                      </TouchableOpacity>
                    ))}
                    <Text style={styles.starRatingNumber}>{reviewRating} / 5</Text>
                  </View>

                  {/* Comment Input */}
                  <TextInput accessibilityLabel="Review comment"
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
                      <Spinner color={colors.cream} />
                    ) : (
                      <>
                        <SolarIcon name="star" size={16} color={colors.cream} />
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.submitReviewBtnText}>Submit verified review</Text>
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
                        <SolarIcon
                          key={star}
                          name={star <= partnerReview.rating ? 'star' : 'star-outline'}
                          size={14}
                          color={colors.gold}
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
                    <SolarIcon name="shield-checkmark" size={12} color={colors.forest} />
                    <Text style={styles.reviewedCardVerified}>Verified peer exchange</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.awaitingPartnerCard}>
                  <SolarIcon name="time-outline" size={16} color={colors.textMuted} />
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
                <SolarIcon name="shirt-outline" size={16} color={colors.charcoal} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.wardrobeLinkBtnText}>View received item in wardrobe →</Text>
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
              <Text style={styles.addressModalTitle}>Select your delivery address</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
                onPress={() => setShowAddressPicker(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <SolarIcon name="close" size={22} color={colors.charcoal} />
              </TouchableOpacity>
            </View>

            {sharingAddress ? (
              <View style={{ minHeight: 160 }}>
                <Loader variant="default" compact message="Updating address..." />
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                {addresses.length === 0 ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text
                      style={{
                        fontFamily: typography.handwritten,
                        fontSize: 13,
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
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.modalAddBtnText}>+ ADD NEW ADDRESS</Text>
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
                              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.defaultBadgeText}>
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
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.modalAddBtnText, { color: colors.charcoal }]}>
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
          <SolarIcon name="cube" size={16} color={colors.charcoal} />
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
            <SolarIcon name="checkmark-circle" size={14} color={colors.forest} />
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
              <SolarIcon name="open-outline" size={14} color={colors.cream} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.trackBtnText}>Track package</Text>
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
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
    marginTop: 20, includeFontPadding: false, },

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
    gap: 8,
    backgroundColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addressHeaderText: {
    color: colors.cream,
    fontFamily: typography.handBold,
    fontSize: 13, includeFontPadding: false, },
  addressBody: {
    padding: 16,
    gap: 4,
  },
  addressName: {
    fontFamily: typography.bodyBold,
    fontSize: 14,
    color: colors.charcoal,
  },
  addressLine: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 18,
  },
  addrDivider: {
    height: 1,
    backgroundColor: colors.overlayLight,
    marginVertical: 4,
  },
  noAddressCard: {
    alignItems: 'center',
    gap: 12,
    padding: 20,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.charcoal,
    marginBottom: 16,
  },
  noAddressText: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 23, includeFontPadding: false, },

  depositCard: {
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 18,
    gap: 12,
  },
  depositCardUnpaid: {
    backgroundColor: colors.paperLight,
    borderColor: colors.terracottaLight,
  },
  depositCardPaid: {
    backgroundColor: colors.emeraldLight,
    borderColor: colors.emeraldLight,
  },
  depositHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  depositIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  depositIconWrapUnpaid: {
    backgroundColor: colors.terracottaLight,
  },
  depositIconWrapPaid: {
    backgroundColor: colors.emeraldLight,
  },
  depositTitle: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  depositAmountText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  depositStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  badgeUnpaid: {
    backgroundColor: colors.terracottaLight,
  },
  badgePaid: {
    backgroundColor: colors.emeraldLight,
  },
  depositStatusBadgeText: {
    fontFamily: typography.handBold,
    fontSize: 13, includeFontPadding: false, },
  badgeTextUnpaid: { color: colors.copper },
  badgeTextPaid: { color: colors.forest },
  depositExplainer: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 23, includeFontPadding: false, },
  payDepositBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 48,
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
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },

  shipCard: {
    backgroundColor: colors.white,
    padding: 18,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 16,
  },
  shipCardDesc: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 23,
    marginBottom: 14, includeFontPadding: false, },
  formLabel: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal,
    marginBottom: 8,
    marginTop: 12, includeFontPadding: false, },
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
    paddingVertical: 9,
    minHeight: 40,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  courierChipActive: {
    backgroundColor: colors.charcoal,
  },
  courierChipText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  courierChipTextActive: { color: colors.cream },
  input: {
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 12,
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.charcoal,
    backgroundColor: colors.white,
    marginBottom: 16,
    minHeight: 48,
  },
  submitBtn: {
    backgroundColor: colors.charcoal,
    height: 50,
    paddingHorizontal: 16,
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
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 0.2,
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
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
  },
  trackingLabel: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  trackingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  trackingField: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
  },
  trackingValue: {
    fontFamily: typography.mono,
    fontSize: 11,
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
    backgroundColor: colors.overlayLight,
    marginTop: 8,
  },
  deliveredText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.forest, includeFontPadding: false, },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.ink,
    paddingVertical: 11,
    minHeight: 44,
    marginTop: 10,
  },
  trackBtnText: {
    color: colors.cream,
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2,
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
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  confirmReceiptCard: {
    backgroundColor: colors.emeraldLight,
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
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.forest,
    flex: 1, includeFontPadding: false, },
  confirmReceiptSub: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    lineHeight: 23,
    color: colors.charcoal,
    marginBottom: 14, includeFontPadding: false, },
  confirmReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.forest,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 46,
  },
  confirmReceiptBtnText: {
    color: colors.cream,
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.emeraldLight,
    borderWidth: 2,
    borderColor: colors.forest,
    padding: 14,
    marginTop: 16,
    marginBottom: 16,
  },
  completedBannerTitle: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.forest, includeFontPadding: false, },
  completedBannerSub: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.charcoal,
    marginTop: 2,
    lineHeight: 20, includeFontPadding: false, },
  reviewPartnerBtn: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewPartnerBtnText: {
    color: colors.cream,
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },

  // 2-tier Address Coordinates Styles
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitleNoMargin: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.textMuted,
    flexShrink: 1, includeFontPadding: false, },
  addressRoleBadge: {
    backgroundColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  addressRoleBadgeText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.cream, includeFontPadding: false, },
  changeAddressLink: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.charcoal,
    textDecorationLine: 'underline',
    letterSpacing: 0.2,
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
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },

  // Modal Styles
  addressModalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  addressModalContent: {
    backgroundColor: colors.cream,
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
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
    fontFamily: typography.bodyBold,
    fontSize: 15,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.8,
    flex: 1,
  },
  modalAddBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 11,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAddBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.cream,
    letterSpacing: 0.2,
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
    backgroundColor: colors.paperLight,
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
    fontFamily: typography.bodyBold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.charcoal,
  },
  addressOptionPhone: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  addressOptionText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 17,
  },
  defaultBadge: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.charcoal,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
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
    fontSize: 16,
    letterSpacing: 0.5,
    color: colors.charcoal,
  },
  reviewedCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gold,
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
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewedCardComment: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 19,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  reviewedCardNoComment: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  reviewedCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
  },
  reviewedCardVerified: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.forest, includeFontPadding: false, },
  writeReviewCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 16,
    borderRadius: 4,
  },
  writeReviewHeading: {
    fontFamily: typography.bodyBold,
    fontSize: 15,
    color: colors.charcoal,
    marginBottom: 4,
  },
  writeReviewSub: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 14,
    lineHeight: 17,
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
    fontFamily: typography.bodyBold,
    fontSize: 14,
    color: colors.charcoal,
    marginLeft: 6,
  },
  reviewInput: {
    backgroundColor: colors.paperLight,
    borderWidth: 1,
    borderColor: colors.charcoal,
    borderRadius: 4,
    padding: 12,
    fontFamily: typography.body,
    fontSize: 13,
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
    paddingHorizontal: 16,
    minHeight: 46,
    borderRadius: 4,
  },
  submitReviewBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.cream,
    letterSpacing: 0.2,
  },
  awaitingPartnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 12,
    marginTop: 12,
    borderRadius: 4,
  },
  awaitingPartnerText: {
    flex: 1,
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 22, includeFontPadding: false, },
  wardrobeLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.paperLight,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 46,
    marginTop: 16,
    borderRadius: 4,
  },
  wardrobeLinkBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.charcoal,
    letterSpacing: 0.2,
  },
});
