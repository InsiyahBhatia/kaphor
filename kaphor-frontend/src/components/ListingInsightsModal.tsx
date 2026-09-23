import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { KaphorImage } from './KaphorImage';
import { colors, typography, spacing, radius } from '../theme';
import { hapticFeedback } from '../utils/haptics';
import { insightService, GarmentDetailedInsights, AdvisorTip } from '../services/insightService';

const { width } = Dimensions.get('window');

interface ListingInsightsModalProps {
  visible: boolean;
  garmentId: string | null;
  onClose: () => void;
}

export function ListingInsightsModal({ visible, garmentId, onClose }: ListingInsightsModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<GarmentDetailedInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && garmentId) {
      loadInsights(garmentId);
    } else {
      setInsights(null);
      setError(null);
    }
  }, [visible, garmentId]);

  const loadInsights = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await insightService.getGarmentInsights(id);
      setInsights(data);
    } catch (err: any) {
      console.error('Failed to load listing insights', err);
      setError(err?.response?.data?.message || 'Could not load listing insights.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPress = () => {
    if (!garmentId) return;
    hapticFeedback.light();
    onClose();
    router.push(`/(tabs)/shop/edit/${garmentId}` as any);
  };

  const getDemandColor = (tier?: string) => {
    switch (tier) {
      case 'HOT ASSET 🔥':
        return '#FF4500';
      case 'STRONG INTEREST ⭐':
        return colors.gold;
      case 'STEADY MOMENTUM 📈':
        return '#00E5FF';
      default:
        return colors.textMuted;
    }
  };

  const maxDailyViews = Math.max(1, ...(insights?.dailyTrend?.map((d) => d.views) || [1]));

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Modal Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.tagIndicator} />
            <Text style={styles.headerSub}>SELLER DOSSIER</Text>
            <Text style={styles.headerTitle}>LISTING TELEMETRY</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              hapticFeedback.light();
              onClose();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={styles.loadingText}>Synthesizing asset telemetry...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.crimson} />
            <Text style={styles.errorTitle}>Telemetry Unavailable</Text>
            <Text style={styles.errorSubtitle}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => garmentId && loadInsights(garmentId)}>
              <Text style={styles.retryBtnText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        ) : !insights ? null : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Asset Brief Banner */}
            <View style={styles.assetCard}>
              <KaphorImage uri={insights.thumbnail} style={styles.assetImage} />
              <View style={styles.assetInfo}>
                <View style={styles.brandRow}>
                  <Text style={styles.brandText} numberOfLines={1}>{insights.brand}</Text>
                  <View
                    style={[
                      styles.demandBadge,
                      { borderColor: getDemandColor(insights.demandTier) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.demandText,
                        { color: getDemandColor(insights.demandTier) },
                      ]}
                    >
                      {insights.demandTier}
                    </Text>
                  </View>
                </View>
                <Text style={styles.garmentTitle} numberOfLines={2}>{insights.title}</Text>
                <View style={styles.priceRow}>
                  {insights.price ? (
                    <Text style={styles.priceText}>₹{insights.price.toLocaleString('en-IN')}</Text>
                  ) : null}
                  {insights.rentalPriceDay ? (
                    <Text style={styles.rentalRateText}>
                      · ₹{insights.rentalPriceDay.toLocaleString('en-IN')}/day
                    </Text>
                  ) : null}
                  <Text style={styles.lifecyclePill}>{insights.lifecycleState || 'LIVE'}</Text>
                </View>
              </View>
            </View>

            {/* Core Telemetry Metric Grid */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>REAL-TIME AUDIENCE METRICS</Text>
              <Text style={styles.demandScoreText}>SCORE: {insights.demandScore}/100</Text>
            </View>

            <View style={styles.metricsGrid}>
              {/* Total Views */}
              <View style={styles.metricBox}>
                <View style={styles.metricIconRow}>
                  <Ionicons name="eye-outline" size={18} color={colors.gold} />
                  <Text style={styles.metricLabel}>TOTAL VIEWS</Text>
                </View>
                <Text style={styles.metricValue}>{insights.views}</Text>
                <Text style={styles.metricSub}>{insights.uniqueViewers} unique shoppers</Text>
              </View>

              {/* Active in Carts */}
              <View style={[styles.metricBox, insights.activeInCart > 0 && styles.activeCartHighlight]}>
                <View style={styles.metricIconRow}>
                  <Ionicons
                    name="cart-outline"
                    size={18}
                    color={insights.activeInCart > 0 ? '#00E5FF' : colors.textMuted}
                  />
                  <Text style={[styles.metricLabel, insights.activeInCart > 0 && { color: '#00E5FF' }]}>
                    IN ACTIVE CARTS
                  </Text>
                </View>
                <Text style={[styles.metricValue, insights.activeInCart > 0 && { color: '#00E5FF' }]}>
                  {insights.activeInCart}
                </Text>
                <Text style={styles.metricSub}>{insights.totalCartAdds} total adds</Text>
              </View>

              {/* Wishlists / Saves */}
              <View style={styles.metricBox}>
                <View style={styles.metricIconRow}>
                  <Ionicons name="heart-outline" size={18} color={colors.crimson} />
                  <Text style={styles.metricLabel}>SAVES / COVETS</Text>
                </View>
                <Text style={styles.metricValue}>{insights.saves}</Text>
                <Text style={styles.metricSub}>{insights.funnel.viewToSaveRate}% save rate</Text>
              </View>

              {/* Direct Inquiries */}
              <View style={styles.metricBox}>
                <View style={styles.metricIconRow}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.gold} />
                  <Text style={styles.metricLabel}>INQUIRIES</Text>
                </View>
                <Text style={styles.metricValue}>{insights.inquiries}</Text>
                <Text style={styles.metricSub}>Direct chats opened</Text>
              </View>

              {/* Checkout / Circular Intents */}
              <View style={styles.metricBox}>
                <View style={styles.metricIconRow}>
                  <Ionicons name="flash-outline" size={18} color={colors.gold} />
                  <Text style={styles.metricLabel}>INTENTS</Text>
                </View>
                <Text style={styles.metricValue}>{insights.intents.total}</Text>
                <Text style={styles.metricSub}>
                  {insights.intents.purchase} buy · {insights.intents.rental} rent
                </Text>
              </View>

              {/* Overall Conversions */}
              <View style={styles.metricBox}>
                <View style={styles.metricIconRow}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#00E676" />
                  <Text style={styles.metricLabel}>CONVERSIONS</Text>
                </View>
                <Text style={[styles.metricValue, { color: '#00E676' }]}>
                  {insights.conversions.total}
                </Text>
                <Text style={styles.metricSub}>{insights.funnel.overallConversionRate}% overall rate</Text>
              </View>
            </View>

            {/* Conversion Funnel Progress */}
            <View style={styles.funnelSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>CONVERSION FUNNEL EFFICIENCY</Text>
              </View>

              <View style={styles.funnelCard}>
                {/* Step 1: Discovery */}
                <View style={styles.funnelStep}>
                  <View style={styles.funnelHeader}>
                    <Text style={styles.stepTitle}>1. Discovery (Views)</Text>
                    <Text style={styles.stepCount}>{insights.views}</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: '100%', backgroundColor: colors.gold }]} />
                  </View>
                </View>

                {/* Step 2: Saves */}
                <View style={styles.funnelStep}>
                  <View style={styles.funnelHeader}>
                    <Text style={styles.stepTitle}>2. Wishlist / Saves</Text>
                    <Text style={styles.stepCount}>
                      {insights.saves} ({insights.funnel.viewToSaveRate}%)
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.max(4, Math.min(100, insights.funnel.viewToSaveRate))}%`,
                          backgroundColor: colors.crimson,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Step 3: In Cart */}
                <View style={styles.funnelStep}>
                  <View style={styles.funnelHeader}>
                    <Text style={styles.stepTitle}>3. Cart Additions</Text>
                    <Text style={styles.stepCount}>
                      {insights.totalCartAdds} ({insights.funnel.viewToCartRate}%)
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.max(4, Math.min(100, insights.funnel.viewToCartRate))}%`,
                          backgroundColor: '#00E5FF',
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Step 4: Conversions */}
                <View style={styles.funnelStep}>
                  <View style={styles.funnelHeader}>
                    <Text style={styles.stepTitle}>4. Completed Purchases / Leases</Text>
                    <Text style={styles.stepCount}>
                      {insights.conversions.total} ({insights.funnel.overallConversionRate}%)
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.max(4, Math.min(100, insights.funnel.overallConversionRate))}%`,
                          backgroundColor: '#00E676',
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* 7-Day Performance Activity Bar Chart */}
            <View style={styles.trendSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>7-DAY ENGAGEMENT TRAJECTORY</Text>
                <Text style={styles.trendLegend}>BAR HEIGHT = DAILY VIEWS</Text>
              </View>

              <View style={styles.chartCard}>
                <View style={styles.barsContainer}>
                  {insights.dailyTrend.map((day, idx) => {
                    const barHeightPct = Math.max(8, (day.views / maxDailyViews) * 100);
                    const dayLabel = day.date.slice(5); // MM-DD
                    return (
                      <View key={idx} style={styles.barColumn}>
                        <View style={styles.barWrapper}>
                          <View
                            style={[
                              styles.barFill,
                              { height: `${barHeightPct}%` },
                              day.views > 0 && styles.activeBar,
                            ]}
                          />
                        </View>
                        <Text style={styles.dayViewsCount}>{day.views}</Text>
                        <Text style={styles.dayLabel}>{dayLabel}</Text>
                        {day.carts > 0 && (
                          <View style={styles.cartDot} />
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* AI Listing Advisor Recommendations */}
            <View style={styles.advisorSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.aiHeaderRow}>
                  <Ionicons name="sparkles" size={16} color={colors.gold} />
                  <Text style={styles.sectionTitle}>KAPHOR AI ADVISOR INSIGHTS</Text>
                </View>
              </View>

              {insights.advisorTips.map((tip: AdvisorTip, idx: number) => (
                <View key={idx} style={styles.tipCard}>
                  <View style={styles.tipTopRow}>
                    <View style={styles.tipCategoryBadge}>
                      <Text style={styles.tipCategoryText}>{tip.category}</Text>
                    </View>
                    <View
                      style={[
                        styles.impactBadge,
                        tip.impact === 'HIGH' ? styles.highImpact : styles.mediumImpact,
                      ]}
                    >
                      <Text style={styles.impactText}>{tip.impact} IMPACT</Text>
                    </View>
                  </View>
                  <Text style={styles.tipHeadline}>{tip.headline}</Text>
                  <Text style={styles.tipDesc}>{tip.description}</Text>
                </View>
              ))}
            </View>

            {/* Quick Action Footer */}
            <View style={styles.actionFooter}>
              <TouchableOpacity style={styles.editListingBtn} onPress={handleEditPress}>
                <Ionicons name="create-outline" size={17} color={colors.bg} />
                <Text style={styles.editListingBtnText}>OPTIMIZE LISTING</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  headerLeft: {
    flex: 1,
  },
  tagIndicator: {
    width: 24,
    height: 2,
    backgroundColor: colors.gold,
    marginBottom: 4,
  },
  headerSub: {
    color: colors.gold,
    fontFamily: typography.mono,
    fontSize: 13.5,
    letterSpacing: 1.5,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontFamily: typography.headings,
    fontSize: 22,
    letterSpacing: 1,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 15.5,
    marginTop: spacing.md,
    letterSpacing: 0.5,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontFamily: typography.headings,
    fontSize: 22,
    marginTop: spacing.md,
  },
  errorSubtitle: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 17,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  retryBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
  },
  retryBtnText: {
    color: colors.bg,
    fontFamily: typography.mono,
    fontSize: 15.5,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  assetCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  assetImage: {
    width: 75,
    height: 95,
    borderRadius: radius.sm,
  },
  assetInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandText: {
    color: colors.gold,
    fontFamily: typography.mono,
    fontSize: 14.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    maxWidth: 130,
  },
  demandBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  demandText: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: 'bold',
  },
  garmentTitle: {
    color: colors.textPrimary,
    fontFamily: typography.body,
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceText: {
    color: colors.textPrimary,
    fontFamily: typography.mono,
    fontSize: 17,
    fontWeight: 'bold',
  },
  rentalRateText: {
    color: colors.gold,
    fontFamily: typography.mono,
    fontSize: 14.5,
  },
  lifecyclePill: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: colors.textSecond,
    fontFamily: typography.mono,
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 14.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  demandScoreText: {
    color: colors.gold,
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: 'bold',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  metricBox: {
    width: (width - spacing.md * 2 - spacing.sm) / 2,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  activeCartHighlight: {
    borderColor: 'rgba(0, 229, 255, 0.4)',
    backgroundColor: 'rgba(0, 229, 255, 0.04)',
  },
  metricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  metricLabel: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 13.5,
    letterSpacing: 0.5,
  },
  metricValue: {
    color: colors.textPrimary,
    fontFamily: typography.headings,
    fontSize: 28,
    fontWeight: 'bold',
  },
  metricSub: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 13.5,
    marginTop: 2,
  },
  funnelSection: {
    marginBottom: spacing.lg,
  },
  funnelCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  funnelStep: {},
  funnelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepTitle: {
    color: colors.textSecond,
    fontFamily: typography.mono,
    fontSize: 14.5,
  },
  stepCount: {
    color: colors.textPrimary,
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  trendSection: {
    marginBottom: spacing.lg,
  },
  trendLegend: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 12,
  },
  chartCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
    paddingHorizontal: 4,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    height: 70,
    width: 14,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 3,
  },
  barFill: {
    width: '100%',
    backgroundColor: 'rgba(201, 168, 76, 0.35)',
    borderRadius: 3,
  },
  activeBar: {
    backgroundColor: colors.gold,
  },
  dayViewsCount: {
    color: colors.textSecond,
    fontFamily: typography.mono,
    fontSize: 12,
    marginTop: 4,
  },
  dayLabel: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 12,
    marginTop: 2,
  },
  cartDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00E5FF',
    marginTop: 2,
  },
  advisorSection: {
    marginBottom: spacing.lg,
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.25)',
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  tipTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  tipCategoryBadge: {
    backgroundColor: 'rgba(201, 168, 76, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tipCategoryText: {
    color: colors.gold,
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: 'bold',
  },
  impactBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  highImpact: {
    backgroundColor: 'rgba(255, 69, 0, 0.15)',
  },
  mediumImpact: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  impactText: {
    color: colors.textSecond,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: 'bold',
  },
  tipHeadline: {
    color: colors.textPrimary,
    fontFamily: typography.body,
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tipDesc: {
    color: colors.textSecond,
    fontFamily: typography.body,
    fontSize: 15.5,
    lineHeight: 17,
  },
  actionFooter: {
    marginTop: spacing.md,
  },
  editListingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gold,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  editListingBtnText: {
    color: colors.bg,
    fontFamily: typography.mono,
    fontSize: 15.5,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
