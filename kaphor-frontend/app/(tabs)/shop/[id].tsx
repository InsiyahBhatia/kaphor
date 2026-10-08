import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SolarIcon } from '../../../src/components/common/SolarIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../../src/components/common/Button';
import { Badge } from '../../../src/components/Badge';
import { garmentService } from '../../../src/services/garmentService';
import { Garment, useGarmentStore } from '../../../src/store/garmentStore';
import { useAuth } from '../../../src/context/AuthContext';
import { useAuthStore } from '../../../src/store/authStore';
import api from '../../../src/services/api';
import { colors, typography } from '../../../src/theme';
import { KaphorImage, getCategoryFallbackImage } from '../../../src/components/KaphorImage';
import { messageService } from '../../../src/services/messageService';
import { VerifiedBadge } from '../../../src/components/common/VerifiedBadge';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { hapticFeedback } from '../../../src/utils/haptics';
import { getFormattedGarmentPrice } from '../../../src/utils/priceFormatter';
import { telemetryService } from '../../../src/services/telemetryService';
import { recommendationService, RecommendedGarment } from '../../../src/services/recommendationService';
import { ListingInsightsModal } from '../../../src/components/ListingInsightsModal';
import { Spinner, Loader } from '../../../src/components/common/Loader';

const { width } = Dimensions.get('window');

