import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Alert, Modal, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../../src/components/common/Button';
import { Badge } from '../../../src/components/Badge';
import { garmentService } from '../../../src/services/garmentService';
import { Garment } from '../../../src/store/garmentStore';
import { useAuth } from '../../../src/context/AuthContext';
import { useAuthStore } from '../../../src/store/authStore';
import api from '../../../src/services/api';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';
import { KaphorImage, getCategoryFallbackImage } from '../../../src/components/KaphorImage';
import { cartService } from '../../../src/services/cartService';
import { messageService } from '../../../src/services/messageService';
import { VerifiedBadge } from '../../../src/components/common/VerifiedBadge';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { hapticFeedback } from '../../../src/utils/haptics';
import { getFormattedGarmentPrice } from '../../../src/utils/priceFormatter';
import { telemetryService } from '../../../src/services/telemetryService';
import { recommendationService, RecommendedGarment } from '../../../src/services/recommendationService';
import { ListingInsightsModal } from '../../../src/components/ListingInsightsModal';

const { width } = Dimensions.get('window');

export default function GarmentDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const authStoreUserId = useAuthStore((s) => s.user?.id);
  useBackHandler('/(tabs)/shop');
  const [garment, setGarment] = useState<Garment | any>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
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
    setLoading(true);
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

  const handleAddToCart = async () => {
    if (!id) return;
    hapticFeedback.light();
    setAddingToCart(true);
    try {
      await cartService.addToCart(id as string);
      telemetryService.trackAddToCart(id as string);
      Alert.alert('Success', 'Item added to your cart.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!id || !garment) return;
    hapticFeedback.medium();
    setBuying(true);
    telemetryService.trackIntent(id as string, 'PURCHASE');
    try {
      router.push({
        pathname: '/(tabs)/shop/checkout/delivery',
        params: {
          garmentId: id as string,
          price: String(priceData.numericRupees || 0),
          title: garment.title,
          image: garment.images?.[0] || '',
          brand: garment.brand || '',
        },
      });
    } catch (e: any) {
      Alert.alert('Checkout Error', e?.message || 'Could not start checkout.');
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
    return <DossierLoading variant="shop" />;
  }

  if (!garment) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: colors.textPrimary, fontFamily: typography.headings, fontSize: 20 }}>
          GARMENT NOT FOUND
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
          This asset may have been transferred or archived in another collection.
        </Text>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/shop')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginTop: 24, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.charcoal, borderRadius: 8 }}
        >
          <Text style={{ color: colors.cream, fontWeight: '700' }}>RETURN TO ARCHIVE</Text>
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
            />
            <View style={styles.zoomHintBadge}>
              <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
              <Text style={styles.zoomHintText}>TAP TO ZOOM</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.backButton, { top: topInset }]} 
            onPress={() => safeBack('/(tabs)/shop')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.charcoal} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.wishlistButton, { top: topInset }, isLiked && { backgroundColor: 'rgba(155, 27, 48, 0.1)' }]} 
            onPress={handleToggleLike}
            disabled={togglingLike}
          >
            <Ionicons 
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
            <TouchableOpacity 
              style={[styles.closeZoomBtn, { top: Math.max(insets.top + 10, 44) }]}
              onPress={() => setZoomVisible(false)}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.zoomImageContainer}>
              <KaphorImage
                uri={currentImage}
                category={garment.category}
                brand={garment.brand}
                style={styles.zoomFullImage}
                contentFit="contain"
              />
            </View>
          </View>
        </Modal>

        <View style={styles.content}>
          {/* Header Title & Pricing */}
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={styles.brand}>{garment.brand || 'KAPHOR ARCHIVE'}</Text>
              <Text style={styles.categoryLabel}>
                {(garment.category || 'ARCHIVE').toUpperCase()} {garment.subCategory ? `> ${garment.subCategory.toUpperCase()}` : ''}
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
                  <Text style={[styles.discountTagText, priceData.isSwap ? styles.swapDiscountText : null]}>
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
                  <Ionicons name="stats-chart" size={13} color={colors.gold} />
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
            <Ionicons 
              name={priceData.isSwap ? "repeat" : priceData.isRental ? "calendar-outline" : "shield-checkmark-outline"} 
              size={14} 
              color={priceData.isSwap ? colors.crimson : priceData.isRental ? "#2E7D32" : colors.charcoal} 
            />
            <Text style={styles.subtextText}>{priceData.subtext}</Text>
          </View>

          {/* Badges Bar */}
          <View style={styles.badges}>
            <Badge 
              variant={priceData.isSwap ? "condition" : priceData.isRental ? "status" : "fitScore"} 
              label={priceData.isSwap ? "CIRCULAR SWAP" : priceData.isRental ? "HERITAGE RENTAL" : "AUTHENTICATED ARCHIVE"} 
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
              {garment.description || 'Authentic heritage piece inspected and preserved in the Kaphor circular fashion archive.'}
            </Text>

            <TouchableOpacity 
              style={styles.aiDoubtButton} 
              onPress={() => router.push({
                pathname: '/(tabs)/shop/ai-chat',
                params: { garmentId: id, initialMessage: `I have questions about this ${garment.title}. Can you explain its material, styling, and condition?` }
              })}
            >
              <Ionicons name="sparkles" size={18} color="#C9A84C" />
              <Text style={styles.aiDoubtText}>DOUBTS? ASK KAPHOR AI ASSISTANT</Text>
            </TouchableOpacity>
          </View>

          {/* Rich Full Specifications Grid */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>SPECIFICATIONS & MANIFEST</Text>
            <View style={styles.specGrid}>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>BRAND</Text>
                <Text style={styles.specValue}>{garment.brand || 'Kaphor Curated Archive'}</Text>
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
                  {garment.subCategory || (garment.category === 'Jewelry' ? 'Jewelry & Accessories' : 'Curated Archive')}
                </Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>FABRIC / MATERIAL</Text>
                <Text style={styles.specValue}>
                  {garment.fabric || cleanMaterials || (garment.category === 'Jewelry' ? 'Metallic / Artisanal Alloy' : 'Premium Textile Blend')}
                </Text>
              </View>

              <View style={styles.specItem}>
                <Text style={styles.specLabel}>COLORWAY</Text>
                <Text style={styles.specValue}>{cleanColors || 'Curated Heritage Tone'}</Text>
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
                <Text style={styles.specValue}>{garment.pattern || 'Solid / Artisanal Weave'}</Text>
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
                Alert.alert('Seller Profile', 'This garment is curated directly by the Kaphor Archive.');
              }
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.crimson} />
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
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* MESSAGE SELLER CTA */}
          {!isOwner && (
            <TouchableOpacity 
              style={styles.messageSellerBtn} 
              onPress={handleStartInquiry}
              disabled={startingInquiry}
            >
              {startingInquiry ? (
                <ActivityIndicator size="small" color={colors.crimson} />
              ) : (
                <>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.crimson} />
                  <Text style={styles.messageSellerText}>MESSAGE SELLER ABOUT ITEM</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Listing Context Info Cards */}
          <View style={styles.actionGrid}>
            {priceData.isSwap && (
              <View style={styles.swapNoticeCard}>
                <Ionicons name="repeat" size={24} color={colors.crimson} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.noticeTitle}>CIRCULAR SWAP ACTIVE</Text>
                  <Text style={styles.noticeDesc}>
                    Exchange one of your owned accessories with this item without cash transaction. Escrow protected.
                  </Text>
                </View>
              </View>
            )}

            {priceData.isRental && (
              <View style={styles.rentalNoticeCard}>
                <Ionicons name="calendar-outline" size={24} color="#2E7D32" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.noticeTitle, { color: '#2E7D32' }]}>HERITAGE RENTAL AVAILABLE</Text>
                  <Text style={styles.noticeDesc}>
                    Book this piece for weddings, galas, and special occasions with doorstep hygiene care.
                  </Text>
                </View>
              </View>
            )}

            {priceData.isSale && (
              <View style={styles.saleInfoCard}>
                <Ionicons name="shield-checkmark" size={22} color={colors.success} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.saleInfoText}>AUTHENTICATED SALE · FULL OWNERSHIP</Text>
                  <Text style={styles.saleInfoSub}>
                    Direct physical dispatch with tamper-evident authentication seal.
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
                          <Image source={{ uri: item.images[0] }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        ) : (
                          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.bgMuted }]} />
                        )}
                        <View style={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          backgroundColor: 'rgba(26,26,26,0.92)',
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 2,
                        }}>
                          <Text style={{ color: colors.gold, fontFamily: typography.mono, fontSize: 8.5, fontWeight: '800' }}>
                            {item.fitScore}% SIMILAR
                          </Text>
                        </View>
                      </View>
                      <View style={{ padding: 8 }}>
                        <Text style={{ fontFamily: typography.mono, fontSize: 8.5, color: colors.textMuted }} numberOfLines={1}>
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
                <Ionicons name="stats-chart-outline" size={12} color={colors.gold} />
                <Text style={styles.insightsTextSmall}>INSIGHTS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editBtnSmall}
                onPress={() => router.push(`/(tabs)/shop/edit/${id}` as any)}
              >
                <Ionicons name="create-outline" size={12} color={colors.gold} />
                <Text style={styles.editTextSmall}>EDIT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtnSmall}
                onPress={async () => {
                  Alert.alert('Delete Asset', 'Confirm permanent removal from the archive deck?', [
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
            <>
              <TouchableOpacity
                style={styles.cartButton}
                onPress={handleAddToCart}
                disabled={addingToCart || isOwner}
              >
                {addingToCart ? (
                  <ActivityIndicator size="small" color={colors.crimson} />
                ) : (
                  <Ionicons name="cart-outline" size={24} color={colors.crimson} />
                )}
              </TouchableOpacity>
              <Button
                title={isOwner ? "OWNED BY YOU" : (buying ? "PREPARING..." : `BUY NOW · ${priceData.displayPrice}`)}
                onPress={handleBuyNow}
                style={{ flex: 1 }}
                disabled={Boolean(isOwner) || buying}
              />
            </>
          ) : priceData.isRental ? (
            <Button
              title={isOwner ? "OWNED BY YOU" : `RESERVE RENTAL · ${priceData.displayPrice}`}
              onPress={() => router.push(`/(tabs)/rental/${id}`)}
              style={{ flex: 1 }}
              disabled={Boolean(isOwner)}
            />
          ) : (
            <Button
              title={isOwner ? "OWNED BY YOU" : "INITIATE ACCESSORY SWAP"}
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
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
  },
  categoryLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.mono,
    letterSpacing: 1.5,
    fontWeight: '800',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
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
  },
  originalPrice: {
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  discountTagBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(155, 27, 48, 0.08)',
  },
  discountTagText: {
    fontSize: 9,
    fontFamily: typography.mono,
    fontWeight: '800',
    color: colors.crimson,
    letterSpacing: 0.5,
  },
  swapDiscountBadge: {
    backgroundColor: 'rgba(201, 168, 76, 0.15)',
  },
  swapDiscountText: {
    color: '#8C6F1E',
  },
  subtextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    backgroundColor: 'rgba(26,26,26,0.03)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  subtextText: {
    fontSize: 11,
    color: colors.textSecond,
    fontFamily: typography.mono,
    letterSpacing: 0.3,
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
  },
  description: {
    color: colors.textSecond,
    fontSize: 15,
    lineHeight: 24,
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
  },
  sellerTrustSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  actionGrid: {
    marginBottom: 40,
  },
  swapNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(155, 27, 48, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(155, 27, 48, 0.2)',
  },
  rentalNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46, 125, 50, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.2)',
  },
  noticeTitle: {
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: '900',
    color: colors.crimson,
    letterSpacing: 1,
  },
  noticeDesc: {
    fontSize: 12,
    color: colors.textSecond,
    marginTop: 4,
    lineHeight: 17,
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
    shadowColor: '#000',
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
    borderWidth: 1.5,
    borderColor: colors.crimson,
    backgroundColor: 'rgba(155, 27, 48, 0.03)',
    marginBottom: 20,
  },
  messageSellerText: {
    color: colors.crimson,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
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
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
  },
  aiDoubtText: {
    color: '#C9A84C',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  listingManagerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(26,26,26,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.1)',
  },
  managerText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '800',
    letterSpacing: 1,
  },
  editBtnSmall: {
    backgroundColor: 'rgba(201, 168, 76, 0.12)',
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
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
  },
  deleteBtnSmall: {
    backgroundColor: 'rgba(155, 27, 48, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteTextSmall: {
    color: colors.crimson,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
  },
  cartButton: {
    width: 54,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.crimson,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  saleInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.05)',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.2)',
  },
  saleInfoText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  saleInfoSub: {
    color: colors.textSecond,
    fontSize: 11,
    marginTop: 2,
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  specItem: {
    width: '48%',
    backgroundColor: 'rgba(26,26,26,0.02)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.06)',
  },
  specLabel: {
    fontSize: 8,
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  specValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '700',
    lineHeight: 16,
  },
  zoomHintBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  zoomHintText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: typography.mono,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    borderWidth: 1.5,
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
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeZoomBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
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
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.3)',
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
    backgroundColor: 'rgba(201, 168, 76, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerBannerTitle: {
    color: colors.gold,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
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
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  insightsBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(201, 168, 76, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.3)',
  },
  insightsTextSmall: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: typography.mono,
  },
});
