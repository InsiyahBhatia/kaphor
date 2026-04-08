import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../../theme';

interface Props {
  width?: number | string;
  height?: number | string;
  style?: any;
}

export function LoadingSkeleton({ width = '100%', height = 150, style }: Props) {
  const customOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(customOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(customOpacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.skeleton, { width, height, opacity: customOpacity }, style]} />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.charcoal,
    borderWidth: 2,
    borderColor: 'rgba(26,26,26,0.3)',
    marginBottom: 16,
  },
});
