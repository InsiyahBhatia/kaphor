import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../theme';

export interface EstTradeValueBadgeProps {
  value?: number | string | null;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'copper' | 'subtle' | 'gold';
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Normalizes and formats trade valuation into a clean INR currency string.
 */
export function formatTradeValuation(val?: number | string | null, fallback = 2500): number {
  if (val == null) return fallback;
  const parsed = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return isNaN(parsed) || parsed <= 0 ? fallback : Math.round(parsed);
}

export function EstTradeValueBadge({
  value,
  size = 'md',
  variant = 'dark',
  showLabel = true,
  style,
}: EstTradeValueBadgeProps) {
  const numericVal = formatTradeValuation(value);
  const formattedVal = `₹${numericVal.toLocaleString('en-IN')}`;

  const getContainerStyle = () => {
    switch (variant) {
      case 'copper':
        return styles.variantCopper;
      case 'gold':
        return styles.variantGold;
      case 'subtle':
        return styles.variantSubtle;
      case 'dark':
      default:
        return styles.variantDark;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'copper':
        return styles.textCopper;
      case 'gold':
        return styles.textGold;
      case 'subtle':
        return styles.textSubtle;
      case 'dark':
      default:
        return styles.textDark;
    }
  };

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  return (
    <View
      style={[
        styles.badgeBase,
        isSmall && styles.badgeSm,
        isLarge && styles.badgeLg,
        getContainerStyle(),
        style,
      ]}
    >
      <View style={styles.iconRow}>
        <Ionicons
          name="pricetag-outline"
          size={isSmall ? 10 : isLarge ? 14 : 11}
          color={variant === 'subtle' ? colors.charcoal : colors.cream}
          style={styles.icon}
        />
        {showLabel && (
          <Text
            style={[
              styles.label,
              isSmall && styles.labelSm,
              isLarge && styles.labelLg,
              getTextStyle(),
            ]}
          >
            EST. TRADE VALUE
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.valueText,
          isSmall && styles.valueTextSm,
          isLarge && styles.valueTextLg,
          getTextStyle(),
        ]}
      >
        {formattedVal}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeBase: {
    borderWidth: 1.5,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 3.5,
  },
  badgeLg: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    marginRight: 2,
  },
  label: {
    fontFamily: typography.handBold,
    fontSize: 16, includeFontPadding: false, },
  labelSm: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  labelLg: {
    fontSize: 11,
    letterSpacing: 1,
  },
  valueText: {
    fontFamily: typography.headings,
    fontSize: 14,
    letterSpacing: 0.8,
    marginTop: 1,
  },
  valueTextSm: {
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.5,
  },
  valueTextLg: {
    fontSize: 17,
    letterSpacing: 1,
  },

  // Variants
  variantDark: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  textDark: {
    color: colors.cream,
  },
  variantCopper: {
    backgroundColor: colors.copper,
    borderColor: colors.charcoal,
  },
  textCopper: {
    color: colors.terracottaLight,
  },
  variantGold: {
    backgroundColor: colors.goldDark,
    borderColor: colors.gold,
  },
  textGold: {
    color: colors.gold,
  },
  variantSubtle: {
    backgroundColor: colors.bgMuted,
    borderColor: colors.charcoal,
  },
  textSubtle: {
    color: colors.charcoal,
  },
});
