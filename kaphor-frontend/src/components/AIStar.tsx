import React from 'react';
import { View, StyleSheet } from 'react-native';

interface AIStarProps {
  size?: number;
  color?: string;
  rotate?: boolean;
}

export const AIStar: React.FC<AIStarProps> = ({ size = 24, color = '#FFFFFF', rotate = false }) => {
  const bar = size * 0.34;
  const radius = size * 0.06;

  return (
    <View
      style={[
        styles.box,
        { width: size, height: size },
        rotate && { transform: [{ rotate: '45deg' }] },
      ]}
    >
      <View style={{ position: 'absolute', width: bar, height: size, backgroundColor: color, borderRadius: radius }} />
      <View style={{ position: 'absolute', width: size, height: bar, backgroundColor: color, borderRadius: radius }} />
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});