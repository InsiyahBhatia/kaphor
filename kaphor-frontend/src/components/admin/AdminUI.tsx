import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography } from '../../theme';

export function formatINR(amount: number | null | undefined): string {
  const n = Math.round(Number(amount) || 0);
  return `₹${n.toLocaleString('en-IN')}`;
}

export function SectionLabel({ children, rule = true }: { children: React.ReactNode; rule?: boolean }) {
  return (
    <View style={[styles.sectionLabelRow, rule && styles.sectionLabelRule]}>
      {rule && <View style={styles.sectionRule} />}
      <Text style={styles.sectionLabel}>{String(children).toUpperCase()}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ children, color = colors.ink, bg = colors.bgMuted }: { children: React.ReactNode; color?: string; bg?: string }) {
  return (
    <View style={[styles.chip, { borderColor: color, backgroundColor: bg }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.chipText, { color }]}>{String(children).toUpperCase()}</Text>
    </View>
  );
}

export function InfoRow({ label, value, valueColor }: { label: string; value: React.ReactNode; valueColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text.toUpperCase()}</Text>
    </View>
  );
}

export function IconBtn({
  icon,
  onPress,
  bg = colors.ink,
  color = colors.white,
  size = 14,
  disabled,
}: {
  icon: string;
  onPress: () => void;
  bg?: string;
  color?: string;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={icon.replace(/-outline$/, '').replace(/-/g, ' ')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.iconBtn, { backgroundColor: bg }, disabled && { opacity: 0.4 }]}
    >
      {/* @ts-ignore */}
      <SolarIcon name={icon} size={size} color={color} />
    </TouchableOpacity>
  );
}

import { SolarIcon } from '../common/SolarIcon';
import { Loader as SkeletonLoader } from '../common/Loader';

function Loader() {
  return <SkeletonLoader compact />;
}
export { Loader };

const styles = StyleSheet.create({
  sectionLabelRow: { marginBottom: 10, marginTop: 18 },
  sectionLabelRule: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 12 },
  sectionRule: { position: 'absolute', top: 0, width: 24, height: 2, backgroundColor: colors.charcoal },
  sectionLabel: {
    fontFamily: typography.bodyBold,
    fontSize: 13,
    color: colors.charcoal,
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  chipText: { fontFamily: typography.bodyMedium, fontSize: 11, letterSpacing: 0.2 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: { fontFamily: typography.bodyMedium, fontSize: 12, color: colors.textMuted },
  infoValue: { fontFamily: typography.bodyBold, fontSize: 12, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  empty: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: colors.paperLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    borderRadius: 10,
    marginVertical: 8,
  },
  emptyText: { fontFamily: typography.bodyMedium, fontSize: 12, color: colors.textMuted },
  iconBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});