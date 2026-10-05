import React from 'react';
import { colors } from '../theme';
import { View, Text, StyleSheet } from 'react-native';

type BadgeVariant = 'tier' | 'fitScore' | 'condition' | 'status';

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  subType?: string; // e.g., 'Bronze', 'Pristine', etc.
}

const COLORS = {
  tier: {
    Bronze: colors.terracotta,
    Silver: colors.borderLight,
    Gold: colors.gold,
    Platinum: colors.paperDark,
    Elite: colors.gold,
  },
  condition: {
    Pristine: colors.gold,
    MinorWear: colors.textMuted,
    Upcycle: colors.sage,
    RecycleOnly: colors.ink,
  },
  status: {
    PREMIUM: colors.rose,
    'NEW RELEASE': colors.gold,
    'LAST PIECE': colors.rose,
    'AVAILABLE NOW': colors.sage,
  }
};

export const Badge: React.FC<BadgeProps> = ({ variant, label, subType }) => {
  let bgColor: string = colors.ink;
  let textColor: string = colors.white;

  if (variant === 'tier' && subType && (COLORS.tier as any)[subType]) {
    bgColor = (COLORS.tier as any)[subType];
    textColor = colors.ink;
  } else if (variant === 'fitScore') {
    bgColor = colors.rose;
  } else if (variant === 'condition' && subType && (COLORS.condition as any)[subType]) {
    bgColor = (COLORS.condition as any)[subType];
  } else if (variant === 'status' && (COLORS.status as any)[label]) {
    bgColor = (COLORS.status as any)[label];
  }

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
