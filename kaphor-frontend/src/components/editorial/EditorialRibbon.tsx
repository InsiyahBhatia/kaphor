import React from 'react';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { EditorialRibbons } from './EditorialAssets';

export type RibbonVariant =
  | 'flowing-left'
  | 'flowing-right'
  | 'sticker-01'
  | 'sticker-02'
  | 'sticker-03'
  | 'sticker-04';

interface EditorialRibbonProps {
  variant?: RibbonVariant;
  width?: number;
  height?: number;
  opacity?: number;
  rotation?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export function EditorialRibbon({
  variant = 'flowing-left',
  width = 120,
  height = 80,
  opacity = 0.9,
  rotation,
  style,
  imageStyle,
}: EditorialRibbonProps) {
  let source;
  switch (variant) {
    case 'flowing-left':
      source = EditorialRibbons.flowingLeft;
      break;
    case 'flowing-right':
      source = EditorialRibbons.flowingRight;
      break;
    case 'sticker-01':
      source = EditorialRibbons.sticker01;
      break;
    case 'sticker-02':
      source = EditorialRibbons.sticker02;
      break;
    case 'sticker-03':
      source = EditorialRibbons.sticker03;
      break;
    case 'sticker-04':
    default:
      source = EditorialRibbons.sticker04;
      break;
  }

  const transformStyle: ViewStyle = rotation ? { transform: [{ rotate: rotation }] } : {};

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        transformStyle,
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
    overflow: 'visible',
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
