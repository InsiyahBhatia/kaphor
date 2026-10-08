import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { colors, typography } from '../../theme';

/**
 * The Kaphor logo: a bold K inside a rose loop with an arrow
 * (clothes going round again). Drawn in code so it stays sharp at any size
 * and always uses the app colors.
 */

interface MarkProps {
  size?: number;
  ring?: string;
  letter?: string;
}

export function KaphorMark({ size = 32, ring = colors.rose, letter = colors.ink }: MarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Kaphor logo">
      <Path
        d="M 87.58 36.32 A 40 40 0 1 1 50 10"
        fill="none"
        stroke={ring}
        strokeWidth={8}
        strokeLinecap="butt"
      />
      <Polygon points="49,1 64,10 49,19" fill={ring} />
      {/* Symmetric K: stem plus two mirrored arms, centred on the ring (50,50) */}
      <Polygon points="31,29 40.5,29 40.5,71 31,71" fill={letter} />
      <Polygon points="57.5,29 69,29 40.5,54.5 40.5,43.5" fill={letter} />
      <Polygon points="57.5,71 69,71 40.5,45.5 40.5,56.5" fill={letter} />
    </Svg>
  );
}

interface LogoProps {
  /** Height of the mark in pixels */
  size?: number;
  /** Show the KAPHOR word next to the mark */
  showWord?: boolean;
  color?: string;
}

export function KaphorLogo({ size = 30, showWord = true, color = colors.ink }: LogoProps) {
  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="Kaphor">
      <KaphorMark size={size} letter={color} />
      {showWord ? (
        <Text style={[styles.word, { fontSize: size * 0.85, color }]}>KAPHOR</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: {
    fontFamily: typography.condensed,
    letterSpacing: 3,
    includeFontPadding: false,
  },
});
