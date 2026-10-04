import React from 'react';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { EditorialFashion } from './EditorialAssets';

export type FashionFigureVariant =
  | 'muse-hero'
  | 'paris-01'
  | 'paris-02'
  | 'paris-03'
  | 'paris-05'
  | 'paris-07'
  | 'paris-10'
  | 'paris-15'
  | 'paris-29'
  | 'style-01'
  | 'style-06'
  | 'style-13'
  | 'style-26';

interface FashionFigureProps {
  variant?: FashionFigureVariant;
  width?: number;
  height?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  contentFit?: 'contain' | 'cover';
}

export function FashionFigure({
  variant = 'muse-hero',
  width = 200,
  height = 200,
  opacity = 0.9,
  style,
  imageStyle,
  contentFit = 'contain',
}: FashionFigureProps) {
  let source;
  switch (variant) {
    case 'muse-hero':
      source = EditorialFashion.museHero;
      break;
    case 'paris-01':
      source = EditorialFashion.parisFigure01;
      break;
    case 'paris-02':
      source = EditorialFashion.parisFigure02;
      break;
    case 'paris-03':
      source = EditorialFashion.parisFigure03;
      break;
    case 'paris-05':
      source = EditorialFashion.parisFigure05;
      break;
    case 'paris-07':
      source = EditorialFashion.parisFigure07;
      break;
    case 'paris-10':
      source = EditorialFashion.parisFigure10;
      break;
    case 'paris-15':
      source = EditorialFashion.parisFigure15;
      break;
    case 'paris-29':
      source = EditorialFashion.parisFigure29;
      break;
    case 'style-01':
      source = EditorialFashion.styleFigure01;
      break;
    case 'style-06':
      source = EditorialFashion.styleFigure06;
      break;
    case 'style-13':
      source = EditorialFashion.styleFigure13;
      break;
    case 'style-26':
    default:
      source = EditorialFashion.styleFigure26;
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
        resizeMode={contentFit}
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
