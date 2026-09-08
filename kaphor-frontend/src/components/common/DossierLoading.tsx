import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors, typography } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');

// ══════════════════════════════════════════════════════════════════════════════
// FASHION TIPS DATABASE
// ══════════════════════════════════════════════════════════════════════════════

interface FashionTip {
  category: 'sustainability' | 'care' | 'fashion' | 'styling' | 'circular' | 'didyouknow';
  tip: string;
  source?: string;
}

const FASHION_TIPS: FashionTip[] = [
  // ── Sustainability ──────────────────────────────────────────────
  { category: 'sustainability', tip: 'Washing clothes in cold water saves up to 90% of energy used by washing machines.' },
  { category: 'sustainability', tip: 'One garment worn 10 more times reduces its carbon footprint by 30%.' },
  { category: 'sustainability', tip: 'The fashion industry produces 10% of global carbon emissions — more than aviation and shipping combined.' },
  { category: 'sustainability', tip: 'Buying second-hand saves an average of 2.5 kg of CO₂ per garment.' },
  { category: 'sustainability', tip: 'A single cotton t-shirt requires 2,700 litres of water to produce — enough for one person to drink for 2.5 years.' },
  { category: 'sustainability', tip: 'Synthetic fabrics shed microplastics with every wash — up to 700,000 fibres per load.' },

  // ── Fabric Care ─────────────────────────────────────────────────
  { category: 'care', tip: 'Store knitwear folded, not hung, to prevent stretching and shoulder bumps.' },
  { category: 'care', tip: 'Use mesh laundry bags to protect delicate fabrics like silk and lace in the wash.' },
  { category: 'care', tip: 'Air drying clothes can reduce your carbon footprint by 2,400 kg per year.' },
  { category: 'care', tip: 'Silk should be hand washed in lukewarm water with mild detergent — never wring it.' },
  { category: 'care', tip: 'Denim fades less if you wash it inside out in cold water and hang dry in shade.' },
  { category: 'care', tip: 'Leather bags last longer when stuffed with tissue paper and stored in breathable dust bags.' },

  // ── Indian Fashion Heritage ─────────────────────────────────────
  { category: 'fashion', tip: 'A handwoven Banarasi sari can take 3-6 months to weave — each piece is a work of art.' },
  { category: 'fashion', tip: 'Block printing from Jaipur dates back to the 12th century and uses natural vegetable dyes.' },
  { category: 'fashion', tip: 'Khadi is not just fabric — it symbolised India\'s independence movement and self-reliance.' },
  { category: 'fashion', tip: 'Chikankari embroidery from Lucknow involves over 36 different stitch types on a single garment.' },
  { category: 'fashion', tip: 'Ikat weaving involves tie-dyeing threads before weaving — a technique practised for over 2,000 years.' },
  { category: 'fashion', tip: 'Kanjeevaram silks use pure gold and silver zari — genuine zari tarnishes when rubbed against skin.' },

  // ── Styling ─────────────────────────────────────────────────────
  { category: 'styling', tip: 'A well-fitted blazer works for both office and evening — invest in one that fits perfectly.' },
  { category: 'styling', tip: 'Monochrome outfits elongate your silhouette and always look polished.' },
  { category: 'styling', tip: 'Layer a kurta over jeans for a modern fusion look that bridges tradition and contemporary.' },
  { category: 'styling', tip: 'Three colours is the golden rule — more than that can look chaotic.' },
  { category: 'styling', tip: 'A statement accessory can transform a simple outfit into something memorable.' },

  // ── Circular Fashion ────────────────────────────────────────────
  { category: 'circular', tip: 'Upcycling an old shirt into a tote bag saves 2,700 litres of water.' },
  { category: 'circular', tip: 'Clothing swaps can extend the life of garments by 2+ years on average.' },
  { category: 'circular', tip: 'Natural fibres like cotton and silk biodegrade in 1-5 months in soil.' },
  { category: 'circular', tip: 'Synthetic fabrics can take 200+ years to decompose in landfills.' },
  { category: 'circular', tip: 'Repairing a garment instead of replacing it saves 25-30 kg of CO₂.' },

  // ── Did You Know ────────────────────────────────────────────────
  { category: 'didyouknow', tip: 'The average garment is worn only 7 times before being discarded.' },
  { category: 'didyouknow', tip: '85% of textiles end up in landfills or incinerated each year.' },
  { category: 'didyouknow', tip: 'Recycling one tonne of cotton saves 20,000 litres of water.' },
  { category: 'didyouknow', tip: 'Organic cotton uses 91% less water than conventional cotton farming.' },
  { category: 'didyouknow', tip: 'The colour black is the most commonly discarded colour in fast fashion.' },
];

