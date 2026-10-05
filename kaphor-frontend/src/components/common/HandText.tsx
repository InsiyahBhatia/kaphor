import React from 'react';
import { Text, TextProps, TextStyle, StyleProp, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography } from '../../theme';

/**
 * Handwritten text. Use it for the "voice" of the app: greetings, short notes,
 * hints, empty states, captions. Keep real content (prices, forms, legal text)
 * in the normal body font.
 *
 * Caveat is a small font, so sizes here run a little bigger than normal text.
 * Now that handwritten/handBold map to PlusJakartaSans, sizes are normalized.
 */

type Size = 'sm' | 'md' | 'lg' | 'xl';
const SIZES: Record<Size, { fontSize: number; lineHeight: number }> = {
  sm: { fontSize: 13, lineHeight: 18 },
  md: { fontSize: 14, lineHeight: 20 },
  lg: { fontSize: 18, lineHeight: 24 },
  xl: { fontSize: 24, lineHeight: 30 },
};

interface HandTextProps extends TextProps {
  size?: Size;
  bold?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function HandText({ size = 'md', bold = false, color = colors.inkSoft, style, ...rest }: HandTextProps) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: bold ? typography.handBold : typography.handwritten, color },
        SIZES[size],
        style,
      ]}
    />
  );
}

/** A loose hand-drawn underline to put under a heading. */
export function Squiggle({ width = 96, color = colors.rose }: { width?: number; color?: string }) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={10} viewBox="0 0 96 10">
        <Path
          d="M2 6 C 12 1, 18 9, 28 5 S 44 2, 54 6 S 72 9, 82 4 S 92 4, 94 5"
          fill="none"
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

export const handStyles = StyleSheet.create({
  note: { fontFamily: typography.handwritten, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
});
