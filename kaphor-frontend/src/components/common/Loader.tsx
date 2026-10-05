import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors, typography, spacing } from '../../theme';
import { KaphorMark } from './KaphorLogo';
import { SkeletonPulse } from './CardLoadingScreen';

/**
 * Loading screens for the whole app. No spinning wheels.
 *
 *  - Normal screens (shop, orders, swaps...)  → a skeleton of the page that is coming.
 *  - Work in progress (condition check, listing fill, payment) → the Kaphor mark
 *    breathing, a plain message, and step bars that show progress.
 *  - Buttons → <Spinner /> (three small pulsing dots).
 */

export type LoaderVariant =
  | 'default'
  | 'home'
  | 'shop'
  | 'product'
  | 'rental'
  | 'swap'
  | 'impact'
  | 'notifications'
  | 'studio'
  | 'cart'
  | 'order'
  | 'checkout'
  | 'seller'
  | 'confirmed'
  | 'glie'
  | 'magic_fill';

type Layout = 'detail' | 'list' | 'grid' | 'progress';

interface VariantInfo {
  message: string;
  layout: Layout;
  steps?: string[];
}

const VARIANTS: Record<LoaderVariant, VariantInfo> = {
  default: { message: 'Loading…', layout: 'list' },
  home: { message: 'Getting your feed ready…', layout: 'grid' },
  shop: { message: 'Loading the shop…', layout: 'detail' },
  product: { message: 'Loading this item…', layout: 'detail' },
  rental: { message: 'Checking rental dates…', layout: 'detail' },
  swap: { message: 'Loading swap…', layout: 'detail' },
  impact: { message: 'Adding up your impact…', layout: 'list' },
  notifications: { message: 'Loading your updates…', layout: 'list' },
  studio: { message: 'Finding tutorials…', layout: 'grid' },
  cart: { message: 'Loading…', layout: 'list' },
  order: { message: 'Loading your order…', layout: 'list' },
  seller: { message: 'Loading seller…', layout: 'detail' },
  checkout: { message: 'Getting checkout ready…', layout: 'progress' },
  confirmed: { message: 'Confirming your order…', layout: 'progress' },
  glie: {
    message: 'Checking your garment…',
    layout: 'progress',
    steps: [
      'Uploading photo',
      'Reading the fabric',
      'Looking for damage',
      'Working out the score',
      'Picking the best next step',
    ],
  },
  magic_fill: {
    message: 'Filling in your listing…',
    layout: 'progress',
    steps: [
      'Uploading photo',
      'Spotting the garment',
      'Finding brand and fabric',
      'Checking the condition',
      'Writing the details',
    ],
  },
};

interface LoaderProps {
  variant?: LoaderVariant;
  /** Small block that fits inside a screen (no full-screen background) */
  compact?: boolean;
  /** Replaces the default message */
  message?: string;
  /** Current step (0-based) for variants that have steps */
  step?: number;
}

// ── Skeleton layouts ────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <View style={styles.page}>
      <SkeletonPulse width="100%" height={300} borderRadius={4} />
      <View style={styles.block}>
        <SkeletonPulse width="70%" height={24} />
        <SkeletonPulse width="35%" height={20} style={styles.gap} />
        <SkeletonPulse width="100%" height={12} style={styles.gap} />
        <SkeletonPulse width="92%" height={12} style={styles.gapSm} />
        <SkeletonPulse width="60%" height={12} style={styles.gapSm} />
        <SkeletonPulse width="100%" height={48} borderRadius={4} style={styles.gapLg} />
      </View>
    </View>
  );
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={styles.page}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.row}>
          <SkeletonPulse width={56} height={56} borderRadius={4} />
          <View style={styles.rowText}>
            <SkeletonPulse width="65%" height={14} />
            <SkeletonPulse width="90%" height={10} style={styles.gapSm} />
            <SkeletonPulse width="40%" height={10} style={styles.gapSm} />
          </View>
        </View>
      ))}
    </View>
  );
}

function GridSkeleton({ items = 4 }: { items?: number }) {
  return (
    <View style={[styles.page, styles.grid]}>
      {Array.from({ length: items }).map((_, i) => (
        <View key={i} style={styles.gridItem}>
          <SkeletonPulse width="100%" height={170} borderRadius={4} />
          <SkeletonPulse width="75%" height={12} style={styles.gap} />
          <SkeletonPulse width="40%" height={12} style={styles.gapSm} />
        </View>
      ))}
    </View>
  );
}

// ── Progress screen (for work that takes a few seconds) ─────────────────

