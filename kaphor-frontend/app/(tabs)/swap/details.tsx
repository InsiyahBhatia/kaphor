import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Modal,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SolarIcon } from '../../../src/components/common/SolarIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, textStyles } from '../../../src/theme';
import { swapService } from '../../../src/services/swapService';
import { messageService } from '../../../src/services/messageService';
import api from '../../../src/services/api';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { VerifiedBadge } from '../../../src/components/common/VerifiedBadge';
import { EstTradeValueBadge } from '../../../src/components/orders/EstTradeValueBadge';
import { FairValueMatcher } from '../../../src/components/orders/FairValueMatcher';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { useAuth } from '../../../src/context/AuthContext';
import { useAuthStore } from '../../../src/store/authStore';
import type { SwapTransaction } from '../../../src/types/swap';
import { Spinner, Loader } from '../../../src/components/common/Loader';
import { getErrorMessage } from '../../../src/utils/errors';

const { width } = Dimensions.get('window');

const TIMELINE_STEPS = [
  { key: 'REQUESTED', label: 'REQUESTED' },
  { key: 'ACCEPTED', label: 'ACCEPTED' },
  { key: 'AGREEMENT_SIGNED', label: 'AGREEMENT' },
  { key: 'SHIPPED', label: 'Deposit & ship' },
  { key: 'COMPLETED', label: 'COMPLETED' },
];

