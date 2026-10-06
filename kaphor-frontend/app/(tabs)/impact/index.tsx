import React, { useState, useCallback, useEffect } from 'react';
import { peek, remember, hydrate } from '../../../src/utils/swrCache';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SolarIcon } from '../../../src/components/common/SolarIcon';
import { colors, typography, spacing, textStyles } from '../../../src/theme';
import { impactService } from '../../../src/services/impactService';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { Loader } from '../../../src/components/common/Loader';

const { width } = Dimensions.get('window');

export default function UnifiedImpactScreen() {
  useBackHandler('/(tabs)/profile');
  const cached = peek<any>('impact:all');
  const [impactData, setImpactData] = useState<any>(cached?.imp ?? null);
  const [reportData, setReportData] = useState<any>(cached?.rep ?? null);
  const [loading, setLoading] = useState(!cached);

  // Cold start: paint the persisted copy immediately, then refresh in the background
  useEffect(() => {
    if (cached) return;
    hydrate<any>('impact:all').then((c) => {
      if (!c) return;
      setImpactData((v: any) => v ?? c.imp);
      setReportData((v: any) => v ?? c.rep);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      (async () => {
        try {
          const [imp, rep] = await Promise.all([
            impactService.getMyImpact(),
            impactService.getImpactReport().catch(() => null),
          ]);
          if (isMounted) {
            setImpactData(imp);
            setReportData(rep);
            remember('impact:all', { imp, rep });
          }
        } catch (err) {
          console.error('Failed to load impact', err);
        } finally {
          if (isMounted) setLoading(false);
        }
      })();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Loader variant="impact" compact />
      </View>
    );
  }

  const record = impactData?.impactRecord || {};
  const co2Kg = (record.carbonSavedKg || 0).toFixed(1);
  const waterKL = (((record.waterSavedL || 0) / 1000)).toFixed(1);
  const wasteKg = (((record.wasteSavedG || 0) / 1000)).toFixed(1);
  const trees = impactData?.equivalentTrees || 0;
  const itemsCirculated = record.itemsCirculated || 0;
  const tier = impactData?.tier || 'Circular citizen';
  const progressPercent = Math.min(100, Math.max(5, impactData?.progressPercentage ?? 35));
  const history = reportData?.monthlyHistory || [];

  const metrics = [
    {
      label: 'CO₂ DISPLACED',
      value: co2Kg,
      unit: 'KG CO₂',
      subtext: 'Emissions prevented vs new production',
      icon: 'leaf',
      color: colors.forest,
    },
    {
      label: 'Water conserved',
      value: waterKL,
      unit: 'KILOLITRES',
      subtext: 'Clean industrial water saved',
      icon: 'water',
      color: colors.navy,
    },
    {
      label: 'Landfill diverted',
      value: wasteKg,
      unit: 'Kg textile',
      subtext: 'Pre-consumer / post-use waste avoided',
      icon: 'trash',
      color: colors.charcoal,
    },
    {
      label: 'Carbon offset',
      value: `${trees}`,
      unit: 'Equiv. Trees',
      subtext: 'Annual carbon absorption equivalent',
      icon: 'sparkles',
      color: colors.forest,
    },
    {
      label: 'Items circulated',
      value: `${itemsCirculated}`,
      unit: 'GARMENTS',
      subtext: 'Active re-wearing & resale cycles',
      icon: 'swap-horizontal',
      color: colors.red,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back"
          style={styles.iconBtn}
          onPress={() => safeBack('/(tabs)/profile')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <SolarIcon name="arrow-back" size={20} color={colors.charcoal} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerPre}>Sustainability ledger</Text>
          <Text style={styles.headerTitle}>Impact details</Text>
        </View>
        <View style={styles.iconPlaceholder}>
          <SolarIcon name="leaf-outline" size={18} color={colors.forest} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tier & Milestone Progress Card */}
        <View style={styles.tierCard}>
          <View style={styles.tierTopRow}>
            <View style={styles.tierPill}>
              <SolarIcon name="shield-checkmark" size={13} color={colors.cream} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.tierPillText}>STATUS: {tier.toUpperCase()}</Text>
            </View>
            <Text style={styles.userCallout}>
              {impactData?.user?.displayName?.toUpperCase() || 'Circular member'}
            </Text>
          </View>

          <View style={styles.tierProgressTrack}>
            <View style={[styles.tierProgressFill, { width: `${progressPercent}%` }]} />
          </View>

          {impactData?.nextMilestone && (
            <View style={styles.milestoneRow}>
              <SolarIcon name="sparkles" size={14} color={colors.gold} />
              <Text style={styles.milestoneText}>{impactData.nextMilestone}</Text>
            </View>
          )}
        </View>

        {/* Core Environmental Impact Grid */}
        <Text style={styles.sectionHeading}>Verified metrics</Text>
        <View style={styles.grid}>
          {metrics.map((m) => (
            <View key={m.label} style={[styles.metricCard, { borderTopColor: m.color }]}>
              <View style={styles.cardHeaderRow}>
                <SolarIcon name={m.icon as any} size={20} color={m.color} />
                <Text style={styles.metricLabel}>{m.label}</Text>
              </View>
              <View style={styles.valueRow}>
                <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
                <Text style={styles.metricUnit}>{m.unit}</Text>
              </View>
              <Text style={styles.metricSubtext}>{m.subtext}</Text>
            </View>
          ))}
        </View>

        {/* Circulation Activity Breakdown */}
        <Text style={styles.sectionHeading}>Circulation breakdown</Text>
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLabelGroup}>
              <View style={[styles.dot, { backgroundColor: colors.forest }]} />
              <Text style={styles.breakdownName}>Garments Re-circulated</Text>
            </View>
            <Text style={styles.breakdownCount}>{record.itemsCirculated || 0} items</Text>
          </View>

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLabelGroup}>
              <View style={[styles.dot, { backgroundColor: colors.copper }]} />
              <Text style={styles.breakdownName}>Artisan Upcycled</Text>
            </View>
            <Text style={styles.breakdownCount}>{record.itemsUpcycled || 0} items</Text>
          </View>

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLabelGroup}>
              <View style={[styles.dot, { backgroundColor: colors.charcoal }]} />
              <Text style={styles.breakdownName}>Fiber Recycled</Text>
            </View>
            <Text style={styles.breakdownCount}>{record.itemsRecycled || 0} items</Text>
          </View>
        </View>

        {/* Historical Velocity (if data available) */}
        {history.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Displacement velocity</Text>
            <View style={styles.historyCard}>
              <View style={styles.historyBarsRow}>
                {history.map((h: any, i: number) => (
                  <View key={i} style={styles.barCol}>
                    <Text style={styles.barVal}>{h.kg}k</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { height: Math.min(100, Math.max(15, (h.kg || 0) * 7)) },
                        ]}
                      />
                    </View>
                    <Text style={styles.barMonth}>{h.month}</Text>
                    <Text style={styles.barType}>{h.label}</Text>
                  </View>
                ))}
              </View>
              {reportData?.message && (
                <Text style={styles.historyMessage}>"{reportData.message}"</Text>
              )}
            </View>
          </>
        )}

        {/* Verification Footer */}
        <View style={styles.footerNote}>
          <SolarIcon name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={styles.footerNoteText}>
            Impact is worked out from garment weights and fabric type.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 52,
    paddingBottom: spacing.sm,
    backgroundColor: colors.cream,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.charcoal,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  iconPlaceholder: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerPre: {
    fontSize: 13,
    fontFamily: typography.handBold,
    color: colors.red, includeFontPadding: false, },
  headerTitle: {
    ...textStyles.screenTitle,
    color: colors.charcoal,
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 100,
  },

  // Tier Card
  tierCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 18,
    marginBottom: 24,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  tierTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.forest,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 2,
  },
  tierPillText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.cream, includeFontPadding: false, },
  userCallout: {
    fontFamily: typography.handSemi,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  tierProgressTrack: {
    height: 6,
    backgroundColor: colors.overlayLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  tierProgressFill: {
    height: '100%',
    backgroundColor: colors.forest,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  milestoneText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.charcoal,
    flex: 1,
    fontWeight: '600',
  },

  sectionHeading: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal,
    marginBottom: 12,
    marginTop: 4, includeFontPadding: false, },

  // Grid
  grid: {
    gap: 14,
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: colors.white,
    padding: 18,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderTopWidth: 6,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 13,
    fontFamily: typography.handBold,
    color: colors.charcoal, includeFontPadding: false, },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 28,
    fontFamily: typography.headings,
    lineHeight: 34,
  },
  metricUnit: {
    fontSize: 11,
    fontFamily: typography.bodyBold,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  metricSubtext: {
    fontSize: 11,
    fontFamily: typography.body,
    color: colors.charcoal,
    opacity: 0.7,
  },

  // Breakdown Card
  breakdownCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 18,
    marginBottom: 24,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.overlayLight,
  },
  breakdownLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownName: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.charcoal,
    fontWeight: '600',
  },
  breakdownCount: {
    fontFamily: typography.bodyBold,
    fontSize: 13,
    color: colors.charcoal,
  },

  // History Card
  historyCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 18,
    marginBottom: 24,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  historyBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 16,
    marginBottom: 12,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barVal: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  barTrack: {
    width: 14,
    height: 80,
    backgroundColor: colors.overlayLight,
    justifyContent: 'flex-end',
    borderRadius: 2,
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.forest,
    borderRadius: 2,
  },
  barMonth: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.charcoal,
    marginTop: 6,
  },
  barType: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2, includeFontPadding: false, },
  historyMessage: {
    fontFamily: typography.body,
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.charcoal,
    textAlign: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
    paddingTop: 8,
  },

  // Footer Note
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  footerNoteText: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    flex: 1,
  },
});