function Breathing({ children }: { children: React.ReactNode }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function ProgressView({
  text,
  steps,
  currentStep,
  compact,
}: {
  text: string;
  steps?: string[];
  currentStep: number;
  compact: boolean;
}) {
  return (
    <View style={compact ? styles.progressCompact : styles.progressFull}>
      <Breathing>
        <KaphorMark size={compact ? 52 : 84} />
      </Breathing>
      <Text style={[styles.message, compact && styles.messageCompact]}>{text}</Text>
      {steps ? (
        <>
          <View style={styles.stepRow}>
            {steps.map((_, i) => (
              <View key={i} style={[styles.stepBar, i <= currentStep && styles.stepBarOn]} />
            ))}
          </View>
          <Text style={styles.stepCount}>
            Step {currentStep + 1} of {steps.length}
          </Text>
        </>
      ) : (
        <Dots />
      )}
    </View>
  );
}

// ── Public components ───────────────────────────────────────────────────

export function Loader({ variant = 'default', compact = false, message, step }: LoaderProps) {
  const info = VARIANTS[variant] ?? VARIANTS.default;
  const steps = info.steps;

  // Move through the steps on a timer unless the screen controls `step`
  const [autoStep, setAutoStep] = useState(0);
  useEffect(() => {
    if (!steps || step !== undefined) return;
    const id = setInterval(() => setAutoStep((s) => Math.min(steps.length - 1, s + 1)), 2200);
    return () => clearInterval(id);
  }, [steps, step]);

  const currentStep = Math.max(0, Math.min(step ?? autoStep, (steps?.length ?? 1) - 1));
  const text = message ?? (steps ? steps[currentStep] : info.message);

  let body: React.ReactNode;
  if (info.layout === 'progress') {
    body = <ProgressView text={text} steps={steps} currentStep={currentStep} compact={compact} />;
  } else if (info.layout === 'detail') {
    body = compact ? <ListSkeleton rows={2} /> : <DetailSkeleton />;
  } else if (info.layout === 'grid') {
    body = <GridSkeleton items={compact ? 2 : 6} />;
  } else {
    body = <ListSkeleton rows={compact ? 3 : 6} />;
  }

  if (info.layout === 'progress') {
    return (
      <View
        style={compact ? undefined : styles.full}
        accessibilityRole="progressbar"
        accessibilityLabel={text}
        accessibilityLiveRegion="polite"
      >
        {body}
      </View>
    );
  }

  return (
    <View
      style={compact ? undefined : styles.fullTop}
      accessibilityRole="progressbar"
      accessibilityLabel={text}
      accessibilityLiveRegion="polite"
    >
      {body}
    </View>
  );
}

function Dot({ delay, color, size }: { delay: number; color: string; size: number }) {
  const opacity = useSharedValue(0.25);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 350 }), withTiming(0.25, { duration: 350 })),
        -1
      )
    );
  }, [delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    />
  );
}

function Dots({ color = colors.rose, size = 6 }: { color?: string; size?: number }) {
  return (
    <View style={styles.dotRow}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 220} color={color} size={size} />
      ))}
    </View>
  );
}

/**
 * Busy indicator for buttons and small spots: three pulsing dots (no spinning).
 * Works like ActivityIndicator (size 'small' | 'large' | number).
 */
export function Spinner({
  size = 'small',
  color = colors.rose,
  style,
}: {
  size?: 'small' | 'large' | number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const px = typeof size === 'number' ? size : size === 'large' ? 10 : 6;
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]} accessibilityLabel="Loading">
      <Dots color={color} size={px} />
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  fullTop: { flex: 1, backgroundColor: colors.paper },
  page: { padding: spacing.md },
  block: { paddingTop: spacing.md },
  gap: { marginTop: 14 },
  gapSm: { marginTop: 8 },
  gapLg: { marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  rowText: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '47%' },
  progressFull: { alignItems: 'center', justifyContent: 'center' },
  progressCompact: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  message: {
    marginTop: spacing.lg,
    fontFamily: typography.handSemi,
    fontSize: 18,
    color: colors.ink,
    textAlign: 'center',
  },
  messageCompact: { marginTop: spacing.md, fontSize: 16 },
  dotRow: { flexDirection: 'row', gap: 6, marginTop: spacing.md },
  stepRow: { flexDirection: 'row', gap: 6, marginTop: spacing.lg },
  stepBar: { width: 28, height: 3, borderRadius: 2, backgroundColor: colors.borderLight },
  stepBarOn: { backgroundColor: colors.rose },
  stepCount: {
    marginTop: spacing.sm,
    fontFamily: typography.handwritten,
    fontSize: 12,
    color: colors.textMuted,
  },
});
