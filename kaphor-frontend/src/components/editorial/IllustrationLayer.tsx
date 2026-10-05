import React from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, typography } from '../../theme';
import {
  EditorialAccents,
  EditorialBotanicals,
  EditorialCouture,
  EditorialFashion,
  EditorialIndian,
  EditorialRibbons,
} from './EditorialAssets';
import { EditorialIcon } from './EditorialIcon';
import type { EditorialIconName } from './EditorialIcon';
import { FloralDecoration } from './FloralDecoration';
import { EditorialRibbon } from './EditorialRibbon';
import { FashionFigure } from './FashionFigure';
import { HandwrittenNote } from './HandwrittenNote';
import { ParisSketch } from './ParisSketch';
import { MagazineDivider } from './MagazineDivider';

export type { EditorialIconName };
export {
  EditorialIcon,
  EditorialIndian,
  FloralDecoration,
  EditorialRibbon,
  FashionFigure,
  HandwrittenNote,
  ParisSketch,
  MagazineDivider,
};

export type EditorialVariant =
  | 'home'
  | 'archive'
  | 'shop'
  | 'rental'
  | 'swap'
  | 'upcycle'
  | 'profile'
  | 'messages'
  | 'deck'
  | 'card';

interface IllustrationLayerProps {
  variant?: EditorialVariant;
  style?: StyleProp<ViewStyle>;
  muted?: boolean;
}

