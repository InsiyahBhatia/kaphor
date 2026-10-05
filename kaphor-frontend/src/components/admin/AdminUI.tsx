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
      <Text style={[styles.chipText, { color }]}>{String(children).toUpperCase()}</Text>
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
      <Ionicons name={icon} size={size} color={color} />
    </TouchableOpacity>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { Loader as SkeletonLoader } from '../common/Loader';

function Loader() {
  return <SkeletonLoader compact />;
}
export { Loader };

const styles = StyleSheet.create({
  sectionLabelRow: { marginBottom: 12, marginTop: 22 },
  sectionLabelRule: { borderTopWidth: 2, borderTopColor: colors.ink, paddingTop: 12 },
  sectionRule: { position: 'absolute', top: 0, width: 28, height: 2, backgroundColor: colors.crimson },
  sectionLabel: {
    fontFamily: typography.headings,
    fontSize: 16,
    color: colors.ink,
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 2,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  chip: {
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  chipText: { fontFamily: typography.monoBold, fontSize: 11, letterSpacing: 0.8 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.borderLight,
  },
  infoLabel: { fontFamily: typography.monoBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1 },
  infoValue: { fontFamily: typography.monoBold, fontSize: 11, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  empty: {
    paddingVertical: 36,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderStyle: 'dashed',
    borderRadius: 2,
    marginVertical: 10,
  },
  emptyText: { fontFamily: typography.monoBold, fontSize: 11, color: colors.textMuted, letterSpacing: 1.2 },
  iconBtn: {
    width: 34,
    height: 34,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
});