export default function GarmentDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const authStoreUserId = useAuthStore((s) => s.user?.id);
  useBackHandler('/(tabs)/shop');
  // Seed from the feed cache so the page appears instantly, then revalidate in the background
  const seeded = useGarmentStore.getState().garments.find((g) => g.id === (id as string));
  const [garment, setGarment] = useState<Garment | any>(seeded ?? null);
  const [loading, setLoading] = useState(!seeded);
  const [startingInquiry, setStartingInquiry] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [togglingLike, setTogglingLike] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [buying, setBuying] = useState(false);
  const [similarGarments, setSimilarGarments] = useState<RecommendedGarment[]>([]);
  const [insightsModalVisible, setInsightsModalVisible] = useState(false);

  useEffect(() => {
    if (id) {
      loadGarment();
    }
    return () => {
      if (id) telemetryService.cancelPendingView(id as string);
    };
  }, [id]);

  const loadGarment = async () => {
    if (!garment) setLoading(true);
    try {
      const data = await garmentService.getGarmentById(id as string);
      setGarment(data);
      setIsLiked(data?.isLiked || false);
      if (data) {
        telemetryService.trackView(id as string, { category: data.category, brand: data.brand });
        recommendationService.getSimilarGarments(id as string, 6).then((similar) => {
          setSimilarGarments(similar || []);
        });
      }
    } catch (error) {
      console.error('Failed to load garment', error);
    } finally {
      setLoading(false);
    }
  };

  const priceData = getFormattedGarmentPrice(garment);

  const handleBuyNow = async () => {
    if (!id || !garment) return;
    hapticFeedback.medium();
    setBuying(true);
    telemetryService.trackIntent(id as string, 'PURCHASE');
    try {
      const { data } = await api.post('/orders', { garmentId: id as string });
      const orderData = data?.data || data;
      const orderId = orderData?.orderId || orderData?.id;
      if (!orderId) {
        throw new Error('Could not start the order session');
      }

      if (orderData?.isApproved) {
        router.push({
          pathname: '/(tabs)/shop/checkout/delivery',
          params: {
            orderId,
            garmentId: id as string,
            price: String(priceData.numericRupees || 0),
            title: garment.title,
            image: garment.images?.[0] || '',
            brand: garment.brand || '',
          },
        });
      } else {
        Alert.alert(
          'Purchase Request Sent! 🛍️',
          'Your purchase request has been submitted to the seller for approval. No payment is taken until the seller approves.\n\nYou will receive a notification as soon as the seller accepts your request.',
          [
            {
              text: 'View Order Status',
              onPress: () => router.push(`/(tabs)/shop/orders/${orderId}` as any),
            },
          ]
        );
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Could not start checkout.';
      Alert.alert('Checkout Error', msg);
    } finally {
      setBuying(false);
    }
  };

  const handleStartInquiry = async () => {
    if (!garment?.seller?.id && !garment?.sellerId) return;
    const sellerId = garment.seller?.id || garment.sellerId;
    if (!sellerId || startingInquiry) return;
    hapticFeedback.light();
    setStartingInquiry(true);
    try {
      const conv = await messageService.getOrCreateConversation(
        sellerId,
        garment.id
      );
      router.push(`/messages/${conv.id}` as any);
    } catch (e: any) {
      Alert.alert('Inquiry', e?.response?.data?.message || 'Failed to start conversation');
    } finally {
      setStartingInquiry(false);
    }
  };

  const handleToggleLike = async () => {
    if (!id || togglingLike) return;
    hapticFeedback.selection();
    setTogglingLike(true);
    
    // Optimistic UI
    const nextState = !isLiked;
    setIsLiked(nextState);
    telemetryService.trackWishlist(id as string, nextState);

    try {
      await api.post('/interactions', {
        garmentId: id,
        eventType: 'WISHLIST',
      });
    } catch (error) {
      setIsLiked(!nextState);
      telemetryService.trackWishlist(id as string, !nextState);
      console.error('Failed to toggle like', error);
    } finally {
      setTogglingLike(false);
    }
  };

  if (loading) {
    return <Loader variant="shop" />;
  }

  if (!garment) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: colors.textPrimary, fontFamily: typography.headings, fontSize: 20 }}>
          GARMENT NOT FOUND
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
          This item may have been removed or moved.
        </Text>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/shop')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginTop: 24, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.charcoal, borderRadius: 8 }}
        >
          <Text style={{ color: colors.cream, fontWeight: '700' }}>BACK TO SHOP</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const topInset = Math.max(insets.top + 8, 48);

  // Clean and prepare images list
  const rawImages: string[] = Array.isArray(garment.images)
    ? garment.images.filter((img: any) => typeof img === 'string' && img.trim().length > 0)
    : [];

  const imagesList: string[] = rawImages.length > 0 ? rawImages : [''];
  const currentImage = imagesList[activeImageIndex] || imagesList[0] || '';
  const effectiveUserId = user?.id || authStoreUserId;
  const isOwner = Boolean(effectiveUserId && (garment.sellerId === effectiveUserId || garment.seller?.id === effectiveUserId));

  // Parse specifications cleanly
  const cleanColors = Array.isArray(garment.color)
    ? garment.color.filter((c: string) => typeof c === 'string' && c.trim().length > 0).join(', ')
    : typeof garment.color === 'string' && garment.color.trim() ? garment.color : '';

  const cleanMaterials = Array.isArray(garment.material)
    ? garment.material.filter((m: string) => typeof m === 'string' && m.trim().length > 0).join(', ')
    : '';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Top Image Hero Banner */}
        <View style={styles.imageContainer}>
          <TouchableOpacity 
            activeOpacity={0.95} 
            onPress={() => setZoomVisible(true)}
            style={{ width: '100%', height: '100%' }}
          >
            <KaphorImage 
              uri={currentImage} 
              category={garment.category}
              brand={garment.brand}
              style={styles.image}
              contentFit="contain"
              width={500}
              priority="high"
            />
            <View style={styles.zoomHintBadge}>
              <SolarIcon name="expand-outline" size={14} color={colors.white} />
              <Text style={styles.zoomHintText}>TAP TO ZOOM</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" 
            style={[styles.backButton, { top: topInset }]} 
            onPress={() => safeBack('/(tabs)/shop')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <SolarIcon name="chevron-back" size={24} color={colors.charcoal} />
          </TouchableOpacity>

          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} 
            style={[styles.wishlistButton, { top: topInset }, isLiked && { backgroundColor: colors.crimsonLight }]} 
            onPress={handleToggleLike}
            disabled={togglingLike}
          >
            <SolarIcon 
              name={isLiked ? "heart" : "heart-outline"} 
              size={24} 
              color={isLiked ? colors.crimson : colors.charcoal} 
            />
          </TouchableOpacity>
        </View>

        {/* Thumbnail Selector for Multiple Images */}
        {imagesList.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScroll} contentContainerStyle={styles.thumbContainer}>
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
                  width={64}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

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
            <View style={styles.zoomImageContainer}>
              <KaphorImage
                uri={currentImage}
                category={garment.category}
                brand={garment.brand}
                style={styles.zoomFullImage}
                contentFit="contain"
                width={800}
              />
            </View>
          </View>
        </Modal>

        <View style={styles.content}>
          {/* Header Title & Pricing */}
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={styles.brand}>{garment.brand || 'KAPHOR SHOP'}</Text>
              <Text style={styles.categoryLabel}>
                {(garment.category || 'ITEM').toUpperCase()} {garment.subCategory ? `> ${garment.subCategory.toUpperCase()}` : ''}
              </Text>
              <Text style={styles.title}>{garment.title}</Text>
            </View>

            <View style={styles.priceContainer}>
              <Text style={[styles.price, priceData.isSwap ? styles.swapPrice : null]}>
                {priceData.displayPrice}
                {priceData.priceUnit ? (
                  <Text style={styles.priceUnitText}>{priceData.priceUnit}</Text>
                ) : null}
              </Text>
              {priceData.originalPrice ? (
                <Text style={styles.originalPrice}>{priceData.originalPrice}</Text>
              ) : null}
              {priceData.discountTag ? (
                <View style={[styles.discountTagBadge, priceData.isSwap ? styles.swapDiscountBadge : null]}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.discountTagText, priceData.isSwap ? styles.swapDiscountText : null]}>
                    {priceData.discountTag}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Seller Telemetry & Insights Quick Action Banner */}
          {isOwner && (
            <TouchableOpacity
              style={styles.sellerTelemetryBanner}
              onPress={() => {
                hapticFeedback.light();
                setInsightsModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.sellerBannerLeft}>
                <View style={styles.sellerCrownBadge}>
                  <SolarIcon name="stats-chart" size={13} color={colors.gold} />
                </View>
                <View>
                  <Text style={styles.sellerBannerTitle}>YOUR LISTING TELEMETRY</Text>
                  <Text style={styles.sellerBannerSub}>
                    {garment.viewCount || 0} Total Views · Tap to inspect shopper funnel & metrics
                  </Text>
                </View>
              </View>
              <View style={styles.sellerBannerAction}>
                <Text style={styles.sellerBannerActionText}>INSIGHTS ›</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Subtext description banner */}
          <View style={styles.subtextRow}>
            <SolarIcon 
              name={priceData.isSwap ? "repeat" : priceData.isRental ? "calendar-outline" : "shield-checkmark-outline"} 
              size={14} 
              color={priceData.isSwap ? colors.crimson : priceData.isRental ? colors.forest : colors.charcoal} 
            />
            <Text style={styles.subtextText}>{priceData.subtext}</Text>
          </View>

          {/* Badges Bar */}
          <View style={styles.badges}>
            <Badge 
              variant={priceData.isSwap ? "condition" : priceData.isRental ? "status" : "fitScore"} 
              label={priceData.isSwap ? "CIRCULAR SWAP" : priceData.isRental ? "RENTAL" : "CHECKED ITEM"} 
            />
            <Badge 
              variant="condition" 
              label={(garment.condition || 'PRISTINE').replace('_', ' ').toUpperCase()} 
            />
            <Badge 
              variant="fitScore" 
              label={garment.size ? `SIZE: ${garment.size.toUpperCase()}` : "ONE SIZE (OS)"} 
            />
          </View>

          {/* Description Section */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>DESCRIPTION</Text>
            <Text style={styles.description}>
              {garment.description || 'A checked pre-owned piece from Kaphor.'}
            </Text>

            <TouchableOpacity 
              style={styles.aiDoubtButton} 
              onPress={() => router.push({
                pathname: '/(tabs)/shop/ai-chat',
                params: { garmentId: id, initialMessage: `I have questions about this ${garment.title}. Can you explain its material, styling, and condition?` }
              })}
            >
              <SolarIcon name="sparkles" size={18} color={colors.gold} />
              <Text style={styles.aiDoubtText}>DOUBTS? ASK KAPHOR AI ASSISTANT</Text>
            </TouchableOpacity>
          </View>

          {/* Rich Full Specifications Grid */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>DETAILS</Text>
            <View style={styles.specGrid}>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>BRAND</Text>
                <Text style={styles.specValue}>{garment.brand || 'Kaphor'}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>CATEGORY</Text>
                <Text style={styles.specValue}>{(garment.category || 'Apparel').toUpperCase()}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>SIZE</Text>
                <Text style={styles.specValue}>{garment.size || 'One Size (OS)'}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>CONDITION</Text>
                <Text style={styles.specValue}>{(garment.condition || 'Pristine').replace('_', ' ')}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>LISTING TYPE</Text>
                <Text style={styles.specValue}>
                  {priceData.isSwap ? 'Peer Accessory Swap' : priceData.isRental ? 'Rental Lease' : 'Direct Authenticated Sale'}
                </Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>SUB-CATEGORY</Text>
                <Text style={styles.specValue}>
                  {garment.subCategory || (garment.category === 'Jewelry' ? 'Jewelry & Accessories' : 'Pre-owned')}
                </Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>FABRIC / MATERIAL</Text>
                <Text style={styles.specValue}>
                  {garment.fabric || cleanMaterials || (garment.category === 'Jewelry' ? 'Metal / mixed' : 'Mixed fabric')}
                </Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>COLORWAY</Text>
                <Text style={styles.specValue}>{cleanColors || 'Classic color'}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>STYLE / FIT</Text>
                <Text style={styles.specValue}>{garment.style || 'Contemporary Tailored'}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>SLEEVE / CUT</Text>
                <Text style={styles.specValue}>
                  {garment.sleeve || (garment.category === 'Jewelry' ? 'N/A (Accessory)' : 'Standard Silhouette')}
                </Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>SILHOUETTE / SHAPE</Text>
                <Text style={styles.specValue}>{garment.shape || 'Structured Drape'}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>PATTERN</Text>
                <Text style={styles.specValue}>{garment.pattern || 'Solid / woven'}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>WEIGHT</Text>
                <Text style={styles.specValue}>{garment.weight || 'Medium Weight'}</Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>AUTHENTICITY</Text>
                <Text style={[styles.specValue, { color: colors.success }]}>100% Inspected & Certified</Text>
              </View>

              <View style={[styles.specItem, { width: '100%' }]}>
                <Text style={styles.specLabel}>CIRCULAR IMPACT METRIC</Text>
                <Text style={styles.specValue}>Preserves ~12kg CO2 and diverts textiles from regional landfills.</Text>
              </View>
            </View>
          </View>

          {/* Seller Trust Profile */}
          <TouchableOpacity
            style={styles.sellerTrust}
            onPress={() => {
              const sellerId = garment.seller?.id || garment.sellerId;
              if (sellerId) {
                router.push(`/(tabs)/shop/seller/${sellerId}`);
              } else {
                Alert.alert('Seller Profile', 'This item is sold by Kaphor.');
              }
            }}
            activeOpacity={0.85}
          >
            <SolarIcon name="shield-checkmark-outline" size={22} color={colors.crimson} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sellerTrustTitle}>
                  {garment.seller?.displayName ? garment.seller.displayName.toUpperCase() : 'KAPHOR VERIFIED SELLER'}
                </Text>
                <VerifiedBadge size="compact" />
              </View>
              <Text style={styles.sellerTrustSub}>
                Verified circular peer · Peer ratings from completed transactions
              </Text>
            </View>
            <SolarIcon name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* MESSAGE SELLER CTA */}
          {!isOwner && (
            <TouchableOpacity 
              style={styles.messageSellerBtn} 
              onPress={handleStartInquiry}
              disabled={startingInquiry}
            >
              {startingInquiry ? (
                <Spinner size="small" color={colors.crimson} />
              ) : (
                <>
                  <SolarIcon name="chatbubble-ellipses-outline" size={20} color={colors.crimson} />
                  <Text style={styles.messageSellerText}>MESSAGE SELLER ABOUT ITEM</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Listing Context Info Cards */}
          <View style={styles.actionGrid}>
            {priceData.isSwap && (
              <View style={styles.swapNoticeCard}>
                <SolarIcon name="repeat" size={24} color={colors.crimson} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.noticeTitle}>CIRCULAR SWAP ACTIVE</Text>
                  <Text style={styles.noticeDesc}>
                    Swap one of your accessories for this item. No cash needed. Payment held safely.
                  </Text>
                </View>
              </View>
            )}

            {priceData.isRental && (
              <View style={styles.rentalNoticeCard}>
                <SolarIcon name="calendar-outline" size={24} color={colors.forest} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.noticeTitle, { color: colors.forest }]}>RENTAL AVAILABLE</Text>
                  <Text style={styles.noticeDesc}>
                    Book this piece for weddings, galas, and special occasions with doorstep hygiene care.
                  </Text>
                </View>
              </View>
            )}

            {priceData.isSale && (
              <View style={styles.saleInfoCard}>
                <SolarIcon name="shield-checkmark" size={22} color={colors.success} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.saleInfoText}>AUTHENTICATED SALE · FULL OWNERSHIP</Text>
                  <Text style={styles.saleInfoSub}>
                    Shipped to you in a sealed package.
                  </Text>
                </View>
              </View>
            )}

            {/* YOU MIGHT ALSO COVET (Similar Items) */}
            {similarGarments.length > 0 && (
              <View style={{ marginTop: 24, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                  <View style={{ width: 4, height: 16, backgroundColor: colors.gold }} />
                  <Text style={{ fontFamily: typography.headings, fontSize: 13, color: colors.charcoal, letterSpacing: 1.5 }}>
                    YOU MIGHT ALSO COVET
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {similarGarments.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={{
                        width: 145,
                        backgroundColor: colors.white,
                        borderWidth: 1.5,
                        borderColor: colors.charcoal,
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                      onPress={() => router.push(`/(tabs)/shop/${item.id}` as any)}
                      activeOpacity={0.85}
                    >
                      <View style={{ height: 155, width: '100%', position: 'relative' }}>
                        {item.images?.[0] ? (
                          <KaphorImage uri={item.images[0]} style={StyleSheet.absoluteFillObject as any} contentFit="cover" width={145} recyclingKey={item.id} />
                        ) : (
                          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.bgMuted }]} />
                        )}
                      </View>
                      <View style={{ padding: 8 }}>
                        <Text style={{ fontFamily: typography.mono, fontSize: 11, color: colors.textMuted }} numberOfLines={1}>
                          {item.brand.toUpperCase()}
                        </Text>
                        <Text style={{ fontFamily: typography.body, fontSize: 12, fontWeight: '700', color: colors.charcoal, marginTop: 2 }} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={{ fontFamily: typography.mono, fontSize: 12, fontWeight: '800', color: colors.charcoal, marginTop: 4 }}>
                          ₹{item.price.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Persistent Bottom Action Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
        {isOwner && (
          <View style={styles.listingManagerBar}>
            <Text style={styles.managerText}>YOU ARE MANAGING THIS ASSET</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={styles.insightsBtnSmall}
                onPress={() => {
                  hapticFeedback.light();
                  setInsightsModalVisible(true);
                }}
              >
                <SolarIcon name="stats-chart-outline" size={12} color={colors.gold} />
                <Text style={styles.insightsTextSmall}>INSIGHTS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editBtnSmall}
                onPress={() => router.push(`/(tabs)/shop/edit/${id}` as any)}
              >
                <SolarIcon name="create-outline" size={12} color={colors.gold} />
                <Text style={styles.editTextSmall}>EDIT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtnSmall}
                onPress={async () => {
                  Alert.alert('Delete Asset', 'Remove this item for good?', [
                    { text: 'CANCEL', style: 'cancel' },
                    { text: 'DELETE', style: 'destructive', onPress: async () => {
                      try {
                        await api.delete(`/garments/${id}`);
                        safeBack('/(tabs)/shop');
                      } catch { Alert.alert('Error', 'De-listing failed.'); }
                    }}
                  ]);
                }}
              >
                <Text style={styles.deleteTextSmall}>DE-LIST</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.buyRow}>
          {priceData.isSale ? (
            <Button
              title={isOwner ? "OWNED BY YOU" : (buying ? "PREPARING..." : `BUY NOW · ${priceData.displayPrice}`)}
              onPress={handleBuyNow}
              style={{ flex: 1 }}
              disabled={Boolean(isOwner) || buying}
            />
          ) : priceData.isRental ? (
            <Button
              title={isOwner ? "OWNED BY YOU" : `RESERVE RENTAL · ${priceData.displayPrice}`}
              onPress={() => router.push(`/(tabs)/rental/${id}`)}
              style={{ flex: 1 }}
              disabled={Boolean(isOwner)}
            />
          ) : (
            <Button
              title={isOwner ? "OWNED BY YOU" : "START ACCESSORY SWAP"}
              onPress={() => router.push(`/(tabs)/swap/${id}`)}
              style={{ flex: 1 }}
              disabled={Boolean(isOwner)}
            />
          )}
        </View>
      </View>

      {/* Seller Listing Telemetry & Insights Modal */}
      <ListingInsightsModal
        visible={insightsModalVisible}
        garmentId={id as string}
        onClose={() => setInsightsModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  imageContainer: {
    width: width,
    height: width * 1.2,
    position: 'relative',
    backgroundColor: colors.bgCard,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paperGlass,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  wishlistButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paperGlass,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  brand: {
    color: colors.crimson,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '800',
    marginBottom: 2,
    textTransform: 'uppercase',
      fontFamily: typography.bodyBold,
  },
  categoryLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontFamily: typography.headings,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    lineHeight: 30,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
      fontFamily: typography.bodyBold,
  },
  swapPrice: {
    color: colors.crimson,
    fontSize: 18,
    fontFamily: typography.mono,
    letterSpacing: 0.5,
  },
  priceUnitText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
      fontFamily: typography.bodyMedium,
  },
  originalPrice: {
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    marginTop: 2,
      fontFamily: typography.body,
  },
  discountTagBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.crimsonLight,
  },
  discountTagText: {
    fontSize: 13,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    color: colors.crimson,
  },
  swapDiscountBadge: {
    backgroundColor: colors.goldLight,
  },
  swapDiscountText: {
    color: colors.goldDark,
  },
  subtextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    backgroundColor: colors.overlayLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  subtextText: {
    fontSize: 13,
    color: colors.textSecond,
    fontFamily: typography.handwritten,
    includeFontPadding: false,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  infoSection: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '800',
    marginBottom: 12,
      fontFamily: typography.bodyBold,
  },
  description: {
    color: colors.textSecond,
    fontSize: 15,
    lineHeight: 24,
      fontFamily: typography.body,
  },
  sellerTrust: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sellerTrustTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.8,
      fontFamily: typography.bodyBold,
  },
  sellerTrustSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
      fontFamily: typography.body,
  },
  actionGrid: {
    marginBottom: 40,
  },
  swapNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.crimsonLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.crimsonLight,
  },
  rentalNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.emeraldLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.emeraldLight,
  },
  noticeTitle: {
    fontSize: 13,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    color: colors.crimson,
  },
  noticeDesc: {
    fontSize: 12,
    color: colors.textSecond,
    marginTop: 4,
    lineHeight: 17,
      fontFamily: typography.body,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  buyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  messageSellerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.crimson,
    backgroundColor: colors.crimsonLight,
    marginBottom: 20,
  },
  messageSellerText: {
    color: colors.crimson,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
      fontFamily: typography.bodyBold,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  aiDoubtButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.goldLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldLight,
  },
  aiDoubtText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
      fontFamily: typography.bodyBold,
  },
  listingManagerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.overlayLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.overlayLight,
  },
  managerText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.textMuted,
  },
  editBtnSmall: {
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editTextSmall: {
    color: colors.gold,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
  },
  deleteBtnSmall: {
    backgroundColor: colors.crimsonLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteTextSmall: {
    color: colors.crimson,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
  },
  saleInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.emeraldLight,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.emeraldLight,
  },
  saleInfoText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
      fontFamily: typography.bodyBold,
  },
  saleInfoSub: {
    color: colors.textSecond,
    fontSize: 11,
    marginTop: 2,
      fontFamily: typography.body,
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  specItem: {
    width: '48%',
    backgroundColor: colors.overlayLight,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.overlayLight,
  },
  specLabel: {
    fontSize: 13,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    color: colors.textMuted,
    marginBottom: 4,
  },
  specValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '700',
    lineHeight: 16,
      fontFamily: typography.bodyBold,
  },
  zoomHintBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: colors.overlay,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  zoomHintText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: typography.handBold,
    includeFontPadding: false,
  },
  thumbScroll: {
    backgroundColor: colors.bgCard,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumbContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },
  thumbButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbButtonActive: {
    borderColor: colors.crimson,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  zoomModalBackdrop: {
    flex: 1,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeZoomBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    backgroundColor: colors.overlayLight,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImageContainer: {
    width: width,
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomFullImage: {
    width: width * 0.95,
    height: '100%',
  },
  sellerTelemetryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.goldLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  sellerBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sellerCrownBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.goldLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerBannerTitle: {
    color: colors.gold,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
  },
  sellerBannerSub: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 11,
    marginTop: 1,
  },
  sellerBannerAction: {
    paddingLeft: 8,
  },
  sellerBannerActionText: {
    color: colors.gold,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
  },
  insightsBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.goldLight,
  },
  insightsTextSmall: {
    color: colors.gold,
    fontSize: 13,
    fontFamily: typography.handBold,
    includeFontPadding: false,
  },
});
