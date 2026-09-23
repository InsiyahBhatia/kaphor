import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

interface BarsProps {
  data: number[];
  height?: number;
  barColor?: string;
  max?: number;
  showValue?: boolean;
}

/**
 * Hand-rolled vertical bar chart (no chart dependencies).
 * Zero values render as a 2px tick so the axis stays visible.
 */
export function Bars({ data, height = 72, barColor = colors.ink, max, showValue = false }: BarsProps) {
  const positive = data.map((v) => Math.max(0, v ?? 0));
  const peak = max && max > 0 ? max : (positive.length ? Math.max(...positive) : 0);
  const d = Math.max(peak, 1);

  return (
    <View style={[styles.wrap, { height }]}>
      {data.map((raw, i) => {
        const v = Math.max(0, raw ?? 0);
        const h = v === 0 && peak === 0 ? 2 : Math.round((v / d) * height);
        return (
          <View key={i} style={styles.barCol}>
            <View style={styles.barCell}>
              {showValue && v > 0 ? <Text style={styles.barValue}>{v}</Text> : null}
              <View
                style={[
                  styles.bar,
                  {
                    height: h === 0 ? 2 : h,
                    backgroundColor: barColor,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

export function Sparkline({ data, color = colors.crimson, height = 28 }: SparklineProps) {
  const counts = data.map((v) => Math.max(0, v ?? 0));
  const peak = counts.length ? Math.max(...counts) : 0;
  const d = Math.max(peak, 1);

  return (
    <View style={[styles.sparkRow, { height }]}>
      {counts.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            marginHorizontal: 1,
            backgroundColor: color,
            opacity: v === 0 ? 0.25 : 0.55 + 0.45 * (v / d),
            height: Math.max(3, Math.round((v / d) * height)),
            alignSelf: 'flex-end',
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barCol: { flex: 1 },
  barCell: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '100%', borderRadius: 1 },
  barValue: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 3,
  },
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end' },
});