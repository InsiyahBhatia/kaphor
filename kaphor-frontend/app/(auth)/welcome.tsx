import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../../src/theme';
import { LegalModal } from '../../src/components/legal/LegalModal';
import { KaphorMark } from '../../src/components/common/KaphorLogo';
import { Squiggle } from '../../src/components/common/HandText';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [legalVisible, setLegalVisible] = useState(false);
  const [legalDocId, setLegalDocId] = useState('terms-and-conditions');

  const openLegal = (docId: string) => {
    setLegalDocId(docId);
    setLegalVisible(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      <StatusBar style="dark" />

      <ExpoImage
        source={require('../../assets/photos/get-started.jpg')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={1.5}
        cachePolicy="memory-disk"
        accessibilityLabel="Clothes hanging on a rack by a window"
      />
      <LinearGradient
        colors={['rgba(245,240,230,0)', 'rgba(245,240,230,0.08)', 'rgba(245,240,230,0.9)', 'rgba(245,240,230,0.97)']}
        locations={[0, 0.3, 0.5, 0.65]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.brandRow}>
        <KaphorMark size={34} />
        <Text style={styles.brandName}>KAPHOR</Text>
      </View>

      <View style={styles.hero} />

      <View style={styles.copy}>
        <Text style={styles.headline}>Wear it. Love it.{'\n'}Pass it on.</Text>
        <Squiggle width={110} />
        <Text style={styles.note}>buy, rent, swap and fix clothes with people like you</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/(auth)/register' as any)}
          accessibilityRole="button"
          accessibilityLabel="Get started"
        >
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.buttonText}>Get started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/login' as any)}
          accessibilityRole="button"
          accessibilityLabel="I already have an account"
        >
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.secondaryButtonText}>I already have an account</Text>
        </TouchableOpacity>

        <Text style={styles.legalNoticeText}>
          By continuing, you agree to our{' '}
          <Text style={styles.legalNoticeLink} onPress={() => openLegal('terms-and-conditions')}>
            Terms of Service
          </Text>
          {' and '}
          <Text style={styles.legalNoticeLink} onPress={() => openLegal('privacy-policy')}>
            Privacy Policy
          </Text>
          .
        </Text>
      </View>

      <LegalModal
        visible={legalVisible}
        onClose={() => setLegalVisible(false)}
        initialDocId={legalDocId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  brandName: {
    fontFamily: typography.condensed,
    fontSize: 28,
    letterSpacing: 6,
    color: colors.ink,
    includeFontPadding: false,
  },
  hero: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  copy: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headline: {
    fontFamily: typography.headings,
    fontSize: 28,
    lineHeight: 36,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  note: {
    marginTop: 8,
    fontFamily: typography.tagline,
    fontSize: 22,
    lineHeight: 27,
    color: colors.rose,
    textAlign: 'center',
    includeFontPadding: false,
  },
  footer: {
    gap: 12,
  },
  button: {
    backgroundColor: colors.rose,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontFamily: typography.bodyBold,
    fontSize: 14,
  },
  secondaryButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: colors.ink,
    fontFamily: typography.bodyBold,
    fontSize: 15,
  },
  legalNoticeText: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  legalNoticeLink: {
    fontFamily: typography.handSemi,
    color: colors.ink,
    textDecorationLine: 'underline',
  },
});
