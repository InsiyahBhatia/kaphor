import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../theme';
import { SolarIcon } from '../common/SolarIcon';
import { EditorialIconName } from './EditorialAssets';

export type { EditorialIconName };

export interface EditorialIconProps {
  name: EditorialIconName;
  /** Rendered width and height in dp. */
  size?: number;
  /** Icon color. Defaults to ink. */
  tintColor?: string;
  /** Kept so older call sites still compile; icons are always drawn in `tintColor`. */
  allowTint?: boolean;
  focused?: boolean;
  /** Screen-reader label. Without it the icon is treated as decorative and hidden from a11y. */
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: unknown;
}

export function EditorialIcon({
  name,
  size = 24,
  tintColor,
  focused,
  accessibilityLabel,
  testID,
  style,
}: EditorialIconProps) {
  const labelled = !!accessibilityLabel;
  // The active (focused) icon uses the accent color unless a color was given
  const color = tintColor ?? (focused ? colors.rose : colors.ink);

  return (
    <View
      testID={testID}
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={focused === undefined ? undefined : { selected: focused }}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
      style={[styles.container, { width: size, height: size }, style]}
    >
      <SolarIcon name={`ed:${name}`} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
