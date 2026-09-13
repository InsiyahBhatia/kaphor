import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rentalService } from '../../../../src/services/rentalService';
import { messageService } from '../../../../src/services/messageService';
import { colors, typography } from '../../../../src/theme';
import { KaphorImage, getCategoryFallbackImage } from '../../../../src/components/KaphorImage';
import { safeBack, useBackHandler } from '../../../../src/utils/navigation';
import { hapticFeedback } from '../../../../src/utils/haptics';
import { useAuthStore } from '../../../../src/store/authStore';

export default function RentalLeaseDossierScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [rental, setRental] = useState<any>(null);
  const [escrow, setEscrow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  // Dispatch Modal
  const [dispatchModalVisible, setDispatchModalVisible] = useState(false);
  const [carrier, setCarrier] = useState('BlueDart');
  const [trackingNumber, setTrackingNumber] = useState('');

  // Return Modal
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [returnCarrier, setReturnCarrier] = useState('Delhivery');
  const [returnTracking, setReturnTracking] = useState('');

  // Review Modal
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useBackHandler('/(tabs)/rental');

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await rentalService.getRentalById(id);
      setRental(data);

      try {
        const escrowData = await rentalService.getEscrow(id);
        setEscrow(escrowData);
      } catch (escrowErr) {
        console.warn('Failed to load escrow details:', escrowErr);
      }
    } catch (err: any) {
      console.error('Failed to load rental lease:', err);
      Alert.alert('Error', err?.response?.data?.message || 'Failed to load rental details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isRenter = rental?.userRole === 'RENTER' || rental?.renterId === currentUserId;
  const isLender = rental?.userRole === 'LENDER' || rental?.garment?.sellerId === currentUserId;

  // Contact counterparty via in-app messaging
  const handleChat = async () => {
    const counterpartyId = isRenter ? rental?.garment?.sellerId : rental?.renterId;
    if (!counterpartyId) return;

    setStartingChat(true);
    hapticFeedback.medium();
    try {
      const conv = await messageService.getOrCreateConversation(
        counterpartyId,
        rental?.garmentId
      );
      if (conv?.id) {
        router.push(`/messages/${conv.id}` as any);
      } else {
        router.push('/messages' as any);
      }
    } catch (err) {
      console.warn('Failed to start conversation:', err);
      router.push('/messages' as any);
    } finally {
      setStartingChat(false);
    }
  };

  // Lender marks as dispatched
  const handleDispatch = async () => {
    if (!trackingNumber.trim()) {
      Alert.alert('Tracking Number Required', 'Please provide a valid courier tracking or consignment number.');
      return;
    }

    setActionLoading(true);
    hapticFeedback.medium();
    try {
      await rentalService.dispatchRental(id as string, {
        carrier: carrier.trim(),
        trackingNumber: trackingNumber.trim(),
      });
      setDispatchModalVisible(false);
      Alert.alert('Garment Dispatched', 'Rental is now active. The borrower has been notified with tracking details.');
      await loadData();
    } catch (err: any) {
      Alert.alert('Dispatch Error', err?.response?.data?.message || 'Failed to dispatch rental.');
    } finally {
      setActionLoading(false);
    }
  };

  // Borrower marks as returned
  const handleReturn = async () => {
    setActionLoading(true);
    hapticFeedback.medium();
    try {
      await rentalService.returnRental(id as string, {
        returnCarrier: returnCarrier.trim(),
        returnTracking: returnTracking.trim() || undefined,
      });
      setReturnModalVisible(false);
      Alert.alert('Return Confirmed', 'The lender has been notified. Your security deposit will be released upon inspection.');
      await loadData();
    } catch (err: any) {
      Alert.alert('Return Error', err?.response?.data?.message || 'Failed to submit return.');
    } finally {
      setActionLoading(false);
    }
  };

  // Lender inspects & releases security deposit
  const handleReleaseDeposit = async () => {
    Alert.alert(
      'Release Security Deposit',
      'Have you received and inspected the returned garment in acceptable condition? This will release the ₹299 refundable deposit back to the borrower.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Inspect & Release',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            hapticFeedback.medium();
            try {
              await rentalService.releaseDeposit(id as string);
              Alert.alert('Deposit Released', '₹299 security deposit has been refunded to the borrower.');
              await loadData();
            } catch (err: any) {
              Alert.alert('Release Error', err?.response?.data?.message || 'Failed to release deposit.');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // Submit review
  const handleSubmitReview = async () => {
    setActionLoading(true);
    hapticFeedback.medium();
    try {
      await rentalService.postReview(id as string, {
        rating,
        comment: reviewComment.trim() || undefined,
      });
      setReviewModalVisible(false);
      setReviewSubmitted(true);
      Alert.alert('Review Submitted', 'Thank you for rating your circular rental partner!');
    } catch (err: any) {
      Alert.alert('Review Error', err?.response?.data?.message || 'Failed to submit review.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.crimson} />
        <Text style={styles.loadingText}>LOADING LEASE DOSSIER…</Text>
      </View>
    );
  }

  if (!rental) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={styles.errorTitle}>RENTAL NOT FOUND</Text>
        <Text style={styles.errorSubtitle}>This rental order could not be located or access is restricted.</Text>
        <TouchableOpacity style={styles.primaryCta} onPress={() => safeBack('/(tabs)/rental')}>
          <Text style={styles.primaryCtaText}>BACK TO RENTALS</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const garment = rental.garment || {};
  const seller = garment.seller || {};
  const renter = rental.renter || {};
  const counterparty = isRenter ? seller : renter;
  const counterpartyRole = isRenter ? 'LENDER / OWNER' : 'BORROWER / RENTER';

  const startDate = new Date(rental.startDate);
  const endDate = new Date(rental.endDate);
  const now = new Date();
  const daysTotal = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24)));

  const isDepositReleased = rental.status === 'RETURNED' && (escrow?.status === 'RELEASED');

  // Breakdown figures
  const meta = rental.metadata || {};
  const rentalFee = meta.rentalFee || rental.totalPrice || 0;
  const refundableDeposit = meta.refundableDeposit || 299;
  const damageInsurance = meta.damageInsurance || 49;
  const deliveryReturnFee = meta.deliveryReturnFee || 199;
  const totalAmount = meta.grandTotal || (rentalFee + refundableDeposit + damageInsurance + deliveryReturnFee);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity
          onPress={() => safeBack('/(tabs)/rental')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>RENTAL LEASE DOSSIER</Text>
          <Text style={styles.headerSub}>ID: {rental.id.slice(0, 8).toUpperCase()}</Text>
        </View>
        <TouchableOpacity
          onPress={handleChat}
          disabled={startingChat}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {startingChat ? (
            <ActivityIndicator size="small" color={colors.crimson} />
          ) : (
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.textPrimary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <View style={[
          styles.statusBanner,
          rental.status === 'ACTIVE' && styles.statusBannerActive,
          rental.status === 'RETURNED' && styles.statusBannerReturned,
          rental.status === 'OVERDUE' && styles.statusBannerOverdue,
        ]}>
          <View style={styles.statusRow}>
            <View style={styles.statusBadgeDot} />
            <Text style={styles.statusTitle}>
              {rental.status === 'RESERVED' && (isLender ? 'READY TO DISPATCH' : 'RESERVATION CONFIRMED')}
              {rental.status === 'ACTIVE' && `ACTIVE LEASE • ${daysLeft} ${daysLeft === 1 ? 'DAY' : 'DAYS'} LEFT`}
              {rental.status === 'RETURNED' && (isDepositReleased ? 'RETURNED & DEPOSIT REFUNDED' : 'GARMENT RETURNED • INSPECTION PENDING')}
              {rental.status === 'OVERDUE' && 'RETURN OVERDUE'}
            </Text>
          </View>
          <Text style={styles.statusDesc}>
            {rental.status === 'RESERVED' && isLender && 'Please package and dispatch the garment. Tap below to enter tracking.'}
            {rental.status === 'RESERVED' && isRenter && 'The garment owner is preparing your piece for insured dispatch.'}
            {rental.status === 'ACTIVE' && isRenter && `Enjoy wearing! Please dispatch for return by ${endDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}.`}
            {rental.status === 'ACTIVE' && isLender && `Garment is currently with the borrower. Scheduled return: ${endDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}.`}
            {rental.status === 'RETURNED' && isLender && !isDepositReleased && 'Please inspect garment hygiene and fabric condition to release the ₹299 escrow deposit.'}
            {rental.status === 'RETURNED' && isDepositReleased && 'All lease obligations fulfilled. Security deposit has been successfully released.'}
            {rental.status === 'OVERDUE' && 'The agreed rental duration has expired. Please contact support or the lender immediately.'}
          </Text>
        </View>

        {/* Garment Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionLabel}>RENTAL ASSET</Text>
          <View style={styles.garmentRow}>
            <KaphorImage
              uri={Array.isArray(garment.images) && garment.images.length > 0 ? garment.images[0] : null}
              style={styles.garmentThumb}
              contentFit="cover"
            />
            <View style={styles.garmentInfo}>
              <Text style={styles.brandText}>{garment.brand || 'LUXURY DESIGNER'}</Text>
              <Text style={styles.titleText} numberOfLines={2}>{garment.title}</Text>
              <View style={styles.tagRow}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{garment.category || 'COUTURE'}</Text>
                </View>
                <View style={[styles.tag, { borderColor: colors.forest || '#2A7B4C' }]}>
                  <Text style={[styles.tagText, { color: colors.forest || '#2A7B4C' }]}>
                    {garment.condition || 'PRISTINE'}
                  </Text>
                </View>
              </View>
              <Text style={styles.garmentRate}>
                ₹{(garment.rentalPriceDay || 0).toLocaleString()} <Text style={styles.rateUnit}>/ day</Text>
              </Text>
            </View>
          </View>

          {/* Counterparty Row */}
          <View style={styles.divider} />
          <View style={styles.counterpartyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.counterpartyRoleLabel}>{counterpartyRole}</Text>
              <Text style={styles.counterpartyName}>{counterparty?.displayName || counterparty?.username || 'Verified Kaphor Member'}</Text>
            </View>
            <TouchableOpacity style={styles.chatButton} onPress={handleChat} activeOpacity={0.8}>
              <Ionicons name="chatbubble-outline" size={14} color={colors.crimson} />
              <Text style={styles.chatButtonText}>MESSAGE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Schedule & Duration Timeline Card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionLabel}>LEASE TIMELINE</Text>
          <View style={styles.timelineContainer}>
            <View style={styles.timelineEndpoint}>
              <View style={styles.timelineCircle} />
              <Text style={styles.timelineDateLabel}>DELIVERY / START</Text>
              <Text style={styles.timelineDateValue}>
                {startDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>

            <View style={styles.timelineBarContainer}>
              <View style={styles.timelineBar} />
              <View style={styles.timelineDurationBadge}>
                <Text style={styles.timelineDurationText}>{daysTotal} DAYS LEASE</Text>
              </View>
            </View>

            <View style={styles.timelineEndpoint}>
              <View style={[styles.timelineCircle, { backgroundColor: colors.forest || '#2A7B4C' }]} />
              <Text style={styles.timelineDateLabel}>RETURN DUE</Text>
              <Text style={styles.timelineDateValue}>
                {endDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
          </View>
        </View>

        {/* Logistics & Tracking Card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionLabel}>LOGISTICS & SHIPMENT TRACKING</Text>

          {/* Outbound Tracking */}
          <View style={styles.trackingSection}>
            <View style={styles.trackingHeader}>
              <Ionicons name="airplane-outline" size={15} color={colors.crimson} />
              <Text style={styles.trackingTitle}>OUTBOUND TO BORROWER</Text>
            </View>
            {rental.trackingNumber ? (
              <View style={styles.trackingDetailsBox}>
                <View style={styles.trackingDetailRow}>
                  <Text style={styles.trackingDetailLabel}>CARRIER</Text>
                  <Text style={styles.trackingDetailValue}>{rental.carrier || 'BlueDart'}</Text>
                </View>
                <View style={styles.trackingDetailRow}>
                  <Text style={styles.trackingDetailLabel}>TRACKING AWB</Text>
                  <Text style={[styles.trackingDetailValue, { fontFamily: typography.mono }]}>
                    {rental.trackingNumber}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.noTrackingText}>
                {isLender
                  ? 'Awaiting your dispatch. Tap "Dispatch Garment" below when ready.'
                  : 'Garment owner will input courier tracking once dispatched.'}
              </Text>
            )}
          </View>

          {/* Inbound / Return Tracking */}
          {(rental.status === 'ACTIVE' || rental.status === 'RETURNED') && (
            <View style={[styles.trackingSection, { marginTop: 14 }]}>
              <View style={styles.trackingHeader}>
                <Ionicons name="repeat-outline" size={15} color={colors.forest || '#2A7B4C'} />
                <Text style={styles.trackingTitle}>RETURN TO LENDER</Text>
              </View>
              {rental.returnTracking ? (
                <View style={styles.trackingDetailsBox}>
                  <View style={styles.trackingDetailRow}>
                    <Text style={styles.trackingDetailLabel}>RETURN COURIER</Text>
                    <Text style={styles.trackingDetailValue}>{rental.returnCarrier || 'Delhivery'}</Text>
                  </View>
                  <View style={styles.trackingDetailRow}>
                    <Text style={styles.trackingDetailLabel}>RETURN AWB</Text>
                    <Text style={[styles.trackingDetailValue, { fontFamily: typography.mono }]}>
                      {rental.returnTracking}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.noTrackingText}>
                  {isRenter
                    ? 'Use the prepaid return bag. Tap "Initiate Return" below once scheduled.'
                    : 'Return shipment will appear once dispatched by the borrower.'}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Shipping Destination Card */}
        {rental.shippingAddress && (
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>DELIVERY ADDRESS</Text>
            <View style={styles.addressBox}>
              <Text style={styles.addressRecipient}>
                {rental.shippingAddress.fullName} • {rental.shippingAddress.phone}
              </Text>
              <Text style={styles.addressLine}>
                {rental.shippingAddress.line1}
                {rental.shippingAddress.line2 ? `, ${rental.shippingAddress.line2}` : ''}
              </Text>
              {rental.shippingAddress.landmark && (
                <Text style={styles.addressLine}>Near: {rental.shippingAddress.landmark}</Text>
              )}
              <Text style={styles.addressCity}>
                {rental.shippingAddress.city}, {rental.shippingAddress.state} - {rental.shippingAddress.pincode}
              </Text>
            </View>
          </View>
        )}

        {/* Escrow & Payment Breakdown Card */}
        <View style={styles.card}>
          <View style={styles.escrowHeaderRow}>
            <Text style={styles.cardSectionLabel}>PAYMENT & ESCROW BREAKDOWN</Text>
            <View style={[
              styles.escrowPill,
              isDepositReleased ? styles.escrowPillReleased : styles.escrowPillHeld
            ]}>
              <Ionicons
                name={isDepositReleased ? 'checkmark-circle' : 'shield-checkmark'}
                size={12}
                color={isDepositReleased ? (colors.forest || '#2A7B4C') : colors.crimson}
              />
              <Text style={[
                styles.escrowPillText,
                isDepositReleased && { color: colors.forest || '#2A7B4C' }
              ]}>
                {isDepositReleased ? 'ESCROW REFUNDED' : 'ESCROW SECURED'}
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>RENTAL FEE ({daysTotal} DAYS)</Text>
            <Text style={styles.summaryValue}>₹{rentalFee.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.summaryLabel}>REFUNDABLE SECURITY DEPOSIT</Text>
              <Ionicons name="lock-closed" size={11} color={colors.forest || '#2A7B4C'} />
            </View>
            <Text style={[styles.summaryValue, { color: colors.forest || '#2A7B4C' }]}>
              ₹{refundableDeposit} {isDepositReleased ? '(Refunded)' : '(In Escrow)'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>DAMAGE WAIVER & HYGIENIC STEAM</Text>
            <Text style={styles.summaryValue}>₹{damageInsurance}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>TWO-WAY INSURED COURIER</Text>
            <Text style={styles.summaryValue}>₹{deliveryReturnFee}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>TOTAL LEASE AMOUNT</Text>
            <Text style={styles.totalValue}>₹{totalAmount.toLocaleString()}</Text>
          </View>
        </View>

        {/* Legal Disclaimer */}
        <View style={styles.legalDisclaimerBox}>
          <Ionicons name="shield-checkmark" size={13} color={colors.textMuted} />
          <Text style={styles.legalDisclaimerText}>
            Direct Peer-to-Peer Rental Agreement: Kaphor operates exclusively as an intermediary under Section 79 of the Information Technology Act, 2000. All transactions and wear liabilities are governed by user agreement between lender and borrower.
          </Text>
        </View>
      </ScrollView>

      {/* Floating Role-Based Action Bar */}
      <View style={[
        styles.footer,
        {
          paddingBottom: Math.max(
            insets.bottom + 12,
            Platform.OS === 'android' ? 24 : 16
          )
        }
      ]}>
        {/* Lender dispatch button */}
        {isLender && rental.status === 'RESERVED' && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setDispatchModalVisible(true)}
            activeOpacity={0.88}
          >
            <Ionicons name="paper-plane" size={16} color={colors.white} />
            <Text style={styles.actionBtnText}>DISPATCH GARMENT & ENTER TRACKING</Text>
          </TouchableOpacity>
        )}

        {/* Borrower return button */}
        {isRenter && rental.status === 'ACTIVE' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.forest || '#2A7B4C' }]}
            onPress={() => setReturnModalVisible(true)}
            activeOpacity={0.88}
          >
            <Ionicons name="return-down-back" size={16} color={colors.white} />
            <Text style={styles.actionBtnText}>INITIATE RETURN & ENTER TRACKING</Text>
          </TouchableOpacity>
        )}

        {/* Lender inspect & release deposit */}
        {isLender && rental.status === 'RETURNED' && !isDepositReleased && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.forest || '#2A7B4C' }]}
            onPress={handleReleaseDeposit}
            disabled={actionLoading}
            activeOpacity={0.88}
          >
            {actionLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={16} color={colors.white} />
                <Text style={styles.actionBtnText}>INSPECT & RELEASE DEPOSIT (₹299)</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Bidirectional Review Button */}
        {rental.status === 'RETURNED' && !reviewSubmitted && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.reviewActionBtn]}
            onPress={() => setReviewModalVisible(true)}
            activeOpacity={0.88}
          >
            <Ionicons name="star" size={16} color={colors.crimson} />
            <Text style={[styles.actionBtnText, { color: colors.crimson }]}>
              RATE & REVIEW {isRenter ? 'LENDER' : 'BORROWER'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* DISPATCH MODAL (Lender) */}
      <Modal
        visible={dispatchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDispatchModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setDispatchModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalPre}>OUTBOUND SHIPMENT</Text>
                <Text style={styles.modalTitle}>DISPATCH GARMENT</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setDispatchModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>COURIER / CARRIER NAME</Text>
            <View style={styles.carrierChipsRow}>
              {['BlueDart', 'Delhivery', 'DTDC', 'India Post'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.carrierChip, carrier === c && styles.carrierChipActive]}
                  onPress={() => setCarrier(c)}
                >
                  <Text style={[styles.carrierChipText, carrier === c && styles.carrierChipTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>TRACKING NUMBER / AWB</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. BD7839210IN"
              placeholderTextColor={colors.textMuted}
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={[styles.modalSubmitBtn, actionLoading && { opacity: 0.6 }]}
              onPress={handleDispatch}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.modalSubmitBtnText}>CONFIRM DISPATCH</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* RETURN MODAL (Borrower) */}
      <Modal
        visible={returnModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReturnModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setReturnModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalPre}>RETURN SHIPMENT</Text>
                <Text style={styles.modalTitle}>CONFIRM GARMENT RETURN</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setReturnModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>RETURN COURIER</Text>
            <View style={styles.carrierChipsRow}>
              {['Delhivery', 'BlueDart', 'DTDC', 'Doorstep Pickup'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.carrierChip, returnCarrier === c && styles.carrierChipActive]}
                  onPress={() => setReturnCarrier(c)}
                >
                  <Text style={[styles.carrierChipText, returnCarrier === c && styles.carrierChipTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>RETURN AWB (OPTIONAL)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. DELH9821034"
              placeholderTextColor={colors.textMuted}
              value={returnTracking}
              onChangeText={setReturnTracking}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: colors.forest || '#2A7B4C' }]}
              onPress={handleReturn}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.modalSubmitBtnText}>MARK AS RETURNED</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* REVIEW MODAL */}
      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setReviewModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalPre}>PEER EXPERIENCE</Text>
                <Text style={styles.modalTitle}>RATE RENTAL PARTNER</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setReviewModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Stars */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => {
                    hapticFeedback.selection();
                    setRating(star);
                  }}
                  style={{ padding: 6 }}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= rating ? '#E5A93C' : colors.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>COMMENTS / FEEDBACK</Text>
            <TextInput
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Garment cleanliness, accuracy, packaging, communication…"
              placeholderTextColor={colors.textMuted}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
            />

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleSubmitReview}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.modalSubmitBtnText}>SUBMIT REVIEW</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: {
    marginTop: 12,
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 16,
    letterSpacing: 1.5,
  },
  errorSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: 'BebasNeue_400Regular',
    letterSpacing: 1.5,
  },
  headerSub: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: typography.mono,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  content: { padding: 16, paddingBottom: 120 },

  // Status Banner
  statusBanner: {
    backgroundColor: 'rgba(229, 169, 60, 0.1)',
    borderWidth: 1.5,
    borderColor: '#E5A93C',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  statusBannerActive: {
    backgroundColor: 'rgba(155, 27, 48, 0.08)',
    borderColor: colors.crimson,
  },
  statusBannerReturned: {
    backgroundColor: 'rgba(42, 123, 76, 0.08)',
    borderColor: colors.forest || '#2A7B4C',
  },
  statusBannerOverdue: {
    backgroundColor: 'rgba(217, 4, 41, 0.12)',
    borderColor: '#D90429',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.crimson,
  },
  statusTitle: {
    fontSize: 12,
    fontFamily: typography.mono,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  statusDesc: {
    fontSize: 11.5,
    color: colors.textSecond,
    lineHeight: 16,
    marginTop: 2,
  },

  // Card Structure
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  cardSectionLabel: {
    fontSize: 9.5,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 12,
  },

  // Garment Row
  garmentRow: { flexDirection: 'row', gap: 12 },
  garmentThumb: {
    width: 76,
    height: 98,
    borderRadius: 8,
    backgroundColor: colors.bg,
  },
  garmentInfo: { flex: 1, justifyContent: 'center' },
  brandText: {
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: '700',
    color: colors.crimson,
    letterSpacing: 1,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
    lineHeight: 18,
  },
  tagRow: { flexDirection: 'row', gap: 6, marginVertical: 6 },
  tag: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 8.5,
    fontFamily: typography.mono,
    fontWeight: '700',
    color: colors.textSecond,
  },
  garmentRate: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  rateUnit: {
    fontSize: 10,
    fontWeight: '400',
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  counterpartyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counterpartyRoleLabel: {
    fontSize: 8.5,
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontWeight: '700',
  },
  counterpartyName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 1,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.crimson,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  chatButtonText: {
    fontSize: 9.5,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.crimson,
    letterSpacing: 0.5,
  },

  // Timeline
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  timelineEndpoint: { flex: 1, alignItems: 'center' },
  timelineCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.crimson,
    marginBottom: 6,
  },
  timelineDateLabel: {
    fontSize: 8,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  timelineDateValue: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
    textAlign: 'center',
  },
  timelineBarContainer: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
    marginHorizontal: 8,
  },
  timelineBar: {
    width: '100%',
    height: 2,
    backgroundColor: colors.border,
    position: 'absolute',
    top: 5,
  },
  timelineDurationBadge: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 16,
  },
  timelineDurationText: {
    fontSize: 8.5,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.crimson,
  },

  // Tracking
  trackingSection: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  trackingTitle: {
    fontSize: 9.5,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  trackingDetailsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    padding: 10,
    borderRadius: 8,
  },
  trackingDetailRow: {},
  trackingDetailLabel: {
    fontSize: 8,
    fontFamily: typography.mono,
    color: colors.textMuted,
  },
  trackingDetailValue: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 1,
  },
  noTrackingText: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },

  // Address
  addressBox: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  addressRecipient: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  addressLine: {
    fontSize: 11.5,
    color: colors.textSecond,
    lineHeight: 16,
  },
  addressCity: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },

  // Escrow Header & Pills
  escrowHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  escrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(155, 27, 48, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  escrowPillReleased: {
    backgroundColor: 'rgba(42, 123, 76, 0.1)',
  },
  escrowPillHeld: {
    backgroundColor: 'rgba(155, 27, 48, 0.08)',
  },
  escrowPillText: {
    fontSize: 8.5,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.crimson,
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: typography.mono,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalLabel: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.crimson,
  },

  // Legal Disclaimer
  legalDisclaimerBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  legalDisclaimerText: {
    flex: 1,
    fontSize: 9.5,
    color: colors.textMuted,
    lineHeight: 14,
  },

  // Floating Footer CTA
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.crimson,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  reviewActionBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.crimson,
  },
  primaryCta: {
    backgroundColor: colors.crimson,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryCtaText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontWeight: '800',
    fontSize: 11,
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalPre: {
    fontSize: 8.5,
    fontFamily: typography.mono,
    color: colors.crimson,
    letterSpacing: 1,
    fontWeight: '800',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
  },
  closeBtn: { padding: 4 },
  inputLabel: {
    fontSize: 9,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  carrierChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  carrierChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  carrierChipActive: {
    borderColor: colors.crimson,
    backgroundColor: 'rgba(155, 27, 48, 0.08)',
  },
  carrierChipText: {
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: '700',
    color: colors.textSecond,
  },
  carrierChipTextActive: {
    color: colors.crimson,
    fontWeight: '900',
  },
  textInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 13,
  },
  modalSubmitBtn: {
    backgroundColor: colors.crimson,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
  },
  modalSubmitBtnText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 12,
  },
});
