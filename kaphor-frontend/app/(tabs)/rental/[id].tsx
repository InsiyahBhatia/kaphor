import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Dimensions, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { garmentService } from '../../../src/services/garmentService';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';
import { KaphorImage, getCategoryFallbackImage } from '../../../src/components/KaphorImage';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { hapticFeedback } from '../../../src/utils/haptics';
import { useAuthStore } from '../../../src/store/authStore';
import { getFormattedGarmentPrice, normalizeRupees } from '../../../src/utils/priceFormatter';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function RentalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [garment, setGarment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomVisible, setZoomVisible] = useState(false);

  useBackHandler('/(tabs)/shop');

  useEffect(() => {
    (async () => {
      try {
        const data = await garmentService.getGarmentById(id as string);
        setGarment(data);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return <DossierLoading variant="rental" />;
  }

  if (!garment) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: colors.textPrimary }}>Item not found</Text>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/shop')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={{ color: colors.crimson, marginTop: 16 }}>Go Back</Text>
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

  const imagesList: string[] = rawImages.length > 0
    ? rawImages
    : [getCategoryFallbackImage(garment.category)];

  const currentImage = imagesList[activeImageIndex] || imagesList[0];

  const cleanColors = Array.isArray(garment.color)
    ? garment.color.filter((c: string) => typeof c === 'string' && c.trim().length > 0).join(', ')
    : typeof garment.color === 'string' && garment.color.trim() ? garment.color : '';

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
              <Ionicons name="scan-outline" size={13} color="#FFFFFF" />
              <Text style={styles.zoomPillText}>TAP TO ZOOM</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.backButton, { top: topInset }]} 
            onPress={() => safeBack('/(tabs)/shop')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
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
          <Text style={styles.brand}>{garment.brand || 'HERITAGE ARCHIVE'}</Text>
          <Text style={styles.title}>{garment.title}</Text>
          <Text style={styles.desc}>{garment.description || 'Curated rental asset from the Kaphor physical archive.'}</Text>

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
            <Ionicons name="sparkles" size={18} color="#C9A84C" />
            <Text style={styles.aiDoubtText}>QUESTIONS? ASK KAPHOR AI</Text>
          </TouchableOpacity>

          <View style={styles.rateCard}>
            <Text style={styles.rateTitle}>RENTAL RATES</Text>
            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>PER DAY</Text>
              <Text style={styles.rateValue}>₹{dayRate.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>PER WEEK</Text>
              <Text style={styles.rateValue}>₹{weekRate.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>SECURITY DEPOSIT</Text>
              <Text style={[styles.rateValue, { color: '#2E7D32' }]}>₹500 (100% Refundable)</Text>
            </View>
          </View>

          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>SIZE</Text>
              <Text style={styles.detailValue}>{garment.size || 'STANDARD'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>CONDITION</Text>
              <Text style={styles.detailValue}>{(garment.condition || 'PRISTINE').replace('_', ' ')}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>CATEGORY</Text>
              <Text style={styles.detailValue}>{garment.category || 'RENTAL'}</Text>
            </View>
            {garment.subCategory && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SUB-CATEGORY</Text>
                <Text style={styles.detailValue}>{garment.subCategory}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>FABRIC</Text>
              <Text style={styles.detailValue}>{garment.fabric || 'Curated Textile Blend'}</Text>
            </View>
            {cleanColors ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>COLOR</Text>
                <Text style={styles.detailValue}>{cleanColors}</Text>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>HYGIENE STANDARD</Text>
              <Text style={styles.detailValue}>Ozone Sanitized & Sealed</Text>
            </View>
          </View>

          <View style={styles.impactCard}>
            <Ionicons name="leaf" size={20} color="#2E7D32" />
            <Text style={styles.impactText}>
              Renting this piece avoids ~12kg CO2 emissions and preserves artisanal circular textiles.
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
          <TouchableOpacity 
            style={[styles.closeZoomBtn, { top: Math.max(insets.top + 10, 44) }]}
            onPress={() => setZoomVisible(false)}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={[styles.zoomInstructionWrap, { top: Math.max(insets.top + 18, 52) }]}>
            <Ionicons name="scan-outline" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={styles.zoomInstructionText}>PINCH TO ZOOM</Text>
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

      {/* Fixed Reserve Footer with Safe Insets */}
      {(() => {
        const isOwner = currentUserId && (garment.sellerId === currentUserId || garment.seller?.id === currentUserId);
        return (
          <View style={[
            styles.footer,
            {
              paddingBottom: Math.max(
                insets.bottom + 12,
                Platform.OS === 'android' ? 24 : 16
              )
            }
          ]}>
            <TouchableOpacity
              style={[styles.reserveButton, isOwner && { backgroundColor: colors.cream, borderColor: colors.charcoal, opacity: 0.7 }]}
              disabled={Boolean(isOwner)}
              onPress={() => {
                if (isOwner) return;
                hapticFeedback.heavy();
                router.push({ 
                  pathname: '/(tabs)/rental/reserve', 
                  params: { garmentId: garment.id, dayRate: String(dayRate) } 
                });
              }}
              activeOpacity={isOwner ? 1 : 0.88}
            >
              <Text style={[styles.reserveButtonText, isOwner && { color: colors.charcoal }]}>
                {isOwner ? 'YOUR LISTED ASSET' : 'RESERVE NOW'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })()}
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  zoomPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: typography.mono,
  },
  backButton: { 
    position: 'absolute', 
    top: 60, 
    left: 20, 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: 'rgba(255,255,255,0.92)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#000', 
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
  brand: { color: colors.crimson, fontSize: 12, letterSpacing: 2, fontWeight: '800' },
  title: { color: colors.textPrimary, fontSize: 32, fontFamily: 'BebasNeue_400Regular', marginTop: 4, marginBottom: 12 },
  desc: { color: colors.textSecond, fontSize: 15, lineHeight: 24, marginBottom: 20 },
  aiDoubtButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E1E1E',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C9A84C',
    marginBottom: 24,
  },
  aiDoubtText: {
    color: '#E5D5A4',
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  rateCard: { 
    backgroundColor: colors.bgCard, 
    borderRadius: 20, 
    padding: 24, 
    marginBottom: 24, 
    borderWidth: 1, 
    borderColor: colors.border, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 2 
  },
  rateTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 2, marginBottom: 20 },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  rateLabel: { color: colors.textMuted, fontSize: 12, letterSpacing: 1, fontWeight: '700' },
  rateValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  details: { marginBottom: 24 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 12, letterSpacing: 1, fontWeight: '700' },
  detailValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  impactCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, backgroundColor: 'rgba(76,175,80,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(76,175,80,0.2)', marginBottom: 24 },
  impactText: { color: '#2E7D32', fontSize: 13, flex: 1, lineHeight: 18, fontWeight: '600' },
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
  reserveButtonText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
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
});
