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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkeletonPulse, OrderCardsLoading, GarmentGridSkeleton } from './CardLoadingScreen';

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

export type LoaderLayout =
  | 'detail'
  | 'list'
  | 'grid'
  | 'garments'
  | 'orders'
  | 'form'
  | 'stats'
  | 'reviews'
  | 'profile'
  | 'progress';
type Layout = LoaderLayout;

interface VariantInfo {
  message: string;
  layout: Layout;
  steps?: string[];
}

const VARIANTS: Record<LoaderVariant, VariantInfo> = {
  default: { message: 'Loading…', layout: 'list' },
  home: { message: 'Getting your feed ready…', layout: 'garments' },
  shop: { message: 'Loading the shop…', layout: 'detail' },
  product: { message: 'Loading this item…', layout: 'detail' },
  rental: { message: 'Checking rental dates…', layout: 'detail' },
  swap: { message: 'Loading swap…', layout: 'detail' },
  impact: { message: 'Adding up your impact…', layout: 'stats' },
  notifications: { message: 'Loading your updates…', layout: 'list' },
  studio: { message: 'Finding tutorials…', layout: 'grid' },
  cart: { message: 'Loading…', layout: 'list' },
  order: { message: 'Loading your order…', layout: 'orders' },
  seller: { message: 'Loading seller…', layout: 'profile' },
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
  /** Overrides the skeleton shape of the variant */
  layout?: LoaderLayout;
  /** Current step (0-based) for variants that have steps */
  step?: number;
}

// ── Skeleton layouts ────────────────────────────────────────────────────
// Each one mirrors the real screen it stands in for (header, hero, rows, bottom bar).

/** Top bar placeholder: back arrow, centered title, one action */
function HeaderSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.headerBar, { paddingTop: Math.max(insets.top + 8, 24) }]}>
      <SkeletonPulse width={28} height={28} borderRadius={14} />
      <SkeletonPulse width={140} height={18} borderRadius={3} />
      <SkeletonPulse width={28} height={28} borderRadius={14} />
    </View>
  );
}

function DetailSkeleton({ withHeader }: { withHeader: boolean }) {
  return (
    <View style={styles.fill}>
      {withHeader && <HeaderSkeleton />}
      <View style={styles.fill}>
        <SkeletonPulse width="100%" height={340} borderRadius={0} />
        <View style={styles.page}>
          <View style={styles.spread}>
            <SkeletonPulse width="55%" height={22} />
            <SkeletonPulse width={64} height={22} />
          </View>
          <SkeletonPulse width="35%" height={12} style={styles.gapSm} />
          <View style={[styles.chips, styles.gap]}>
            <SkeletonPulse width={64} height={26} borderRadius={13} />
            <SkeletonPulse width={78} height={26} borderRadius={13} />
            <SkeletonPulse width={58} height={26} borderRadius={13} />
          </View>
          <SkeletonPulse width="100%" height={11} style={styles.gapLg} />
          <SkeletonPulse width="94%" height={11} style={styles.gapSm} />
          <SkeletonPulse width="62%" height={11} style={styles.gapSm} />
        </View>
      </View>
      <View style={styles.bottomBar}>
        <SkeletonPulse width="100%" height={48} borderRadius={4} />
      </View>
    </View>
  );
}

function ListSkeleton({ rows = 5, withHeader = false }: { rows?: number; withHeader?: boolean }) {
  return (
    <View style={styles.fill}>
      {withHeader && <HeaderSkeleton />}
      <View style={styles.page}>
        {Array.from({ length: rows }).map((_, i) => (
          <View key={i} style={styles.row}>
            <SkeletonPulse width={44} height={44} borderRadius={22} />
            <View style={styles.rowText}>
              <SkeletonPulse width="55%" height={13} />
              <SkeletonPulse width="90%" height={10} style={styles.gapSm} />
            </View>
            <SkeletonPulse width={30} height={10} />
          </View>
        ))}
      </View>
    </View>
  );
}

function GridSkeleton({ items = 4, withHeader = false }: { items?: number; withHeader?: boolean }) {
  return (
    <View style={styles.fill}>
      {withHeader && <HeaderSkeleton />}
      <View style={styles.page}>
        <SkeletonPulse width="45%" height={26} />
        <SkeletonPulse width="30%" height={12} style={[styles.gapSm, { marginBottom: 14 }]} />
        <View style={styles.grid}>
          {Array.from({ length: items }).map((_, i) => (
            <View key={i} style={styles.gridItem}>
              <SkeletonPulse width="100%" height={150} borderRadius={4} />
              <SkeletonPulse width="75%" height={12} style={styles.gap} />
              <SkeletonPulse width="40%" height={12} style={styles.gapSm} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function GarmentsSkeleton({ items = 4, withHeader = false }: { items?: number; withHeader?: boolean }) {
  return (
    <View style={styles.fill}>
      {withHeader && <HeaderSkeleton />}
      <GarmentGridSkeleton count={items} />
    </View>
  );
}

function OrdersSkeleton({ withHeader = false, count = 4 }: { withHeader?: boolean; count?: number }) {
  return (
    <View style={styles.fill}>
      {withHeader && <HeaderSkeleton />}
      <OrderCardsLoading count={count} />
    </View>
  );
}

/** Settings / identity / address style forms: label + input pairs and a save button */
function FormSkeleton({ withHeader = false }: { withHeader?: boolean }) {
  return (
    <View style={styles.fill}>
      {withHeader && <HeaderSkeleton />}
      <View style={styles.page}>
        <View style={styles.center}>
          <SkeletonPulse width={84} height={84} borderRadius={42} />
          <SkeletonPulse width={120} height={12} style={styles.gap} />
        </View>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.gapLg}>
            <SkeletonPulse width={90} height={10} />
            <SkeletonPulse width="100%" height={46} borderRadius={4} style={styles.gapSm} />
          </View>
        ))}
        <SkeletonPulse width="100%" height={48} borderRadius={4} style={styles.gapLg} />
      </View>
    </View>
  );
}

/** Impact / dashboard: hero card, metric tiles, progress rows */
function StatsSkeleton({ withHeader = false }: { withHeader?: boolean }) {
  return (
    <View style={styles.fill}>
      {withHeader && <HeaderSkeleton />}
      <View style={styles.page}>
        <SkeletonPulse width="100%" height={150} borderRadius={6} />
        <View style={[styles.chips, styles.gap]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.statTile}>
              <SkeletonPulse width={28} height={28} borderRadius={14} />
              <SkeletonPulse width="70%" height={16} style={styles.gapSm} />
              <SkeletonPulse width="50%" height={10} style={styles.gapSm} />
            </View>
          ))}
        </View>
        <SkeletonPulse width="40%" height={14} style={styles.gapLg} />
        {[0, 1, 2].map((i) => (
          <SkeletonPulse key={i} width="100%" height={56} borderRadius={4} style={styles.gap} />
        ))}
      </View>
    </View>
  );
}

