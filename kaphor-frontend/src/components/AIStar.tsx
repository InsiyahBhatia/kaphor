import React from 'react';
import { colors } from '../theme';
import Svg, { Path } from 'react-native-svg';

interface AIStarProps {
  size?: number;
  color?: string;
  rotate?: boolean;
}

const SPARKLE_PATH =
  'M12 1 C13.2 7.6 16.4 10.8 23 12 C16.4 13.2 13.2 16.4 12 23 C10.8 16.4 7.6 13.2 1 12 C7.6 10.8 10.8 7.6 12 1 Z';

export const AIStar: React.FC<AIStarProps> = ({ size = 24, color = colors.white, rotate = false }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={rotate ? { transform: [{ rotate: '45deg' }] } : undefined}
  >
    <Path d={SPARKLE_PATH} fill={color} />
  </Svg>
);