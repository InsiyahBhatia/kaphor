import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, Modal, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { garmentService } from '../../../src/services/garmentService';
import api from '../../../src/services/api';
import { swapService } from '../../../src/services/swapService';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';
import { KaphorImage } from '../../../src/components/KaphorImage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { useAuth } from '../../../src/context/AuthContext';
import { useAuthStore } from '../../../src/store/authStore';
import { isAccessoryCategory } from '../../../src/constants/market';
import { EstTradeValueBadge, formatTradeValuation } from '../../../src/components/orders/EstTradeValueBadge';
import { FairValueMatcher } from '../../../src/components/orders/FairValueMatcher';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SwapDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const targetGarmentId = (params.id || params.wantedId) as string;
  const router = useRouter();
  useBackHandler('/(tabs)/circular');

  const { user } = useAuth();
  const authStoreUserId = useAuthStore((s) => s.user?.id);
  const [currentUserId, setCurrentUserId] = useState<string | null>(user?.id || authStoreUserId || null);
  const effectiveUserId = user?.id || currentUserId || authStoreUserId;

  const [garment, setGarment] = useState<any>(null);
  const [myGarments, setMyGarments] = useState<any[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  const [filterFairOnly, setFilterFairOnly] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [conditionPhotos, setConditionPhotos] = useState<string[]>([]);
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [gData, myData, meRes] = await Promise.all([
          garmentService.getGarmentById(targetGarmentId),
          api.get('/garments/me').then((r) => r.data.data).catch(() => []),
          api.get('/users/me').catch(() => ({ data: { data: null } })),
        ]);
        setGarment(gData);

        const resolvedUid = meRes.data?.data?.id || user?.id || authStoreUserId || null;
        if (resolvedUid) {
          setCurrentUserId(resolvedUid);
        }

        // Accessories only, strictly excluding the target garment itself
        const accessoriesOnly = (Array.isArray(myData) ? myData : []).filter((item: any) =>
          item.id !== targetGarmentId &&
          (isAccessoryCategory(item.category, item.subCategory) || item.listingType === 'ACCESSORY_SWAP')
        );
        setMyGarments(accessoriesOnly);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [targetGarmentId]);

  const isOwnGarment = Boolean(
    effectiveUserId &&
    garment &&
    (garment.sellerId === effectiveUserId || garment.seller?.id === effectiveUserId)
  );

  const pickConditionPhoto = () => {
    Alert.alert('Condition Evidence', 'Take a close-up photo with your camera or choose from your gallery:', [
      {
        text: 'Take Photo',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Grant camera access to take condition evidence photos.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.85,
            });
            if (!result.canceled && result.assets[0]?.uri) {
              setConditionPhotos((prev) => [...prev, result.assets[0].uri].slice(0, 3));
            }
          } catch {
            Alert.alert('Error', 'Failed to capture photo');
          }
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission needed', 'Grant photo access to add condition evidence.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.85,
            });
            if (!result.canceled && result.assets[0]?.uri) {
              setConditionPhotos((prev) => [...prev, result.assets[0].uri].slice(0, 3));
            }
          } catch {
            Alert.alert('Error', 'Failed to pick photo');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadPhoto = async (uri: string): Promise<string> => {
    // Convert local file URI to base64 for API transmission
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      return `data:image/jpeg;base64,${base64}`;
    } catch {
      return uri; // Fallback: send raw URI (backend may handle it)
    }
  };

  const handleSwap = async () => {
    if (isOwnGarment) {
      Alert.alert('Cannot Swap With Yourself', 'This accessory is already in your archive. Browse community listings to trade.');
      return;
    }
    if (!selectedOffer) {
      Alert.alert('Select an accessory', 'Choose one of your accessories to offer.');
      return;
    }
    if (selectedOffer === targetGarmentId) {
      Alert.alert('Invalid Selection', 'You cannot offer the same item you are requesting.');
      return;
    }
    setSubmitting(true);
    try {
      // Convert condition photos to base64 before sending
      const photoData = conditionPhotos.length > 0
        ? await Promise.all(conditionPhotos.map(uploadPhoto))
        : undefined;

      const res: any = await swapService.createSwapRequest({
        garmentOfferedId: selectedOffer,
        garmentWantedId: targetGarmentId,
        message: message.trim() || undefined,
        conditionPhotos: photoData,
      });
      const convId = res?.conversationId || res?.data?.conversationId;
      Alert.alert(
        'Swap Requested!',
        'The owner has been notified. Your proposal message has been sent to your chat thread.',
        [
          ...(convId ? [{ text: 'VIEW IN CHAT', onPress: () => router.push(`/messages/${convId}` as any) }] : []),
          { text: 'VIEW SWAPS', onPress: () => safeBack('/(tabs)/circular') },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Swap request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const targetVal = formatTradeValuation(garment?.price || garment?.estimatedValue);

  const fairMatchesCount = myGarments.filter((g) => {
    const v = formatTradeValuation(g.price || g.estimatedValue);
    return Math.abs(v - targetVal) / Math.max(v, targetVal, 1) <= 0.15;
  }).length;

  const sortedGarments = [...myGarments].sort((a, b) => {
    const valA = formatTradeValuation(a.price || a.estimatedValue);
    const valB = formatTradeValuation(b.price || b.estimatedValue);
    const diffA = Math.abs(valA - targetVal);
    const diffB = Math.abs(valB - targetVal);
    return diffA - diffB;
  });

  const displayedGarments = filterFairOnly
    ? sortedGarments.filter((g) => {
        const v = formatTradeValuation(g.price || g.estimatedValue);
        return Math.abs(v - targetVal) / Math.max(v, targetVal, 1) <= 0.15;
      })
    : sortedGarments;

  const selectedGarment = myGarments.find((g) => g.id === selectedOffer);

  if (loading) {
    return <DossierLoading variant="swap" />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/circular')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SWAP REQUEST</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
      >
        {garment && (
          <View style={[styles.wantedCard, isOwnGarment && styles.wantedCardOwn]}>
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => {
                const uri = (garment as any)?.primaryImage || garment.images?.[0];
                if (uri) setZoomImageUri(uri);
              }}
              style={{ position: 'relative' }}
            >
              <KaphorImage uri={(garment as any)?.primaryImage || garment.images?.[0]} style={styles.wantedImage} contentFit="cover" />
              <View style={styles.zoomPillSmall}>
                <Ionicons name="scan-outline" size={10} color="#FFFFFF" />
                <Text style={styles.zoomPillSmallText}>ZOOM</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.wantedInfo}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                <Text style={[styles.label, isOwnGarment && { color: colors.crimson }]}>
                  {isOwnGarment ? 'YOUR ARCHIVE ASSET' : 'YOU WANT'}
                </Text>
                <EstTradeValueBadge value={garment.price || garment.estimatedValue} size="sm" variant="copper" />
              </View>
              <Text style={styles.wantedTitle}>{garment.title}</Text>
              <Text style={styles.wantedBrand}>{(garment.brand || 'Kaphor Archive').toUpperCase()}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 10, fontFamily: typography.mono, color: colors.textMuted }}>
                  SIZE: {garment.size || 'OS'}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: typography.mono, color: colors.crimson, fontWeight: '700' }}>
                  {(garment.condition || 'PRISTINE').replace('_', ' ')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/(tabs)/shop/${targetGarmentId}` as any)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}
              >
                <Text style={{ fontSize: 10, fontFamily: typography.mono, color: colors.gold, fontWeight: '700' }}>
                  VIEW FULL PIECE DETAILS →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* If user owns this item, show prominent self-swap block banner */}
        {isOwnGarment ? (
          <View style={styles.ownGarmentContainer}>
            <View style={styles.ownGarmentHeader}>
              <Ionicons name="information-circle" size={24} color={colors.crimson} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ownGarmentBadgeText}>OWNED BY YOU · SELF-SWAP RESTRICTED</Text>
                <Text style={styles.ownGarmentTitle}>This is your listed accessory</Text>
              </View>
            </View>
            <Text style={styles.ownGarmentDesc}>
              You cannot send a swap request for an accessory you already own. Swapping is reserved for trading your pieces with other archive members.
            </Text>
            <View style={styles.ownGarmentBtnRow}>
              <TouchableOpacity
                style={styles.browseCommunityBtn}
                onPress={() => router.push('/(tabs)/swap')}
              >
                <Ionicons name="swap-horizontal" size={16} color={colors.cream} />
                <Text style={styles.browseCommunityBtnText}>BROWSE COMMUNITY SWAPS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewClosetBtn}
                onPress={() => router.push('/(tabs)/profile')}
              >
                <Text style={styles.viewClosetBtnText}>VIEW IN MY ARCHIVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Secure Swap Steps Indicator */}
            <View style={styles.stepsIndicator}>
              {['Request', 'Agree', 'Ship', 'Track', 'Complete'].map((step, i) => (
                <View key={step} style={styles.stepItem}>
                  <View style={[styles.stepDot, i === 0 && styles.stepDotActive]}>
                    <Text style={[styles.stepDotText, i === 0 && styles.stepDotTextActive]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepLabel, i === 0 && styles.stepLabelActive]}>{step}</Text>
                </View>
              ))}
            </View>

            {/* Security Notice */}
            <View style={styles.securityNotice}>
              <Ionicons name="shield-checkmark" size={16} color={colors.navy} />
              <Text style={styles.securityNoticeText}>
                Secure escrow swap: Both parties protected. Refundable ₹500 deposit required before shipping.
              </Text>
            </View>

            <View style={styles.arrowContainer}>
              <Ionicons name="swap-vertical" size={32} color={colors.charcoal} />
            </View>

            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>SELECT AN ACCESSORY TO OFFER</Text>
              {fairMatchesCount > 0 && (
                <View style={styles.fairCountPill}>
                  <Text style={styles.fairCountPillText}>
                    {fairMatchesCount} FAIR MATCH{fairMatchesCount > 1 ? 'ES' : ''}
                  </Text>
                </View>
              )}
            </View>

            {myGarments.length > 0 && (
              <View style={styles.filterChipRow}>
                <TouchableOpacity
                  style={[styles.filterChip, !filterFairOnly && styles.filterChipActive]}
                  onPress={() => setFilterFairOnly(false)}
                >
                  <Text style={[styles.filterChipText, !filterFairOnly && styles.filterChipTextActive]}>
                    ALL PIECES ({myGarments.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterChip, filterFairOnly && styles.filterChipActive]}
                  onPress={() => setFilterFairOnly(true)}
                >
                  <Ionicons 
                    name="scale-outline" 
                    size={12} 
                    color={filterFairOnly ? colors.cream : '#1E3B2F'} 
                    style={{ marginRight: 4 }} 
                  />
                  <Text style={[styles.filterChipText, filterFairOnly && styles.filterChipTextActive, !filterFairOnly && { color: '#1E3B2F' }]}>
                    FAIR VALUE ({fairMatchesCount})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {displayedGarments.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {filterFairOnly
                    ? 'No items in your closet currently fall within the ±15% fair value range.'
                    : "You don't have any accessories listed for swap yet."}
                </Text>
                {filterFairOnly ? (
                  <TouchableOpacity onPress={() => setFilterFairOnly(false)} style={{ marginTop: 10 }}>
                    <Text style={styles.linkText}>VIEW ALL ACCESSORIES</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/shop/sell', params: { prefillListingType: 'ACCESSORY_SWAP', listingType: 'ACCESSORY_SWAP', fresh: Date.now().toString() } } as any)}>
                    <Text style={styles.linkText}>LIST AN ACCESSORY</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.offerGrid}>
                {displayedGarments.map((g) => {
                  const myVal = formatTradeValuation(g.price || g.estimatedValue);
                  const delta = Math.abs(myVal - targetVal);
                  const maxV = Math.max(myVal, targetVal, 1);
                  const diffPct = Math.round((delta / maxV) * 100);
                  const isFair = diffPct <= 15;
                  const isSurplus = myVal > targetVal && !isFair;

                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[
                        styles.offerCard,
                        selectedOffer === g.id && styles.offerCardSelected,
                        isFair && styles.offerCardFair,
                      ]}
                      onPress={() => setSelectedOffer(g.id)}
                    >
                      <View style={{ position: 'relative' }}>
                        <KaphorImage uri={g.images?.[0]} style={styles.offerImage} contentFit="cover" />
                        
                        {/* Trade Value Badge */}
                        <View style={styles.cardValuationBadge}>
                          <Text style={styles.cardValuationText}>EST. ₹{myVal.toLocaleString('en-IN')}</Text>
                        </View>

                        {/* Parity Status Tag */}
                        <View style={[
                          styles.parityTag,
                          isFair ? styles.parityFair : isSurplus ? styles.paritySurplus : styles.paritySpread
                        ]}>
                          <Text style={styles.parityTagText}>
                            {isFair 
                              ? `FAIR (±${diffPct}%)` 
                              : isSurplus 
                                ? `+₹${delta.toLocaleString()} SURPLUS` 
                                : `+₹${delta.toLocaleString()} SPREAD`}
                          </Text>
                        </View>

                        {selectedOffer === g.id && (
                          <View style={styles.checkmark}>
                            <Ionicons name="checkmark-circle" size={24} color={colors.crimson} />
                          </View>
                        )}
                      </View>

                      <View style={styles.offerCardInfo}>
                        <Text style={styles.offerTitle} numberOfLines={1}>{g.title}</Text>
                        <Text style={styles.offerCategory} numberOfLines={1}>
                          {(g.subCategory || g.category || 'ACCESSORY').toUpperCase()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Fair Value Matcher Live Balance Meter */}
            {selectedOffer && selectedGarment && (
              <FairValueMatcher
                myGarment={selectedGarment}
                theirGarment={garment}
                style={{ marginTop: 18, marginBottom: 8 }}
              />
            )}

            {/* Condition Photos */}
            <Text style={styles.sectionTitle}>CONDITION EVIDENCE (RECOMMENDED)</Text>
            <Text style={styles.sectionSubtext}>
              Add close-up photos of your garment's condition. Tap any photo to zoom.
            </Text>
            <View style={styles.photoRow}>
              {conditionPhotos.map((uri, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.photoThumb}
                  activeOpacity={0.9}
                  onPress={() => setZoomImageUri(uri)}
                >
                  <Image source={{ uri }} style={styles.photoThumbImg} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={(e) => {
                      e.stopPropagation();
                      setConditionPhotos((prev) => prev.filter((_, i) => i !== idx));
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.red} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
              {conditionPhotos.length < 3 && (
                <TouchableOpacity style={styles.photoAddBtn} onPress={pickConditionPhoto}>
                  <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
                  <Text style={styles.photoAddText}>ADD PHOTO</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sectionTitle}>MESSAGE THE OWNER (OPTIONAL)</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Add a note about condition, timing, or delivery…"
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
            />
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.swapBtn, (isOwnGarment || !selectedOffer) && { opacity: 0.5 }]}
          onPress={handleSwap}
          disabled={isOwnGarment || !selectedOffer || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.cream} />
          ) : (
            <Text style={styles.swapBtnText}>
              {isOwnGarment ? 'CANNOT SWAP WITH YOURSELF' : 'SEND SECURE SWAP REQUEST'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Full Screen Pinch & Zoom Modal */}
      <Modal
        visible={!!zoomImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomImageUri(null)}
        statusBarTranslucent
      >
        <View style={styles.zoomModalBackdrop}>
          <TouchableOpacity 
            style={[styles.closeZoomBtn, { top: Math.max(insets.top + 10, 44) }]}
            onPress={() => setZoomImageUri(null)}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={[styles.zoomInstructionWrap, { top: Math.max(insets.top + 18, 52) }]}>
            <Ionicons name="scan-outline" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={styles.zoomInstructionText}>PINCH TO ZOOM</Text>
          </View>

          {zoomImageUri && (
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
                uri={zoomImageUri}
                style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }}
                contentFit="contain"
              />
            </ScrollView>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 24, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { color: colors.charcoal, fontSize: 16, fontFamily: typography.mono, fontWeight: '900', letterSpacing: 2 },
  content: { padding: 20, paddingBottom: 180 },

  stepsIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(30,31,34,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(30,31,34,0.15)',
  },
  stepDotActive: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  stepDotText: { fontFamily: typography.mono, fontSize: 10, fontWeight: '800', color: colors.charcoal },
  stepDotTextActive: { color: colors.cream },
  stepLabel: { fontFamily: typography.mono, fontSize: 7, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  stepLabelActive: { color: colors.charcoal, fontWeight: '900' },

  securityNotice: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(28,43,74,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(28,43,74,0.12)',
    marginBottom: 8,
    alignItems: 'center',
  },
  securityNoticeText: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.navy,
    lineHeight: 14,
  },

  wantedCard: { flexDirection: 'row', backgroundColor: colors.white, borderWidth: 2, borderColor: colors.charcoal, overflow: 'hidden', marginBottom: 8 },
  wantedCardOwn: { borderColor: colors.crimson, backgroundColor: '#FFFDF9' },
  wantedImage: { width: 100, height: 120 },
  wantedInfo: { flex: 1, padding: 16, justifyContent: 'center' },
  label: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.5, marginBottom: 4, fontWeight: '800' },
  wantedTitle: { color: colors.charcoal, fontFamily: typography.headings, fontSize: 20 },
  wantedBrand: { color: colors.red, fontFamily: typography.mono, fontSize: 11, marginTop: 4, fontWeight: '700' },

  ownGarmentContainer: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.crimson,
    padding: 16,
    marginVertical: 14,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 3,
  },
  ownGarmentHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  ownGarmentBadgeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.crimson,
    letterSpacing: 1.2,
  },
  ownGarmentTitle: {
    fontFamily: typography.headings,
    fontSize: 16,
    color: colors.charcoal,
    marginTop: 2,
  },
  ownGarmentDesc: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textSecond,
    lineHeight: 18,
    marginBottom: 16,
  },
  ownGarmentBtnRow: {
    gap: 10,
  },
  browseCommunityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.charcoal,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  browseCommunityBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 1.5,
  },
  viewClosetBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  viewClosetBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 1,
  },

  arrowContainer: { alignItems: 'center', marginVertical: 16 },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  fairCountPill: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#2E7D32',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  fairCountPillText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: '#1B5E20',
    letterSpacing: 0.5,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  filterChipActive: {
    backgroundColor: colors.charcoal,
  },
  filterChipText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  filterChipTextActive: {
    color: colors.cream,
  },
  sectionTitle: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  sectionSubtext: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, lineHeight: 14, marginBottom: 12, marginTop: -12 },
  messageInput: {
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.charcoal,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 90,
    color: colors.charcoal, textAlignVertical: 'top', fontSize: 14,
    marginBottom: 12,
  },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 12 },
  linkText: { color: colors.red, fontFamily: typography.mono, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 12 },
  offerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  offerCard: { width: '47%', backgroundColor: colors.white, borderWidth: 2, borderColor: colors.charcoal, overflow: 'hidden', position: 'relative' },
  offerCardSelected: { borderColor: colors.charcoal, borderWidth: 2, backgroundColor: 'rgba(30,31,34,0.02)' },
  offerCardFair: { borderColor: '#2E7D32', borderWidth: 2 },
  cardValuationBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(30,31,34,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
    zIndex: 2,
  },
  cardValuationText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  parityTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
    zIndex: 2,
  },
  parityFair: {
    backgroundColor: '#1B5E20',
  },
  paritySurplus: {
    backgroundColor: colors.copper,
  },
  paritySpread: {
    backgroundColor: '#1C2B4A',
  },
  parityTagText: {
    color: '#FFFFFF',
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  offerCardInfo: {
    padding: 8,
    backgroundColor: colors.white,
  },
  offerCategory: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    fontWeight: '700',
    marginTop: 2,
  },
  offerImage: { width: '100%', height: 150 },
  offerTitle: { color: colors.charcoal, fontFamily: typography.headings, fontSize: 13 },
  checkmark: { position: 'absolute', top: 8, right: 8, zIndex: 3 },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  photoThumb: { width: 90, height: 90, position: 'relative', borderWidth: 2, borderColor: colors.charcoal },
  photoThumbImg: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: -8, right: -8 },
  photoAddBtn: {
    width: 90, height: 90,
    borderWidth: 2, borderStyle: 'dashed', borderColor: colors.charcoal,
    justifyContent: 'center', alignItems: 'center', gap: 4,
    backgroundColor: colors.white,
  },
  photoAddText: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, fontWeight: '700' },

  footer: { 
    padding: 20, 
    paddingBottom: 24,
    borderTopWidth: 2, 
    borderTopColor: colors.charcoal, 
    backgroundColor: colors.cream, 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0 
  },
  swapBtn: {
    backgroundColor: colors.charcoal, 
    height: 56,
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2, 
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal, 
    shadowOffset: { width: 4, height: 4 }, 
    shadowOpacity: 1, 
    shadowRadius: 0, 
    elevation: 4,
  },
  swapBtnText: { color: colors.cream, fontFamily: typography.mono, fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  zoomModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeZoomBtn: {
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
});
