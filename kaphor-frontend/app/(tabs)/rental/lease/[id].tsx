import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SolarIcon } from '../../../../src/components/common/SolarIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rentalService } from '../../../../src/services/rentalService';
import { messageService } from '../../../../src/services/messageService';
import { colors, typography, textStyles } from '../../../../src/theme';
import { KaphorImage, getCategoryFallbackImage } from '../../../../src/components/KaphorImage';
import { safeBack, useBackHandler } from '../../../../src/utils/navigation';
import { hapticFeedback } from '../../../../src/utils/haptics';
import { useAuthStore } from '../../../../src/store/authStore';

import { invalidateCache } from '../../../../src/services/api';
import { Loader, Spinner } from '../../../../src/components/common/Loader';
import { getErrorMessage } from '../../../../src/utils/errors';
import {
  formatShortDate,
  formatFullDate,
  formatWeekdayDate,
  formatWeekdayFullDate,
  formatDateTime,
  getDaysBetween,
  getDaysRemaining,
  formatCurrency,
} from '../../../../src/utils/dateFormatter';

export default function RentalLeaseDossierScreen() {
  const insets = useSafeAreaInsets();
  const searchParams = useLocalSearchParams<{ id?: string; rentalId?: string; orderId?: string; rentalOrderId?: string }>();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const id = String(searchParams.id || searchParams.rentalOrderId || searchParams.rentalId || searchParams.orderId || '').trim();

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

  // Decline Modal (Lender)
  const [declineModalVisible, setDeclineModalVisible] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Review Modal
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useBackHandler('/(tabs)/rental');

  const loadData = useCallback(async () => {
    const cleanId = (!id || id === 'undefined' || id === 'null') ? '' : id;
    try {
      setLoading(true);
      let data: any = null;

      if (cleanId) {
        try {
          data = await rentalService.getRentalById(cleanId);
        } catch (idErr) {
          console.warn('Direct rental lookup failed, attempting fallback to my rentals', idErr);
        }
      }

      if (!data) {
        const myRentals = await rentalService.getMyRentals('all').catch(() => []);
        if (Array.isArray(myRentals) && myRentals.length > 0) {
          data = myRentals[0];
        }
      }

      if (data) {
        setRental(data);

        if (data?.metadata?.reviews && currentUserId && data.metadata.reviews[currentUserId]) {
          setReviewSubmitted(true);
          setRating(data.metadata.reviews[currentUserId].rating || 5);
          if (data.metadata.reviews[currentUserId].comment) {
            setReviewComment(data.metadata.reviews[currentUserId].comment);
          }
        }

        try {
          const targetId = data.id || cleanId;
          const escrowData = await rentalService.getEscrow(targetId);
          setEscrow(escrowData);
        } catch (escrowErr) {
          console.warn('Escrow details unavailable for rental:', escrowErr);
        }
      }
    } catch (err: any) {
      console.error('Failed to load rental lease:', err);
    } finally {
      setLoading(false);
    }
  }, [id, currentUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if ((searchParams as any)?.review === 'true') {
      setReviewModalVisible(true);
    }
  }, [searchParams]);

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

  // Lender approves rental request
  const handleApprove = async () => {
    setActionLoading(true);
    hapticFeedback.medium();
    try {
      await rentalService.approveRental(id as string);
      invalidateCache('/rentals');
      invalidateCache('/users/me/wardrobe');
      Alert.alert(
        'Rental Request Approved',
        'You have approved the rental dates! The borrower has been notified and granted 24 hours to pay. Your money is held safely until delivery.'
      );
      await loadData();
    } catch (err: any) {
      Alert.alert('Approval Error', getErrorMessage(err, 'Failed to approve rental request.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Lender declines rental request
  const handleDecline = async () => {
    setActionLoading(true);
    hapticFeedback.medium();
    try {
      await rentalService.declineRental(id as string, declineReason.trim() || undefined);
      invalidateCache('/rentals');
      invalidateCache('/users/me/wardrobe');
      setDeclineModalVisible(false);
      setDeclineReason('');
      Alert.alert('Request Declined', 'You have declined this rental request.');
      await loadData();
    } catch (err: any) {
      Alert.alert('Decline Error', getErrorMessage(err, 'Failed to decline rental request.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Borrower proceeds to payment once approved
  const handleProceedToPayment = () => {
    const totalDays = getDaysBetween(rental.startDate, rental.endDate);
    router.push({
      pathname: '/(tabs)/rental/payment',
      params: {
        rentalOrderId: id as string,
        garmentId: rental.garmentId,
        days: String(totalDays),
        dayRate: String(rental.garment?.rentalPriceDay || 149),
      },
    } as any);
  };

  // Borrower marks garment as delivered/received
  const handleConfirmDelivery = async () => {
    Alert.alert(
      'Confirm Garment Received',
      'Did you get the piece and check it? Your rental starts now.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Received',
          onPress: async () => {
            setActionLoading(true);
            hapticFeedback.medium();
            try {
              await rentalService.confirmDelivery(id as string);
              invalidateCache('/rentals');
              invalidateCache('/users/me/wardrobe');
              Alert.alert('Delivery Confirmed', 'Enjoy your rental piece! Return instructions are available anytime on this screen.');
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', getErrorMessage(err, 'Failed to confirm delivery.'));
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // Lender marks return package as received
  const handleConfirmReturnDelivery = async () => {
    Alert.alert(
      'Confirm Return Received',
      'Have you received the returned package from the borrower? Your 48-hour inspection period begins now.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Return Received',
          onPress: async () => {
            setActionLoading(true);
            hapticFeedback.medium();
            try {
              await rentalService.confirmReturnDelivery(id as string);
              invalidateCache('/rentals');
              invalidateCache('/users/me/wardrobe');
              Alert.alert('Return Received', 'Inspection period active. Please inspect the garment and release the ₹299 deposit.');
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', getErrorMessage(err, 'Failed to confirm return receipt.'));
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // Direct courier tracking link helpers
  const handleTrackOutbound = () => {
    const url = rentalService.getCarrierTrackingUrl(rental?.carrier, rental?.trackingNumber);
    if (url) {
      Linking.openURL(url).catch(() => Alert.alert('Could Not Open', 'Unable to open courier tracking URL.'));
    }
  };

  const handleTrackReturn = () => {
    const url = rentalService.getCarrierTrackingUrl(rental?.returnCarrier, rental?.returnTracking);
    if (url) {
      Linking.openURL(url).catch(() => Alert.alert('Could Not Open', 'Unable to open courier tracking URL.'));
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
      invalidateCache('/rentals');
      invalidateCache('/users/me/wardrobe');
      setDispatchModalVisible(false);
      Alert.alert('Garment Shipped', 'Your shipment is marked as sent. The borrower can now see the tracking details.');
      await loadData();
    } catch (err: any) {
      Alert.alert('Shipping Error', getErrorMessage(err, 'Could not update shipping. Please try again.'));
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
      invalidateCache('/rentals');
      invalidateCache('/users/me/wardrobe');
      setReturnModalVisible(false);
      Alert.alert('Return Confirmed', 'The lender has been notified. Your security deposit will be released upon inspection.');
      await loadData();
    } catch (err: any) {
      Alert.alert('Return Error', getErrorMessage(err, 'Failed to submit return.'));
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
              invalidateCache('/rentals');
              invalidateCache('/users/me/wardrobe');
              Alert.alert('Deposit Released', '₹299 security deposit has been refunded to the borrower.');
              await loadData();
            } catch (err: any) {
              Alert.alert('Release Error', getErrorMessage(err, 'Failed to release deposit.'));
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
      await loadData();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || '';
      if (status === 409 || msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
        setReviewModalVisible(false);
        setReviewSubmitted(true);
        Alert.alert('Review Saved', 'Your review has been recorded for this transaction.');
        await loadData();
      } else {
        Alert.alert('Review Error', msg || 'Failed to submit review.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <Loader variant="rental" />;
  }

  if (!rental) {
    return (
      <View style={[styles.container, styles.center]}>
        <SolarIcon name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={styles.errorTitle}>Rental not found</Text>
        <Text style={styles.errorSubtitle}>This rental order could not be located or access is restricted.</Text>
        <TouchableOpacity style={styles.primaryCta} onPress={() => safeBack('/(tabs)/rental')}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.primaryCtaText}>Back to rentals</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const garment = rental.garment || {};
  const seller = garment.seller || {};
  const renter = rental.renter || {};
  const counterparty = isRenter ? seller : renter;
  const counterpartyRole = isRenter ? 'Lender / owner' : 'Borrower / renter';

  const daysTotal = getDaysBetween(rental.startDate, rental.endDate);
  const daysLeft = getDaysRemaining(rental.endDate);

  const isDepositReleased = rental.status === 'RETURNED' && (escrow?.status === 'RELEASED');

  // Breakdown figures
  const meta = rental.metadata || {};
  const rentalFee = meta.rentalFee ?? rental.totalPrice ?? 0;
  const refundableDeposit = meta.refundableDeposit ?? 299;
  const damageInsurance = meta.damageInsurance ?? 49;
  const deliveryReturnFee = meta.deliveryReturnFee ?? 199;
  const totalAmount = meta.grandTotal ?? (rentalFee + refundableDeposit + damageInsurance + deliveryReturnFee);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back"
          onPress={() => safeBack('/(tabs)/rental')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <SolarIcon name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Rental lease details</Text>
          <Text style={styles.headerSub}>ID: {rental.id.slice(0, 8).toUpperCase()}</Text>
        </View>
        <TouchableOpacity
          onPress={handleChat}
          disabled={startingChat}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {startingChat ? (
            <Spinner size="small" color={colors.crimson} />
          ) : (
            <SolarIcon name="chatbubble-ellipses-outline" size={24} color={colors.textPrimary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Visual 7-Step Progress Stepper */}
        <View style={styles.stepperContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepperScroll}>
            {[
              { key: 'REQUEST', label: '1. REQUEST', icon: 'document-text-outline', done: true },
              { key: 'APPROVE', label: '2. APPROVAL', icon: 'checkmark-circle-outline', done: rental.status !== 'REQUESTED' && rental.status !== 'DECLINED' },
              { key: 'PAY', label: '3. PAY', icon: 'card-outline', done: ['RESERVED', 'DISPATCHED', 'ACTIVE', 'RETURN_DISPATCHED', 'RETURNED', 'COMPLETED'].includes(rental.status) },
              { key: 'DISPATCH', label: '4. SHIPPING', icon: 'airplane-outline', done: ['DISPATCHED', 'ACTIVE', 'RETURN_DISPATCHED', 'RETURNED', 'COMPLETED'].includes(rental.status) },
              { key: 'ACTIVE', label: '5. WEAR', icon: 'sparkles-outline', done: ['ACTIVE', 'RETURN_DISPATCHED', 'RETURNED', 'COMPLETED'].includes(rental.status) },
              { key: 'RETURN', label: '6. RETURN', icon: 'repeat-outline', done: ['RETURN_DISPATCHED', 'RETURNED', 'COMPLETED'].includes(rental.status) },
              { key: 'REFUND', label: '7. REFUND', icon: 'shield-checkmark-outline', done: rental.status === 'COMPLETED' },
            ].map((step, idx) => {
              const isCurrent =
                (rental.status === 'REQUESTED' && step.key === 'APPROVE') ||
                (rental.status === 'APPROVED' && step.key === 'PAY') ||
                (rental.status === 'RESERVED' && step.key === 'DISPATCH') ||
                (rental.status === 'DISPATCHED' && step.key === 'ACTIVE') ||
                (rental.status === 'ACTIVE' && step.key === 'ACTIVE') ||
                (rental.status === 'RETURN_DISPATCHED' && step.key === 'RETURN') ||
                (rental.status === 'RETURNED' && step.key === 'REFUND') ||
                (rental.status === 'COMPLETED' && step.key === 'REFUND');

              return (
                <View key={step.key} style={styles.stepperItem}>
                  <View style={[
                    styles.stepperBadge,
                    step.done && styles.stepperBadgeDone,
                    isCurrent && styles.stepperBadgeCurrent,
                  ]}>
                    <SolarIcon
                      name={step.icon as any}
                      size={12}
                      color={step.done || isCurrent ? colors.white : colors.textMuted}
                    />
                  </View>
                  <Text style={[
                    styles.stepperItemText,
                    step.done && styles.stepperItemTextDone,
                    isCurrent && styles.stepperItemTextCurrent,
                  ]}>
                    {step.label}
                  </Text>
                  {idx < 6 && <View style={[styles.stepperLine, step.done && styles.stepperLineDone]} />}
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Status Banner */}
        <View style={[
          styles.statusBanner,
          rental.status === 'REQUESTED' && styles.statusBannerRequested,
          rental.status === 'APPROVED' && styles.statusBannerApproved,
          rental.status === 'DECLINED' && styles.statusBannerDeclined,
          rental.status === 'RESERVED' && styles.statusBannerReserved,
          rental.status === 'DISPATCHED' && styles.statusBannerDispatched,
          rental.status === 'ACTIVE' && styles.statusBannerActive,
          rental.status === 'RETURN_DISPATCHED' && styles.statusBannerReturnDispatched,
          rental.status === 'RETURNED' && styles.statusBannerReturned,
          rental.status === 'COMPLETED' && styles.statusBannerCompleted,
          rental.status === 'OVERDUE' && styles.statusBannerOverdue,
        ]}>
          <View style={styles.statusRow}>
            <View style={[
              styles.statusBadgeDot,
              (rental.status === 'APPROVED' || rental.status === 'ACTIVE' || rental.status === 'COMPLETED') && { backgroundColor: colors.forest || colors.forest },
              (rental.status === 'REQUESTED' || rental.status === 'RESERVED') && { backgroundColor: colors.gold || colors.gold },
              (rental.status === 'DECLINED' || rental.status === 'OVERDUE') && { backgroundColor: colors.red || colors.rose },
            ]} />
            <Text style={styles.statusTitle}>
              {rental.status === 'REQUESTED' && (isLender ? 'ACTION REQUIRED • NEW RENTAL REQUEST' : 'REQUEST SENT • PENDING LENDER APPROVAL')}
              {rental.status === 'APPROVED' && (isLender ? 'REQUEST APPROVED • AWAITING PAYMENT' : 'Request approved! Proceed to payment')}
              {rental.status === 'DECLINED' && 'Rental request declined'}
              {rental.status === 'RESERVED' && (isLender ? 'PAID • READY TO SHIP' : 'PAID • HELD SAFELY')}
              {rental.status === 'DISPATCHED' && (isLender ? 'Outbound shipment in transit' : 'SHIPPED • ON THE WAY')}
              {rental.status === 'ACTIVE' && `ACTIVE LEASE • ${daysLeft > 0 ? `${daysLeft} ${daysLeft === 1 ? 'DAY' : 'DAYS'} LEFT` : 'Due today'}`}
              {rental.status === 'RETURN_DISPATCHED' && (isLender ? 'Return shipment in transit' : 'RETURN SHIPPED • ON THE WAY')}
              {rental.status === 'RETURNED' && (isDepositReleased ? 'Returned & deposit refunded' : 'RETURN RECEIVED • 48H INSPECTION WINDOW')}
              {rental.status === 'COMPLETED' && 'LEASE COMPLETED • DEPOSIT REFUNDED'}
              {rental.status === 'OVERDUE' && 'Return overdue'}
            </Text>
          </View>
          <Text style={styles.statusDesc}>
            {rental.status === 'REQUESTED' && isLender && 'Please review the requested dates and approve or decline the lease request.'}
            {rental.status === 'REQUESTED' && isRenter && 'The garment owner will review your dates within 24 hours. No payment is taken until approved.'}
            {rental.status === 'APPROVED' && isLender && 'You approved this lease. The borrower has 24 hours to secure their reservation by completing payment.'}
            {rental.status === 'APPROVED' && isRenter && 'The garment owner approved your request! Pay now to lock in your dates.'}
            {rental.status === 'DECLINED' && (rental.declineReason ? `Owner note: "${rental.declineReason}"` : 'This rental request could not be accommodated at this time.')}
            {rental.status === 'RESERVED' && isLender && 'Payment is held safely. Please pack and ship the garment, then add the tracking number below.'}
            {rental.status === 'RESERVED' && isRenter && 'Payment is held safely. The owner is getting your piece ready to ship.'}
            {rental.status === 'DISPATCHED' && isLender && `Shipped via ${rental.carrier || 'courier'} (${rental.trackingNumber || 'Tracking provided'}).`}
            {rental.status === 'DISPATCHED' && isRenter && `Shipped via ${rental.carrier || 'courier'} (${rental.trackingNumber || 'Tracking provided'}). Please tap "Confirm Received" upon delivery.`}
            {rental.status === 'ACTIVE' && isRenter && `Enjoy wearing! Please ship for return on or before ${formatShortDate(rental.endDate)}.`}
            {rental.status === 'ACTIVE' && isLender && `Garment is currently with the borrower. Scheduled return: ${formatShortDate(rental.endDate)}.`}
            {rental.status === 'RETURN_DISPATCHED' && isLender && `Sent back by borrower via ${rental.returnCarrier || 'courier'} (${rental.returnTracking || 'Tracking provided'}). Please confirm upon delivery.`}
            {rental.status === 'RETURN_DISPATCHED' && isRenter && `Return package in transit via ${rental.returnCarrier || 'courier'}. Security deposit will be refunded after owner inspection.`}
            {rental.status === 'RETURNED' && isLender && !isDepositReleased && 'Please check the garment is clean and undamaged to release the ₹299 deposit.'}
            {rental.status === 'RETURNED' && isDepositReleased && 'All lease obligations fulfilled. Security deposit has been successfully released.'}
            {rental.status === 'COMPLETED' && 'All lease obligations fulfilled. Security deposit has been successfully refunded.'}
            {rental.status === 'OVERDUE' && 'The agreed rental duration has expired. Please contact support or the lender immediately.'}
          </Text>
        </View>

        {/* ── Prominent Lender Approval Card ── */}
        {isLender && rental.status === 'REQUESTED' && (
          <View style={styles.actionPromptCard}>
            <View style={styles.actionPromptTop}>
              <View style={styles.actionPromptIconBadge}>
                <SolarIcon name="time" size={18} color={colors.terracottaDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionPromptTitle}>Action required: approve rental dates</Text>
                <Text style={styles.actionPromptSub}>
                  {rental.renter?.displayName || 'Borrower'} requested this piece for {daysTotal} days ({formatShortDate(rental.startDate)} – {formatShortDate(rental.endDate)}). Approve to open the 24-hour escrow payment window.
                </Text>
              </View>
            </View>
            <View style={styles.actionPromptBtnRow}>
              <TouchableOpacity
                style={[styles.actionPromptBtn, styles.actionPromptDecline]}
                onPress={() => setDeclineModalVisible(true)}
              >
                <Text style={styles.actionPromptDeclineText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionPromptBtn, styles.actionPromptAccept]}
                onPress={handleApprove}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Spinner color={colors.white} size="small" />
                ) : (
                  <>
                    <SolarIcon name="checkmark-circle" size={15} color={colors.white} />
                    <Text style={styles.actionPromptAcceptText}>Accept & approve dates</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Prominent Borrower Payment Action Card when Approved ── */}
        {isRenter && rental.status === 'APPROVED' && !rental.paidAt && (
          <View style={[styles.actionPromptCard, { borderColor: colors.forest, backgroundColor: colors.emeraldLight }]}>
            <View style={styles.actionPromptTop}>
              <View style={[styles.actionPromptIconBadge, { backgroundColor: colors.emeraldLight }]}>
                <SolarIcon name="checkmark-circle" size={18} color={colors.forest} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionPromptTitle, { color: colors.forest }]}>
                  Dates approved! Time to pay
                </Text>
                <Text style={styles.actionPromptSub}>
                  The owner has approved your reservation! Please pay within 24 hours to keep your dates.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.actionPromptBtn, styles.actionPromptPay]}
              onPress={handleProceedToPayment}
            >
              <SolarIcon name="card" size={15} color={colors.white} />
              <Text style={styles.actionPromptAcceptText}>PROCEED TO PAYMENT (₹{formatCurrency(totalAmount)}) →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Completed Review Card (If already reviewed) ── */}
        {Boolean(reviewSubmitted || (currentUserId && rental?.metadata?.reviews?.[currentUserId])) && (
          <View style={styles.rentalReviewCard}>
            <View style={styles.rentalReviewHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <SolarIcon name="star" size={16} color={colors.orange} />
                <Text style={styles.rentalReviewTitle}>Your rental review</Text>
              </View>
              <View style={styles.rentalReviewBadge}>
                <Text style={styles.rentalReviewScore}>
                  {(currentUserId && rental?.metadata?.reviews?.[currentUserId]?.rating) || rating}.0 ★
                </Text>
              </View>
            </View>
            {Boolean((currentUserId && rental?.metadata?.reviews?.[currentUserId]?.comment) || reviewComment) && (
              <Text style={styles.rentalReviewComment}>
                "{(currentUserId && rental?.metadata?.reviews?.[currentUserId]?.comment) || reviewComment}"
              </Text>
            )}
            <View style={styles.rentalReviewFooter}>
              <SolarIcon name="shield-checkmark" size={12} color={colors.forest} />
              <Text style={styles.rentalReviewMeta}>Verified Circular Lease Review · Saved</Text>
            </View>
          </View>
        )}

        {/* Garment Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionLabel}>Rental item</Text>
          <View style={styles.garmentRow}>
            <KaphorImage
              uri={Array.isArray(garment.images) && garment.images.length > 0 ? garment.images[0] : null}
              style={styles.garmentThumb}
              contentFit="cover"
            />
            <View style={styles.garmentInfo}>
              <Text style={styles.brandText}>{garment.brand || 'DESIGNER'}</Text>
              <Text style={styles.titleText} numberOfLines={2}>{garment.title}</Text>
              <View style={styles.tagRow}>
                <View style={styles.tag}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.tagText}>{garment.category || 'COUTURE'}</Text>
                </View>
                <View style={[styles.tag, { borderColor: colors.forest || colors.forest }]}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tagText, { color: colors.forest || colors.forest }]}>
                    {garment.condition || 'PRISTINE'}
                  </Text>
                </View>
              </View>
              <Text style={styles.garmentRate}>
                ₹{formatCurrency(garment.rentalPriceDay)} <Text style={styles.rateUnit}>/ day</Text>
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
              <SolarIcon name="chatbubble-outline" size={14} color={colors.crimson} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.chatButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Schedule & Duration Timeline Card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionLabel}>Lease timeline</Text>
          <View style={styles.timelineContainer}>
            <View style={styles.timelineEndpoint}>
              <View style={styles.timelineCircle} />
              <Text style={styles.timelineDateLabel}>Delivery / start</Text>
              <Text style={styles.timelineDateValue}>
                {formatWeekdayFullDate(rental.startDate)}
              </Text>
            </View>

            <View style={styles.timelineBarContainer}>
              <View style={styles.timelineBar} />
              <View style={styles.timelineDurationBadge}>
                <Text style={styles.timelineDurationText}>{daysTotal} DAYS LEASE</Text>
              </View>
            </View>

            <View style={styles.timelineEndpoint}>
              <View style={[styles.timelineCircle, { backgroundColor: colors.forest || colors.forest }]} />
              <Text style={styles.timelineDateLabel}>Return due</Text>
              <Text style={styles.timelineDateValue}>
                {formatWeekdayFullDate(rental.endDate)}
              </Text>
            </View>
          </View>
        </View>

        {/* Logistics & Tracking Card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionLabel}>Logistics & shipment tracking</Text>

          {/* Outbound Tracking */}
          <View style={styles.trackingSection}>
            <View style={styles.trackingHeader}>
              <SolarIcon name="airplane-outline" size={15} color={colors.crimson} />
              <Text style={styles.trackingTitle}>Outbound to borrower</Text>
            </View>
            {rental.trackingNumber ? (
              <View style={styles.trackingDetailsBox}>
                <View style={styles.trackingDetailRow}>
                  <Text style={styles.trackingDetailLabel}>Carrier</Text>
                  <Text style={styles.trackingDetailValue}>{rental.carrier || 'BlueDart'}</Text>
                </View>
                <View style={styles.trackingDetailRow}>
                  <Text style={styles.trackingDetailLabel}>Tracking AWB</Text>
                  <Text style={[styles.trackingDetailValue, { fontFamily: typography.mono }]}>
                    {rental.trackingNumber}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.trackOnlineBtn}
                  onPress={handleTrackOutbound}
                  activeOpacity={0.8}
                >
                  <SolarIcon name="open-outline" size={13} color={colors.crimson} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.trackOnlineBtnText}>TRACK ON {rental.carrier ? rental.carrier.toUpperCase() : 'COURIER'} WEBSITE</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.noTrackingText}>
                {isLender
                  ? (rental.status === 'REQUESTED' || rental.status === 'APPROVED'
                      ? 'Shipment details will unlock once the request is approved and paid.'
                      : 'Tap "Ship Garment" below when you are ready.')
                  : 'The owner will add the tracking number once shipped.'}
              </Text>
            )}
          </View>

          {/* Inbound / Return Tracking */}
          {(['ACTIVE', 'RETURN_DISPATCHED', 'RETURNED', 'COMPLETED'].includes(rental.status) || Boolean(rental.returnTracking)) && (
            <View style={[styles.trackingSection, { marginTop: 14 }]}>
              <View style={styles.trackingHeader}>
                <SolarIcon name="repeat-outline" size={15} color={colors.forest || colors.forest} />
                <Text style={styles.trackingTitle}>Return to lender</Text>
              </View>
              {rental.returnTracking ? (
                <View style={styles.trackingDetailsBox}>
                  <View style={styles.trackingDetailRow}>
                    <Text style={styles.trackingDetailLabel}>Return courier</Text>
                    <Text style={styles.trackingDetailValue}>{rental.returnCarrier || 'Delhivery'}</Text>
                  </View>
                  <View style={styles.trackingDetailRow}>
                    <Text style={styles.trackingDetailLabel}>Return AWB</Text>
                    <Text style={[styles.trackingDetailValue, { fontFamily: typography.mono }]}>
                      {rental.returnTracking}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.trackOnlineBtn, { borderColor: colors.forest || colors.forest }]}
                    onPress={handleTrackReturn}
                    activeOpacity={0.8}
                  >
                    <SolarIcon name="open-outline" size={13} color={colors.forest || colors.forest} />
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.trackOnlineBtnText, { color: colors.forest || colors.forest }]}>
                      TRACK RETURN ON {rental.returnCarrier ? rental.returnCarrier.toUpperCase() : 'COURIER'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.noTrackingText}>
                  {isRenter
                    ? 'Use the prepaid return bag. Tap "Start Return" below once scheduled.'
                    : 'Return shipping will show up once the borrower ships it.'}
                </Text>
              )}
            </View>
          )}

          {/* Activity Log / Milestones */}
          {Array.isArray(rental.trackingHistory) && rental.trackingHistory.length > 0 && (
            <View style={styles.historyContainer}>
              <Text style={styles.historyLabel}>Activity & audit log</Text>
              {rental.trackingHistory.map((item: any, idx: number) => (
                <View key={idx} style={styles.historyRow}>
                  <View style={styles.historyDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyNote}>{item.note || item.status}</Text>
                    <Text style={styles.historyTime}>
                      {item.timestamp ? formatDateTime(item.timestamp) : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Shipping Destination Card */}
        {rental.shippingAddress && (
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>Delivery address</Text>
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
            <Text style={styles.cardSectionLabel}>Payment breakdown</Text>
            <View style={[
              styles.escrowPill,
              isDepositReleased ? styles.escrowPillReleased : styles.escrowPillHeld
            ]}>
              <SolarIcon
                name={isDepositReleased ? 'checkmark-circle' : 'shield-checkmark'}
                size={12}
                color={isDepositReleased ? (colors.forest || colors.forest) : colors.crimson}
              />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[
                styles.escrowPillText,
                isDepositReleased && { color: colors.forest || colors.forest }
              ]}>
                {isDepositReleased ? 'Deposit refunded' : 'Deposit secured'}
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>RENTAL FEE ({daysTotal} DAYS)</Text>
            <Text style={styles.summaryValue}>₹{formatCurrency(rentalFee)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.summaryLabel}>Refundable security deposit</Text>
              <SolarIcon name="lock-closed" size={11} color={colors.forest || colors.forest} />
            </View>
            <Text style={[styles.summaryValue, { color: colors.forest || colors.forest }]}>
              ₹{formatCurrency(refundableDeposit)} {isDepositReleased ? '(Refunded)' : '(Held safely)'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Damage waiver & hygienic steam</Text>
            <Text style={styles.summaryValue}>₹{formatCurrency(damageInsurance)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Two-way insured courier</Text>
            <Text style={styles.summaryValue}>₹{formatCurrency(deliveryReturnFee)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total lease amount</Text>
            <Text style={styles.totalValue}>₹{formatCurrency(totalAmount)}</Text>
          </View>
        </View>

        {/* Legal Disclaimer */}
        <View style={styles.legalDisclaimerBox}>
          <SolarIcon name="shield-checkmark" size={13} color={colors.textMuted} />
          <Text style={styles.legalDisclaimerText}>
            Rental Agreement: Kaphor operates exclusively as an intermediary under Section 79 of the Information Technology Act, 2000. All transactions and wear liabilities are governed by user agreement between lender and borrower.
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
        {/* Lender Approve / Decline buttons */}
        {isLender && rental.status === 'REQUESTED' && (
          <View style={styles.dualActionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.declineBtn]}
              onPress={() => setDeclineModalVisible(true)}
              activeOpacity={0.88}
            >
              <SolarIcon name="close-circle-outline" size={16} color={colors.red || colors.rose} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.actionBtnText, { color: colors.red || colors.rose }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={handleApprove}
              disabled={actionLoading}
              activeOpacity={0.88}
            >
              {actionLoading ? (
                <Spinner color={colors.white} />
              ) : (
                <>
                  <SolarIcon name="checkmark-circle" size={16} color={colors.white} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>Accept request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Borrower Proceed to Payment button */}
        {isRenter && rental.status === 'APPROVED' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.gold || colors.gold }]}
            onPress={handleProceedToPayment}
            activeOpacity={0.88}
          >
            <SolarIcon name="card" size={16} color={colors.white} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>PROCEED TO PAYMENT (₹{formatCurrency(totalAmount)})</Text>
          </TouchableOpacity>
        )}

        {/* Lender dispatch button */}
        {isLender && rental.status === 'RESERVED' && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setDispatchModalVisible(true)}
            activeOpacity={0.88}
          >
            <SolarIcon name="paper-plane" size={16} color={colors.white} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>Ship garment & enter tracking</Text>
          </TouchableOpacity>
        )}

        {/* Borrower confirm delivery button */}
        {isRenter && rental.status === 'DISPATCHED' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.forest || colors.forest }]}
            onPress={handleConfirmDelivery}
            disabled={actionLoading}
            activeOpacity={0.88}
          >
            {actionLoading ? (
              <Spinner color={colors.white} />
            ) : (
              <>
                <SolarIcon name="checkmark-done" size={16} color={colors.white} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>Confirm I received garment</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Borrower return button */}
        {isRenter && rental.status === 'ACTIVE' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.forest || colors.forest }]}
            onPress={() => setReturnModalVisible(true)}
            activeOpacity={0.88}
          >
            <SolarIcon name="return-down-back" size={16} color={colors.white} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>Start return & enter tracking</Text>
          </TouchableOpacity>
        )}

        {/* Lender confirm return delivery */}
        {isLender && rental.status === 'RETURN_DISPATCHED' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.forest || colors.forest }]}
            onPress={handleConfirmReturnDelivery}
            disabled={actionLoading}
            activeOpacity={0.88}
          >
            {actionLoading ? (
              <Spinner color={colors.white} />
            ) : (
              <>
                <SolarIcon name="checkbox-outline" size={16} color={colors.white} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>Confirm return received</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Lender inspect & release deposit */}
        {isLender && rental.status === 'RETURNED' && !isDepositReleased && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.forest || colors.forest }]}
            onPress={handleReleaseDeposit}
            disabled={actionLoading}
            activeOpacity={0.88}
          >
            {actionLoading ? (
              <Spinner color={colors.white} />
            ) : (
              <>
                <SolarIcon name="shield-checkmark" size={16} color={colors.white} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>Inspect & release deposit (₹299)</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Bidirectional Review Button */}
        {(rental.status === 'RETURNED' || rental.status === 'COMPLETED') && !reviewSubmitted && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.reviewActionBtn]}
            onPress={() => setReviewModalVisible(true)}
            activeOpacity={0.88}
          >
            <SolarIcon name="star" size={16} color={colors.crimson} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.actionBtnText, { color: colors.crimson }]}>
              RATE & REVIEW {isRenter ? 'LENDER' : 'BORROWER'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* DECLINE MODAL (Lender) */}
      <Modal
        visible={declineModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeclineModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setDeclineModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalPre}>Lender decision</Text>
                <Text style={styles.modalTitle}>Decline rental request</Text>
              </View>
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Close"
                style={styles.closeBtn}
                onPress={() => setDeclineModalVisible(false)}
              >
                <SolarIcon name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Reason for declining (optional)</Text>
            <TextInput accessibilityLabel="Reason for declining"
              style={[styles.textInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
              placeholder="e.g. Garment is undergoing professional cleaning, or dates unavailable."
              placeholderTextColor={colors.textMuted}
              value={declineReason}
              onChangeText={setDeclineReason}
              multiline
            />

            <View style={styles.dualActionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.declineBtn, { flex: 1 }]}
                onPress={() => setDeclineModalVisible(false)}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.actionBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, backgroundColor: colors.red || colors.rose }]}
                onPress={handleDecline}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Spinner color={colors.white} />
                ) : (
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>Confirm decline</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
                <Text style={styles.modalPre}>Outbound shipment</Text>
                <Text style={styles.modalTitle}>Ship garment</Text>
              </View>
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Close"
                style={styles.closeBtn}
                onPress={() => setDispatchModalVisible(false)}
              >
                <SolarIcon name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Courier / carrier name</Text>
            <View style={styles.carrierChipsRow}>
              {['BlueDart', 'Delhivery', 'DTDC', 'India Post'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.carrierChip, carrier === c && styles.carrierChipActive]}
                  onPress={() => setCarrier(c)}
                >
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.carrierChipText, carrier === c && styles.carrierChipTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Tracking number / AWB</Text>
            <TextInput accessibilityLabel="Tracking number"
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
                <Spinner color={colors.white} />
              ) : (
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.modalSubmitBtnText}>Confirm shipping</Text>
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
                <Text style={styles.modalPre}>Return shipment</Text>
                <Text style={styles.modalTitle}>Confirm garment return</Text>
              </View>
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Close"
                style={styles.closeBtn}
                onPress={() => setReturnModalVisible(false)}
              >
                <SolarIcon name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Return courier</Text>
            <View style={styles.carrierChipsRow}>
              {['Delhivery', 'BlueDart', 'DTDC', 'Doorstep Pickup'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.carrierChip, returnCarrier === c && styles.carrierChipActive]}
                  onPress={() => setReturnCarrier(c)}
                >
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.carrierChipText, returnCarrier === c && styles.carrierChipTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Return AWB (optional)</Text>
            <TextInput accessibilityLabel="Return tracking number"
              style={styles.textInput}
              placeholder="e.g. DELH9821034"
              placeholderTextColor={colors.textMuted}
              value={returnTracking}
              onChangeText={setReturnTracking}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: colors.forest || colors.forest }]}
              onPress={handleReturn}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Spinner color={colors.white} />
              ) : (
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.modalSubmitBtnText}>Mark as returned</Text>
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
                <Text style={styles.modalPre}>Peer experience</Text>
                <Text style={styles.modalTitle}>Rate rental partner</Text>
              </View>
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Close"
                style={styles.closeBtn}
                onPress={() => setReviewModalVisible(false)}
              >
                <SolarIcon name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Stars */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`Rate ${star} stars`}
                  key={star}
                  onPress={() => {
                    hapticFeedback.selection();
                    setRating(star);
                  }}
                  style={{ padding: 6 }}
                >
                  <SolarIcon
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= rating ? colors.gold : colors.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Comments / feedback</Text>
            <TextInput accessibilityLabel="Review comment"
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
                <Spinner color={colors.white} />
              ) : (
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.modalSubmitBtnText}>Submit review</Text>
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
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textMuted, includeFontPadding: false, },
  errorTitle: {
    fontSize: 16,
    fontFamily: typography.handBold,
    color: colors.textPrimary,
    marginTop: 16, includeFontPadding: false, },
  errorSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
      fontFamily: typography.body,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    ...textStyles.screenTitle,
    color: colors.textPrimary,
  },
  headerSub: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: typography.handwritten,
    marginTop: 1, includeFontPadding: false, },
  content: { padding: 16, paddingBottom: 120 },

  // Status Banner
  statusBanner: {
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  statusBannerActive: {
    backgroundColor: colors.crimsonLight,
    borderColor: colors.crimson,
  },
  statusBannerReturned: {
    backgroundColor: colors.emeraldLight,
    borderColor: colors.forest || colors.forest,
  },
  statusBannerOverdue: {
    backgroundColor: colors.crimsonLight,
    borderColor: colors.rose,
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
    fontSize: 13,
    fontFamily: typography.handBold,
    color: colors.textPrimary, includeFontPadding: false, },
  statusDesc: {
    fontSize: 11,
    color: colors.textSecond,
    lineHeight: 16,
    marginTop: 2,
      fontFamily: typography.body,
  },

  // Card Structure
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 14,
  },
  cardSectionLabel: {
    fontSize: 13,
    fontFamily: typography.handBold,
    color: colors.textMuted,
    marginBottom: 12, includeFontPadding: false, },

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
    fontSize: 13,
    fontFamily: typography.handSemi,
    color: colors.crimson, includeFontPadding: false, },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
    lineHeight: 18,
      fontFamily: typography.bodyBold,
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
    fontSize: 13,
    fontFamily: typography.handSemi,
    color: colors.textSecond, includeFontPadding: false, },
  garmentRate: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
      fontFamily: typography.bodyBold,
  },
  rateUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.textMuted,
      fontFamily: typography.body,
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
    fontSize: 13,
    fontFamily: typography.handSemi,
    color: colors.textMuted, includeFontPadding: false, },
  counterpartyName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 1,
      fontFamily: typography.bodyBold,
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
    fontSize: 11,
    fontFamily: typography.bodyBold,
    color: colors.crimson,
    letterSpacing: 0.2,
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
    fontSize: 13,
    fontFamily: typography.handBold,
    color: colors.textMuted, includeFontPadding: false, },
  timelineDateValue: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
    textAlign: 'center',
      fontFamily: typography.bodyBold,
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
    fontSize: 13,
    fontFamily: typography.handBold,
    color: colors.crimson, includeFontPadding: false, },

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
    fontSize: 13,
    fontFamily: typography.handBold,
    color: colors.textPrimary, includeFontPadding: false, },
  trackingDetailsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    padding: 10,
    borderRadius: 8,
  },
  trackingDetailRow: {},
  trackingDetailLabel: {
    fontSize: 13,
    fontFamily: typography.handwritten,
    color: colors.textMuted, includeFontPadding: false, },
  trackingDetailValue: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 1,
      fontFamily: typography.bodyBold,
  },
  noTrackingText: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
      fontFamily: typography.body,
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
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
      fontFamily: typography.bodyBold,
  },
  addressLine: {
    fontSize: 11,
    color: colors.textSecond,
    lineHeight: 16,
      fontFamily: typography.body,
  },
  addressCity: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
      fontFamily: typography.bodyMedium,
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
    backgroundColor: colors.crimsonLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  escrowPillReleased: {
    backgroundColor: colors.emeraldLight,
  },
  escrowPillHeld: {
    backgroundColor: colors.crimsonLight,
  },
  escrowPillText: {
    fontSize: 13,
    fontFamily: typography.handBold,
    color: colors.crimson, includeFontPadding: false, },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: typography.handwritten,
    color: colors.textMuted, includeFontPadding: false, },
  summaryValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
      fontFamily: typography.bodyBold,
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: typography.handBold,
    color: colors.textPrimary, includeFontPadding: false, },
  totalValue: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.crimson,
      fontFamily: typography.bodyBold,
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
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 14,
      fontFamily: typography.body,
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
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  reviewActionBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
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
    fontFamily: typography.bodyBold,
    fontSize: 11,
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalPre: {
    fontSize: 13,
    fontFamily: typography.handBold,
    color: colors.crimson, includeFontPadding: false, },
  modalTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
      fontFamily: typography.bodyBold,
  },
  closeBtn: { padding: 4 },
  inputLabel: {
    fontSize: 14,
    fontFamily: typography.handBold,
    color: colors.textMuted,
    marginBottom: 8, includeFontPadding: false, },
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
    backgroundColor: colors.crimsonLight,
  },
  carrierChipText: {
    fontSize: 13,
    fontFamily: typography.handSemi,
    color: colors.textSecond, includeFontPadding: false, },
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
      fontFamily: typography.body,
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
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 12,
  },

  // ── Stepper Styles ──
  stepperContainer: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  stepperScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  stepperItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  stepperBadgeDone: {
    backgroundColor: colors.forest || colors.forest,
  },
  stepperBadgeCurrent: {
    backgroundColor: colors.gold || colors.gold,
    borderWidth: 1,
    borderColor: colors.crimson,
  },
  stepperItemText: {
    fontSize: 13,
    fontFamily: typography.handSemi,
    color: colors.textMuted,
    marginRight: 8, includeFontPadding: false, },
  stepperItemTextDone: {
    color: colors.forest || colors.forest,
  },
  stepperItemTextCurrent: {
    color: colors.textPrimary,
    fontWeight: '900',
  },
  stepperLine: {
    width: 16,
    height: 2,
    backgroundColor: colors.border,
    marginRight: 8,
  },
  stepperLineDone: {
    backgroundColor: colors.forest || colors.forest,
  },

  // ── Status Banner Variants ──
  statusBannerRequested: {
    borderColor: colors.gold || colors.gold,
    backgroundColor: colors.overlayLight,
  },
  statusBannerApproved: {
    borderColor: colors.forest || colors.forest,
    backgroundColor: colors.emeraldLight,
  },
  statusBannerDeclined: {
    borderColor: colors.red || colors.rose,
    backgroundColor: colors.crimsonLight,
  },
  statusBannerReserved: {
    borderColor: colors.gold || colors.gold,
    backgroundColor: colors.overlayLight,
  },
  statusBannerDispatched: {
    borderColor: colors.crimson,
    backgroundColor: colors.crimsonLight,
  },
  statusBannerReturnDispatched: {
    borderColor: colors.forest || colors.forest,
    backgroundColor: colors.emeraldLight,
  },
  statusBannerCompleted: {
    borderColor: colors.forest || colors.forest,
    backgroundColor: colors.emeraldLight,
  },

  // ── Online Tracking Button ──
  trackOnlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.crimson,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  trackOnlineBtnText: {
    fontSize: 11,
    fontFamily: typography.bodyBold,
    color: colors.crimson,
    letterSpacing: 0.2,
  },

  // ── Activity History Log ──
  historyContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyLabel: {
    fontSize: 13,
    fontFamily: typography.handBold,
    color: colors.textMuted,
    marginBottom: 8, includeFontPadding: false, },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  historyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.crimson,
    marginTop: 5,
  },
  historyNote: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '600',
      fontFamily: typography.bodyMedium,
  },
  historyTime: {
    fontSize: 11,
    fontFamily: typography.bodyMedium,
    color: colors.textMuted,
    marginTop: 2,
  },

  // ── Dual Action Buttons ──
  dualActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  declineBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.red || colors.rose,
  },
  approveBtn: {
    flex: 2,
    backgroundColor: colors.gold || colors.gold,
  },

  // ── Action Prompt Cards (Lender Approval & Borrower Payment) ──
  actionPromptCard: {
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  actionPromptTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  actionPromptIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  actionPromptTitle: {
    fontSize: 13,
    fontFamily: typography.handBold,
    color: colors.terracottaDark,
    marginBottom: 3, includeFontPadding: false, },
  actionPromptSub: {
    fontSize: 11,
    color: colors.textSecond,
    lineHeight: 16,
      fontFamily: typography.body,
  },
  actionPromptBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  actionPromptDecline: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.red || colors.rose,
  },
  actionPromptDeclineText: {
    fontSize: 11,
    fontFamily: typography.bodyBold,
    color: colors.red || colors.rose,
    letterSpacing: 0.2,
  },
  actionPromptAccept: {
    flex: 2,
    backgroundColor: colors.crimson,
  },
  actionPromptAcceptText: {
    fontSize: 11,
    fontFamily: typography.bodyBold,
    color: colors.white,
    letterSpacing: 0.2,
  },
  actionPromptPay: {
    backgroundColor: colors.forest || colors.forest,
    width: '100%',
    marginTop: 4,
  },

  // ── Rental Review Card & Action Button ──
  rentalReviewCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  rentalReviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rentalReviewTitle: {
    fontSize: 13,
    fontFamily: typography.handBold,
    color: colors.textPrimary, includeFontPadding: false, },
  rentalReviewBadge: {
    backgroundColor: colors.goldLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rentalReviewScore: {
    fontSize: 11,
    fontFamily: typography.bodyBold,
    color: colors.terracottaDark,
  },
  rentalReviewComment: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textSecond,
    lineHeight: 18,
    marginBottom: 10,
      fontFamily: typography.body,
  },
  rentalReviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  rentalReviewMeta: {
    fontSize: 13,
    fontFamily: typography.handwritten,
    color: colors.textMuted, includeFontPadding: false, },
});
