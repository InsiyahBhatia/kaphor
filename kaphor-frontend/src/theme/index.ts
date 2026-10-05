/**
 * Kaphor Design System — Editorial Fashion Illustration × Circular Fashion
 * Based on DESIGN.md
 */

export const colors = {
  // Editorial Paper Surfaces
  paper: '#F5F0E6',
  paperLight: '#FAF7F0',
  paperDark: '#E8DFD1',
  cream: '#F5F0E6',
  bg: '#F5F0E6',
  bgCard: '#FAF7F0',
  bgMuted: '#E8DFD1',

  // Ink & Typography
  ink: '#171717',
  inkSoft: '#4B4843',
  charcoal: '#171717',
  black: '#171717',
  textPrimary: '#171717',
  textSecond: '#4B4843',
  textMuted: '#7A756D',
  border: '#171717',
  borderLight: '#D8CEBE',
  white: '#FFFFFF',

  // Fashion Editorial Accents
  rose: '#C92745',
  dustyRose: '#D98991',
  blush: '#EAB8B5',
  mauve: '#A88C9C',
  crimson: '#C92745',
  crimsonDark: '#5C0B12',
  crimsonLight: '#FCEBEF',

  // Sustainability & Circularity (Emerald / Forest / Sage)
  forest: '#176451',
  emerald: '#176451',
  sage: '#819B83',
  emeraldDark: '#072B20',
  emeraldLight: '#E6F4EF',

  // Prestige & Heritage (Gold / Brass)
  gold: '#B89A3E',
  goldDark: '#4A3A13',
  goldLight: '#FDF9EE',
  copper: '#B89A3E',

  // Overlays
  overlay: 'rgba(23,23,23,0.55)',
  overlayLight: 'rgba(23,23,23,0.08)',
  paperGlass: 'rgba(250,247,240,0.92)',

  // Semantic mappings
  success: '#176451',
  error: '#C92745',
  warning: '#B89A3E',
  red: '#C92745',
  navy: '#171717',
  orange: '#C95F12',
  terracotta: '#C85A32',
  terracottaDark: '#8B3617',
  terracottaLight: '#FCEEE8',
  purple: '#171717',
  teal: '#176451',
} as const;

export const typography = {
  // Editorial Headlines & Titles (High-Fashion Editorial Masthead)
  headings: 'PlayfairDisplay_700Bold',
  editorialDisplay: 'CormorantGaramond_700Bold',
  displaySerif: 'PlayfairDisplay_700Bold',
  
  // Editorial High-Fashion Serif & Heritage
  editorialSerif: 'CormorantGaramond_600SemiBold',
  serif: 'CormorantGaramond_600SemiBold',
  serifRegular: 'CormorantGaramond_400Regular',
  serifItalic: 'PlayfairDisplay_400Regular_Italic',
  accent: 'PlayfairDisplay_400Regular_Italic',
  ranks: 'IMFellEnglish_400Regular',

  // Modern Clean Luxury Body Copy (High readability, elegant geometric sans)
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodyBold: 'PlusJakartaSans_700Bold',

  // Monospace & Editorial Metadata (Stamps, SKUs, Technical Tags)
  mono: 'IBMPlexMono_400Regular',
  monoBold: 'IBMPlexMono_700Bold',

  // Bold Capsule / Poster Condensed
  condensed: 'BebasNeue_400Regular',

  // Handwritten Editorial Annotations & Signatures
  script: 'Caveat_400Regular',
  handwritten: 'Caveat_400Regular',
  handSemi: 'Caveat_600SemiBold',
  handBold: 'Caveat_700Bold',
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
  sm: 2,
  md: 4,
  lg: 8,
  xl: 12,
  card: 10,
  full: 999,
} as const;
