/**
 * Kaphor design system — Editorial Archive / Circular Fashion Palette
 * Strict 5-Role Color Palette
 */
export const colors = {
  // Core 5-Role Color System (Each color has exactly ONE job)
  cream: '#F5F1E8',       // Base/paper surface
  ink: '#141414',         // Text, structure, primary buttons, AI features
  crimson: '#C81E2C',     // Urgency/live states only — active nav tab, ending soon, live counters
  emerald: '#0F5C46',     // Sustainability data only — CO2 saved, water saved, circular impact metrics
  gold: '#B8912F',        // Status/prestige only — membership tier badges + "Curated Match" tags

  // Dark & Light Family Shades (Rule: Text on colored fill uses darkest shade from same family)
  emeraldDark: '#072B20',
  emeraldLight: '#E6F4EF',
  crimsonDark: '#5C0B12',
  crimsonLight: '#FCEBEF',
  goldDark: '#4A3A13',
  goldLight: '#FDF9EE',

  // Structure / Utility aliases
  white: '#FFFFFF',
  black: '#141414',
  charcoal: '#141414',    // Mapped to ink
  bg: '#F5F1E8',          // Cream paper surface
  bgCard: '#FFFFFF',
  bgMuted: '#EAE6DF',
  
  border: '#141414',      // Sharp ink structure borders
  textPrimary: '#141414', // Ink text
  textSecond: '#383A40',
  textMuted: '#706C66',
  
  // Backward compatibility alias mappings
  red: '#C81E2C',         // Mapped to crimson
  forest: '#0F5C46',      // Mapped to emerald
  terracotta: '#141414',  // Replaced/folded into ink
  terracottaDark: '#141414',
  terracottaLight: '#F5F1E8',
  orange: '#141414',
  copper: '#B8912F',
  navy: '#141414',
  teal: '#0F5C46',
  purple: '#141414',

  success: '#0F5C46',
  error: '#C81E2C',
  warning: '#B8912F',
} as const;

export const typography = {
  headings: 'BebasNeue_400Regular',
  mono: 'IBMPlexMono_400Regular',
  body: 'IBMPlexMono_400Regular',
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

