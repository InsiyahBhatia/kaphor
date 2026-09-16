import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../theme';
import { formatTradeValuation } from './EstTradeValueBadge';

export interface FairValueGarmentInfo {
  title?: string;
  brand?: string;
  price?: number | null;
  estimatedValue?: number | null;
  condition?: string | null;
  category?: string | null;
}

export interface FairValueMatcherProps {
  myGarment?: FairValueGarmentInfo | null;
  theirGarment?: FairValueGarmentInfo | null;
  myValuation?: number | null;
  theirValuation?: number | null;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function FairValueMatcher({
  myGarment,
  theirGarment,
  myValuation,
  theirValuation,
  compact = false,
  style,
}: FairValueMatcherProps) {
  const [expandedDetails, setExpandedDetails] = useState(false);

  const myVal = formatTradeValuation(myValuation ?? myGarment?.price ?? myGarment?.estimatedValue);
  const theirVal = formatTradeValuation(theirValuation ?? theirGarment?.price ?? theirGarment?.estimatedValue);

  const delta = Math.abs(myVal - theirVal);
  const totalVal = myVal + theirVal;
  const myRatio = Math.round((myVal / (totalVal || 1)) * 100);
  const theirRatio = 100 - myRatio;
  const maxVal = Math.max(myVal, theirVal, 1);
  const diffPct = Math.round((delta / maxVal) * 100);

  // Parity classification: <= 15% difference is considered equitable 1:1 match
  const isEquitable = diffPct <= 15;
  const userHasSurplus = myVal > theirVal && !isEquitable;
  const partnerHasSurplus = theirVal > myVal && !isEquitable;

  const getStatusColor = () => {
    if (isEquitable) return '#1E3B2F'; // Forest green
    if (userHasSurplus) return colors.copper; // Copper/amber
    return '#1C2B4A'; // Deep navy
  };

  const getStatusBadgeText = () => {
    if (isEquitable) return 'EQUITABLE MATCH (PARITY OK)';
    if (userHasSurplus) return `+₹${delta.toLocaleString('en-IN')} YOUR TRADE EQUITY`;
    return `+₹${delta.toLocaleString('en-IN')} COUNTERPART VALUE`;
  };

  return (
    <View style={[styles.container, style]}>
      {/* HEADER SECTION */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Ionicons name="scale-outline" size={14} color={colors.charcoal} />
          <Text style={styles.matcherTitle}>FAIR VALUE MATCHER</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusBadgeText}>{getStatusBadgeText()}</Text>
        </View>
      </View>

      {/* EQUILIBRIUM BALANCE METER */}
      <View style={styles.meterContainer}>
        <View style={styles.meterLabelRow}>
          <Text style={styles.meterLabel}>
            YOUR PIECE ({myRatio}%)
          </Text>
          <Text style={styles.meterLabel}>
            THEIR PIECE ({theirRatio}%)
          </Text>
        </View>

        {/* DUAL-SIDED PROGRESS BAR */}
        <View style={styles.barTrack}>
          <View style={[styles.barFillLeft, { width: `${myRatio}%` }]} />
          <View style={styles.barCenterPin}>
            <View style={styles.centerPinLine} />
          </View>
          <View style={[styles.barFillRight, { width: `${theirRatio}%` }]} />
        </View>

        <View style={styles.meterFooterRow}>
          <Text style={styles.meterValText}>₹{myVal.toLocaleString('en-IN')}</Text>
          <View style={styles.centerBalanceBadge}>
            <Text style={styles.centerBalanceText}>
              {isEquitable ? '±' + diffPct + '% VARIANCE' : diffPct + '% SPREAD'}
            </Text>
          </View>
          <Text style={styles.meterValText}>₹{theirVal.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* PARITY ASSESSMENT MESSAGE */}
      <View style={styles.recommendationBox}>
        {isEquitable ? (
          <View style={styles.recContent}>
            <Ionicons name="checkmark-circle" size={15} color="#1E3B2F" />
            <Text style={styles.recText}>
              <Text style={styles.recTextBold}>Fair 1:1 Barter Confirmed.</Text> Both pieces have balanced appraisal value within standard vintage trade tolerances. No cash equalizer needed.
            </Text>
          </View>
        ) : (
          <View style={styles.recContent}>
            <Ionicons name="alert-circle-outline" size={15} color={getStatusColor()} />
            <Text style={styles.recText}>
              <Text style={styles.recTextBold}>Suggested Cash Equalizer: ₹{delta.toLocaleString('en-IN')}.</Text>{' '}
              {userHasSurplus
                ? `Your garment appraisal is higher. A ₹${delta.toLocaleString('en-IN')} cash sweetener or secondary accessory from the partner balances parity.`
                : `Their garment appraisal is higher. Adding a ₹${delta.toLocaleString('en-IN')} cash top-up or secondary accessory achieves perfect 50/50 parity.`}
            </Text>
          </View>
        )}
      </View>

      {/* EXPANDABLE DETAILS FOR DOSSIER DEPTH */}
      {!compact && (
        <View style={styles.detailAccordion}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setExpandedDetails(!expandedDetails)}
            activeOpacity={0.7}
          >
            <Text style={styles.accordionTitle}>APPRAISAL METRICS & ATTRIBUTES</Text>
            <Ionicons
              name={expandedDetails ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.charcoal}
            />
          </TouchableOpacity>

          {expandedDetails && (
            <View style={styles.accordionBody}>
              <View style={styles.metricComparisonRow}>
                <View style={styles.metricColumn}>
                  <Text style={styles.columnHeader}>YOUR ITEM</Text>
                  <Text style={styles.metricValBold}>{myGarment?.brand || 'ARCHIVE ITEM'}</Text>
                  <Text style={styles.metricSub}>Condition: {myGarment?.condition || 'PRISTINE'}</Text>
                  <Text style={styles.metricSub}>Cat: {myGarment?.category || 'ACCESSORY'}</Text>
                </View>

                <View style={styles.columnDivider} />

                <View style={styles.metricColumn}>
                  <Text style={styles.columnHeader}>THEIR ITEM</Text>
                  <Text style={styles.metricValBold}>{theirGarment?.brand || 'ARCHIVE ITEM'}</Text>
                  <Text style={styles.metricSub}>Condition: {theirGarment?.condition || 'PRISTINE'}</Text>
                  <Text style={styles.metricSub}>Cat: {theirGarment?.category || 'ACCESSORY'}</Text>
                </View>
              </View>

              <Text style={styles.appraisalDisclaimer}>
                Appraisal algorithm weights designer brand tier, archival rarity, certified condition rating, and current secondary market transactions.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAF8F4',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 2,
    padding: 12,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matcherTitle: {
    fontFamily: typography.headings,
    fontSize: 13,
    color: colors.charcoal,
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  statusBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 0.5,
  },

  // Meter
  meterContainer: {
    marginBottom: 8,
    backgroundColor: colors.white,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2DEC9',
    borderRadius: 2,
  },
  meterLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  meterLabel: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '700',
    color: colors.textSecond,
    letterSpacing: 0.5,
  },
  barTrack: {
    height: 10,
    backgroundColor: colors.bgMuted,
    borderRadius: 1,
    flexDirection: 'row',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  barFillLeft: {
    backgroundColor: colors.charcoal,
    height: '100%',
  },
  barCenterPin: {
    width: 2,
    backgroundColor: colors.cream,
    height: '100%',
    zIndex: 2,
  },
  centerPinLine: {
    width: 2,
    height: '100%',
    backgroundColor: colors.red,
  },
  barFillRight: {
    backgroundColor: colors.copper,
    height: '100%',
  },
  meterFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  meterValText: {
    fontFamily: typography.headings,
    fontSize: 12,
    color: colors.charcoal,
  },
  centerBalanceBadge: {
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: colors.charcoal,
  },
  centerBalanceText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '800',
    color: colors.charcoal,
  },

  // Recommendation Box
  recommendationBox: {
    backgroundColor: colors.cream,
    borderLeftWidth: 3,
    borderLeftColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 1,
  },
  recContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  recText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.charcoal,
    lineHeight: 13,
    flex: 1,
  },
  recTextBold: {
    fontWeight: '800',
    color: colors.charcoal,
  },

  // Accordion
  detailAccordion: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2DEC9',
    paddingTop: 6,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  accordionTitle: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  accordionBody: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2DEC9',
  },
  metricComparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricColumn: {
    flex: 1,
  },
  columnDivider: {
    width: 1,
    backgroundColor: '#E2DEC9',
    marginHorizontal: 8,
  },
  columnHeader: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
    color: colors.red,
    marginBottom: 2,
  },
  metricValBold: {
    fontFamily: typography.headings,
    fontSize: 13,
    color: colors.charcoal,
  },
  metricSub: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textSecond,
    marginTop: 1,
  },
  appraisalDisclaimer: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 10,
    marginTop: 4,
  },
});
