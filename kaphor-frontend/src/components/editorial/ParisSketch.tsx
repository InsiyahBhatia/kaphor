import React from 'react';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { EditorialAccents } from './EditorialAssets';

export type ParisSketchVariant = 'facade01' | 'facade02' | 'facade03';

interface ParisSketchProps {
  variant?: ParisSketchVariant;
  width?: number;
  height?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export function ParisSketch({
  variant = 'facade01',
  width = 180,
  height = 140,
  opacity = 0.16,
  style,
  imageStyle,
}: ParisSketchProps) {
  let source;
  switch (variant) {
    case 'facade02':
      source = EditorialAccents.parisSketch02;
      break;
    case 'facade03':
      source = EditorialAccents.parisSketch03;
      break;
    case 'facade01':
    default:
      source = EditorialAccents.parisSketch01;
      break;
  }

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        { width, height, opacity },
        style,
      ]}
    >
      <Image
        source={source}
        style={[styles.image, imageStyle]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    zIndex: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
