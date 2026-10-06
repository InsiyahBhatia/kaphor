import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SolarIcon } from './common/SolarIcon';
import { useRouter } from 'expo-router';
import { KaphorImage } from './KaphorImage';
import { colors, typography, spacing, radius } from '../theme';
import { hapticFeedback } from '../utils/haptics';
import { insightService, GarmentDetailedInsights, AdvisorTip } from '../services/insightService';
import { Loader } from './common/Loader';
import { cleanText } from '../utils/formatText';

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
      setError('Could not load listing insights. Please try again.');
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
        return colors.error;
      case 'STRONG INTEREST ⭐':
        return colors.gold;
      case 'STEADY MOMENTUM 📈':
        return colors.teal;
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
            <Text style={styles.headerSub}>FOR SELLERS</Text>
            <Text style={styles.headerTitle}>LISTING INSIGHTS</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              hapticFeedback.light();
              onClose();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <SolarIcon name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1 }}>
            <Loader variant="default" message="Loading your listing insights..." />
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <SolarIcon name="alert-circle-outline" size={48} color={colors.crimson} />
            <Text style={styles.errorTitle}>Insights unavailable</Text>
            <Text style={styles.errorSubtitle}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => garmentId && loadInsights(garmentId)}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.retryBtnText}>RETRY</Text>
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
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.lifecyclePill}>{insights.lifecycleState || 'LIVE'}</Text>
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
                  <SolarIcon name="eye-outline" size={18} color={colors.gold} />
                  <Text style={styles.metricLabel}>TOTAL VIEWS</Text>
                </View>
                <Text style={styles.metricValue}>{insights.views}</Text>
                <Text style={styles.metricSub}>{insights.uniqueViewers} unique shoppers</Text>
              </View>

              {/* Wishlists / Saves */}
              <View style={styles.metricBox}>
                <View style={styles.metricIconRow}>
                  <SolarIcon name="heart-outline" size={18} color={colors.crimson} />
                  <Text style={styles.metricLabel}>SAVES</Text>
                </View>
                <Text style={styles.metricValue}>{insights.saves}</Text>
                <Text style={styles.metricSub}>{insights.funnel.viewToSaveRate}% save rate</Text>
              </View>

              {/* Direct Inquiries */}
              <View style={styles.metricBox}>
                <View style={styles.metricIconRow}>
                  <SolarIcon name="chatbubble-ellipses-outline" size={18} color={colors.gold} />
                  <Text style={styles.metricLabel}>INQUIRIES</Text>
                </View>
                <Text style={styles.metricValue}>{insights.inquiries}</Text>
                <Text style={styles.metricSub}>Direct chats opened</Text>
              </View>

              {/* Checkout / Circular Intents */}
              <View style={styles.metricBox}>
                <View style={styles.metricIconRow}>
                  <SolarIcon name="flash-outline" size={18} color={colors.gold} />
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
                  <SolarIcon name="checkmark-circle-outline" size={18} color={colors.success} />
                  <Text style={styles.metricLabel}>CONVERSIONS</Text>
                </View>
                <Text style={[styles.metricValue, { color: colors.success }]}>
                  {insights.conversions.total}
                </Text>
                <Text style={styles.metricSub}>{insights.funnel.overallConversionRate}% overall rate</Text>
              </View>
            </View>

            {/* Conversion Funnel Progress */}
            <View style={styles.funnelSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>FROM VIEWS TO SALES</Text>
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

                {/* Step 3: Conversions */}
                <View style={styles.funnelStep}>
                  <View style={styles.funnelHeader}>
                    <Text style={styles.stepTitle}>3. Completed Purchases / Leases</Text>
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
                          backgroundColor: colors.success,
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
                <Text style={styles.sectionTitle}>LAST 7 DAYS</Text>
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
                  <SolarIcon name="sparkles" size={16} color={colors.gold} />
                  <Text style={styles.sectionTitle}>TIPS FROM KAPHOR AI</Text>
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
                  <Text style={styles.tipHeadline}>{cleanText(tip.headline)}</Text>
                  <Text style={styles.tipDesc}>{cleanText(tip.description)}</Text>
                </View>
              ))}
            </View>

            {/* Quick Action Footer */}
            <View style={styles.actionFooter}>
              <TouchableOpacity style={styles.editListingBtn} onPress={handleEditPress}>
                <SolarIcon name="create-outline" size={17} color={colors.bg} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.editListingBtnText}>IMPROVE LISTING</Text>
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
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontFamily: typography.headings,
    fontSize: 18,
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
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 14,
    marginTop: spacing.md,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontFamily: typography.headings,
    fontSize: 18,
    marginTop: spacing.md,
  },
  errorSubtitle: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 13,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
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
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
    maxWidth: 130,
  },
  demandBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.overlay,
  },
  demandText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
  },
  garmentTitle: {
    color: colors.textPrimary,
    fontFamily: typography.body,
    fontSize: 14,
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
    fontSize: 13,
    fontWeight: 'bold',
  },
  rentalRateText: {
    color: colors.gold,
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
  },
  lifecyclePill: {
    marginLeft: 'auto',
    backgroundColor: colors.overlayLight,
    color: colors.textSecond,
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
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
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
  },
  demandScoreText: {
    color: colors.gold,
    fontFamily: typography.mono,
    fontSize: 11,
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
  metricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  metricLabel: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  metricValue: {
    color: colors.textPrimary,
    fontFamily: typography.headings,
    fontSize: 24,
    fontWeight: 'bold',
  },
  metricSub: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 10,
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
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
  },
  stepCount: {
    color: colors.textPrimary,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.overlayLight,
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
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 13,
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
    backgroundColor: colors.overlayLight,
    borderRadius: 3,
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.goldLight,
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
    borderColor: colors.goldLight,
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
    backgroundColor: colors.goldLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tipCategoryText: {
    color: colors.gold,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
  },
  impactBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  highImpact: {
    backgroundColor: colors.crimsonLight,
  },
  mediumImpact: {
    backgroundColor: colors.overlayLight,
  },
  impactText: {
    color: colors.textSecond,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
  },
  tipHeadline: {
    color: colors.textPrimary,
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tipDesc: {
    color: colors.textSecond,
    fontFamily: typography.body,
    fontSize: 12,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
  },
});
