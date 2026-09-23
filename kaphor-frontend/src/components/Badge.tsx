import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type BadgeVariant = 'tier' | 'fitScore' | 'condition' | 'status';

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  subType?: string; // e.g., 'Bronze', 'Pristine', etc.
}

const COLORS = {
  tier: {
    Bronze: '#CD7F32',
    Silver: '#C0C0C0',
    Gold: '#D4AF37',
    Platinum: '#E5E4E2',
    Elite: '#C9A84C',
  },
  condition: {
    Pristine: '#D4AF37',
    MinorWear: '#6B5C52',
    Upcycle: '#4CAF50',
    RecycleOnly: '#3A2C30',
  },
  status: {
    PREMIUM: '#9B1B30',
    'NEW RELEASE': '#C9A84C',
    'LAST PIECE': '#9B1B30',
    'AVAILABLE NOW': '#4CAF50',
  }
};

export const Badge: React.FC<BadgeProps> = ({ variant, label, subType }) => {
  let bgColor = '#3A2C30';
  let textColor = 'white';

  if (variant === 'tier' && subType && (COLORS.tier as any)[subType]) {
    bgColor = (COLORS.tier as any)[subType];
    textColor = '#1A0C10';
  } else if (variant === 'fitScore') {
    bgColor = '#9B1B30';
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
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
