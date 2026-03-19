/**
 * Kaphor design system — dark luxury aesthetic.
 * Use these values consistently; do not introduce new colors.
 */
export const colors = {
  // Backgrounds
  bg: '#0F0609',
  bgCard: '#1A0C10',
  bgMuted: '#261018',

  // Brand
  crimson: '#8B0000',
  crimsonDark: '#5C0000',
  crimsonLight: '#B22222',

  // Text
  textPrimary: '#F5F0EB',
  textSecond: '#A89880',
  textMuted: '#6B5C52',

  // Accent
  gold: '#C9A84C',
  goldLight: '#E8C97A',

  // UI
  border: '#2C1A1F',
  success: '#2E7D32',
  error: '#C62828',
  warning: '#E65100',
} as const;

export const typography = {
  headings: 'Cormorant Garamond',
  body: 'DM Sans',
  mono: 'JetBrains Mono',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

export const theme = {
  colors,
  typography,
  spacing,
  radius,
} as const;

export type Theme = typeof theme;
