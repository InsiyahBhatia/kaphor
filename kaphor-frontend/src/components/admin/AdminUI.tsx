import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
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

function Loader() {
  return <ActivityIndicator size="small" color={colors.ink} />;
}
export { Loader };

const styles = StyleSheet.create({
  sectionLabelRow: { marginBottom: 10, marginTop: 24 },
  sectionLabelRule: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  sectionRule: { position: 'absolute', top: 4, width: 24, height: 1, backgroundColor: colors.border },
  sectionLabel: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  chipText: { fontFamily: typography.mono, fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, letterSpacing: 1 },
  infoValue: { fontFamily: typography.mono, fontSize: 11, fontWeight: '700', color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, letterSpacing: 1 },
  iconBtn: { width: 32, height: 32, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});