export default function SwapDetailsScreen() {
  const params = useLocalSearchParams();
  const swapId = (params.swapId || params.id) as string;
  const router = useRouter();

  useBackHandler('/(tabs)/circular');

  const { user } = useAuth();
  const authStoreUserId = useAuthStore((s) => s.user?.id);
  const [currentUserId, setCurrentUserId] = useState<string | null>(user?.id || authStoreUserId || null);
  const effectiveUserId = currentUserId || user?.id || authStoreUserId;

  const [swap, setSwap] = useState<SwapTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [confirmingReceived, setConfirmingReceived] = useState(false);

  const handleConfirmReceived = async () => {
    if (!swapId) return;
    Alert.alert(
      'Confirm Delivery',
      'Are you sure you have received the item in satisfactory condition? Once confirmed by both parties, garment ownership is transferred and your ₹500 security deposit is released.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Yes, confirm',
          onPress: async () => {
            setConfirmingReceived(true);
            try {
              const res = await swapService.confirmReceived(swapId, true);
              if (res?.status === 'COMPLETED') {
                Alert.alert('Swap Completed', 'Both packages arrived! Deposits are refunded and the items are now yours.');
              } else {
                Alert.alert('Receipt Confirmed!', 'We recorded your delivery confirmation. When your partner also confirms receipt, the swap will finalize automatically.');
              }
              await loadData();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message || 'Failed to confirm receipt');
            } finally {
              setConfirmingReceived(false);
            }
          },
        },
      ]
    );
  };

  const handleSubmitReview = async () => {
    if (!swapId) return;
    setSubmittingReview(true);
    try {
      await swapService.submitSwapReview(swapId, reviewRating, reviewComment.trim() || undefined);
      Alert.alert('Review Submitted!', 'Thank you for building trust in the circular community.');
      await loadData();
    } catch (e: any) {
      Alert.alert('Review Error', e?.response?.data?.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!swapId) return;
    try {
      setLoading(true);
      const [swapData, meRes] = await Promise.all([
        swapService.getSwapById(swapId),
        api.get('/users/me').catch(() => ({ data: { data: null } })),
      ]);
      setSwap(swapData);
      const uid = meRes.data.data?.id || user?.id || authStoreUserId || null;
      if (uid) {
        setCurrentUserId(uid);
      }
    } catch (err: any) {
      console.error('Failed to load swap details:', err);
      Alert.alert('Error', 'Unable to load swap request details.', [
        { text: 'Go back', onPress: () => safeBack('/(tabs)/circular') },
      ]);
    } finally {
      setLoading(false);
    }
  }, [swapId, router]);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading || !swap) {
    return <Loader variant="swap" />;
  }

  const isInitiator = effectiveUserId ? effectiveUserId === swap.initiatorId : true;
  const isReceiver = effectiveUserId ? effectiveUserId === swap.receiverId : false;
  const partner = isInitiator ? (swap as any).receiver : (swap as any).initiator;

  // Safely resolve offered & wanted garments whether populated as objects or IDs or aliases
  const offeredGarmentObj =
    (typeof swap.garmentOffered === 'object' && swap.garmentOffered) ||
    (typeof (swap as any).offeredGarment === 'object' && (swap as any).offeredGarment) ||
    null;

  const wantedGarmentObj =
    (typeof swap.garmentWanted === 'object' && swap.garmentWanted) ||
    (typeof (swap as any).wantedGarment === 'object' && (swap as any).wantedGarment) ||
    null;

  // Items perspective:
  // Initiator gives offered, receives wanted
  // Receiver gives wanted, receives offered
  const itemYouGive = isInitiator ? offeredGarmentObj : wantedGarmentObj;
  const itemYouReceive = isInitiator ? wantedGarmentObj : offeredGarmentObj;

  const getGarmentImageUri = (item: any): string => {
    if (!item) return '';
    if (typeof item === 'string' && (item.startsWith('http') || item.startsWith('data:') || item.startsWith('file:'))) {
      return item;
    }
    return (
      item.primaryImage ||
      item.image ||
      item.images?.[0] ||
      item.imageUrl ||
      (Array.isArray(item.images) && item.images[0]) ||
      ''
    );
  };

  const getDisplayGarmentValue = (item: any): string => {
    if (!item) return 'Est. ₹750';
    const rawVal = item.price || item.estimatedValue || item.rentalPriceDay;
    if (rawVal != null && !isNaN(rawVal) && rawVal > 0) {
      return `EST. ₹${Math.round(rawVal).toLocaleString('en-IN')}`;
    }
    return 'Est. ₹750 (swap)';
  };

  // Direct Message Handler
  const handleMessagePartner = async () => {
    if (!partner?.id) {
      Alert.alert('Notice', 'Partner profile information is currently unavailable.');
      return;
    }
    setActionLoading(true);
    try {
      const garmentContextId = (wantedGarmentObj as any)?.id || (offeredGarmentObj as any)?.id;
      const conversation = await messageService.getOrCreateConversation(
        partner.id,
        garmentContextId
      );
      router.push(`/messages/${conversation.id}?swapId=${swap.id}` as any);
    } catch (err: any) {
      console.error('Message partner error:', err);
      Alert.alert('Message Error', 'Could not open conversation with swap partner.');
    } finally {
      setActionLoading(false);
    }
  };

  // Accept / Reject Actions
  const handleRespond = (accept: boolean) => {
    Alert.alert(
      accept ? 'Accept Swap Offer?' : 'Decline Swap Offer?',
      accept
        ? 'Next, both people sign the agreement and pay the deposit.'
        : 'Are you sure you want to decline this trade offer?',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: accept ? 'ACCEPT' : 'DECLINE',
          style: accept ? 'default' : 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await swapService.respondToSwap(swap.id, accept ? 'ACCEPTED' : 'REJECTED');
              if (accept) {
                Alert.alert(
                  'Swap Accepted!',
                  'Next step: Review and sign the digital swap agreement.',
                  [
                    {
                      text: 'Sign agreement now',
                      onPress: () => router.push(`/(tabs)/swap/agreement?swapId=${swap.id}` as any),
                    },
                    { text: 'LATER', onPress: () => loadData() },
                  ]
                );
              } else {
                Alert.alert('Declined', 'The swap request was declined.');
                loadData();
              }
            } catch (err: any) {
              Alert.alert('Error', getErrorMessage(err, 'Failed to update swap.'));
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Cancel Request Action (Initiator)
  const handleCancel = () => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel this swap request?', [
      { text: 'NO', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await api.post(`/swaps/${swap.id}/cancel`);
            Alert.alert('Cancelled', 'Your swap request has been cancelled.');
            loadData();
          } catch (err: any) {
            Alert.alert('Error', getErrorMessage(err, 'Failed to cancel swap.'));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  // Stepper logic
  const getStepStatus = (stepKey: string) => {
    const s = swap.status as string;
    const order = ['REQUESTED', 'ACCEPTED', 'AGREEMENT_SIGNED', 'SHIPPED', 'COMPLETED'];
    let currentIndex = 0;
    if (s === 'ACCEPTED' || s === 'AGREEMENT_PENDING') currentIndex = 1;
    else if (s === 'AGREEMENT_SIGNED' || s === 'ADDRESS_SHARED') currentIndex = 2;
    else if (s === 'SHIPPED' || s === 'BOTH_SHIPPED' || s === 'DELIVERED') currentIndex = 3;
    else if (s === 'COMPLETED') currentIndex = 4;

    const targetIndex = order.indexOf(stepKey);
    if (targetIndex < currentIndex) return 'completed';
    if (targetIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Navigation Bar */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back"
          style={styles.backBtn}
          onPress={() => safeBack('/(tabs)/circular')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <SolarIcon name="arrow-back" size={20} color={colors.charcoal} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerPre}>Exchange details</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            REF #{swap.id.slice(0, 8).toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Chat"
          style={styles.chatHeaderBtn}
          onPress={handleMessagePartner}
          disabled={actionLoading}
        >
          <SolarIcon name="chatbubbles" size={18} color={colors.cream} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
      >
        {/* Partner Card & Chat CTA */}
        <View style={styles.partnerCard}>
          <View style={styles.partnerInfoRow}>
            <View style={styles.avatarWrap}>
              <KaphorImage
                uri={partner?.avatar || ''}
                style={styles.avatar}
                contentFit="cover"
              />
            </View>
            <View style={styles.partnerMeta}>
              <View style={styles.partnerNameRow}>
                <Text style={styles.partnerDisplayName} numberOfLines={1}>
                  {partner?.displayName || partner?.username || 'Swap Partner'}
                </Text>
                <VerifiedBadge size="compact" showLabel={false} />
              </View>
              <Text style={styles.partnerRole}>
                {isInitiator ? 'RECEIVER' : 'SENDER'}
              </Text>
              {partner?.username && (
                <Text style={styles.partnerHandle}>@{partner.username}</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.directChatBtn}
            onPress={handleMessagePartner}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            {actionLoading ? (
              <Spinner size="small" color={colors.cream} />
            ) : (
              <>
                <SolarIcon name="chatbubbles-outline" size={16} color={colors.cream} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.directChatBtnText}>
                  MESSAGE {partner?.displayName?.toUpperCase() || 'PARTNER'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Status Badge & Lifecycle Stepper */}
        <View style={styles.timelineCard}>
          <View style={styles.statusRow}>
            <Text style={styles.sectionLabel}>Transaction status</Text>
            <View style={[styles.statusTag, getStatusTagStyle(swap.status)]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.statusTagText}>{swap.status}</Text>
            </View>
          </View>

          {/* Stepper */}
          <View style={styles.stepperContainer}>
            {TIMELINE_STEPS.map((step, idx) => {
              const status = getStepStatus(step.key);
              return (
                <View key={step.key} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      status === 'completed' && styles.stepCircleCompleted,
                      status === 'active' && styles.stepCircleActive,
                    ]}
                  >
                    {status === 'completed' ? (
                      <SolarIcon name="checkmark" size={10} color={colors.cream} />
                    ) : (
                      <Text
                        style={[
                          styles.stepNumber,
                          status === 'active' && styles.stepNumberActive,
                        ]}
                      >
                        {idx + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      status === 'active' && styles.stepLabelActive,
                      status === 'completed' && styles.stepLabelCompleted,
                    ]}
                    numberOfLines={2}
                  >
                    {step.label}
                  </Text>
                  {idx < TIMELINE_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.stepLine,
                        (status === 'completed' || status === 'active') && styles.stepLineActive,
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Garment Exchange Comparison Dossier */}
        <Text style={styles.sectionHeading}>Exchange list</Text>
        <View style={styles.manifestGrid}>
          {/* YOU GIVE CARD */}
          <View style={styles.garmentCard}>
            <View style={styles.cardBadgeGive}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.cardBadgeText}>You give</Text>
            </View>
            <TouchableOpacity
              style={styles.garmentImgWrap}
              activeOpacity={0.9}
              onPress={() => {
                const uri = getGarmentImageUri(itemYouGive);
                if (uri) setSelectedPhoto(uri);
              }}
            >
              <KaphorImage
                uri={getGarmentImageUri(itemYouGive)}
                style={styles.garmentImg}
                contentFit="cover"
              />
              <View style={styles.zoomPillSmall}>
                <SolarIcon name="scan-outline" size={11} color={colors.white} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.zoomPillSmallText}>Zoom</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.garmentCardBody}
              activeOpacity={0.7}
              onPress={() => {
                if ((itemYouGive as any)?.id) {
                  router.push(`/(tabs)/shop/${(itemYouGive as any).id}` as any);
                }
              }}
            >
              <Text style={styles.garmentBrand} numberOfLines={1}>
                {(itemYouGive as any)?.brand || 'BRAND'}
              </Text>
              <Text style={styles.garmentTitle} numberOfLines={2}>
                {(itemYouGive as any)?.title || 'Offered Item'}
              </Text>
              <View style={styles.garmentMetaRow}>
                <Text style={styles.garmentSize}>
                  SIZE: {(itemYouGive as any)?.size || 'M'}
                </Text>
                {(itemYouGive as any)?.condition && (
                  <Text style={styles.garmentCondition}>
                    {(itemYouGive as any).condition}
                  </Text>
                )}
              </View>
              <EstTradeValueBadge
                value={(itemYouGive as any)?.price || (itemYouGive as any)?.estimatedValue}
                size="sm"
                variant="dark"
                style={{ marginTop: 4 }}
              />
            </TouchableOpacity>
          </View>

          {/* Center Swap Icon */}
          <View style={styles.exchangeDivider}>
            <View style={styles.exchangeIconCircle}>
              <SolarIcon name="repeat" size={18} color={colors.cream} />
            </View>
          </View>

          {/* YOU RECEIVE CARD */}
          <View style={styles.garmentCard}>
            <View style={styles.cardBadgeReceive}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.cardBadgeText}>You receive</Text>
            </View>
            <TouchableOpacity
              style={styles.garmentImgWrap}
              activeOpacity={0.9}
              onPress={() => {
                const uri = getGarmentImageUri(itemYouReceive);
                if (uri) setSelectedPhoto(uri);
              }}
            >
              <KaphorImage
                uri={getGarmentImageUri(itemYouReceive)}
                style={styles.garmentImg}
                contentFit="cover"
              />
              <View style={styles.zoomPillSmall}>
                <SolarIcon name="scan-outline" size={11} color={colors.white} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.zoomPillSmallText}>Zoom</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.garmentCardBody}
              activeOpacity={0.7}
              onPress={() => {
                if ((itemYouReceive as any)?.id) {
                  router.push(`/(tabs)/shop/${(itemYouReceive as any).id}` as any);
                }
              }}
            >
              <Text style={styles.garmentBrand} numberOfLines={1}>
                {(itemYouReceive as any)?.brand || 'BRAND'}
              </Text>
              <Text style={styles.garmentTitle} numberOfLines={2}>
                {(itemYouReceive as any)?.title || 'Wanted Item'}
              </Text>
              <View style={styles.garmentMetaRow}>
                <Text style={styles.garmentSize}>
                  SIZE: {(itemYouReceive as any)?.size || 'M'}
                </Text>
                {(itemYouReceive as any)?.condition && (
                  <Text style={styles.garmentCondition}>
                    {(itemYouReceive as any).condition}
                  </Text>
                )}
              </View>
              <EstTradeValueBadge
                value={(itemYouReceive as any)?.price || (itemYouReceive as any)?.estimatedValue}
                size="sm"
                variant="copper"
                style={{ marginTop: 4 }}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* FAIR VALUE MATCHER SECTION */}
        <FairValueMatcher
          myGarment={itemYouGive as any}
          theirGarment={itemYouReceive as any}
          myValuation={(itemYouGive as any)?.price || (itemYouGive as any)?.estimatedValue}
          theirValuation={(itemYouReceive as any)?.price || (itemYouReceive as any)?.estimatedValue}
          compact={false}
          style={{ marginTop: 12, marginBottom: 4 }}
        />

        {/* DISCUSS VALUATION CHAT CTA */}
        <TouchableOpacity
          style={styles.chatPartnerBanner}
          onPress={handleMessagePartner}
          disabled={actionLoading}
          activeOpacity={0.8}
        >
          <View style={styles.chatPartnerBannerLeft}>
            <View style={styles.chatIconWrap}>
              <SolarIcon name="chatbubbles" size={16} color={colors.cream} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatPartnerBannerTitle}>
                DISCUSS WITH @{(partner?.username || partner?.displayName || 'PARTNER').toUpperCase()}
              </Text>
              <Text style={styles.chatPartnerBannerSubtitle}>
                Chat about trade balance, garment condition, or logistics →
              </Text>
            </View>
          </View>
          <SolarIcon name="chevron-forward" size={18} color={colors.charcoal} />
        </TouchableOpacity>

        {/* Proposal Note */}
        {swap.message && (
          <View style={styles.messageBox}>
            <View style={styles.messageHeaderRow}>
              <SolarIcon name="chatbox-ellipses-outline" size={14} color={colors.charcoal} />
              <Text style={styles.messageLabel}>Proposal memo</Text>
            </View>
            <Text style={styles.messageText}>"{swap.message}"</Text>
          </View>
        )}

        {/* Condition Photos Gallery */}
        {(() => {
          const conditionPhotoList: string[] = Array.isArray(swap.conditionPhotos)
            ? (swap.conditionPhotos as any as string[])
            : swap.conditionPhotos
            ? [...(((swap.conditionPhotos as any).offeredPhotos) || []), ...(((swap.conditionPhotos as any).wantedPhotos) || [])]
            : [];

          if (conditionPhotoList.length === 0) return null;

          return (
            <View style={styles.evidenceSection}>
              <View style={styles.evidenceHeader}>
                <SolarIcon name="shield-checkmark-outline" size={14} color={colors.charcoal} />
                <Text style={styles.sectionLabel}>Condition evidence photos</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                {conditionPhotoList.map((photoUri: string, index: number) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.evidencePhotoWrap}
                    onPress={() => setSelectedPhoto(photoUri)}
                    activeOpacity={0.8}
                  >
                    <KaphorImage uri={photoUri} style={styles.evidencePhoto} contentFit="cover" />
                    <View style={styles.photoIndexBadge}>
                      <Text style={styles.photoIndexText}>#{index + 1}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          );
        })()}

        {/* Escrow & Security Deposit Summary */}
        <View style={styles.escrowNoticeCard}>
          <View style={styles.escrowNoticeHeader}>
            <SolarIcon name="lock-closed" size={16} color={colors.goldDark} />
            <Text style={styles.escrowNoticeTitle}>Security payment protection</Text>
          </View>
          <Text style={styles.escrowNoticeBody}>
            Kaphor holds a refundable ₹500 security deposit from each swapper. Deposits are
            fully refunded once both parties check condition and confirm receipt.
          </Text>
        </View>

        {/* Completed Swap Review Card */}
        {swap.status === 'COMPLETED' && (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <SolarIcon name="star" size={18} color={colors.gold} />
              <Text style={styles.reviewCardTitle}>Swap partner reputation</Text>
            </View>

            {(swap as any).reviews?.[effectiveUserId || ''] ? (
              <View style={styles.reviewSubmittedBox}>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <SolarIcon
                      key={s}
                      name="star"
                      size={18}
                      color={s <= (swap as any).reviews[effectiveUserId || ''].rating ? colors.gold : colors.bgMuted}
                    />
                  ))}
                </View>
                <Text style={styles.reviewSubmittedLabel}>Your review submitted</Text>
                {(swap as any).reviews[effectiveUserId || ''].comment ? (
                  <Text style={styles.reviewCommentText}>
                    "{(swap as any).reviews[effectiveUserId || ''].comment}"
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.reviewForm}>
                <Text style={styles.reviewInstruction}>
                  Rate your exchange experience with {partner?.displayName || 'partner'} to help calibrate circular community trust.
                </Text>
                <View style={styles.interactiveStarsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`Rate ${star} stars`}
                      key={star}
                      onPress={() => setReviewRating(star)}
                      style={{ padding: 4 }}
                    >
                      <SolarIcon
                        name={star <= reviewRating ? 'star' : 'star-outline'}
                        size={28}
                        color={colors.gold}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput accessibilityLabel="Review comment"
                  placeholder="Share details on packaging, condition accuracy, or communication..."
                  placeholderTextColor={colors.textMuted}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  style={styles.reviewInput}
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity
                  style={styles.submitReviewBtn}
                  onPress={handleSubmitReview}
                  disabled={submittingReview}
                  activeOpacity={0.8}
                >
                  {submittingReview ? (
                    <Spinner size="small" color={colors.cream} />
                  ) : (
                    <>
                      <SolarIcon name="checkmark-circle" size={16} color={colors.cream} />
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.submitReviewBtnText}>Submit review</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Dock */}
      <View style={styles.actionDock}>
        {/* State 1: Incoming & REQUESTED */}
        {swap.status === 'REQUESTED' && isReceiver && (
          <View style={styles.dockButtonRow}>
            <TouchableOpacity
              style={[styles.dockBtn, styles.secondaryBtn, { flex: 1 }]}
              onPress={handleMessagePartner}
              disabled={actionLoading}
            >
              <SolarIcon name="chatbubbles-outline" size={15} color={colors.charcoal} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.secondaryBtnText}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dockBtn, styles.declineBtn, { flex: 1 }]}
              onPress={() => handleRespond(false)}
              disabled={actionLoading}
            >
              <SolarIcon name="close" size={15} color={colors.red} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dockBtn, styles.acceptBtn, { flex: 1.5 }]}
              onPress={() => handleRespond(true)}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Spinner size="small" color={colors.cream} />
              ) : (
                <>
                  <SolarIcon name="checkmark" size={15} color={colors.cream} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.acceptBtnText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* State 2: Outgoing & REQUESTED */}
        {swap.status === 'REQUESTED' && isInitiator && (
          <View style={styles.dockButtonRow}>
            <TouchableOpacity
              style={[styles.dockBtn, styles.cancelBtn]}
              onPress={handleCancel}
              disabled={actionLoading}
            >
              <SolarIcon name="close-circle-outline" size={16} color={colors.textMuted} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.cancelBtnText}>Cancel request</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dockBtn, styles.primaryBtn]}
              onPress={handleMessagePartner}
              disabled={actionLoading}
            >
              <SolarIcon name="chatbubbles" size={16} color={colors.cream} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.primaryBtnText}>Message owner</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* State 3: ACCEPTED / AGREEMENT_PENDING */}
        {((swap.status as string) === 'ACCEPTED' || swap.status === 'AGREEMENT_PENDING') && (
          <View style={styles.dockButtonRow}>
            <TouchableOpacity
              style={[styles.dockBtn, styles.secondaryBtn]}
              onPress={handleMessagePartner}
            >
              <SolarIcon name="chatbubbles-outline" size={16} color={colors.charcoal} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.secondaryBtnText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dockBtn, styles.primaryBtn, { flex: 2 }]}
              onPress={() => router.push(`/(tabs)/swap/agreement?swapId=${swap.id}` as any)}
            >
              <SolarIcon name="document-text-outline" size={16} color={colors.cream} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.primaryBtnText}>Review & sign agreement</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* State 4: AGREEMENT_SIGNED / ADDRESS_SHARED / ESCROW */}
        {(swap.status === 'AGREEMENT_SIGNED' || swap.status === 'ADDRESS_SHARED') && (
          <View style={styles.dockButtonRow}>
            <TouchableOpacity
              style={[styles.dockBtn, styles.secondaryBtn]}
              onPress={() => router.push(`/(tabs)/swap/agreement?swapId=${swap.id}` as any)}
            >
              <SolarIcon name="document-text" size={14} color={colors.charcoal} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.secondaryBtnText}>Agreement</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dockBtn, styles.goldBtn, { flex: 2 }]}
              onPress={() => router.push(`/(tabs)/swap/shipping?swapId=${swap.id}` as any)}
            >
              <SolarIcon name="cube-outline" size={16} color={colors.cream} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.goldBtnText}>Pay deposit & ship</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* State 5: SHIPPED / BOTH_SHIPPED / DELIVERED */}
        {(swap.status === 'SHIPPED' || swap.status === 'BOTH_SHIPPED' || swap.status === 'DELIVERED') && (
          <View style={styles.dockButtonRow}>
            <TouchableOpacity
              style={[styles.dockBtn, styles.secondaryBtn]}
              onPress={() => router.push(`/(tabs)/swap/shipping?swapId=${swap.id}` as any)}
            >
              <SolarIcon name="cube-outline" size={14} color={colors.charcoal} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.secondaryBtnText}>Tracking</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dockBtn, styles.forestBtn, { flex: 2 }]}
              onPress={handleConfirmReceived}
              disabled={confirmingReceived}
              activeOpacity={0.85}
            >
              {confirmingReceived ? (
                <Spinner color={colors.cream} size="small" />
              ) : (
                <>
                  <SolarIcon name="checkmark-done-circle" size={16} color={colors.cream} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.forestBtnText}>Confirm package received</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* State 6: COMPLETED */}
        {swap.status === 'COMPLETED' && (
          <View style={styles.completedNotice}>
            <SolarIcon name="checkmark-circle" size={18} color={colors.forest} />
            <Text style={styles.completedNoticeText}>Swap complete & deposits released</Text>
          </View>
        )}
      </View>

      {/* Photo Pinch & Zoom Lightbox Modal */}
      <Modal 
        visible={!!selectedPhoto} 
        transparent 
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" 
            style={[styles.modalCloseBtn, { top: Math.max(insets.top + 10, 44) }]} 
            onPress={() => setSelectedPhoto(null)}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <SolarIcon name="close" size={28} color={colors.white} />
          </TouchableOpacity>

          <View style={[styles.zoomInstructionWrap, { top: Math.max(insets.top + 18, 52) }]}>
            <SolarIcon name="scan-outline" size={13} color={colors.paperGlass} />
            <Text style={styles.zoomInstructionText}>Pinch to zoom</Text>
          </View>

          {selectedPhoto && (
            <ScrollView
              style={{ flex: 1, width: '100%' }}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
              maximumZoomScale={5}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <KaphorImage
                uri={selectedPhoto}
                style={{ width: width, height: Dimensions.get('window').height * 0.8 }}
                contentFit="contain"
              />
            </ScrollView>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function getStatusTagStyle(status: string) {
  switch (status) {
    case 'ACCEPTED':
    case 'AGREEMENT_SIGNED':
      return { backgroundColor: colors.emeraldLight, borderColor: colors.forest };
    case 'SHIPPED':
    case 'BOTH_SHIPPED':
      return { backgroundColor: colors.goldLight, borderColor: colors.goldDark };
    case 'COMPLETED':
      return { backgroundColor: colors.emeraldLight, borderColor: colors.forest };
    case 'REJECTED':
    case 'CANCELLED':
      return { backgroundColor: colors.crimsonLight, borderColor: colors.red };
    default:
      return { backgroundColor: colors.bgMuted, borderColor: colors.charcoal };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 52,
    paddingBottom: spacing.sm,
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerPre: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textMuted, includeFontPadding: false, },
  headerTitle: {
    ...textStyles.screenTitle,
    color: colors.charcoal,
  },
  chatHeaderBtn: {
    width: 36,
    height: 36,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 180,
  },

  // Partner Card
  partnerCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  chatPartnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.paperLight,
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: spacing.md,
    gap: 10,
  },
  chatPartnerBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  chatIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatPartnerBannerTitle: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  chatPartnerBannerSubtitle: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 20, includeFontPadding: false, },
  partnerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarWrap: {
    width: 50,
    height: 50,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    overflow: 'hidden',
    backgroundColor: colors.bgMuted,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  partnerMeta: {
    marginLeft: spacing.md,
    flex: 1,
  },
  partnerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partnerDisplayName: {
    fontFamily: typography.headings,
    fontSize: 16,
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  partnerRole: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2, includeFontPadding: false, },
  partnerHandle: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textSecond,
    marginTop: 1, includeFontPadding: false, },
  directChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.charcoal,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    gap: 8,
  },
  directChatBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    color: colors.cream,
    letterSpacing: 0.2,
  },

  // Timeline & Stepper
  timelineCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.textMuted, includeFontPadding: false, },
  statusTag: {
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 2,
  },
  statusTagText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
    paddingTop: 4,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
    paddingHorizontal: 2,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepCircleActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  stepCircleCompleted: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  stepNumber: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.textMuted,
  },
  stepNumberActive: {
    color: colors.cream,
    fontWeight: '800',
  },
  stepLabel: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center', includeFontPadding: false, },
  stepLabelActive: {
    color: colors.charcoal,
    fontWeight: '800',
  },
  stepLabelCompleted: {
    color: colors.forest,
    fontWeight: '700',
  },
  stepLine: {
    position: 'absolute',
    top: 13,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: colors.bgMuted,
    zIndex: -1,
  },
  stepLineActive: {
    backgroundColor: colors.forest,
  },

  // Manifest
  sectionHeading: {
    fontFamily: typography.bodyBold,
    fontSize: 14,
    color: colors.charcoal,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  manifestGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: 8,
  },
  garmentCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardBadgeGive: {
    backgroundColor: colors.charcoal,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadgeReceive: {
    backgroundColor: colors.goldDark,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadgeText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.cream, includeFontPadding: false, },
  garmentImgWrap: {
    width: '100%',
    height: 140,
    backgroundColor: colors.bgMuted,
    position: 'relative',
  },
  garmentImg: {
    width: '100%',
    height: '100%',
  },
  garmentCardBody: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  garmentBrand: {
    fontFamily: typography.handSemi,
    fontSize: 13,
    color: colors.textMuted, includeFontPadding: false, },
  garmentTitle: {
    fontFamily: typography.bodyBold,
    fontSize: 13,
    color: colors.charcoal,
    marginVertical: 4,
    lineHeight: 18,
    minHeight: 36,
  },
  garmentMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    marginBottom: 6,
  },
  garmentSize: {
    fontFamily: typography.handSemi,
    fontSize: 13,
    color: colors.textSecond, includeFontPadding: false, },
  garmentCondition: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.forest, includeFontPadding: false, },
  garmentValue: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.charcoal,
    marginTop: 4,
  },
  exchangeDivider: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  exchangeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Proposal Memo
  messageBox: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  messageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  messageLabel: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.textMuted, includeFontPadding: false, },
  messageText: {
    fontFamily: typography.accent,
    fontSize: 14,
    color: colors.charcoal,
    lineHeight: 20,
  },

  // Evidence Photos
  evidenceSection: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  evidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  photosScroll: {
    flexDirection: 'row',
  },
  evidencePhotoWrap: {
    width: 78,
    height: 78,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: 8,
    position: 'relative',
    backgroundColor: colors.bgMuted,
  },
  evidencePhoto: {
    width: '100%',
    height: '100%',
  },
  photoIndexBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: colors.overlay,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  photoIndexText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.cream,
  },

  // Escrow Notice
  escrowNoticeCard: {
    backgroundColor: colors.paperLight,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  escrowNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  escrowNoticeTitle: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.goldDark, includeFontPadding: false, },
  escrowNoticeBody: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textSecond,
    lineHeight: 23,
    marginTop: 4, includeFontPadding: false, },

  // Action Dock
  actionDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1.5,
    borderTopColor: colors.charcoal,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  dockButtonRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dockBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 46,
    gap: 6,
  },
  acceptBtn: {
    backgroundColor: colors.forest,
  },
  acceptBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    color: colors.cream,
    letterSpacing: 0.2,
  },
  declineBtn: {
    borderWidth: 1.5,
    borderColor: colors.red,
    backgroundColor: colors.white,
  },
  declineBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    color: colors.red,
    letterSpacing: 0.2,
  },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  cancelBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  primaryBtn: {
    backgroundColor: colors.charcoal,
  },
  primaryBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    color: colors.cream,
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  secondaryBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.charcoal,
    letterSpacing: 0.2,
  },
  goldBtn: {
    backgroundColor: colors.goldDark,
  },
  goldBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.cream,
    letterSpacing: 0.2,
  },
  forestBtn: {
    backgroundColor: colors.forest,
  },
  forestBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.cream,
    letterSpacing: 0.2,
  },
  completedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  completedNoticeText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.forest, includeFontPadding: false, },

  // Review Card
  reviewCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: spacing.md,
    marginTop: 8,
    marginBottom: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reviewCardTitle: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  reviewSubmittedBox: {
    backgroundColor: colors.paperLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  reviewSubmittedLabel: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.goldDark, includeFontPadding: false, },
  reviewCommentText: {
    fontFamily: typography.accent,
    fontSize: 13,
    color: colors.charcoal,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  reviewForm: {
    marginTop: 4,
  },
  reviewInstruction: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textSecond,
    lineHeight: 22,
    marginBottom: 8, includeFontPadding: false, },
  interactiveStarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 8,
  },
  reviewInput: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.charcoal,
    textAlignVertical: 'top',
    minHeight: 64,
    marginBottom: 10,
  },
  submitReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.charcoal,
    paddingVertical: 12,
    minHeight: 46,
  },
  submitReviewBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.cream,
    letterSpacing: 0.2,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 100,
    backgroundColor: colors.overlayLight,
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomInstructionWrap: {
    position: 'absolute',
    left: 24,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.overlay,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  zoomInstructionText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: typography.handBold, includeFontPadding: false, },
  zoomPillSmall: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.overlay,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  zoomPillSmallText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: typography.handBold, includeFontPadding: false, },
  modalImage: {
    width: width * 0.9,
    height: width * 1.2,
  },
});
