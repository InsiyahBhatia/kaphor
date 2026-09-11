import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../../src/theme';
import { impactService } from '../../../src/services/impactService';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { VerifiedBadge } from '../../../src/components/common/VerifiedBadge';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';

const { width } = Dimensions.get('window');

export default function ImpactReportScreen() {
  const router = useRouter();
  useBackHandler('/(tabs)/impact');
  const [impactData, setImpactData] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [imp, rep] = await Promise.all([
          impactService.getMyImpact(),
          impactService.getImpactReport(),
        ]);
        setImpactData(imp);
        setReportData(rep);
      } catch (err) {
        console.error('Failed to load impact report', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleShareCertificate = async () => {
    try {
      const co2 = (impactData?.impactRecord?.carbonSavedKg || 0).toFixed(1);
      const water = (((impactData?.impactRecord?.waterSavedL || 0) / 1000)).toFixed(1);
      const items = impactData?.impactRecord?.itemsCirculated || 0;
      await Share.share({
        message: `🌱 Kaphor Verified Circular Certificate: I have displaced ${co2} KG of CO₂ and conserved ${water} KL of fresh water by circulating ${items} luxury items on Kaphor! Check out your fashion footprint: https://kaphor.com`,
        title: 'Kaphor Verified Sustainability Audit',
      });
    } catch {
      Alert.alert('Share', 'Could not open share sheet.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <DossierLoading variant="impact" compact />
      </View>
    );
  }

  const record = impactData?.impactRecord || {};
  const co2Kg = (record.carbonSavedKg || 0).toFixed(1);
  const waterKL = ((record.waterSavedL || 0) / 1000).toFixed(1);
  const wasteKg = ((record.wasteSavedG || 0) / 1000).toFixed(1);
  const trees = impactData?.equivalentTrees || 0;
  const tier = impactData?.tier || 'CIRCULAR CITIZEN';
  const history = reportData?.monthlyHistory || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.iconBtn} 
          onPress={() => safeBack('/(tabs)/profile')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.charcoal} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerPre}>ENVIRONMENTAL AUDIT</Text>
          <Text style={styles.headerTitle}>CERTIFIED REPORT</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={handleShareCertificate}>
          <Ionicons name="share-social-outline" size={20} color={colors.charcoal} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Certificate Card */}
        <View style={styles.certificateCard}>
          <View style={styles.certCornerTL} />
          <View style={styles.certCornerTR} />
          <View style={styles.certCornerBL} />
          <View style={styles.certCornerBR} />

          <View style={styles.certHeader}>
            <View>
              <Text style={styles.certBadge}>VERIFIED LEDGER #KP-{Math.floor(100000 + Math.random() * 900000)}</Text>
              <Text style={styles.certUserName}>
                {impactData?.user?.displayName?.toUpperCase() || 'CIRCULAR MEMBER'}
              </Text>
            </View>
            <VerifiedBadge size="standard" showLabel={false} />
          </View>

          <View style={styles.tierPill}>
            <Ionicons name="shield-checkmark" size={14} color={colors.cream} />
            <Text style={styles.tierPillText}>STATUS: {tier.toUpperCase()}</Text>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{co2Kg}</Text>
              <Text style={styles.metricUnit}>KG CO₂</Text>
              <Text style={styles.metricLabel}>EMISSIONS DISPLACED</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{waterKL}</Text>
              <Text style={styles.metricUnit}>KILOLITRES</Text>
              <Text style={styles.metricLabel}>WATER CONSERVED</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{wasteKg}</Text>
              <Text style={styles.metricUnit}>KG WASTE</Text>
              <Text style={styles.metricLabel}>DIVERTED FROM DUMPS</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{trees}</Text>
              <Text style={styles.metricUnit}>EQUIV. TREES</Text>
              <Text style={styles.metricLabel}>CARBON SEQUESTRATION</Text>
            </View>
          </View>

          <View style={styles.certFooter}>
            <Ionicons name="leaf-outline" size={14} color={colors.forest} />
            <Text style={styles.certFooterText}>
              Audit verified via Kaphor GLIE lifecycle database & sustainability constants.
            </Text>
          </View>
        </View>

        {/* Milestone Message */}
        {impactData?.nextMilestone && (
          <View style={styles.milestoneCard}>
            <Ionicons name="sparkles" size={18} color="#C9A84C" />
            <Text style={styles.milestoneText}>{impactData.nextMilestone}</Text>
          </View>
        )}

        {/* Activity Breakdown */}
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

        {/* Historical Velocity */}
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
                          { height: Math.min(100, Math.max(15, h.kg * 7)) },
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

        {/* Share Button */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleShareCertificate} activeOpacity={0.85}>
          <Ionicons name="share-social" size={18} color={colors.cream} />
          <Text style={styles.shareBtnText}>EXPORT & SHARE IMPACT CERTIFICATE</Text>
        </TouchableOpacity>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerPre: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontFamily: typography.headings,
    fontSize: 18,
    color: colors.charcoal,
    letterSpacing: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 60,
  },

  // Certificate
  certificateCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: spacing.md,
    position: 'relative',
    marginBottom: spacing.md,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  certCornerTL: { position: 'absolute', top: 4, left: 4, width: 8, height: 8, borderTopWidth: 2, borderLeftWidth: 2, borderColor: colors.charcoal },
  certCornerTR: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, borderColor: colors.charcoal },
  certCornerBL: { position: 'absolute', bottom: 4, left: 4, width: 8, height: 8, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: colors.charcoal },
  certCornerBR: { position: 'absolute', bottom: 4, right: 4, width: 8, height: 8, borderBottomWidth: 2, borderRightWidth: 2, borderColor: colors.charcoal },
  certHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  certBadge: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
    fontWeight: '700',
  },
  certUserName: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.charcoal,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.forest,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  tierPillText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.cream,
    fontWeight: '700',
    letterSpacing: 1,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metricBox: {
    width: (width - 64) / 2,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  metricVal: {
    fontFamily: typography.headings,
    fontSize: 24,
    color: colors.charcoal,
  },
  metricUnit: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.red,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: -2,
  },
  metricLabel: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 4,
  },
  certFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.bgMuted,
  },
  certFooterText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 12,
  },

  // Milestone
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF7EE',
    borderWidth: 1,
    borderColor: '#D4C4A3',
    padding: 12,
    marginBottom: spacing.md,
  },
  milestoneText: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: '#8C6D3B',
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.5,
  },

  // Section
  sectionHeading: {
    fontFamily: typography.headings,
    fontSize: 14,
    color: colors.charcoal,
    letterSpacing: 1,
    marginBottom: 8,
  },
  breakdownCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 14,
    marginBottom: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgMuted,
  },
  breakdownLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
  },
  breakdownName: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.charcoal,
    fontWeight: '700',
  },
  breakdownCount: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textSecond,
    fontWeight: '800',
  },

  // History
  historyCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 16,
    marginBottom: spacing.md,
  },
  historyBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 140,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgMuted,
  },
  barCol: {
    alignItems: 'center',
    width: 50,
  },
  barVal: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 4,
  },
  barTrack: {
    width: 22,
    height: 90,
    backgroundColor: colors.bgMuted,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.forest,
  },
  barMonth: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.charcoal,
    fontWeight: '700',
    marginTop: 6,
  },
  barType: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    color: colors.textMuted,
  },
  historyMessage: {
    fontFamily: typography.accent,
    fontSize: 12,
    color: colors.charcoal,
    marginTop: 10,
    textAlign: 'center',
  },

  // Share CTA
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.charcoal,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  shareBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.cream,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
