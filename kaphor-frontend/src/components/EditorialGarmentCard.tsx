import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KaphorImage } from './KaphorImage';
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
  onAddToCart?: () => void;
  style?: ViewStyle;
  imageAspectRatio?: number;
}

function formatCurrency(amount?: number | null): string {
  if (!amount || amount <= 0) return '0';
  return Math.round(amount).toLocaleString('en-IN');
}

export function EditorialGarmentCard({
  item,
  onPress,
  onAddToCart,
  style,
  imageAspectRatio = 0.85,
}: EditorialGarmentCardProps) {
  const [isLiked, setIsLiked] = useState<boolean>(Boolean(item.isLiked));
  const price = item.price ? Math.round(item.price) : 0;
  const estimatedOriginal = price > 0 ? Math.round(price * 1.65) : 0;
  const discountPercent =
    estimatedOriginal > 0 ? Math.round(((estimatedOriginal - price) / estimatedOriginal) * 100) : 0;

  const handleToggleLike = async (e: any) => {
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
  };

  return (
    <TouchableOpacity
      style={[styles.garmentCard, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={[styles.garmentImageWrap, { aspectRatio: imageAspectRatio }]}>
        <KaphorImage
          uri={item.images?.[0]}
          brand={item.brand}
          category={item.category}
          style={styles.garmentImage}
          contentFit="cover"
        />

        <View style={styles.conditionPill}>
          <Text style={styles.conditionPillText}>
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
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={18}
            color={isLiked ? colors.crimson : colors.charcoal}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.garmentInfo}>
        <View style={styles.garmentMetaRow}>
          <Text style={styles.garmentBrand} numberOfLines={1}>
            {(item.brand || 'ARCHIVE ATELIER').toUpperCase()}
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
                  <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
                </View>
              )}
            </View>
            {estimatedOriginal > price && (
              <Text style={styles.garmentOriginalPrice}>
                MRP ₹{formatCurrency(estimatedOriginal)}
              </Text>
            )}
          </View>

          {onAddToCart && (
            <TouchableOpacity
              style={styles.quickAddBtn}
              onPress={(e) => {
                e.stopPropagation();
                hapticFeedback.light();
                onAddToCart();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="cart-outline" size={17} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  garmentCard: {
    width: 220,
    marginRight: 14,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  garmentImageWrap: {
    width: '100%',
    aspectRatio: 0.85,
    backgroundColor: '#F3EFE9',
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
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 3,
  },
  conditionPillText: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  garmentInfo: {
    padding: 10,
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
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.4,
  },
  garmentSize: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    fontWeight: '700',
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
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
  },
  garmentOriginalPrice: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  quickAddBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
