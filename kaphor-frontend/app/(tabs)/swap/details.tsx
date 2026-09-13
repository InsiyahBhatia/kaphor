import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../../src/theme';
import { swapService } from '../../../src/services/swapService';
import { messageService } from '../../../src/services/messageService';
import api from '../../../src/services/api';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { VerifiedBadge } from '../../../src/components/common/VerifiedBadge';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { EstTradeValueBadge } from '../../../src/components/orders/EstTradeValueBadge';
import { FairValueMatcher } from '../../../src/components/orders/FairValueMatcher';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { useAuth } from '../../../src/context/AuthContext';
import { useAuthStore } from '../../../src/store/authStore';
import type { SwapTransaction } from '../../../src/types/swap';

const { width } = Dimensions.get('window');

const TIMELINE_STEPS = [
  { key: 'REQUESTED', label: 'REQUESTED' },
  { key: 'ACCEPTED', label: 'ACCEPTED' },
  { key: 'AGREEMENT_SIGNED', label: 'AGREEMENT' },
  { key: 'SHIPPED', label: 'ESCROW & SHIP' },
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
      'Confirm Package Delivery',
      'Are you sure you have received the item in satisfactory condition? Once confirmed by both parties, garment ownership is transferred and your ₹500 security deposit is released.',
      [
        { text: 'NOT YET', style: 'cancel' },
        {
          text: 'YES, CONFIRM',
          onPress: async () => {
            setConfirmingReceived(true);
            try {
              const res = await swapService.confirmReceived(swapId, true);
              if (res?.status === 'COMPLETED') {
                Alert.alert('🎉 Swap Completed!', 'Both packages confirmed! Escrow security deposits have been released and garment ownership transferred.');
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
        { text: 'GO BACK', onPress: () => safeBack('/(tabs)/circular') },
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
    return <DossierLoading variant="swap" />;
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
    if (!item) return 'EST. ₹750';
    const rawVal = item.price || item.estimatedValue || item.rentalPriceDay;
    if (rawVal != null && !isNaN(rawVal) && rawVal > 0) {
      return `EST. ₹${Math.round(rawVal).toLocaleString('en-IN')}`;
    }
    return 'EST. ₹750 (SWAP)';
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
      router.push(`/messages/${conversation.id}` as any);
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
        ? 'Both parties will proceed to digital contract verification and escrow deposit.'
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
                      text: 'SIGN AGREEMENT NOW',
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
              Alert.alert('Error', err?.response?.data?.message || 'Failed to update swap.');
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
        text: 'YES, CANCEL',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await api.post(`/swaps/${swap.id}/cancel`);
            Alert.alert('Cancelled', 'Your swap request has been cancelled.');
            loadData();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to cancel swap.');
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
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => safeBack('/(tabs)/circular')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.charcoal} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerPre}>EXCHANGE DOSSIER</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            REF #{swap.id.slice(0, 8).toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.chatHeaderBtn}
          onPress={handleMessagePartner}
          disabled={actionLoading}
        >
          <Ionicons name="chatbubbles" size={18} color={colors.cream} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
                {isInitiator ? 'RECIPROCATOR (RECEIVER)' : 'PROPOSER (INITIATOR)'}
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
              <ActivityIndicator size="small" color={colors.cream} />
            ) : (
              <>
                <Ionicons name="chatbubbles-outline" size={16} color={colors.cream} />
                <Text style={styles.directChatBtnText}>
                  MESSAGE {partner?.displayName?.toUpperCase() || 'PARTNER'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Status Badge & Lifecycle Stepper */}
        <View style={styles.timelineCard}>
          <View style={styles.statusRow}>
            <Text style={styles.sectionLabel}>TRANSACTION STATUS</Text>
            <View style={[styles.statusTag, getStatusTagStyle(swap.status)]}>
              <Text style={styles.statusTagText}>{swap.status}</Text>
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
                      <Ionicons name="checkmark" size={10} color={colors.cream} />
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
                    numberOfLines={1}
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
        <Text style={styles.sectionHeading}>EXCHANGE MANIFEST</Text>
        <View style={styles.manifestGrid}>
          {/* YOU GIVE CARD */}
          <View style={styles.garmentCard}>
            <View style={styles.cardBadgeGive}>
              <Text style={styles.cardBadgeText}>YOU GIVE</Text>
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
                <Ionicons name="scan-outline" size={11} color="#FFFFFF" />
                <Text style={styles.zoomPillSmallText}>ZOOM</Text>
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
              <Ionicons name="repeat" size={18} color={colors.cream} />
            </View>
          </View>

          {/* YOU RECEIVE CARD */}
          <View style={styles.garmentCard}>
            <View style={styles.cardBadgeReceive}>
              <Text style={styles.cardBadgeText}>YOU RECEIVE</Text>
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
                <Ionicons name="scan-outline" size={11} color="#FFFFFF" />
                <Text style={styles.zoomPillSmallText}>ZOOM</Text>
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
          style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4 }}
        />

        {/* Proposal Note */}
        {swap.message && (
          <View style={styles.messageBox}>
            <View style={styles.messageHeaderRow}>
              <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.charcoal} />
              <Text style={styles.messageLabel}>PROPOSAL MEMO</Text>
            </View>
            <Text style={styles.messageText}>"{swap.message}"</Text>
          </View>
        )}

        {/* Condition Evidence Gallery */}
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
                <Ionicons name="shield-checkmark-outline" size={14} color={colors.charcoal} />
                <Text style={styles.sectionLabel}>CONDITION EVIDENCE PHOTOS</Text>
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
            <Ionicons name="lock-closed" size={16} color="#8C6D3B" />
            <Text style={styles.escrowNoticeTitle}>SECURITY ESCROW PROTECTION</Text>
          </View>
          <Text style={styles.escrowNoticeBody}>
            Kaphor holds a refundable ₹500 security deposit from each swapper. Deposits are
            fully refunded once both parties authenticate condition and confirm receipt.
          </Text>
        </View>

        {/* Completed Swap Review Card */}
        {swap.status === 'COMPLETED' && (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Ionicons name="star" size={18} color="#C9A84C" />
              <Text style={styles.reviewCardTitle}>SWAP PARTNER REPUTATION</Text>
            </View>

            {(swap as any).reviews?.[effectiveUserId || ''] ? (
              <View style={styles.reviewSubmittedBox}>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name="star"
                      size={18}
                      color={s <= (swap as any).reviews[effectiveUserId || ''].rating ? '#C9A84C' : colors.bgMuted}
                    />
                  ))}
                </View>
                <Text style={styles.reviewSubmittedLabel}>YOUR REVIEW SUBMITTED</Text>
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
                    <TouchableOpacity
                      key={star}
                      onPress={() => setReviewRating(star)}
                      style={{ padding: 4 }}
                    >
                      <Ionicons
                        name={star <= reviewRating ? 'star' : 'star-outline'}
                        size={28}
                        color="#C9A84C"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
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
                    <ActivityIndicator size="small" color={colors.cream} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color={colors.cream} />
                      <Text style={styles.submitReviewBtnText}>SUBMIT REVIEW</Text>
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
              style={[styles.dockBtn, styles.declineBtn]}
              onPress={() => handleRespond(false)}
              disabled={actionLoading}
            >
              <Ionicons name="close" size={16} color={colors.red} />
              <Text style={styles.declineBtnText}>DECLINE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dockBtn, styles.acceptBtn]}
              onPress={() => handleRespond(true)}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={colors.cream} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color={colors.cream} />
                  <Text style={styles.acceptBtnText}>ACCEPT SWAP</Text>
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
              <Ionicons name="close-circle-outline" size={16} color={colors.textMuted} />
              <Text style={styles.cancelBtnText}>CANCEL REQUEST</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dockBtn, styles.primaryBtn]}
              onPress={handleMessagePartner}
              disabled={actionLoading}
            >
              <Ionicons name="chatbubbles" size={16} color={colors.cream} />
              <Text style={styles.primaryBtnText}>MESSAGE OWNER</Text>
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
              <Ionicons name="chatbubbles-outline" size={16} color={colors.charcoal} />
              <Text style={styles.secondaryBtnText}>CHAT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dockBtn, styles.primaryBtn, { flex: 2 }]}
              onPress={() => router.push(`/(tabs)/swap/agreement?swapId=${swap.id}` as any)}
            >
              <Ionicons name="document-text-outline" size={16} color={colors.cream} />
              <Text style={styles.primaryBtnText}>REVIEW & SIGN AGREEMENT</Text>
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
              <Ionicons name="document-text" size={14} color={colors.charcoal} />
              <Text style={styles.secondaryBtnText}>AGREEMENT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dockBtn, styles.goldBtn, { flex: 2 }]}
              onPress={() => router.push(`/(tabs)/swap/shipping?swapId=${swap.id}` as any)}
            >
              <Ionicons name="cube-outline" size={16} color={colors.cream} />
              <Text style={styles.goldBtnText}>PAY ESCROW & SHIP</Text>
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
              <Ionicons name="cube-outline" size={14} color={colors.charcoal} />
              <Text style={styles.secondaryBtnText}>TRACKING</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dockBtn, styles.forestBtn, { flex: 2 }]}
              onPress={handleConfirmReceived}
              disabled={confirmingReceived}
              activeOpacity={0.85}
            >
              {confirmingReceived ? (
                <ActivityIndicator color={colors.cream} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-done-circle" size={16} color={colors.cream} />
                  <Text style={styles.forestBtnText}>CONFIRM PACKAGE RECEIVED</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* State 6: COMPLETED */}
        {swap.status === 'COMPLETED' && (
          <View style={styles.completedNotice}>
            <Ionicons name="checkmark-circle" size={18} color={colors.forest} />
            <Text style={styles.completedNoticeText}>SWAP COMPLETE & DEPOSITS RELEASED</Text>
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
          <TouchableOpacity 
            style={[styles.modalCloseBtn, { top: Math.max(insets.top + 10, 44) }]} 
            onPress={() => setSelectedPhoto(null)}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={[styles.zoomInstructionWrap, { top: Math.max(insets.top + 18, 52) }]}>
            <Ionicons name="scan-outline" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={styles.zoomInstructionText}>PINCH TO ZOOM</Text>
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
      return { backgroundColor: '#EBF3ED', borderColor: colors.forest };
    case 'SHIPPED':
    case 'BOTH_SHIPPED':
      return { backgroundColor: '#FDF6E2', borderColor: '#8C6D3B' };
    case 'COMPLETED':
      return { backgroundColor: '#EBF3ED', borderColor: colors.forest };
    case 'REJECTED':
    case 'CANCELLED':
      return { backgroundColor: '#FDECEC', borderColor: colors.red };
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
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontFamily: typography.headings,
    fontSize: 18,
    color: colors.charcoal,
    letterSpacing: 1,
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
    paddingBottom: 110,
  },

  // Partner Card
  partnerCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  partnerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
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
    gap: 4,
  },
  partnerDisplayName: {
    fontFamily: typography.headings,
    fontSize: 16,
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  partnerRole: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  partnerHandle: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textSecond,
    marginTop: 1,
  },
  directChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.charcoal,
    paddingVertical: 10,
    gap: 8,
  },
  directChatBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.cream,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Timeline & Stepper
  timelineCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
    fontWeight: '700',
  },
  statusTag: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusTagText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
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
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
  },
  stepNumberActive: {
    color: colors.cream,
    fontWeight: '700',
  },
  stepLabel: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    color: colors.textMuted,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.charcoal,
    fontWeight: '700',
  },
  stepLabelCompleted: {
    color: colors.forest,
  },
  stepLine: {
    position: 'absolute',
    top: 10,
    left: '50%',
    width: '100%',
    height: 1,
    backgroundColor: colors.bgMuted,
    zIndex: -1,
  },
  stepLineActive: {
    backgroundColor: colors.forest,
  },

  // Manifest
  sectionHeading: {
    fontFamily: typography.headings,
    fontSize: 15,
    color: colors.charcoal,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  manifestGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  garmentCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardBadgeGive: {
    backgroundColor: colors.charcoal,
    paddingVertical: 3,
    alignItems: 'center',
  },
  cardBadgeReceive: {
    backgroundColor: '#8C6D3B',
    paddingVertical: 3,
    alignItems: 'center',
  },
  cardBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.cream,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  garmentImgWrap: {
    width: '100%',
    height: 130,
    backgroundColor: colors.bgMuted,
  },
  garmentImg: {
    width: '100%',
    height: '100%',
  },
  garmentCardBody: {
    padding: 8,
  },
  garmentBrand: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  garmentTitle: {
    fontFamily: typography.headings,
    fontSize: 13,
    color: colors.charcoal,
    marginVertical: 2,
    lineHeight: 16,
  },
  garmentMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  garmentSize: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textSecond,
  },
  garmentCondition: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.forest,
    fontWeight: '700',
  },
  garmentValue: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.charcoal,
    fontWeight: '700',
    marginTop: 4,
  },
  exchangeDivider: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exchangeIconCircle: {
    width: 26,
    height: 26,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Proposal Memo
  messageBox: {
    backgroundColor: colors.white,
    borderWidth: 1,
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
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
    fontWeight: '700',
  },
  messageText: {
    fontFamily: typography.accent,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 18,
  },

  // Evidence Photos
  evidenceSection: {
    backgroundColor: colors.white,
    borderWidth: 1,
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
    width: 75,
    height: 75,
    borderWidth: 1,
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  photoIndexText: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.cream,
  },

  // Escrow Notice
  escrowNoticeCard: {
    backgroundColor: '#FAF7EE',
    borderWidth: 1,
    borderColor: '#D4C4A3',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  escrowNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  escrowNoticeTitle: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: '#8C6D3B',
    fontWeight: '700',
    letterSpacing: 1,
  },
  escrowNoticeBody: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    color: colors.textSecond,
    lineHeight: 14,
    marginBottom: 8,
  },

  // Action Dock
  actionDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  dockButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dockBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 6,
  },
  acceptBtn: {
    backgroundColor: colors.forest,
  },
  acceptBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.cream,
    letterSpacing: 1,
  },
  declineBtn: {
    borderWidth: 1,
    borderColor: colors.red,
    backgroundColor: colors.white,
  },
  declineBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.red,
    letterSpacing: 1,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  cancelBtnText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  primaryBtn: {
    backgroundColor: colors.charcoal,
  },
  primaryBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.cream,
    letterSpacing: 1,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  secondaryBtnText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  goldBtn: {
    backgroundColor: '#8C6D3B',
  },
  goldBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.cream,
    letterSpacing: 1,
  },
  forestBtn: {
    backgroundColor: colors.forest,
  },
  forestBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.cream,
    letterSpacing: 1,
  },
  completedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  completedNoticeText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.forest,
    fontWeight: '700',
    letterSpacing: 1,
  },

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
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.charcoal,
    fontWeight: '800',
    letterSpacing: 1,
  },
  reviewSubmittedBox: {
    backgroundColor: '#FAF7EE',
    borderWidth: 1,
    borderColor: '#D4C4A3',
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
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#8C6D3B',
    letterSpacing: 0.8,
  },
  reviewCommentText: {
    fontFamily: typography.accent,
    fontSize: 12,
    color: colors.charcoal,
    marginTop: 4,
    textAlign: 'center',
  },
  reviewForm: {
    marginTop: 4,
  },
  reviewInstruction: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    color: colors.textSecond,
    lineHeight: 14,
    marginBottom: 8,
  },
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
    padding: 10,
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.charcoal,
    textAlignVertical: 'top',
    minHeight: 60,
    marginBottom: 10,
  },
  submitReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.charcoal,
    paddingVertical: 12,
  },
  submitReviewBtnText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 1,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  zoomInstructionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: '800',
    letterSpacing: 1,
  },
  zoomPillSmall: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  zoomPillSmallText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: typography.mono,
    fontWeight: '800',
  },
  modalImage: {
    width: width * 0.9,
    height: width * 1.2,
  },
});
