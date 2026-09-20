import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, DimensionValue, Text, ScrollView } from 'react-native';
import { colors, typography } from '../../theme';

interface SkeletonPulseProps {
  style?: any;
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
}

export function SkeletonPulse({ style, width, height, borderRadius = 3 }: SkeletonPulseProps) {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.skeletonBase,
        {
          width,
          height,
          borderRadius,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

/**
 * Message Inbox Card Loading Skeleton Screen
 * Renders multiple realistic placeholder conversation cards with avatar, title, snippet, and thumbnail.
 */
export function MessageCardsLoading({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.container}>
      <View style={styles.syncBanner}>
        <SkeletonPulse width={8} height={8} borderRadius={4} style={{ backgroundColor: colors.ink }} />
        <Text style={styles.syncText}>SYNCING ATELIER ARCHIVE...</Text>
      </View>

      {Array.from({ length: count }).map((_, idx) => (
        <View key={idx} style={styles.messageCardSkeleton}>
          {/* Avatar Skeleton */}
          <SkeletonPulse width={44} height={44} borderRadius={22} style={styles.avatarSkeleton} />

          {/* Info Lines */}
          <View style={styles.messageCardMiddle}>
            <View style={styles.rowBetween}>
              <SkeletonPulse width="42%" height={13} borderRadius={2} />
              <SkeletonPulse width={38} height={10} borderRadius={2} />
            </View>

            <View style={[styles.row, { gap: 6, marginVertical: 4 }]}>
              <SkeletonPulse width={64} height={14} borderRadius={2} />
              <SkeletonPulse width={48} height={14} borderRadius={2} />
            </View>

            <SkeletonPulse width="82%" height={11} borderRadius={2} />
          </View>

          {/* Right Thumbnail & Action Skeleton */}
          <View style={styles.messageCardRight}>
            <SkeletonPulse width={36} height={38} borderRadius={3} />
            <SkeletonPulse width={14} height={14} borderRadius={2} style={{ marginTop: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Conversation Chat Detail Loading Screen
 * Renders full chat interface skeleton with partner header, message bubbles, and bottom composer.
 */
export function ConversationChatLoading() {
  return (
    <View style={styles.chatContainer}>
      {/* Top Header Placeholder */}
      <View style={styles.chatHeaderSkeleton}>
        <SkeletonPulse width={24} height={24} borderRadius={3} />
        <SkeletonPulse width={36} height={36} borderRadius={18} />
        <View style={{ flex: 1, gap: 4 }}>
          <SkeletonPulse width={110} height={13} borderRadius={2} />
          <SkeletonPulse width={75} height={9} borderRadius={2} />
        </View>
        <SkeletonPulse width={22} height={22} borderRadius={3} />
        <SkeletonPulse width={22} height={22} borderRadius={3} />
      </View>

      {/* Transaction Top Strip Placeholder */}
      <View style={styles.chatContextStrip}>
        <SkeletonPulse width={68} height={16} borderRadius={2} />
        <SkeletonPulse width="55%" height={12} borderRadius={2} />
      </View>

      {/* Staggered Message Bubbles */}
      <View style={styles.chatMessagesArea}>
        {/* Partner Bubble */}
        <View style={[styles.bubbleWrapper, styles.bubbleLeft]}>
          <SkeletonPulse width={30} height={30} borderRadius={15} style={{ marginRight: 8 }} />
          <View style={[styles.bubbleBox, styles.bubbleBoxLeft]}>
            <SkeletonPulse width={170} height={13} borderRadius={2} style={{ marginBottom: 6 }} />
            <SkeletonPulse width={120} height={11} borderRadius={2} />
          </View>
        </View>

        {/* My Bubble */}
        <View style={[styles.bubbleWrapper, styles.bubbleRight]}>
          <View style={[styles.bubbleBox, styles.bubbleBoxRight]}>
            <SkeletonPulse width={190} height={13} borderRadius={2} style={{ marginBottom: 6 }} />
            <SkeletonPulse width={140} height={11} borderRadius={2} />
          </View>
        </View>

        {/* Partner Bubble with item preview */}
        <View style={[styles.bubbleWrapper, styles.bubbleLeft]}>
          <SkeletonPulse width={30} height={30} borderRadius={15} style={{ marginRight: 8 }} />
          <View style={[styles.bubbleBox, styles.bubbleBoxLeft, { width: 230 }]}>
            <SkeletonPulse width={200} height={85} borderRadius={3} style={{ marginBottom: 8 }} />
            <SkeletonPulse width={150} height={12} borderRadius={2} />
          </View>
        </View>

        {/* My Bubble */}
        <View style={[styles.bubbleWrapper, styles.bubbleRight]}>
          <View style={[styles.bubbleBox, styles.bubbleBoxRight, { width: 160 }]}>
            <SkeletonPulse width={130} height={12} borderRadius={2} />
          </View>
        </View>
      </View>

      {/* Bottom Composer Placeholder */}
      <View style={styles.chatInputBarSkeleton}>
        <SkeletonPulse width={30} height={30} borderRadius={3} />
        <SkeletonPulse style={{ flex: 1 }} height={36} borderRadius={3} />
        <SkeletonPulse width={36} height={36} borderRadius={3} />
      </View>
    </View>
  );
}

/**
 * Orders & Rentals Transaction Cards Loading Skeleton Screen
 */
export function OrderCardsLoading({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.container}>
      <View style={styles.syncBanner}>
        <SkeletonPulse width={8} height={8} borderRadius={4} style={{ backgroundColor: colors.ink }} />
        <Text style={styles.syncText}>LOADING TRANSACTIONS LEDGER...</Text>
      </View>

      {Array.from({ length: count }).map((_, idx) => (
        <View key={idx} style={styles.orderCardSkeleton}>
          {/* Top Status & Date Row */}
          <View style={styles.rowBetween}>
            <SkeletonPulse width={85} height={18} borderRadius={2} />
            <SkeletonPulse width={95} height={12} borderRadius={2} />
          </View>

          {/* Middle Garment & Info Row */}
          <View style={[styles.row, { gap: 12, marginVertical: 8 }]}>
            <SkeletonPulse width={64} height={70} borderRadius={3} />
            <View style={{ flex: 1, gap: 5 }}>
              <SkeletonPulse width={75} height={10} borderRadius={2} />
              <SkeletonPulse width="88%" height={14} borderRadius={2} />
              <SkeletonPulse width={60} height={16} borderRadius={2} />
            </View>
          </View>

          {/* Bottom Tracking Bar */}
          <View style={styles.orderCardBottom}>
            <SkeletonPulse width="45%" height={12} borderRadius={2} />
            <SkeletonPulse width={80} height={26} borderRadius={3} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Textile Recycling Centers Cards Loading Skeleton
 */
export function CenterCardsLoading({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.syncBanner}>
        <SkeletonPulse width={8} height={8} borderRadius={4} style={{ backgroundColor: colors.forest || '#1E3B2F' }} />
        <Text style={styles.syncText}>LOCATING VERIFIED TEXTILE HUBS...</Text>
      </View>

      {Array.from({ length: count }).map((_, idx) => (
        <View key={idx} style={styles.centerCardSkeleton}>
          {/* Top Row: Name & Recovery Score */}
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, gap: 4 }}>
              <SkeletonPulse width="65%" height={13} borderRadius={2} />
              <SkeletonPulse width="40%" height={10} borderRadius={2} />
            </View>
            <SkeletonPulse width={80} height={18} borderRadius={2} />
          </View>

          {/* Address & Hours */}
          <View style={{ gap: 5, marginVertical: 4 }}>
            <SkeletonPulse width="88%" height={10} borderRadius={2} />
            <SkeletonPulse width="50%" height={10} borderRadius={2} />
          </View>

          {/* Fibers tags */}
          <View style={[styles.row, { gap: 4, marginVertical: 2 }]}>
            <SkeletonPulse width={54} height={14} borderRadius={2} />
            <SkeletonPulse width={62} height={14} borderRadius={2} />
            <SkeletonPulse width={48} height={14} borderRadius={2} />
          </View>

          {/* Facility Details box */}
          <SkeletonPulse width="100%" height={40} borderRadius={3} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

/**
 * Editorial Clothes Card Skeleton (Matches EditorialGarmentCard layout & brutalist borders)
 */
export function GarmentCardSkeleton({
  width = 200,
  style,
}: {
  width?: DimensionValue;
  style?: any;
}) {
  return (
    <View style={[styles.garmentCardSkeleton, { width }, style]}>
      {/* Top Image Placeholder */}
      <View style={styles.garmentImageSkeletonBox}>
        <SkeletonPulse width="100%" height="100%" borderRadius={0} />
        {/* Condition pill skeleton */}
        <View style={styles.garmentPillSkeleton}>
          <SkeletonPulse width={48} height={13} borderRadius={2} />
        </View>
        {/* Heart icon skeleton */}
        <View style={styles.garmentHeartSkeleton}>
          <SkeletonPulse width={26} height={26} borderRadius={13} />
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.garmentInfoSkeleton}>
        {/* Brand & Size Row */}
        <View style={styles.rowBetween}>
          <SkeletonPulse width="55%" height={10} borderRadius={2} />
          <SkeletonPulse width={26} height={10} borderRadius={2} />
        </View>

        {/* Title Line */}
        <SkeletonPulse width="82%" height={12} borderRadius={2} style={{ marginTop: 6 }} />

        {/* Price & Quick Add Button Row */}
        <View style={[styles.rowBetween, { marginTop: 10 }]}>
          <View style={{ gap: 3 }}>
            <SkeletonPulse width={68} height={15} borderRadius={2} />
            <SkeletonPulse width={42} height={9} borderRadius={2} />
          </View>
          <SkeletonPulse width={28} height={28} borderRadius={14} />
        </View>
      </View>
    </View>
  );
}

/**
 * Horizontal Clothes Shelf Skeleton (For Home / Explore Shelves)
 */
export function GarmentShelfSkeleton({
  count = 3,
  cardWidth = 200,
}: {
  count?: number;
  cardWidth?: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.shelfScrollSkeleton}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <GarmentCardSkeleton key={idx} width={cardWidth} />
      ))}
    </ScrollView>
  );
}

/**
 * 2-Column Clothes Grid Skeleton (For Shop / Rentals / Wardrobe / Swap)
 */
export function GarmentGridSkeleton({
  count = 4,
}: {
  count?: number;
}) {
  return (
    <View style={styles.garmentGridContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <View key={idx} style={styles.garmentGridCol}>
          <GarmentCardSkeleton width="100%" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 10,
  },
  skeletonBase: {
    backgroundColor: 'rgba(20,20,20,0.12)',
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    marginBottom: 4,
  },
  syncText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Message Card Skeleton
  messageCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 4,
    padding: 10,
    gap: 10,
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 2,
  },
  avatarSkeleton: {
    borderWidth: 1,
    borderColor: 'rgba(20,20,20,0.1)',
  },
  messageCardMiddle: {
    flex: 1,
  },
  messageCardRight: {
    alignItems: 'center',
  },

  // Chat Detail Skeleton
  chatContainer: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  chatHeaderSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.ink,
  },
  chatContextStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#EFECE4',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20,20,20,0.1)',
  },
  chatMessagesArea: {
    flex: 1,
    padding: 14,
    gap: 14,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bubbleLeft: {
    justifyContent: 'flex-start',
  },
  bubbleRight: {
    justifyContent: 'flex-end',
  },
  bubbleBox: {
    padding: 12,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  bubbleBoxLeft: {
    backgroundColor: colors.white,
    borderColor: colors.ink,
  },
  bubbleBoxRight: {
    backgroundColor: '#E6E4DC',
    borderColor: colors.ink,
  },
  chatInputBarSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1.5,
    borderTopColor: colors.ink,
  },

  // Order Card Skeleton
  orderCardSkeleton: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 4,
    padding: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 2,
  },
  orderCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(20,20,20,0.08)',
    marginTop: 4,
  },
  centerCardSkeleton: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 4,
    padding: 12,
    gap: 6,
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 2,
  },

  // Garment Clothes Card Skeletons
  garmentCardSkeleton: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 2,
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  garmentImageSkeletonBox: {
    width: '100%',
    aspectRatio: 0.85,
    backgroundColor: '#ECE8DF',
    position: 'relative',
  },
  garmentPillSkeleton: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
  },
  garmentHeartSkeleton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
  },
  garmentInfoSkeleton: {
    padding: 10,
    backgroundColor: colors.white,
  },
  shelfScrollSkeleton: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 14,
  },
  garmentGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 10,
    paddingTop: 8,
    paddingBottom: 24,
  },
  garmentGridCol: {
    width: '48.5%',
  },
});
