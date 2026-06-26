import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme';
import { KaphorImage } from './KaphorImage';

export interface PlayingCardProps {
  rank: string;
  suit: '♠' | '♥' | '♦' | '♣';
  bgColor?: string;
  productName: string;
  price: number;
  size: string;
  matchPercent?: number;
  imageUrl?: string;
  flavorText?: string;
  condition?: string;
  category?: string;
  subCategory?: string;
  onSwapRequest?: () => void;
  onAddToCart?: () => void;
  buttonText?: string;
  style?: ViewStyle;
}

export function PlayingCard({
  rank,
  suit,
  bgColor = colors.white,
  productName,
  price,
  size,
  matchPercent,
  imageUrl,
  flavorText,
  condition = "Excellent",
  category,
  subCategory,
  onSwapRequest,
  onAddToCart,
  buttonText = "Swap Request",
  style,
}: PlayingCardProps) {
  
  const isRedSuit = suit === '♥' || suit === '♦';
  const suitColor = isRedSuit ? colors.crimson : colors.charcoal;

  return (
    <View style={[styles.cardContainer, { backgroundColor: bgColor }, style]}>
      
      {/* Subtle Corner Decoration */}
      <View style={styles.cornerDecorationTop}>
        <Text style={[styles.rankText, { color: suitColor }]}>{rank}</Text>
        <Text style={[styles.suitText, { color: suitColor }]}>{suit}</Text>
      </View>

      {/* Match Badge */}
      {matchPercent !== undefined && (
        <View style={styles.matchBadge}>
          <Text style={styles.matchBadgeText}>{matchPercent}% MATCH</Text>
        </View>
      )}

      {/* Product Image */}
      <View style={styles.imageWrapper}>
        {imageUrl ? (
          <KaphorImage
            uri={imageUrl}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>NO IMAGE</Text>
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.contentContainer}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName} numberOfLines={1}>{productName}</Text>
            {(subCategory || category) && <Text style={styles.categoryText}>{(subCategory || category || '').toUpperCase()}</Text>}
          </View>
          <Text style={styles.sizeBadge}>{size}</Text>
        </View>
        
        <View style={styles.detailsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.priceText}>₹{price.toLocaleString()}</Text>
            <View style={styles.conditionTag}>
              <Text style={styles.conditionTagText}>{(condition || 'Excellent').toUpperCase()}</Text>
            </View>
          </View>

          {onAddToCart && (
            <Pressable 
              style={({ pressed }) => [styles.cartBtn, pressed && { transform: [{ scale: 0.95 }] }]} 
              onPress={(e) => {
                e.stopPropagation();
                onAddToCart();
              }}
            >
              <Ionicons name="cart" size={20} color={colors.white} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    padding: 10,
    borderRadius: 16,
    position: 'relative',
    backgroundColor: colors.white,
    // Modern SaaS Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  cornerDecorationTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    alignItems: 'center',
    zIndex: 10,
    opacity: 0.6, // Muted for UX friendliness
  },
  rankText: {
    fontFamily: typography.ranks,
    fontSize: 14,
    fontWeight: '700',
  },
  suitText: {
    fontFamily: typography.ranks,
    fontSize: 12,
    marginTop: -2,
  },
  matchBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(168, 34, 34, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 20,
  },
  matchBadgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
  },
  imageWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: '#F8FAFB',
    borderRadius: 12,
    marginTop: 20, 
    marginBottom: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%', 
    height: '100%',
  },
  placeholderImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
  },
  placeholderText: {
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontSize: 10,
  },
  contentContainer: {
    paddingHorizontal: 4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sizeBadge: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  productName: {
    fontFamily: typography.headings,
    fontSize: 16,
    color: colors.charcoal,
    flex: 1,
    marginRight: 8,
    fontWeight: '600',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  priceText: {
    fontFamily: typography.mono,
    fontSize: 15, 
    color: colors.charcoal,
    fontWeight: '800',
  },
  conditionTag: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  conditionTagText: {
    color: colors.crimson,
    fontFamily: typography.mono,
    fontSize: 8,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  cartBtn: {
    width: 32,
    height: 32,
    backgroundColor: colors.charcoal,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryText: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 2,
    letterSpacing: 1,
    fontWeight: '700',
  },
});