const CATEGORY_ICONS: Record<string, string> = {
  sustainability: '♻',
  care: '✦',
  fashion: '◈',
  styling: '◆',
  circular: '○',
  didyouknow: '★',
};

const CATEGORY_LABELS: Record<string, string> = {
  sustainability: 'SUSTAINABILITY',
  care: 'FABRIC CARE',
  fashion: 'HERITAGE',
  styling: 'STYLE',
  circular: 'CIRCULAR',
  didyouknow: 'DID YOU KNOW',
};

// ══════════════════════════════════════════════════════════════════════════════
// GLIE ASSESSMENT STEPS
// ══════════════════════════════════════════════════════════════════════════════

interface GLIEStep {
  label: string;
  duration: number; // ms
}

const GLIE_STEPS: GLIEStep[] = [
  { label: 'UPLOADING IMAGE', duration: 2000 },
  { label: 'ANALYSING FIBRE', duration: 3000 },
  { label: 'SCANNING CONDITION', duration: 4000 },
  { label: 'COMPUTING SCORE', duration: 2000 },
  { label: 'DETERMINING ROUTE', duration: 1500 },
];

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

const SUITS = ['♠', '♥', '♦', '♣'];

// ══════════════════════════════════════════════════════════════════════════════
// ANIMATED SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function DealingCard({ index }: { index: number }) {
  const translateY = useSharedValue(-40);
  const rotate = useSharedValue(-15 + Math.random() * 30);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    const delay = index * 250;
    translateY.value = withDelay(
      delay,
      withSequence(
        withTiming(0, { duration: 300, easing: Easing.out(Easing.back(1.5)) }),
        withTiming(0, { duration: 1200 }),
        withTiming(-20, { duration: 200, easing: Easing.in(Easing.cubic) })
      )
    );
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(1, { duration: 1200 }),
        withTiming(0, { duration: 200 })
      )
    );
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 1200 }),
        withTiming(0.8, { duration: 200 })
      )
    );
    rotate.value = withDelay(
      delay,
      withTiming(rotate.value * 0.3, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const suit = SUITS[index % 4];
  const isRed = suit === '♥' || suit === '♦';

  return (
    <Animated.View style={[styles.dealingCard, animatedStyle]}>
      <Text style={[styles.dealingCardSuit, isRed && styles.redSuit]}>{suit}</Text>
    </Animated.View>
  );
}

function MiniDealingCard({ index }: { index: number }) {
  const translateY = useSharedValue(-20);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(-10 + Math.random() * 20);

  useEffect(() => {
    const delay = index * 180;
    translateY.value = withDelay(
      delay,
      withSequence(
        withTiming(0, { duration: 250, easing: Easing.out(Easing.back(1.5)) }),
        withTiming(0, { duration: 800 }),
        withTiming(-12, { duration: 150, easing: Easing.in(Easing.cubic) })
      )
    );
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(1, { duration: 800 }),
        withTiming(0, { duration: 150 })
      )
    );
    rotate.value = withDelay(
      delay,
      withTiming(rotate.value * 0.3, { duration: 300 })
    );
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const suit = SUITS[index % 4];
  const isRed = suit === '♥' || suit === '♦';

  return (
    <Animated.View style={[styles.miniCard, animatedStyle]}>
      <Text style={[styles.miniCardSuit, isRed && styles.redSuit]}>{suit}</Text>
    </Animated.View>
  );
}

function ScanningLine() {
  const translateX = useSharedValue(-SCREEN_W);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(SCREEN_W, { duration: 2500, easing: Easing.inOut(Easing.cubic) }),
      -1
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.scanLineContainer}>
      <Animated.View style={[styles.scanLine, animatedStyle]} />
    </View>
  );
}

