import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SolarIcon } from './SolarIcon';
import { colors, typography } from '../../theme';

interface VerifiedBadgeProps {
  label?: string;
  size?: 'compact' | 'standard' | 'large';
  showLabel?: boolean;
  type?: 'seller' | 'member' | 'artisan';
}

export function VerifiedBadge({
  label,
  size = 'standard',
  showLabel = true,
  type = 'seller',
}: VerifiedBadgeProps) {
  const handlePress = () => {
    Alert.alert(
      'Verified Identity & Trust',
      'This Kaphor member has passed government-issued identity verification and circular commerce authenticity checks.',
      [{ text: 'Close', style: 'default' }]
    );
  };

  const defaultLabel = type === 'seller' ? 'VERIFIED SELLER' : type === 'artisan' ? 'VERIFIED MAKER' : 'VERIFIED';
  const displayLabel = label || defaultLabel;

  if (size === 'compact') {
    return (
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Shield checkmark"
        onPress={handlePress}
        style={styles.compactWrap}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <SolarIcon name="shield-checkmark" size={14} color={colors.gold} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.badgeWrap,
        size === 'large' && styles.badgeLarge,
      ]}
      activeOpacity={0.8}
    >
      <SolarIcon name="shield-checkmark" size={size === 'large' ? 14 : 12} color={colors.gold} />
      {showLabel && (
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.badgeText, size === 'large' && styles.badgeTextLarge]}>
          {displayLabel}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  compactWrap: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.ink,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  badgeLarge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: colors.paperLight,
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  badgeTextLarge: {
    fontSize: 11.5,
      fontFamily: typography.body,
  },
});
