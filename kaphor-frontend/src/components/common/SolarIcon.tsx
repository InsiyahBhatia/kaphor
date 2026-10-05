import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';
import { SOLAR_PATHS } from './solarIconData';

/**
 * App icons. Uses the Solar icon set (480 Design, CC BY 4.0).
 *
 * Works like the old Ionicons component: <SolarIcon name="home-outline" size={24} color={...} />
 *  - names ending in "-outline" are the light outline style
 *  - other names are the solid style
 *
 * Icons without a label are hidden from screen readers; pass `accessibilityLabel`
 * when an icon is the only thing telling the person what a control does.
 */

export type SolarIconName = keyof typeof SOLAR_PATHS;

interface SolarIconProps {
  name: SolarIconName | string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const FALLBACK = 'help-outline';

/** Global icon scale: the app's icons were drawn too large, so every icon renders at 70% of its requested size. */
export const ICON_SCALE = 0.7;

function SolarIconBase({ name, size = 24, color = colors.ink, style, accessibilityLabel }: SolarIconProps) {
  const shapes = SOLAR_PATHS[name] ?? SOLAR_PATHS[FALLBACK];
  if (__DEV__ && !SOLAR_PATHS[name]) {
    console.warn(`[SolarIcon] unknown icon "${name}"`);
  }
  return (
    <Svg
      width={Math.round(size * ICON_SCALE)}
      height={Math.round(size * ICON_SCALE)}
      viewBox="0 0 24 24"
      style={style}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    >
      {shapes.map(([d, evenOdd, opacity], i) => (
        <Path
          key={i}
          d={d}
          fill={color}
          fillRule={evenOdd ? 'evenodd' : 'nonzero'}
          clipRule={evenOdd ? 'evenodd' : 'nonzero'}
          opacity={opacity}
        />
      ))}
    </Svg>
  );
}

export const SolarIcon = Object.assign(React.memo(SolarIconBase), {
  /** Same shape as Ionicons.glyphMap, so `keyof typeof SolarIcon.glyphMap` still works for icon name types. */
  glyphMap: SOLAR_PATHS,
});
