import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../../src/theme';
import { impactService } from '../../../src/services/impactService';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';

const { width } = Dimensions.get('window');

export default function UnifiedImpactScreen() {
  useBackHandler('/(tabs)/profile');
  const [impactData, setImpactData] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
          }
        } catch (err) {
          console.error('Failed to load impact dossier', err);
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
        <DossierLoading variant="impact" compact />
      </View>
    );
  }

  const record = impactData?.impactRecord || {};
  const co2Kg = (record.carbonSavedKg || 0).toFixed(1);
  const waterKL = (((record.waterSavedL || 0) / 1000)).toFixed(1);
  const wasteKg = (((record.wasteSavedG || 0) / 1000)).toFixed(1);
  const trees = impactData?.equivalentTrees || 0;
  const itemsCirculated = record.itemsCirculated || 0;
  const tier = impactData?.tier || 'CIRCULAR CITIZEN';
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
      label: 'WATER CONSERVED',
      value: waterKL,
      unit: 'KILOLITRES',
      subtext: 'Clean industrial water saved',
      icon: 'water',
      color: colors.navy,
    },
    {
      label: 'LANDFILL DIVERTED',
      value: wasteKg,
      unit: 'KG TEXTILE',
      subtext: 'Pre-consumer / post-use waste avoided',
      icon: 'trash',
      color: colors.charcoal,
    },
    {
      label: 'CARBON OFFSET',
      value: `${trees}`,
      unit: 'EQUIV. TREES',
      subtext: 'Annual carbon absorption equivalent',
      icon: 'sparkles',
      color: colors.forest,
    },
    {
      label: 'ITEMS CIRCULATED',
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
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => safeBack('/(tabs)/profile')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={colors.charcoal} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerPre}>SUSTAINABILITY LEDGER</Text>
          <Text style={styles.headerTitle}>IMPACT DOSSIER</Text>
        </View>
        <View style={styles.iconPlaceholder}>
          <Ionicons name="leaf-outline" size={18} color={colors.forest} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tier & Milestone Progress Card */}
        <View style={styles.tierCard}>
          <View style={styles.tierTopRow}>
            <View style={styles.tierPill}>
              <Ionicons name="shield-checkmark" size={13} color={colors.cream} />
              <Text style={styles.tierPillText}>STATUS: {tier.toUpperCase()}</Text>
            </View>
            <Text style={styles.userCallout}>
              {impactData?.user?.displayName?.toUpperCase() || 'CIRCULAR MEMBER'}
            </Text>
          </View>

          <View style={styles.tierProgressTrack}>
            <View style={[styles.tierProgressFill, { width: `${progressPercent}%` }]} />
          </View>

          {impactData?.nextMilestone && (
            <View style={styles.milestoneRow}>
              <Ionicons name="sparkles" size={14} color="#C9A84C" />
              <Text style={styles.milestoneText}>{impactData.nextMilestone}</Text>
            </View>
          )}
        </View>

        {/* Core Environmental Impact Grid */}
        <Text style={styles.sectionHeading}>VERIFIED METRICS</Text>
        <View style={styles.grid}>
          {metrics.map((m) => (
            <View key={m.label} style={[styles.metricCard, { borderTopColor: m.color }]}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name={m.icon as any} size={20} color={m.color} />
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
        <Text style={styles.sectionHeading}>CIRCULATION BREAKDOWN</Text>
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
            <Text style={styles.sectionHeading}>DISPLACEMENT VELOCITY</Text>
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
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={styles.footerNoteText}>
            Impact data verified via Kaphor GLIE lifecycle database, garment weights, and certified fiber coefficients.
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
    fontSize: 12,
    fontFamily: typography.mono,
    color: colors.red,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: typography.headings,
    color: colors.charcoal,
    letterSpacing: 1,
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
    fontFamily: typography.mono,
    fontSize: 13.5,
    color: colors.cream,
    letterSpacing: 1,
    fontWeight: '800',
  },
  userCallout: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    color: colors.charcoal,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  tierProgressTrack: {
    height: 6,
    backgroundColor: 'rgba(26,26,26,0.08)',
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
    fontSize: 15.5,
    color: colors.charcoal,
    flex: 1,
    fontWeight: '600',
  },

  sectionHeading: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 4,
  },

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
    fontSize: 14.5,
    fontFamily: typography.mono,
    letterSpacing: 1,
    fontWeight: '800',
    color: colors.charcoal,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 42,
    fontFamily: typography.headings,
    lineHeight: 40,
  },
  metricUnit: {
    fontSize: 14.5,
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricSubtext: {
    fontSize: 14.5,
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
    borderBottomColor: 'rgba(26,26,26,0.08)',
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
    fontSize: 17,
    color: colors.charcoal,
    fontWeight: '600',
  },
  breakdownCount: {
    fontFamily: typography.mono,
    fontSize: 17,
    fontWeight: '800',
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
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  barTrack: {
    width: 14,
    height: 80,
    backgroundColor: 'rgba(26,26,26,0.06)',
    justifyContent: 'flex-end',
    borderRadius: 2,
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.forest,
    borderRadius: 2,
  },
  barMonth: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.charcoal,
    marginTop: 6,
  },
  barType: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  historyMessage: {
    fontFamily: typography.body,
    fontSize: 14.5,
    fontStyle: 'italic',
    color: colors.charcoal,
    textAlign: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26,26,26,0.08)',
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
    fontSize: 14.5,
    color: colors.textMuted,
    lineHeight: 16,
    flex: 1,
  },
});