/** Reviews: rating summary followed by review cards */
function ReviewsSkeleton({ withHeader = false }: { withHeader?: boolean }) {
  return (
    <View style={styles.fill}>
      {withHeader && <HeaderSkeleton />}
      <View style={styles.page}>
        <View style={styles.spread}>
          <SkeletonPulse width={72} height={56} borderRadius={4} />
          <View style={styles.rowText}>
            {[0, 1, 2].map((i) => (
              <SkeletonPulse key={i} width={`${90 - i * 20}%`} height={8} style={i ? styles.gapSm : undefined} />
            ))}
          </View>
        </View>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.reviewCard}>
            <View style={styles.row}>
              <SkeletonPulse width={36} height={36} borderRadius={18} />
              <View style={styles.rowText}>
                <SkeletonPulse width="40%" height={12} />
                <SkeletonPulse width="25%" height={10} style={styles.gapSm} />
              </View>
            </View>
            <SkeletonPulse width="100%" height={10} />
            <SkeletonPulse width="70%" height={10} style={styles.gapSm} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Seller / user profile: avatar, name, stats row, listings grid */
function ProfileSkeleton({ withHeader = false }: { withHeader?: boolean }) {
  return (
    <View style={styles.fill}>
      {withHeader && <HeaderSkeleton />}
      <View style={styles.page}>
        <View style={styles.center}>
          <SkeletonPulse width={88} height={88} borderRadius={44} />
          <SkeletonPulse width={150} height={18} style={styles.gap} />
          <SkeletonPulse width={100} height={11} style={styles.gapSm} />
        </View>
        <View style={[styles.chips, styles.gapLg, { justifyContent: 'space-around' }]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.center}>
              <SkeletonPulse width={36} height={18} />
              <SkeletonPulse width={52} height={10} style={styles.gapSm} />
            </View>
          ))}
        </View>
        <View style={[styles.grid, styles.gapLg]}>
          {[0, 1].map((i) => (
            <View key={i} style={styles.gridItem}>
              <SkeletonPulse width="100%" height={150} borderRadius={4} />
              <SkeletonPulse width="70%" height={12} style={styles.gap} />
            </View>
          ))}
        </View>
      </View>
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

export function Loader({ variant = 'default', compact = false, message, step, layout: layoutOverride }: LoaderProps) {
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

  const layout = layoutOverride ?? info.layout;
  const withHeader = !compact;

  let body: React.ReactNode;
  if (layout === 'progress') {
    body = <ProgressView text={text} steps={steps} currentStep={currentStep} compact={compact} />;
  } else if (layout === 'detail') {
    body = compact ? <ListSkeleton rows={2} /> : <DetailSkeleton withHeader={withHeader} />;
  } else if (layout === 'grid') {
    body = <GridSkeleton items={compact ? 2 : 6} withHeader={withHeader} />;
  } else if (layout === 'garments') {
    body = <GarmentsSkeleton items={compact ? 2 : 6} withHeader={withHeader} />;
  } else if (layout === 'orders') {
    body = <OrdersSkeleton count={compact ? 2 : 4} withHeader={withHeader} />;
  } else if (layout === 'form') {
    body = <FormSkeleton withHeader={withHeader} />;
  } else if (layout === 'stats') {
    body = <StatsSkeleton withHeader={withHeader} />;
  } else if (layout === 'reviews') {
    body = <ReviewsSkeleton withHeader={withHeader} />;
  } else if (layout === 'profile') {
    body = <ProfileSkeleton withHeader={withHeader} />;
  } else {
    body = <ListSkeleton rows={compact ? 3 : 7} withHeader={withHeader} />;
  }

  if (layout === 'progress') {
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
  fill: { flex: 1, alignSelf: 'stretch' },
  page: { padding: spacing.md, alignSelf: 'stretch' },
  center: { alignItems: 'center' },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chips: { flexDirection: 'row', gap: 8 },
  statTile: { flex: 1, padding: 12, borderRadius: 6, backgroundColor: colors.bg },
  reviewCard: { marginTop: 18, padding: 14, borderRadius: 6, backgroundColor: colors.bg },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  bottomBar: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
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
    fontSize: 14,
    color: colors.ink,
    textAlign: 'center',
  },
  messageCompact: {
 marginTop: spacing.md, fontSize: 14, fontFamily: typography.body,
  },
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