export function IllustrationLayer({
  variant = 'archive',
  style,
  muted = false,
}: IllustrationLayerProps) {
  if (variant === 'card') {
    return (
      <View pointerEvents="none" style={[styles.cardLayer, style]}>
        <Image
          source={EditorialBotanicals.sprig04}
          style={styles.cardSticker}
          resizeMode="contain"
        />
      </View>
    );
  }

  const baseOpacity = muted ? 0.35 : 1.0;

  if (variant === 'home') {
    return (
      <View pointerEvents="none" style={[styles.layer, style, { opacity: baseOpacity }]}>
        {/* Subtle Architectural Palace Jharokha in Soft Heritage Gold/Sandstone */}
        <Image
          source={EditorialIndian.jharokhaWindowGarlands}
          style={styles.homePalaceBackdrop}
          resizeMode="contain"
        />
        {/* Editorial Indian Heritage Muse in Rani Pink Banarasi & Gajra */}
        <Image
          source={EditorialIndian.musePinkBanarasi}
          style={styles.homeMuseFigure}
          resizeMode="contain"
        />
        <View style={styles.inkRule} />
      </View>
    );
  }

  if (variant === 'rental') {
    return (
      <View pointerEvents="none" style={[styles.layer, style, { opacity: baseOpacity }]}>
        {/* Carved Palace Jharokha Window with Mogra Garlands */}
        <Image
          source={EditorialIndian.jharokhaWindowGarlands}
          style={styles.rentalJharokha}
          resizeMode="contain"
        />
        {/* Royal Crimson Bridal Zari Lehenga */}
        <Image
          source={EditorialIndian.royalCrimsonLehenga}
          style={styles.rentalLehenga}
          resizeMode="contain"
        />
        {/* Royal Zari Potli Bag */}
        <Image
          source={EditorialIndian.royalCrimsonPotli}
          style={styles.rentalPotli}
          resizeMode="contain"
        />
        <View style={styles.inkRule} />
      </View>
    );
  }

  if (variant === 'swap') {
    return (
      <View pointerEvents="none" style={[styles.layer, style, { opacity: baseOpacity }]}>
        {/* Two women exchanging garments / peer-to-peer exchange */}
        <Image
          source={EditorialFashion.parisFigure03}
          style={styles.swapFigureLeft}
          resizeMode="contain"
        />
        <Image
          source={EditorialFashion.parisFigure07}
          style={styles.swapFigureRight}
          resizeMode="contain"
        />
        <Image
          source={EditorialRibbons.sticker02}
          style={styles.swapBadge}
          resizeMode="contain"
        />
        <View style={styles.inkRule} />
      </View>
    );
  }

  if (variant === 'upcycle') {
    return (
      <View pointerEvents="none" style={[styles.layer, style, { opacity: baseOpacity }]}>
        {/* Scissors and tailoring tools */}
        <Image
          source={EditorialCouture.tool01}
          style={styles.upcycleScissors}
          resizeMode="contain"
        />
        <Image
          source={EditorialCouture.tool02}
          style={styles.upcycleThread}
          resizeMode="contain"
        />
        <Image
          source={EditorialBotanicals.sprig03}
          style={styles.upcycleFloral}
          resizeMode="contain"
        />
        <View style={styles.inkRule} />
      </View>
    );
  }

  if (variant === 'profile') {
    return (
      <View pointerEvents="none" style={[styles.layer, style, { opacity: baseOpacity }]}>
        <Image
          source={EditorialBotanicals.sprig08}
          style={styles.profileFloral}
          resizeMode="contain"
        />
        <Image
          source={EditorialAccents.accent01}
          style={styles.profileCuratorSeal}
          resizeMode="contain"
        />
        <View style={styles.inkRule} />
      </View>
    );
  }

  if (variant === 'messages') {
    return (
      <View pointerEvents="none" style={[styles.layer, style, { opacity: baseOpacity }]}>
        <Image
          source={EditorialBotanicals.sprig05}
          style={styles.messagesFloral}
          resizeMode="contain"
        />
        <Image
          source={EditorialAccents.accent02}
          style={styles.messagesStamp}
          resizeMode="contain"
        />
        <View style={styles.inkRule} />
      </View>
    );
  }

  if (variant === 'deck') {
    return (
      <View pointerEvents="none" style={[styles.layer, style, { opacity: baseOpacity }]}>
        <Image
          source={EditorialAccents.parisSketch03}
          style={styles.deckSketch}
          resizeMode="contain"
        />
        <Image
          source={EditorialBotanicals.sprig02}
          style={styles.deckFloral}
          resizeMode="contain"
        />
        <View style={styles.inkRule} />
      </View>
    );
  }

  // Default: 'archive' / 'shop'
  return (
    <View pointerEvents="none" style={[styles.layer, style, { opacity: baseOpacity }]}>
      <Image
        source={EditorialAccents.parisSketch01}
        style={styles.archiveParisSketch}
        resizeMode="contain"
      />
      <Image
        source={EditorialBotanicals.sprig02}
        style={styles.archiveFloralLeft}
        resizeMode="contain"
      />
      <Image
        source={EditorialBotanicals.sprig07}
        style={styles.archiveFloralRight}
        resizeMode="contain"
      />
      <View style={styles.inkRule} />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EditorialPageHeader Component
// ══════════════════════════════════════════════════════════════════════════════
interface EditorialPageHeaderProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  variant?: EditorialVariant;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function EditorialPageHeader({
  title,
  subtitle,
  eyebrow,
  variant = 'archive',
  children,
  style,
}: EditorialPageHeaderProps) {
  return (
    <View style={[styles.pageHeader, style]}>
      <IllustrationLayer variant={variant} muted />
      <View style={styles.pageHeaderContent}>
        {eyebrow && (
          <View style={styles.eyebrowContainer}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
          </View>
        )}
        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={styles.pageSubtitle}>{subtitle}</Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  inkRule: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    height: 1,
    backgroundColor: 'rgba(23, 23, 23, 0.14)',
  },

  // Home Hero Illustrations
  homePalaceBackdrop: {
    position: 'absolute',
    right: 8,
    top: 6,
    width: 175,
    height: 195,
    opacity: 0.12,
  },
  homeMuseFigure: {
    position: 'absolute',
    right: -10,
    bottom: -6,
    width: 220,
    height: 250,
    opacity: 0.96,
  },

  // Archive / Shop
  archiveParisSketch: {
    position: 'absolute',
    right: 10,
    top: 5,
    width: 170,
    height: 140,
    opacity: 0.14,
  },
  archiveFloralLeft: {
    position: 'absolute',
    left: -15,
    bottom: 4,
    width: 75,
    height: 75,
    opacity: 0.6,
  },
  archiveFloralRight: {
    position: 'absolute',
    right: -10,
    top: -10,
    width: 85,
    height: 85,
    opacity: 0.55,
    transform: [{ rotate: '45deg' }],
  },

  // Rental
  rentalJharokha: {
    position: 'absolute',
    left: 20,
    top: 8,
    width: 140,
    height: 165,
    opacity: 0.16,
  },
  rentalLehenga: {
    position: 'absolute',
    right: -12,
    bottom: -8,
    width: 205,
    height: 230,
    opacity: 0.95,
  },
  rentalPotli: {
    position: 'absolute',
    right: 160,
    bottom: 12,
    width: 52,
    height: 58,
    opacity: 0.85,
  },

  // Swap
  swapFigureLeft: {
    position: 'absolute',
    right: 110,
    bottom: -10,
    width: 160,
    height: 190,
    opacity: 0.82,
  },
  swapFigureRight: {
    position: 'absolute',
    right: -15,
    bottom: -10,
    width: 170,
    height: 190,
    opacity: 0.85,
  },
  swapBadge: {
    position: 'absolute',
    left: -15,
    top: 10,
    width: 80,
    height: 80,
    opacity: 0.65,
    transform: [{ rotate: '-8deg' }],
  },

  // Upcycle Studio
  upcycleScissors: {
    position: 'absolute',
    right: 25,
    top: 12,
    width: 95,
    height: 95,
    opacity: 0.75,
    transform: [{ rotate: '-25deg' }],
  },
  upcycleThread: {
    position: 'absolute',
    right: 125,
    bottom: 10,
    width: 85,
    height: 85,
    opacity: 0.7,
  },
  upcycleFloral: {
    position: 'absolute',
    left: -15,
    bottom: -5,
    width: 75,
    height: 75,
    opacity: 0.6,
  },

  // Profile / Curator
  profileFloral: {
    position: 'absolute',
    right: -10,
    top: -10,
    width: 80,
    height: 80,
    opacity: 0.5,
  },
  profileCuratorSeal: {
    position: 'absolute',
    left: 20,
    top: 10,
    width: 70,
    height: 70,
    opacity: 0.15,
  },

  // Messages
  messagesFloral: {
    position: 'absolute',
    right: -12,
    top: -8,
    width: 80,
    height: 80,
    opacity: 0.5,
  },
  messagesStamp: {
    position: 'absolute',
    left: 10,
    top: 8,
    width: 75,
    height: 75,
    opacity: 0.18,
  },

  // Deck
  deckSketch: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 170,
    height: 140,
    opacity: 0.14,
  },
  deckFloral: {
    position: 'absolute',
    left: -10,
    bottom: 10,
    width: 75,
    height: 75,
    opacity: 0.6,
  },

  // Card layer
  cardLayer: {
    position: 'absolute',
    right: -16,
    bottom: -16,
    width: 64,
    height: 64,
    overflow: 'hidden',
    opacity: 0.22,
  },
  cardSticker: {
    width: '100%',
    height: '100%',
  },

  // Header styles
  pageHeader: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.paper,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.ink,
  },
  pageHeaderContent: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    minHeight: 136,
    justifyContent: 'flex-end',
  },
  eyebrowContainer: {
    alignSelf: 'flex-start',
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: 'rgba(184, 154, 62, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  eyebrow: {
    fontFamily: typography.handwritten,
    fontSize: 14,
    color: colors.goldDark, includeFontPadding: false, },
  pageTitle: {
    fontFamily: typography.headings,
    fontSize: 44,
    lineHeight: 46,
    color: colors.ink,
    letterSpacing: 2.2,
  },
  pageSubtitle: {
    marginTop: 4,
    fontFamily: typography.handwritten,
    fontSize: 15,
    color: colors.crimson, includeFontPadding: false, },
});
