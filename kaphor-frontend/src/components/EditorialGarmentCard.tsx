import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { KaphorImage } from './KaphorImage';
import { EditorialIcon, IllustrationLayer } from './editorial/IllustrationLayer';
import { colors, typography } from '../theme';
import { hapticFeedback } from '../utils/haptics';
import api from '../services/api';

export interface EditorialGarmentCardProps {
  item: {
    id: string;
    title: string;
    brand?: string | null;
    category?: string | null;
    subCategory?: string | null;
    price?: number | null;
    size?: string | null;
    condition?: string | null;
    images?: string[] | null;
    isLiked?: boolean;
    [key: string]: any;
  };
  onPress: () => void;
  onBuyRequest?: () => void;
  style?: ViewStyle;
  imageAspectRatio?: number;
}

function formatCurrency(amount?: number | null): string {
  if (!amount || amount <= 0) return '0';
  return Math.round(amount).toLocaleString('en-IN');
}

function EditorialGarmentCardImpl({
  item,
  onPress,
  onBuyRequest,
  style,
  imageAspectRatio = 0.85,
}: EditorialGarmentCardProps) {
  const [isLiked, setIsLiked] = useState<boolean>(Boolean(item.isLiked));
  // Keep the latest handlers in refs so the memo comparer can ignore inline closures
  const onPressRef = useRef(onPress);
  const onBuyRef = useRef(onBuyRequest);
  onPressRef.current = onPress;
  onBuyRef.current = onBuyRequest;
  const handlePress = useCallback(() => onPressRef.current?.(), []);
  const handleBuy = useCallback((e: any) => {
    e.stopPropagation();
    hapticFeedback.light();
    onBuyRef.current?.();
  }, []);
  useEffect(() => {
    setIsLiked(Boolean(item.isLiked));
  }, [item.isLiked]);
  const price = item.price ? Math.round(item.price) : 0;
  const rawOriginal = item.originalPrice ? Math.round(Number(item.originalPrice)) : (item.costPrice ? Math.round(Number(item.costPrice)) : 0);
  const estimatedOriginal = rawOriginal > price
    ? rawOriginal
    : (price > 0 ? Math.round(price * 1.65) : 0);
  const discountPercent =
    estimatedOriginal > price ? Math.round(((estimatedOriginal - price) / estimatedOriginal) * 100) : 0;

  const handleToggleLike = useCallback(async (e: any) => {
    e.stopPropagation();
    hapticFeedback.selection();
    const nextState = !isLiked;
    setIsLiked(nextState);

    try {
      await api.post('/interactions', {
        garmentId: item.id,
        eventType: 'WISHLIST',
      });
    } catch (err) {
      setIsLiked(!nextState);
      console.error('Failed to toggle wishlist item', err);
    }
  }, [isLiked, item.id]);

  return (
    <TouchableOpacity
      style={[styles.garmentCard, style]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <View style={[styles.garmentImageWrap, { aspectRatio: imageAspectRatio }]}>
        <KaphorImage
          uri={item.images?.[0]}
          brand={item.brand}
          category={item.category}
          style={styles.garmentImage}
          contentFit="cover"
          width={typeof (style as any)?.width === 'number' ? (style as any).width : 220}
          recyclingKey={item.id}
        />

        <View style={styles.conditionPill}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.conditionPillText}>
            {item.condition ? item.condition.replace('_', ' ').toUpperCase() : 'PRISTINE'}
          </Text>
        </View>

        {/* Heart / Wishlist Button (Stops Propagation to prevent opening product details) */}
        <TouchableOpacity
          style={styles.wishlistBtn}
          onPress={handleToggleLike}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.8}
        >
          <EditorialIcon name={isLiked ? 'heartFilled' : 'heart'} size={18} tintColor={isLiked ? colors.red : colors.ink} />
        </TouchableOpacity>
      </View>

      <View style={styles.garmentInfo}>
        <IllustrationLayer variant="card" />
        <View style={styles.garmentMetaRow}>
          <Text style={styles.garmentBrand} numberOfLines={1}>
            {(item.brand || 'KAPHOR').toUpperCase()}
          </Text>
          <Text style={styles.garmentSize}>SIZE {item.size || 'M'}</Text>
        </View>

        <Text style={styles.garmentTitle} numberOfLines={1}>
          {item.title}
        </Text>

        <View style={styles.garmentPriceRow}>
          <View>
            <View style={styles.priceWithDiscountRow}>
              <Text style={styles.garmentPrice}>₹{formatCurrency(price)}</Text>
              {discountPercent > 0 && (
                <View style={styles.discountBadge}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.discountBadgeText}>-{discountPercent}%</Text>
                </View>
              )}
            </View>
            {estimatedOriginal > price && (
              <Text style={styles.garmentOriginalPrice}>
                MRP ₹{formatCurrency(estimatedOriginal)}
              </Text>
            )}
          </View>

          {onBuyRequest && (
            <TouchableOpacity
              style={styles.quickBuyBtn}
              onPress={handleBuy}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <EditorialIcon name="bag" size={22} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function areEqual(prev: EditorialGarmentCardProps, next: EditorialGarmentCardProps): boolean {
  const a = prev.item;
  const b = next.item;
  return (
    a.id === b.id &&
    a.updatedAt === b.updatedAt &&
    Boolean(a.isLiked) === Boolean(b.isLiked) &&
    a.price === b.price &&
    a.title === b.title &&
    a.condition === b.condition &&
    a.images?.[0] === b.images?.[0] &&
    Boolean(prev.onBuyRequest) === Boolean(next.onBuyRequest) &&
    prev.style === next.style &&
    prev.imageAspectRatio === next.imageAspectRatio
  );
}

export const EditorialGarmentCard = React.memo(EditorialGarmentCardImpl, areEqual);

const styles = StyleSheet.create({
  garmentCard: {
    width: 220,
    marginRight: 14,
    backgroundColor: colors.paperLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  garmentImageWrap: {
    width: '100%',
    aspectRatio: 0.85,
    backgroundColor: colors.paper,
    position: 'relative',
  },
  garmentImage: {
    width: '100%',
    height: '100%',
  },
  conditionPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: colors.paperGlass,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 3,
  },
  conditionPillText: {
    color: colors.charcoal,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 9.5,
  },
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.paperGlass,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  garmentInfo: {
    padding: 10,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.paperLight,
  },
  garmentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 6,
  },
  garmentBrand: {
    flex: 1,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11.5,
    color: colors.charcoal,
  },
  garmentSize: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 10.5,
    color: colors.textMuted,
  },
  garmentTitle: {
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.charcoal,
    marginBottom: 8,
  },
  garmentPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceWithDiscountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  garmentPrice: {
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '900',
    color: colors.charcoal,
  },
  discountBadge: {
    backgroundColor: colors.crimson,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  discountBadgeText: {
    color: colors.white,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 10,
  },
  garmentOriginalPrice: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  quickBuyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
