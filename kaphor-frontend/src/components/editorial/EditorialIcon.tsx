import React from 'react';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { EditorialIcons, EditorialIconName } from './EditorialAssets';

export type { EditorialIconName };

export interface EditorialIconProps {
  name: EditorialIconName;
  size?: number;
  tintColor?: string;
  allowTint?: boolean;
  focused?: boolean;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export function EditorialIcon({
  name,
  size = 24,
  tintColor,
  allowTint = false,
  focused,
  style,
  imageStyle,
}: EditorialIconProps) {
  const iconSource = EditorialIcons[name] || EditorialIcons.sparkle;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Image
        source={iconSource}
        style={[
          styles.image,
          { width: size, height: size },
          allowTint && tintColor ? { tintColor } : undefined,
          imageStyle,
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