function DotPulse({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ),
        -1
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

function DiamondGrid() {
  const opacity = useSharedValue(0.1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.03, { duration: 2000 }),
        withTiming(0.1, { duration: 2000 })
      ),
      -1
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.diamondGrid, style]}>
      {Array.from({ length: 15 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.diamond,
            {
              left: `${(i % 5) * 24 + 3}%`,
              top: `${Math.floor(i / 5) * 30 + 5}%`,
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FASHION TIP CARD
// ══════════════════════════════════════════════════════════════════════════════

function FashionTipCard({ tip, compact = false }: { tip: FashionTip; compact?: boolean }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
    translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
    return () => {
      opacity.value = 0;
      translateY.value = 12;
    };
  }, [tip]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const icon = CATEGORY_ICONS[tip.category] || '◆';
  const label = CATEGORY_LABELS[tip.category] || 'TIP';

  if (compact) {
    return (
      <Animated.View style={[styles.tipCardCompact, animatedStyle]}>
        <View style={styles.tipHeaderCompact}>
          <Text style={styles.tipIconCompact}>{icon}</Text>
          <Text style={styles.tipLabelCompact}>{label}</Text>
        </View>
        <Text style={styles.tipTextCompact}>
          {tip.tip}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.tipCard, animatedStyle]}>
      <View style={styles.tipHeader}>
        <View style={styles.tipBadge}>
          <Text style={styles.tipIcon}>{icon}</Text>
          <Text style={styles.tipLabel}>{label}</Text>
        </View>
        <Text style={styles.tipLabelRight}>FASHION INTEL</Text>
      </View>
      <Text style={styles.tipText}>{tip.tip}</Text>
      <View style={styles.tipFooter}>
        <View style={styles.tipFooterDot} />
        <View style={styles.tipFooterLine} />
        <Text style={styles.tipFooterText}>KAPHOR CIRCULAR INTELLIGENCE</Text>
      </View>
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GLIE PROGRESS STEPS
// ══════════════════════════════════════════════════════════════════════════════

function GLIEProgressSteps({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: totalSteps }).map((_, i) => {
        const isComplete = i < currentStep;
        const isActive = i === currentStep;
        return (
          <View key={i} style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                isComplete && styles.progressDotComplete,
                isActive && styles.progressDotActive,
              ]}
            >
              {isComplete ? (
                <Text style={styles.progressCheck}>✓</Text>
              ) : isActive ? (
                <View style={styles.progressPulse} />
              ) : null}
            </View>
            <Text
              style={[
                styles.progressLabel,
                isComplete && styles.progressLabelComplete,
                isActive && styles.progressLabelActive,
              ]}
              numberOfLines={1}
            >
              {GLIE_STEPS[i]?.label || ''}
            </Text>
            {i < totalSteps - 1 && (
              <View
                style={[
                  styles.progressLine,
                  isComplete && styles.progressLineComplete,
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

type DossierVariant =
  | 'home'
  | 'shop'
  | 'rental'
  | 'swap'
  | 'impact'
  | 'notifications'
  | 'studio'
  | 'cart'
  | 'product'
  | 'order'
  | 'checkout'
  | 'seller'
  | 'confirmed'
  | 'glie'
  | 'default';

interface DossierLoadingProps {
  variant?: DossierVariant;
  compact?: boolean;
  /** GLIE-specific: show progress steps */
  glieStep?: number;
  /** GLIE-specific: total steps */
  glieTotalSteps?: number;
}

export function DossierLoading({
  variant = 'default',
  compact = false,
  glieStep,
  glieTotalSteps = GLIE_STEPS.length,
}: DossierLoadingProps) {
  const [tipIndex, setTipIndex] = useState(0);

  // Shuffle tips on mount for variety
  const shuffledTips = useMemo(() => {
    const shuffled = [...FASHION_TIPS];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // Cycle fashion tips (4 seconds each)
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % shuffledTips.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [shuffledTips]);

  const currentTip = shuffledTips[tipIndex % shuffledTips.length];

  // ── GLIE-specific loading ────────────────────────────────────────
  if (variant === 'glie') {
    const step = glieStep ?? 0;
    return (
      <View style={styles.glieContainer}>
        <ScanningLine />
        <DiamondGrid />

        {/* Card dealing animation */}
        <View style={styles.cardDealArea}>
          {[0, 1, 2, 3].map((i) => (
            <DealingCard key={i} index={i} />
          ))}
        </View>

        {/* GLIE title */}
        <Text style={styles.glieTitle}>GLIE</Text>
        <Text style={styles.glieSubtitle}>GARMENT LIFECYCLE INTELLIGENCE ENGINE</Text>

        {/* Progress steps */}
        <GLIEProgressSteps currentStep={step} totalSteps={glieTotalSteps} />

        {/* Fashion tip card */}
        <FashionTipCard tip={currentTip} />

        {/* Dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <DotPulse key={i} delay={i * 300} />
          ))}
        </View>
      </View>
    );
  }

  // ── Compact mode ──────────────────────────────────────────────────
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.miniCardDealArea}>
          {[0, 1, 2, 3].map((i) => (
            <MiniDealingCard key={i} index={i} />
          ))}
        </View>

        {/* Fashion tip */}
        <FashionTipCard tip={currentTip} compact />

        {/* Dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <DotPulse key={i} delay={i * 300} />
          ))}
        </View>
      </View>
    );
  }

  // ── Full mode ─────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScanningLine />
      <DiamondGrid />

      {/* Card dealing animation */}
      <View style={styles.cardDealArea}>
        {[0, 1, 2, 3].map((i) => (
          <DealingCard key={i} index={i} />
        ))}
      </View>

      {/* Fashion tip card */}
      <FashionTipCard tip={currentTip} />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {[0, 1, 2].map((i) => (
          <DotPulse key={i} delay={i * 300} />
        ))}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // ── Full mode ──────────────────────────────────────────────────
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cream,
    gap: 16,
    padding: 20,
  },

  // ── GLIE mode ──────────────────────────────────────────────────
  glieContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cream,
    gap: 14,
    padding: 20,
  },
  glieTitle: {
    fontFamily: typography.headings,
    fontSize: 48,
    color: colors.charcoal,
    letterSpacing: 8,
    marginTop: 8,
  },
  glieSubtitle: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: 4,
  },

  // ── Compact mode ───────────────────────────────────────────────
  compactContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 12,
  },

  // ── Card dealing (full) ────────────────────────────────────────
  cardDealArea: {
    flexDirection: 'row',
    gap: 12,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealingCard: {
    width: 52,
    height: 72,
    backgroundColor: colors.charcoal,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  dealingCardSuit: {
    fontSize: 24,
    color: colors.cream,
    fontFamily: typography.headings,
  },

  // ── Mini card dealing (compact) ────────────────────────────────
  miniCardDealArea: {
    flexDirection: 'row',
    gap: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCard: {
    width: 34,
    height: 48,
    backgroundColor: colors.charcoal,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  miniCardSuit: {
    fontSize: 16,
    color: colors.cream,
    fontFamily: typography.headings,
  },
  redSuit: {
    color: colors.red,
  },

  // ── Fashion tip card ───────────────────────────────────────────
  tipCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 16,
    width: '100%',
    maxWidth: 340,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  tipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tipIcon: {
    fontSize: 10,
    color: colors.cream,
  },
  tipLabel: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 1.5,
  },
  tipLabelRight: {
    fontFamily: typography.mono,
    fontSize: 7,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  tipText: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 20,
    marginBottom: 12,
  },
  tipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipFooterDot: {
    width: 4,
    height: 4,
    backgroundColor: colors.red,
    borderRadius: 2,
  },
  tipFooterLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.charcoal,
    opacity: 0.2,
  },
  tipFooterText: {
    fontFamily: typography.mono,
    fontSize: 6,
    color: colors.textMuted,
    letterSpacing: 1,
  },

  // ── Compact tip card ───────────────────────────────────────────
  tipCardCompact: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 10,
    width: '100%',
    maxWidth: 280,
  },
  tipHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  tipIconCompact: {
    fontSize: 8,
    color: colors.red,
  },
  tipLabelCompact: {
    fontFamily: typography.mono,
    fontSize: 7,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  tipTextCompact: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.charcoal,
    lineHeight: 16,
  },

  // ── GLIE progress steps ────────────────────────────────────────
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 340,
    paddingHorizontal: 8,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotComplete: {
    backgroundColor: colors.charcoal,
  },
  progressDotActive: {
    borderColor: colors.red,
    backgroundColor: colors.white,
  },
  progressCheck: {
    fontSize: 10,
    color: colors.cream,
    fontWeight: '900',
  },
  progressPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  progressLabel: {
    fontFamily: typography.mono,
    fontSize: 7,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginLeft: 6,
    flex: 1,
  },
  progressLabelComplete: {
    color: colors.charcoal,
    fontWeight: '800',
  },
  progressLabelActive: {
    color: colors.red,
    fontWeight: '800',
  },
  progressLine: {
    width: 12,
    height: 1,
    backgroundColor: colors.charcoal,
    opacity: 0.2,
    marginHorizontal: 4,
  },
  progressLineComplete: {
    backgroundColor: colors.charcoal,
    opacity: 1,
  },

  // ── Scan line ──────────────────────────────────────────────────
  scanLineContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    overflow: 'hidden',
  },
  scanLine: {
    width: SCREEN_W * 0.4,
    height: 2,
    backgroundColor: colors.red,
    opacity: 0.6,
  },

  // ── Diamond grid background ────────────────────────────────────
  diamondGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  diamond: {
    position: 'absolute',
    width: 10,
    height: 10,
    backgroundColor: colors.red,
    transform: [{ rotate: '45deg' }],
  },

  // ── Dots ───────────────────────────────────────────────────────
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.red,
  },
});
