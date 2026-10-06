import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { SolarIcon } from '../common/SolarIcon';
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
    if (isEquitable) return colors.emeraldDark; // Forest green
    if (userHasSurplus) return colors.copper; // Copper/amber
    return colors.ink; // Deep navy
  };

  const getStatusBadgeText = () => {
    if (isEquitable) return 'Equitable match (parity ok)';
    if (userHasSurplus) return `+₹${delta.toLocaleString('en-IN')} YOUR TRADE EQUITY`;
    return `+₹${delta.toLocaleString('en-IN')} COUNTERPART VALUE`;
  };

  return (
    <View style={[styles.container, style]}>
      {/* HEADER SECTION */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <SolarIcon name="scale-outline" size={14} color={colors.charcoal} />
          <Text style={styles.matcherTitle}>Fair value matcher</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.statusBadgeText}>{getStatusBadgeText()}</Text>
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
            <SolarIcon name="checkmark-circle" size={15} color={colors.emeraldDark} />
            <Text style={styles.recText}>
              <Text style={styles.recTextBold}>Fair 1:1 Barter Confirmed.</Text> Both pieces have balanced appraisal value within standard vintage trade tolerances. No cash equalizer needed.
            </Text>
          </View>
        ) : (
          <View style={styles.recContent}>
            <SolarIcon name="alert-circle-outline" size={15} color={getStatusColor()} />
            <Text style={styles.recText}>
              <Text style={styles.recTextBold}>Suggested Cash Equalizer: ₹{delta.toLocaleString('en-IN')}.</Text>{' '}
              {userHasSurplus
                ? `Your item is worth more. A ₹${delta.toLocaleString('en-IN')} cash top-up or an extra accessory from your partner makes it fair.`
                : `Their item is worth more. Adding a ₹${delta.toLocaleString('en-IN')} cash top-up or an extra accessory makes it fair.`}
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
            <Text style={styles.accordionTitle}>Price check metrics & attributes</Text>
            <SolarIcon
              name={expandedDetails ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.charcoal}
            />
          </TouchableOpacity>

          {expandedDetails && (
            <View style={styles.accordionBody}>
              <View style={styles.metricComparisonRow}>
                <View style={styles.metricColumn}>
                  <Text style={styles.columnHeader}>Your item</Text>
                  <Text style={styles.metricValBold}>{myGarment?.brand || 'CLOSET ITEM'}</Text>
                  <Text style={styles.metricSub}>Condition: {myGarment?.condition || 'PRISTINE'}</Text>
                  <Text style={styles.metricSub}>Cat: {myGarment?.category || 'ACCESSORY'}</Text>
                </View>

                <View style={styles.columnDivider} />

                <View style={styles.metricColumn}>
                  <Text style={styles.columnHeader}>Their item</Text>
                  <Text style={styles.metricValBold}>{theirGarment?.brand || 'CLOSET ITEM'}</Text>
                  <Text style={styles.metricSub}>Condition: {theirGarment?.condition || 'PRISTINE'}</Text>
                  <Text style={styles.metricSub}>Cat: {theirGarment?.category || 'ACCESSORY'}</Text>
                </View>
              </View>

              <Text style={styles.appraisalDisclaimer}>
                Price checks use the brand, how rare the item is, its condition and recent resale prices.
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
    backgroundColor: colors.paperLight,
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
    gap: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matcherTitle: {
    fontFamily: typography.bodyBold,
    fontSize: 13,
    color: colors.charcoal,
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.charcoal,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.cream, includeFontPadding: false, },

  // Meter
  meterContainer: {
    marginBottom: 8,
    backgroundColor: colors.white,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 2,
  },
  meterLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  meterLabel: {
    fontFamily: typography.handSemi,
    fontSize: 13,
    color: colors.textSecond, includeFontPadding: false, },
  barTrack: {
    height: 12,
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
    marginTop: 6,
  },
  meterValText: {
    fontFamily: typography.bodyBold,
    fontSize: 13,
    color: colors.charcoal,
  },
  centerBalanceBadge: {
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: colors.charcoal,
  },
  centerBalanceText: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.charcoal,
  },

  // Recommendation Box
  recommendationBox: {
    backgroundColor: colors.cream,
    borderLeftWidth: 3,
    borderLeftColor: colors.charcoal,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 1,
  },
  recContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  recText: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 20,
    flex: 1, includeFontPadding: false, },
  recTextBold: {
    fontWeight: '800',
    color: colors.charcoal,
  },

  // Accordion
  detailAccordion: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  accordionTitle: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  accordionBody: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
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
    backgroundColor: colors.paperDark,
    marginHorizontal: 8,
  },
  columnHeader: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.red,
    marginBottom: 2, includeFontPadding: false, },
  metricValBold: {
    fontFamily: typography.bodyBold,
    fontSize: 13,
    color: colors.charcoal,
  },
  metricSub: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textSecond,
    marginTop: 1, includeFontPadding: false, },
  appraisalDisclaimer: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 19,
    marginTop: 4, includeFontPadding: false, },
});
