import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, typography } from '../../theme';
import { FloralDecoration } from './FloralDecoration';

interface MagazineDividerProps {
  label?: string;
  hasFloral?: boolean;
  style?: StyleProp<ViewStyle>;
  color?: string;
}

export function MagazineDivider({
  label,
  hasFloral = false,
  style,
  color = 'rgba(23, 23, 23, 0.16)',
}: MagazineDividerProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.line, { backgroundColor: color }]} />
      {hasFloral ? (
        <View style={styles.centerDecor}>
          <FloralDecoration variant="sprig03" size={24} opacity={0.6} />
        </View>
      ) : label ? (
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>{label.toUpperCase()}</Text>
        </View>
      ) : (
        <View style={styles.diamond}>
          <Text style={[styles.diamondText, { color }]}>✦</Text>
        </View>
      )}
      <View style={[styles.line, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    paddingHorizontal: 16,
  },
  line: {
    flex: 1,
    height: 1,
  },
  centerDecor: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    paddingHorizontal: 12,
  },
  labelText: {
    fontFamily: typography.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  diamond: {
    paddingHorizontal: 8,
  },
  diamondText: {
    fontSize: 10,
    lineHeight: 12,
  },
});
