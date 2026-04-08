import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle } from 'react-native';
import { colors, typography } from '../theme';

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
  style?: ViewStyle;
}

export function PlayingCard({
  rank,
  suit,
  bgColor = colors.bgCard,
  productName,
  price,
  size,
  matchPercent,
  imageUrl,
  flavorText = "that's love story energy right there",
  style,
}: PlayingCardProps) {
  
  const isRedSuit = suit === '♥' || suit === '♦';

  return (
    <View style={[styles.cardContainer, { backgroundColor: bgColor }, style]}>
      
      {/* Inner Border to simulate a playing card / dossier frame */}
      <View style={styles.innerBorder} pointerEvents="none" />

      {/* Top Left: Rank and Suit */}
      <View style={styles.topLeft}>
        <Text style={[styles.rankText, isRedSuit ? { color: colors.crimson } : { color: colors.charcoal }]}>{rank}</Text>
        <Text style={[styles.suitText, isRedSuit ? { color: colors.crimson } : { color: colors.charcoal }]}>{suit}</Text>
      </View>

      {/* Bottom Right: Inverted Rank and Suit */}
      <View style={styles.bottomRight}>
        <Text style={[styles.rankText, isRedSuit ? { color: colors.crimson } : { color: colors.charcoal }, { transform: [{ rotate: '180deg' }] }]}>{rank}</Text>
        <Text style={[styles.suitText, isRedSuit ? { color: colors.crimson } : { color: colors.charcoal }, { transform: [{ rotate: '180deg' }] }]}>{suit}</Text>
      </View>

      {/* Top Right: Match Badge */}
      {matchPercent !== undefined && (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{matchPercent}%</Text>
        </View>
      )}

      {/* Center: Image */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>NO VISUAL DATA</Text>
          </View>
        )}
      </View>

      {/* Right Edge: Flavor Text */}
      <View style={styles.flavorTextContainer}>
        <Text style={styles.flavorText}>{flavorText} ↕</Text>
      </View>

      {/* Bottom Setup */}
      <View style={styles.bottomSection}>
        <Text style={styles.productName} numberOfLines={1}>{productName}</Text>
        <View style={styles.detailsRow}>
          <View style={styles.sizeBox}>
            <Text style={styles.sizeText}>{size}</Text>
          </View>
          <Text style={styles.priceText}>₹{price.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: 200,
    height: 300,
    borderWidth: 2,
    borderColor: colors.charcoal,
    position: 'relative',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  innerBorder: {
    position: 'absolute',
    top: 6, bottom: 6, left: 6, right: 6,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.1)',
    zIndex: 2,
  },
  topLeft: {
    position: 'absolute',
    top: 12,
    left: 12,
    alignItems: 'center',
    zIndex: 10,
  },
  bottomRight: {
    position: 'absolute',
    bottom: 80, // Above the black bottom section
    right: 12,
    alignItems: 'center',
    zIndex: 10,
  },
  rankText: {
    fontFamily: typography.ranks,
    fontSize: 28,
    lineHeight: 32,
  },
  suitText: {
    fontFamily: typography.ranks,
    fontSize: 24,
    marginTop: -4,
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
    borderWidth: 2,
    borderColor: colors.cream,
  },
  badgeText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 1,
  },
  imageContainer: {
    flex: 1,
    marginTop: 20,
    marginBottom: 74, // Space for bottom section
    marginHorizontal: 32,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.bgCard, // Improved background for contain
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cream,
  },
  placeholderText: {
    fontFamily: typography.mono,
    color: 'rgba(30,31,34,0.3)',
    fontSize: 8,
    transform: [{ rotate: '-90deg' }],
    letterSpacing: 2,
  },
  flavorTextContainer: {
    position: 'absolute',
    right: -60,
    top: 140,
    transform: [{ rotate: '90deg' }],
    width: 160,
  },
  flavorText: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: 'rgba(30, 31, 34, 0.4)',
    letterSpacing: 2,
    textAlign: 'center',
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.cream,
    padding: 12,
    borderTopWidth: 2,
    borderColor: colors.charcoal,
    height: 70,
    justifyContent: 'center',
  },
  productName: {
    fontFamily: typography.headings,
    fontSize: 24,
    color: colors.charcoal,
    letterSpacing: 1,
    marginBottom: 4,
    lineHeight: 24,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sizeBox: {
    borderWidth: 1,
    borderColor: colors.red,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sizeText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.red,
    fontWeight: '800',
  },
  priceText: {
    fontFamily: typography.mono,
    fontSize: 14,
    color: colors.charcoal,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
