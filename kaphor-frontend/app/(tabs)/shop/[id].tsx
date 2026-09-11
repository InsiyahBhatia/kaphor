import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, ActivityIndicator, Alert, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../../src/components/common/Button';
import { Badge } from '../../../src/components/Badge';
import { garmentService } from '../../../src/services/garmentService';
import { Garment } from '../../../src/store/garmentStore';
import { useAuth } from '../../../src/context/AuthContext';
import api from '../../../src/services/api';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { orderService } from '../../../src/services/orderService';
import { cartService } from '../../../src/services/cartService';
import { messageService } from '../../../src/services/messageService';
import { VerifiedBadge } from '../../../src/components/common/VerifiedBadge';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { hapticFeedback } from '../../../src/utils/haptics';

const { width } = Dimensions.get('window');

export default function GarmentDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
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

  useEffect(() => {
    if (id) {
      loadGarment();
    }
  }, [id]);

  const loadGarment = async () => {
    setLoading(true);
    try {
      const data = await garmentService.getGarmentById(id as string);
      setGarment(data);
      setIsLiked(data.isLiked || false);
    } catch (error) {
      console.error('Failed to load garment', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!id) return;
    hapticFeedback.light();
    setAddingToCart(true);
    try {
      await cartService.addToCart(id as string);
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
    try {
      router.push({
        pathname: '/(tabs)/shop/checkout/delivery',
        params: {
          garmentId: id as string,
          price: String(garment.price || 0),
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

  const handleMessageSeller = handleStartInquiry;

  const handleToggleLike = async () => {
    if (!id || togglingLike) return;
    hapticFeedback.selection();
    setTogglingLike(true);
    
    // Optimistic UI
    const nextState = !isLiked;
    setIsLiked(nextState);

    try {
      await api.post('/interactions', {
        garmentId: id,
        eventType: 'WISHLIST', // We use WISHLIST as "Like"
      });
      // Backend handles behaviour signal
    } catch (error) {
      // Revert if failed
      setIsLiked(!nextState);
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
        <Text style={{ color: colors.textPrimary }}>Garment not found</Text>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/shop')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={{ color: colors.crimson, marginTop: 20 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const topInset = Math.max(insets.top + 8, 48);
  const imagesList = Array.isArray(garment.images) && garment.images.length > 0 ? garment.images : [''];
  const currentImage = imagesList[activeImageIndex] || imagesList[0];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: garment?.title || 'Details' }} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <TouchableOpacity 
            activeOpacity={0.95} 
            onPress={() => setZoomVisible(true)}
            style={{ width: '100%', height: '100%' }}
          >
            <KaphorImage 
              uri={currentImage} 
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
                <KaphorImage uri={imgUri} style={styles.thumbImg} contentFit="cover" />
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
            <ScrollView
              style={{ flex: 1, width: '100%' }}
              contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <Image
                source={{ uri: currentImage }}
                style={styles.zoomFullImage}
                resizeMode="contain"
              />
            </ScrollView>
          </View>
        </Modal>

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={styles.brand}>{garment.brand || 'Kaphor Archive'}</Text>
              <Text style={styles.categoryLabel}>{garment.category?.toUpperCase() || 'GENERAL ARCHIVE'} {garment.subCategory ? `> ${garment.subCategory.toUpperCase()}` : ''}</Text>
              <Text style={styles.title}>{garment.title}</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>
                ₹{garment.listingType === 'RENTAL' 
                  ? (garment.rentalPriceDay ? (garment.rentalPriceDay / 100).toLocaleString() : '---')
                  : (garment.price ? (garment.price / 100).toLocaleString() : '---')}
                {garment.listingType === 'RENTAL' && <Text style={{ fontSize: 14 }}> / day</Text>}
              </Text>
              {garment.listingType !== 'RENTAL' && (
                <Text style={styles.originalPrice}>₹{(garment.price ? (garment.price / 100) * 2 : 0).toLocaleString()}</Text>
              )}
            </View>
          </View>

          <View style={styles.badges}>
            <Badge variant="fitScore" label="98% MATCH" />
            <Badge variant="condition" label={garment.condition || 'PRISTINE'} subType="Pristine" />
            <Badge variant="status" label="NEW RELEASE" />
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>DESCRIPTION</Text>
            <Text style={styles.description}>
              {garment.description || 'No description available for this heritage piece.'}
            </Text>

            <TouchableOpacity 
              style={styles.aiDoubtButton} 
              onPress={() => router.push({
                pathname: '/(tabs)/shop/ai-chat',
                params: { garmentId: id, initialMessage: `I have a doubt about this ${garment.title}. Can you help?` }
              })}
            >
              <Ionicons name="sparkles" size={18} color="#C9A84C" />
              <Text style={styles.aiDoubtText}>DOUBTS? ASK KAPHOR AI</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>SPECIFICATIONS</Text>
            <View style={styles.specGrid}>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>SIZE</Text>
                <Text style={styles.specValue}>{garment.size || 'N/A'}</Text>
              </View>
              <View style={styles.specItem}>
                <Text style={styles.specLabel}>CATEGORY</Text>
                <Text style={styles.specValue}>{garment.category?.toUpperCase() || 'GENERAL'}</Text>
              </View>
              {garment.fabric && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>FABRIC</Text>
                  <Text style={styles.specValue}>{garment.fabric}</Text>
                </View>
              )}
              {garment.color && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>COLOR</Text>
                  <Text style={styles.specValue}>{Array.isArray(garment.color) ? garment.color.join(', ') : garment.color}</Text>
                </View>
              )}
              {garment.style && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>STYLE</Text>
                  <Text style={styles.specValue}>{garment.style}</Text>
                </View>
              )}
              {garment.sleeve && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>SLEEVE</Text>
                  <Text style={styles.specValue}>{garment.sleeve}</Text>
                </View>
              )}
              {garment.shape && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>SHAPE</Text>
                  <Text style={styles.specValue}>{garment.shape}</Text>
                </View>
              )}
              {garment.pattern && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>PATTERN</Text>
                  <Text style={styles.specValue}>{garment.pattern}</Text>
                </View>
              )}
              {garment.weight && (
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>WEIGHT</Text>
                  <Text style={styles.specValue}>{garment.weight}</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.sellerTrust}
            onPress={() => router.push(`/(tabs)/shop/seller/${garment.seller?.id ?? garment.sellerId}`)}
            activeOpacity={0.85}
          >
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.crimson} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sellerTrustTitle}>SELLER PROFILE & REVIEWS</Text>
                {garment.seller?.isVerified && <VerifiedBadge size="compact" />}
              </View>
              <Text style={styles.sellerTrustSub}>
                {garment.seller?.displayName ?? 'Seller'} · peer ratings from completed sales
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* MESSAGE SELLER CTA */}
          <TouchableOpacity 
            style={styles.messageSellerBtn} 
            onPress={handleMessageSeller}
            disabled={startingInquiry}
          >
            {startingInquiry ? (
              <ActivityIndicator size="small" color={colors.crimson} />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.crimson} />
                <Text style={styles.messageSellerText}>MESSAGE SELLER ABOUT DEAL</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.actionGrid}>
            {(garment.listingType === 'RENTAL' || garment.listingType === 'ACCESSORY_SWAP') && (
              <TouchableOpacity 
                style={styles.actionCard}
                onPress={() => router.push('/(tabs)/swap')}
              >
                <Ionicons name="repeat" size={24} color={colors.crimson} />
                <Text style={styles.actionTitle}>SWAP</Text>
                <Text style={styles.actionDesc}>Exchange for items</Text>
              </TouchableOpacity>
            )}
            
            {garment.listingType === 'RENTAL' && (
              <TouchableOpacity 
                style={styles.actionCard} 
                onPress={() => router.push(`/(tabs)/rental/${id}`)}
              >
                <Ionicons name="calendar-outline" size={24} color={colors.crimson} />
                <Text style={styles.actionTitle}>RENT</Text>
                <Text style={styles.actionDesc}>₹{garment.rentalPriceDay ? (garment.rentalPriceDay / 100).toLocaleString() : '---'} / day</Text>
              </TouchableOpacity>
            )}

            {garment.listingType === 'SALE' && (
               <View style={styles.saleInfoCard}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.success} />
                  <Text style={styles.saleInfoText}>AUTHENTICATED SALE · FULL OWNERSHIP</Text>
               </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {garment && user && (garment.sellerId === user.id || user.role === 'ADMIN') && (
          <View style={styles.listingManagerBar}>
            <Text style={styles.managerText}>YOU ARE MANAGING THIS ASSET</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
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
                  Alert.alert('Delete Asset', 'Confirm permanent removal from the deck?', [
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
          {garment.listingType?.toUpperCase() === 'SALE' ? (
            <>
              <TouchableOpacity
                style={styles.cartButton}
                onPress={handleAddToCart}
                disabled={addingToCart || (garment.sellerId === user?.id)}
              >
                {addingToCart ? <ActivityIndicator size="small" color={colors.crimson} /> : (
                  <Ionicons name="cart-outline" size={24} color={colors.crimson} />
                )}
              </TouchableOpacity>
              <Button
                title={garment.sellerId === user?.id ? "OWNED BY YOU" : (buying ? "PREPARING..." : "BUY NOW")}
                onPress={handleBuyNow}
                style={{ flex: 1 }}
                disabled={garment.sellerId === user?.id || buying}
              />
            </>
          ) : (garment.listingType?.toUpperCase() === 'RENTAL' || garment.listingType?.toUpperCase() === 'LEASE') ? (
            <Button
              title="BOOK RENTAL"
              onPress={() => router.push(`/(tabs)/rental/${id}`)}
              style={{ flex: 1 }}
              disabled={garment.sellerId === user?.id}
            />
          ) : (
            <Button
              title="INITIATE SWAP"
              onPress={() => router.push(`/(tabs)/swap/${id}`)}
              style={{ flex: 1 }}
              disabled={garment.sellerId === user?.id}
            />
          )}
        </View>
      </View>
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
    backgroundColor: colors.bgCard, // Neutral background for contain mode
  },
  image: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wishlistButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  brand: {
    color: colors.crimson,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '800',
    marginBottom: 2,
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
    fontSize: 32,
    fontFamily: typography.headings,
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  originalPrice: {
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  infoSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
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
    marginBottom: 24,
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
    flexDirection: 'row',
    gap: 16,
    marginBottom: 80,
  },
  actionCard: {
    flex: 1,
    height: 120,
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  actionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
  },
  actionDesc: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
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
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.crimson,
    backgroundColor: 'rgba(155, 27, 48, 0.03)',
    marginBottom: 24,
  },
  messageSellerText: {
    color: colors.crimson,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  buyButton: {
    width: '100%',
    backgroundColor: colors.crimson,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.1)',
  },
  managerText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '800',
    letterSpacing: 1,
  },
  editBtnSmall: {
    backgroundColor: 'rgba(201, 168, 76, 0.12)',
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editTextSmall: {
    color: colors.gold,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
  },
  deleteBtnSmall: {
    backgroundColor: 'rgba(155, 27, 48, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteTextSmall: {
    color: colors.crimson,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
  },
  cartButton: {
    width: 60,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.crimson,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  saleInfoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(52, 199, 89, 0.05)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.2)',
  },
  saleInfoText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
  },
  specItem: {
    width: '47%',
    backgroundColor: 'rgba(26,26,26,0.02)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.05)',
  },
  specLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  specValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  zoomHintBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
  },
  closeZoomBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomFullImage: {
    width: width,
    height: '85%',
  },
});
