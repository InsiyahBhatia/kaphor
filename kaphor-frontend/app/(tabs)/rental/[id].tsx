import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Dimensions, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SolarIcon } from '../../../src/components/common/SolarIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { garmentService } from '../../../src/services/garmentService';
import { messageService } from '../../../src/services/messageService';
import { api } from '../../../src/services/api';
import { colors, typography } from '../../../src/theme';
import { KaphorImage, getCategoryFallbackImage } from '../../../src/components/KaphorImage';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { hapticFeedback } from '../../../src/utils/haptics';
import { useAuthStore } from '../../../src/store/authStore';
import { getFormattedGarmentPrice, normalizeRupees } from '../../../src/utils/priceFormatter';
import { Spinner, Loader } from '../../../src/components/common/Loader';
import { peekGarment } from '../../../src/store/garmentStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function RentalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id);
  // Seed from lists already seen so the page paints instantly, then revalidate in the background
  const seeded = peekGarment(id as string);
  const [garment, setGarment] = useState<any>(seeded ?? null);
  const [loading, setLoading] = useState(!seeded);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [availabilityData, setAvailabilityData] = useState<{
    isAvailable: boolean;
    bookedRanges: Array<{ startDate: string; endDate: string }>;
  }>({
    isAvailable: true,
    bookedRanges: [],
  });

  useBackHandler('/(tabs)/shop');

  useEffect(() => {
    if (!id) return;
    api
      .get('/rentals/check-availability', { params: { garmentId: id } })
      .then((res) => {
        if (res.data?.data) {
          setAvailabilityData({
            isAvailable: res.data.data.isAvailable !== false,
            bookedRanges: res.data.data.bookedRanges || [],
          });
        }
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!seeded) setLoading(true);
      try {
        const data = await garmentService.getGarmentById(id as string);
        if (data && isMounted) {
          setGarment(data);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Failed to fetch garment by id in rental detail:', err);
      }

      // If id was actually a rentalId from a notification or payment history, route to lease dossier
      try {
        const myRentalsRes = await api.get('/rentals/me');
        const myRentals = myRentalsRes?.data?.data || myRentalsRes?.data || [];
        const match = myRentals.find((r: any) => r.id === id || r.garmentId === id);
        if (match?.id === id && isMounted) {
          router.replace(`/(tabs)/rental/lease/${match.id}` as any);
          return;
        }
        if (match?.garment && isMounted) {
          setGarment(match.garment);
          setLoading(false);
          return;
        } else if (match?.garmentId && isMounted) {
          const g = await garmentService.getGarmentById(match.garmentId);
          if (g && isMounted) {
            setGarment(g);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to resolve garment from my rentals:', err);
      }

      if (isMounted) {
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleStartChat = async () => {
    const sellerId = garment?.seller?.id || garment?.sellerId;
    if (!sellerId) {
      Alert.alert('Chat Notice', 'Lender information is not available for this item.');
      return;
    }
    if (sellerId === currentUserId) {
      Alert.alert('Notice', 'You are the owner of this rental listing.');
      return;
    }
    if (startingChat) return;

    hapticFeedback.light();
    setStartingChat(true);
    try {
      const conv = await messageService.getOrCreateConversation(sellerId, garment.id);
      router.push(`/messages/${conv.id}` as any);
    } catch (e: any) {
      Alert.alert('Chat Error', e?.response?.data?.message || 'Could not start conversation with lender.');
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) {
    return <Loader variant="rental" />;
  }

  if (!garment) {
    return (
      <View style={[styles.container, styles.center, { paddingHorizontal: 24 }]}>
        <SolarIcon name="calendar-outline" size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
        <Text style={{ color: colors.charcoal, fontFamily: typography.handSemi, fontSize: 18, textAlign: 'center', includeFontPadding: false }}>
          Rental lease details
        </Text>
        <Text style={{ color: colors.textMuted, fontFamily: typography.handwritten, fontSize: 16, marginTop: 8, textAlign: 'center', includeFontPadding: false }}>
          This rental agreement is registered. You can view its full timeline and return status in My Rentals.
        </Text>
        <TouchableOpacity 
          onPress={() => router.replace('/(tabs)/rental?tab=my' as any)}
          style={{ marginTop: 24, backgroundColor: colors.charcoal, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 2 }}
        >
          <Text style={{ color: colors.cream, fontFamily: typography.handBold, fontSize: 16, includeFontPadding: false }}>View my rentals</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/shop')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginTop: 16 }}
        >
          <Text style={{ color: colors.crimson, fontFamily: typography.handwritten, fontSize: 16, includeFontPadding: false }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const priceData = getFormattedGarmentPrice({ ...garment, listingType: 'RENTAL' });
  const dayRate = priceData.numericRupees;
  const weekRate = garment.rentalPriceWeek ? normalizeRupees(garment.rentalPriceWeek) : Math.round(dayRate * 5);
  const topInset = Math.max(insets.top + 8, 48);

  const rawImages: string[] = Array.isArray(garment.images)
    ? garment.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0)
    : [];

  const imagesList: string[] = rawImages.length > 0 ? rawImages : [''];
  const currentImage = imagesList[activeImageIndex] || imagesList[0] || '';

  const cleanColors = Array.isArray(garment.color)
    ? garment.color.filter((c: string) => typeof c === 'string' && c.trim().length > 0).join(', ')
    : typeof garment.color === 'string' && garment.color.trim() ? garment.color : '';

  const isOwner = Boolean(currentUserId && (garment.sellerId === currentUserId || garment.seller?.id === currentUserId));

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Main Image with Zoom Trigger */}
        <View style={styles.imageWrap}>
          <TouchableOpacity 
            activeOpacity={0.95} 
            onPress={() => {
              hapticFeedback.light();
              setZoomVisible(true);
            }}
          >
            <KaphorImage 
              uri={currentImage} 
              category={garment.category}
              brand={garment.brand}
              style={styles.image} 
              contentFit="cover" 
            />
            <View style={styles.zoomPill}>
              <SolarIcon name="scan-outline" size={13} color={colors.white} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.zoomPillText}>Tap to zoom</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" 
            style={[styles.backButton, { top: topInset }]} 
            onPress={() => safeBack('/(tabs)/shop')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <SolarIcon name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Thumbnail Selector for Multiple Images */}
        {imagesList.length > 1 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.thumbScroll} 
            contentContainerStyle={styles.thumbContainer}
          >
            {imagesList.map((imgUri: string, idx: number) => (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  hapticFeedback.selection();
                  setActiveImageIndex(idx);
                }}
                style={[
                  styles.thumbButton,
                  activeImageIndex === idx && styles.thumbButtonActive,
                ]}
              >
                <KaphorImage 
                  uri={imgUri} 
                  category={garment.category}
                  brand={garment.brand}
                  style={styles.thumbImg} 
                  contentFit="cover" 
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.content}>
          <Text style={styles.brand}>{garment.brand || 'Kaphor closet'}</Text>
          <Text style={styles.title}>{garment.title}</Text>
          <Text style={styles.desc}>{garment.description || 'Rental item from the Kaphor closet.'}</Text>

          {/* CHAT WITH LENDER BUTTON */}
          {!isOwner && (
            <TouchableOpacity 
              style={styles.messageLenderBtn} 
              onPress={handleStartChat}
              disabled={startingChat}
              activeOpacity={0.8}
            >
              {startingChat ? (
                <Spinner size="small" color={colors.charcoal} />
              ) : (
                <>
                  <SolarIcon name="chatbubble-ellipses-outline" size={18} color={colors.charcoal} />
                  <Text style={styles.messageLenderText}>Chat with lender about rental</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* AI Doubt & Style Assistant Button */}
          <TouchableOpacity 
            style={styles.aiDoubtButton} 
            onPress={() => {
              hapticFeedback.medium();
              router.push({
                pathname: '/(tabs)/shop/ai-chat',
                params: { 
                  garmentId: id as string, 
                  initialMessage: `I want to rent "${garment.title}". Can you give me styling advice and details about fit and rental care?` 
                }
              });
            }}
          >
            <SolarIcon name="sparkles" size={18} color={colors.gold} />
            <Text style={styles.aiDoubtText}>Questions? Ask Kaphor ai</Text>
          </TouchableOpacity>

          <View style={styles.rateCard}>
            <Text style={styles.rateTitle}>Rental rates</Text>
            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>Per day</Text>
              <Text style={styles.rateValue}>₹{dayRate.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>Per week</Text>
              <Text style={styles.rateValue}>₹{weekRate.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>Security deposit</Text>
              <Text style={[styles.rateValue, { color: colors.forest }]}>₹500 (100% Refundable)</Text>
            </View>
          </View>

          {/* Real-time Availability & Request Checker */}
          <View style={styles.availabilityCard}>
            <View style={styles.availabilityHeaderRow}>
              <View style={styles.availabilityTitleGroup}>
                <SolarIcon
                  name={availabilityData.isAvailable ? 'checkmark-circle' : 'time'}
                  size={18}
                  color={availabilityData.isAvailable ? colors.forest : colors.gold}
                />
                <Text style={styles.availabilityTitle}>Availability</Text>
              </View>
              <View style={[
                styles.availabilityBadge,
                availabilityData.isAvailable ? styles.availabilityBadgeOk : styles.availabilityBadgeWarn
              ]}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.availabilityBadgeText}>
                  {availabilityData.isAvailable ? 'Available to rent' : 'Check dates'}
                </Text>
              </View>
            </View>
            <Text style={styles.availabilitySubtext}>
              {availabilityData.isAvailable
                ? 'Cleaned and insured. Ready to ship for your event dates.'
                : 'Current dates have reservation holds. Check specific dates to schedule an occasion lease.'}
            </Text>
            <TouchableOpacity
              style={styles.checkDatesBtn}
              onPress={() => {
                hapticFeedback.light();
                router.push({
                  pathname: '/(tabs)/rental/reserve',
                  params: { garmentId: garment.id, dayRate: String(dayRate) }
                });
              }}
              activeOpacity={0.85}
            >
              <SolarIcon name="calendar-outline" size={15} color={colors.charcoal} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.checkDatesBtnText}>Check specific dates & availability →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Size</Text>
              <Text style={styles.detailValue}>{garment.size || 'STANDARD'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Condition</Text>
              <Text style={styles.detailValue}>{(garment.condition || 'PRISTINE').replace('_', ' ')}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Category</Text>
              <Text style={styles.detailValue}>{garment.category || 'RENTAL'}</Text>
            </View>
            {garment.subCategory && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Sub-category</Text>
                <Text style={styles.detailValue}>{garment.subCategory}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fabric</Text>
              <Text style={styles.detailValue}>{garment.fabric || 'Mixed fabric'}</Text>
            </View>
            {cleanColors ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Color</Text>
                <Text style={styles.detailValue}>{cleanColors}</Text>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Hygiene standard</Text>
              <Text style={styles.detailValue}>Ozone Sanitized & Sealed</Text>
            </View>
          </View>

          <View style={styles.impactCard}>
            <SolarIcon name="leaf" size={20} color={colors.forest} />
            <Text style={styles.impactText}>
              Renting this piece avoids about 12kg of CO2.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Full Screen Pinch & Zoom Modal */}
      <Modal
        visible={zoomVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.zoomModalBackdrop}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" 
            style={[styles.closeZoomBtn, { top: Math.max(insets.top + 10, 44) }]}
            onPress={() => setZoomVisible(false)}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <SolarIcon name="close" size={28} color={colors.white} />
          </TouchableOpacity>

          <View style={[styles.zoomInstructionWrap, { top: Math.max(insets.top + 18, 52) }]}>
            <SolarIcon name="scan-outline" size={13} color={colors.paperGlass} />
            <Text style={styles.zoomInstructionText}>Pinch to zoom</Text>
          </View>

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
              uri={currentImage}
              style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }}
              contentFit="contain"
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Fixed Reserve & Chat Footer with Safe Insets */}
      <View style={[
        styles.footer,
        {
          paddingBottom: Math.max(
            insets.bottom + 12,
            Platform.OS === 'android' ? 24 : 16
          )
        }
      ]}>
        {isOwner ? (
          <TouchableOpacity
            style={[styles.reserveButton, { backgroundColor: colors.cream, borderColor: colors.charcoal, opacity: 0.7 }]}
            disabled={true}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.reserveButtonText, { color: colors.charcoal }]}>
              Your listed item
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.chatIconButton}
              onPress={handleStartChat}
              disabled={startingChat}
              activeOpacity={0.8}
            >
              {startingChat ? (
                <Spinner size="small" color={colors.charcoal} />
              ) : (
                <>
                  <SolarIcon name="chatbubble-ellipses-outline" size={20} color={colors.charcoal} />
                  <Text style={styles.chatIconLabel}>Chat</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reserveButton, { flex: 1 }]}
              onPress={() => {
                hapticFeedback.heavy();
                router.push({ 
                  pathname: '/(tabs)/rental/reserve', 
                  params: { garmentId: garment.id, dayRate: String(dayRate) } 
                });
              }}
              activeOpacity={0.88}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <SolarIcon name="calendar-outline" size={16} color={colors.white} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.reserveButtonText}>Request to rent</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  imageWrap: { position: 'relative', width: '100%', height: 420 },
  image: { width: '100%', height: 420 },
  zoomPill: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.overlay,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  zoomPillText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: typography.handBold, includeFontPadding: false, },
  backButton: { 
    position: 'absolute', 
    top: 60, 
    left: 20, 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: colors.paperGlass, 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: colors.ink, 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3 
  },
  thumbScroll: {
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumbContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  thumbButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  thumbButtonActive: {
    borderColor: colors.crimson,
    transform: [{ scale: 1.05 }],
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  content: { padding: 24 },
  brand: {
 color: colors.crimson, fontSize: 12, letterSpacing: 2, fontWeight: '800', fontFamily: typography.bodyBold,
  },
  title: { color: colors.textPrimary, fontSize: 32, fontFamily: typography.headings, marginTop: 4, marginBottom: 12 },
  desc: {
 color: colors.textSecond, fontSize: 15, lineHeight: 24, marginBottom: 20, fontFamily: typography.body,
  },
  aiDoubtButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.ink,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    marginBottom: 24,
  },
  aiDoubtText: {
    color: colors.gold,
    fontFamily: typography.handBold,
    fontSize: 13, includeFontPadding: false, },
  rateCard: { 
    backgroundColor: colors.bgCard, 
    borderRadius: 20, 
    padding: 24, 
    marginBottom: 24, 
    borderWidth: 1, 
    borderColor: colors.border, 
    shadowColor: colors.ink, 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 2 
  },
  rateTitle: {
 color: colors.textPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 2, marginBottom: 20, fontFamily: typography.bodyBold,
  },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  rateLabel: {
 color: colors.textMuted, fontSize: 12, letterSpacing: 1, fontWeight: '700', fontFamily: typography.bodyBold,
  },
  rateValue: {
 color: colors.textPrimary, fontSize: 14, fontWeight: '800', fontFamily: typography.bodyBold,
  },
  details: { marginBottom: 24 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: {
 color: colors.textMuted, fontSize: 12, letterSpacing: 1, fontWeight: '700', fontFamily: typography.bodyBold,
  },
  detailValue: {
 color: colors.textPrimary, fontSize: 15, fontWeight: '700', fontFamily: typography.bodyBold,
  },
  impactCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, backgroundColor: colors.emeraldLight, borderRadius: 16, borderWidth: 1, borderColor: colors.emeraldLight, marginBottom: 24 },
  impactText: {
 color: colors.forest, fontSize: 13, flex: 1, lineHeight: 18, fontWeight: '600', fontFamily: typography.bodyMedium,
  },
  footer: { 
    paddingHorizontal: 24, 
    paddingTop: 16,
    borderTopWidth: 1, 
    borderTopColor: colors.border, 
    backgroundColor: colors.bg, 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0 
  },
  reserveButton: { 
    backgroundColor: colors.crimson, 
    height: 56, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  reserveButtonText: {
 color: colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 2, fontFamily: typography.bodyBold,
  },
  messageLenderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  messageLenderText: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    color: colors.charcoal,
    letterSpacing: 0.2,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    width: '100%',
  },
  chatIconButton: {
    width: 60,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  chatIconLabel: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  zoomModalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeZoomBtn: {
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

  // ── Availability Card ──────────────────────────────────────────
  availabilityCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  availabilityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  availabilityTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  availabilityTitle: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  availabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  availabilityBadgeOk: {
    backgroundColor: colors.emeraldLight,
    borderColor: colors.forest,
  },
  availabilityBadgeWarn: {
    backgroundColor: colors.overlayLight,
    borderColor: colors.gold,
  },
  availabilityBadgeText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  availabilitySubtext: {
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    marginBottom: 12,
  },
  checkDatesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  checkDatesBtnText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.charcoal,
    letterSpacing: 0.2,
  },
});
