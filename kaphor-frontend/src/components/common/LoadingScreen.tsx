import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { colors, typography, spacing } from '../../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const CYCLE_MESSAGES = [
  'Curating your style…',
  'Sourcing rare finds…',
  'Circularizing fashion…',
  'Connecting artisans…',
  'Building your wardrobe…',
];

const PLAYING_SUITS = ['♠', '♥', '♦', '♣'];

function SuitSymbol({ suit, index }: { suit: string; index: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);
  const rotate = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      200 + index * 150,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      200 + index * 150,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
    rotate.value = withDelay(
      200 + index * 150,
      withRepeat(
        withSequence(
          withTiming(360, { duration: 3000, easing: Easing.linear }),
          withTiming(360, { duration: 0 })
        ),
        -1
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.Text style={[styles.suit, animatedStyle]}>
      {suit}
    </Animated.Text>
  );
}

function CircularArrows() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.circularContainer, animatedStyle]}>
      <Text style={styles.circularIcon}>↻</Text>
    </Animated.View>
  );
}

function ProgressBar() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 2000, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.9, { duration: 2500, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.4, { duration: 1800, easing: Easing.inOut(Easing.cubic) })
      ),
      -1
    );
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressBar, barStyle]} />
    </View>
  );
}

function DiamondGrid() {
  const cells = Array.from({ length: 12 });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % cells.length);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.diamondGrid}>
      {cells.map((_, i) => (
        <View
          key={i}
          style={[
            styles.diamondCell,
            i === activeIndex && styles.diamondCellActive,
          ]}
        />
      ))}
    </View>
  );
}

function RotatingCard() {
  const rotateY = useSharedValue(0);

  useEffect(() => {
    rotateY.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.inOut(Easing.cubic) }),
      -1
    );
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotateY.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      <View style={styles.cardFace}>
        <Text style={styles.cardSuit}>K</Text>
      </View>
    </Animated.View>
  );
}

export function LoadingScreen() {
  const [messageIndex, setMessageIndex] = useState(0);
  const fadeIn = useSharedValue(0);
  const logoScale = useSharedValue(0.8);

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.5)) });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % CYCLE_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Geometric background pattern */}
      <View style={styles.bgPattern}>
        <View style={[styles.bgLine, styles.bgLine1]} />
        <View style={[styles.bgLine, styles.bgLine2]} />
        <View style={[styles.bgLine, styles.bgLine3]} />
      </View>

      {/* Top suit row */}
      <View style={styles.suitRow}>
        {PLAYING_SUITS.map((suit, i) => (
          <SuitSymbol key={suit} suit={suit} index={i} />
        ))}
      </View>

      {/* Central brand block */}
      <View style={styles.center}>
        <Animated.View style={logoStyle}>
          <Text style={styles.brandName}>KAPHOR</Text>
          <View style={styles.brandDivider} />
          <Text style={styles.brandTagline}>CIRCULAR FASHION</Text>
        </Animated.View>

        <CircularArrows />

        <RotatingCard />

        <DiamondGrid />
      </View>

      {/* Progress bar */}
      <ProgressBar />

      {/* Cycling message */}
      <Text style={styles.message}>{CYCLE_MESSAGES[messageIndex]}</Text>

      {/* Bottom accent */}
      <View style={styles.bottomAccent}>
        <View style={styles.accentDot} />
        <View style={styles.accentLine} />
        <View style={styles.accentDot} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  // Background geometric pattern
  bgPattern: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgLine: {
    position: 'absolute',
    backgroundColor: colors.border,
    opacity: 0.06,
  },
  bgLine1: {
    width: SCREEN_W * 1.5,
    height: 1,
    transform: [{ rotate: '45deg' }],
  },
  bgLine2: {
    width: SCREEN_W * 1.5,
    height: 1,
    transform: [{ rotate: '-45deg' }],
  },
  bgLine3: {
    width: 1,
    height: SCREEN_H,
    opacity: 0.04,
  },

  // Suit row
  suitRow: {
    position: 'absolute',
    top: SCREEN_H * 0.15,
    flexDirection: 'row',
    gap: 28,
  },
  suit: {
    fontSize: 32.5,
    color: colors.crimson,
    fontFamily: typography.headings,
  },

  // Center
  center: {
    alignItems: 'center',
    gap: 20,
  },

  // Brand
  brandName: {
    fontFamily: typography.headings,
    fontSize: 68,
    color: colors.textPrimary,
    letterSpacing: 12,
    textAlign: 'center',
  },
  brandDivider: {
    width: 60,
    height: 2,
    backgroundColor: colors.crimson,
    marginVertical: 8,
    alignSelf: 'center',
  },
  brandTagline: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    color: colors.textMuted,
    letterSpacing: 4,
    textAlign: 'center',
  },

  // Circular arrows
  circularContainer: {
    marginTop: 4,
  },
  circularIcon: {
    fontSize: 37,
    color: colors.crimson,
  },

  // Rotating card
  card: {
    width: 48,
    height: 64,
    backgroundColor: colors.charcoal,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cardFace: {
    alignItems: 'center',
  },
  cardSuit: {
    fontFamily: typography.headings,
    fontSize: 32.5,
    color: colors.crimson,
  },

  // Diamond grid
  diamondGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 48,
    gap: 4,
    justifyContent: 'center',
    marginTop: 8,
  },
  diamondCell: {
    width: 8,
    height: 8,
    backgroundColor: colors.border,
    opacity: 0.15,
    transform: [{ rotate: '45deg' }],
  },
  diamondCellActive: {
    backgroundColor: colors.crimson,
    opacity: 0.8,
  },

  // Progress
  progressTrack: {
    width: 160,
    height: 2,
    backgroundColor: colors.bgMuted,
    borderRadius: 1,
    marginTop: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.crimson,
    borderRadius: 1,
  },

  // Message
  message: {
    fontFamily: typography.mono,
    fontSize: 15.5,
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: 16,
  },

  // Bottom accent
  bottomAccent: {
    position: 'absolute',
    bottom: SCREEN_H * 0.1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accentDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.crimson,
    opacity: 0.4,
  },
  accentLine: {
    width: 40,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.2,
  },
});
