/**
 * Kaphor design system — brutalist spy-agency playing-card aesthetic.
 */
export const colors = {
  // 60-30-10 Minimal & Bold Brutalist Palette
  cream: '#F7F5F0',    // 60% Base
  red: '#A82222',      // 10% Accent
  charcoal: '#1E1F22', // 30% Structural/Text
  navy: '#1C2B4A',
  forest: '#1E3B2F',
  copper: '#4A2E1A',
  purple: '#2D1B4E',
  teal: '#0D3B3B',
  orange: '#C95F12',
  white: '#FFFFFF',    // 30% Card background
  
  // Backwards compatibility mappings
  bg: '#F7F5F0',       // 60%
  bgCard: '#FFFFFF',   // 30%
  bgMuted: '#EAE6DF',  // Subtle contrast
  
  crimson: '#A82222',  // 10% Accent
  crimsonDark: '#7A1616',
  crimsonLight: '#D33F3F',
  
  textPrimary: '#1E1F22', // 30%
  textSecond: '#383A40',
  textMuted: '#9A8E7E',
  
  gold: '#C95F12',
  goldLight: '#E87D33',
  
  border: '#1E1F22', // Sharp dark borders matching charcoal
  success: '#1E3B2F',
  error: '#A82222',
  warning: '#C95F12',
  black: '#0F0F11',
} as const;

export const typography = {
  headings: 'BebasNeue_400Regular',
  body: 'IBMPlexMono_400Regular',
  mono: 'IBMPlexMono_400Regular',
  accent: 'PlayfairDisplay_400Regular_Italic',
  ranks: 'IMFellEnglish_400Regular',
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
  sm: 0,   // Brutalist sharp edges
  md: 4,   // Slightly rounded
  lg: 8,
  xl: 12,
  card: 20,
  full: 999,
} as const;

export const theme = {
  colors,
  typography,
  spacing,
  radius,
} as const;

export type Theme = typeof theme;
