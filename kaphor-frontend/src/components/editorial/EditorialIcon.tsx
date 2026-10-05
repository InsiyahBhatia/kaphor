import React from 'react';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { EditorialIconName, getEditorialIcon } from './EditorialAssets';

export type { EditorialIconName };

export interface EditorialIconProps {
  name: EditorialIconName;
  /** Rendered width and height in dp. Icons ship as square 256px canvases, so this is the real visual box. */
  size?: number;
  /**
   * Only applied when `allowTint` is true. The artwork is full-colour, so tinting turns it
   * into a flat silhouette; leave both unset to keep the illustration as drawn.
   */
  tintColor?: string;
  allowTint?: boolean;
  focused?: boolean;
  /** Screen-reader label. Without it the icon is treated as decorative and hidden from a11y. */
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export function EditorialIcon({
  name,
  size = 24,
  tintColor,
  allowTint = false,
  focused,
  accessibilityLabel,
  testID,
  style,
  imageStyle,
}: EditorialIconProps) {
  const source = getEditorialIcon(name);
  const labelled = !!accessibilityLabel;

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
      <Image
        source={source}
        style={[
          { width: size, height: size },
          allowTint && tintColor ? { tintColor } : undefined,
          imageStyle,
        ]}
        resizeMode="contain"
        fadeDuration={0}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
