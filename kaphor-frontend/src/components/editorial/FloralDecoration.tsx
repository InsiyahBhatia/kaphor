import React from 'react';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { EditorialBotanicals } from './EditorialAssets';

export type FloralPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'inline';

export type FloralVariant =
  | 'sprig01'
  | 'sprig02'
  | 'sprig03'
  | 'sprig04'
  | 'sprig05'
  | 'sprig06'
  | 'sprig07'
  | 'sprig08';

interface FloralDecorationProps {
  variant?: FloralVariant;
  position?: FloralPosition;
  size?: number;
  opacity?: number;
  rotation?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export function FloralDecoration({
  variant = 'sprig01',
  position = 'inline',
  size = 56,
  opacity = 0.85,
  rotation,
  style,
  imageStyle,
}: FloralDecorationProps) {
  const source = EditorialBotanicals[variant] || EditorialBotanicals.sprig01;

  const positionStyles: ViewStyle = {};
  if (position === 'top-left') {
    positionStyles.position = 'absolute';
    positionStyles.top = -12;
    positionStyles.left = -12;
  } else if (position === 'top-right') {
    positionStyles.position = 'absolute';
    positionStyles.top = -12;
    positionStyles.right = -12;
  } else if (position === 'bottom-left') {
    positionStyles.position = 'absolute';
    positionStyles.bottom = -12;
    positionStyles.left = -12;
  } else if (position === 'bottom-right') {
    positionStyles.position = 'absolute';
    positionStyles.bottom = -12;
    positionStyles.right = -12;
  }

  const transformStyle: ViewStyle = rotation ? { transform: [{ rotate: rotation }] } : {};

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        positionStyles,
        transformStyle,
        { width: size, height: size, opacity },
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
    zIndex: 2,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
