import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { SolarIcon } from '../../../src/components/common/SolarIcon';
import { useRouter } from 'expo-router';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import {
  EditorialPageHeader,
  HandwrittenNote,
  EditorialIcon,
} from '../../../src/components/editorial/IllustrationLayer';

const { width: SCREEN_W } = Dimensions.get('window');

interface Tutorial {
  label: string;
  url: string;
}

interface UpcycleCategory {
  id: string;
  garment: string;
  tagline: string;
  accentColor: string;
  accentLight: string;
  accentDark: string;
  icon: keyof typeof SolarIcon.glyphMap;
  image: any;
  tutorials: Tutorial[];
  inspirations?: string[];
}

const UPCYCLE_DATA: UpcycleCategory[] = [
  {
    id: 'jeans',
    garment: 'JEANS',
    tagline: 'Turn denim into something extraordinary',
    accentColor: colors.ink,
    accentLight: colors.bgMuted,
    accentDark: colors.ink,
    icon: 'cut-outline',
    image: require('../../../assets/upcycle/jeans.png'),
    tutorials: [
      { label: 'Jeans pouch', url: 'https://youtube.com/shorts/o08upOyjZg0' },
      { label: 'KEYCHAIN', url: 'https://youtube.com/shorts/C84XqM9n9yM' },
      { label: 'Shoulder bag', url: 'https://youtube.com/shorts/tyhXeOIIRWk' },
      { label: 'Denim vest', url: 'https://youtube.com/shorts/Qd9Hbq42toU' },
      { label: 'Denim ties', url: 'https://youtube.com/shorts/FGB9LtrBWsg' },
      { label: 'Denim skirt', url: 'https://youtube.com/shorts/zfYrMeWjZjM' },
    ],
    inspirations: [],
  },
  {
    id: 'shirt',
    garment: 'SHIRT',
    tagline: 'Your old shirt — creatively reimagined',
    accentColor: colors.terracotta,
    accentLight: colors.terracottaLight,
    accentDark: colors.terracottaDark,
    icon: 'shirt-outline',
    image: require('../../../assets/upcycle/shirt.png'),
    tutorials: [
      { label: 'Plaid-it up', url: 'https://youtube.com/shorts/Ej01U_CfXM8' },
      { label: 'Tie-it up', url: 'https://youtube.com/shorts/sGG5oNH7u2A' },
      { label: 'Skirt-it up', url: 'https://youtube.com/shorts/FpLDyrKg-KU' },
      { label: 'Paint-it up', url: 'https://youtube.com/shorts/L5vFfCdzy5U' },
      { label: 'Button & patch', url: 'https://youtube.com/shorts/pMja3OU-kos' },
    ],
    inspirations: [],
  },
  {
    id: 'tshirt',
    garment: 'T-SHIRT',
    tagline: 'Elevate your boring basics',
    accentColor: colors.ink,
    accentLight: colors.paperDark,
    accentDark: colors.ink,
    icon: 'color-palette-outline',
    image: require('../../../assets/upcycle/tshirt.png'),
    tutorials: [
      { label: 'Button patch', url: 'https://youtube.com/shorts/pMja3OU-kos' },
      { label: 'Cutting art', url: 'https://youtu.be/zQDyu7O9O5g' },
      { label: 'Fabric painting', url: 'https://youtube.com/shorts/6jDXF95oGoQ' },
      { label: 'Bleach art', url: 'https://youtube.com/shorts/pYDTvFYWx8I' },
    ],
    inspirations: [],
  },
  {
    id: 'saree',
    garment: 'SAREE',
    tagline: "Got mom's old saree? Turn it into something new",
    accentColor: colors.rose,
    accentLight: colors.crimsonLight,
    accentDark: colors.crimsonDark,
    icon: 'sparkles-outline',
    image: require('../../../assets/upcycle/saree.png'),
    tutorials: [],
    inspirations: ['A TOP', 'A sharara', 'A dress', 'A shirt', 'A bag'],
  },
  {
    id: 'socks',
    garment: 'SOCKS',
    tagline: 'Why leave out the socks? Give them new life',
    accentColor: colors.success,
    accentLight: colors.emeraldLight,
    accentDark: colors.emeraldDark,
    icon: 'happy-outline',
    image: require('../../../assets/upcycle/socks.png'),
    tutorials: [],
    inspirations: ['HAND WARMERS', 'Soft toy', 'Small pouch', 'Leg warmers'],
  },
];

function TutorialPill({ tutorial, accent, accentLight, accentDark }: {
  tutorial: Tutorial; accent: string; accentLight: string; accentDark: string;
}) {
  const handlePress = async () => {
    try {
      await Linking.openURL(tutorial.url);
    } catch {
      try {
        const fallbackUrl = tutorial.url.includes('youtu.be')
          ? tutorial.url.replace('youtu.be/', 'www.youtube.com/watch?v=')
          : tutorial.url;
        await Linking.openURL(fallbackUrl);
      } catch {
        Alert.alert('Unable to open link', 'Please ensure you have a web browser or YouTube app installed.');
      }
    }
  };
  return (
    <TouchableOpacity style={[styles.pill, { backgroundColor: accentLight, borderColor: accent }]} onPress={handlePress} activeOpacity={0.75}>
      <SolarIcon name="logo-youtube" size={11} color={colors.error} />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.pillText, { color: accentDark }]}>{tutorial.label}</Text>
      <SolarIcon name="open-outline" size={10} color={accentDark} style={{ opacity: 0.6 }} />
    </TouchableOpacity>
  );
}

function InspirationPill({ label, accent, accentLight, accentDark }: {
  label: string; accent: string; accentLight: string; accentDark: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: accentLight, borderColor: accent }]}>
      <SolarIcon name="bulb-outline" size={11} color={accentDark} />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.pillText, { color: accentDark }]}>{label}</Text>
    </View>
  );
}

function UpcycleCard({ category }: { category: UpcycleCategory }) {
  const [posterVisible, setPosterVisible] = useState(false);
  const router = useRouter();
  return (
    <>
      <View style={[styles.card, { borderColor: category.accentColor }]}>
        <TouchableOpacity style={[styles.cardImageWrapper, { backgroundColor: category.accentLight }]} onPress={() => setPosterVisible(true)} activeOpacity={0.88}>
          <Image source={category.image} style={styles.cardImage} resizeMode="cover" />
          <View style={styles.cardImageOverlay}>
            <View style={[styles.expandBadge, { backgroundColor: category.accentColor }]}>
              <SolarIcon name="expand-outline" size={12} color={colors.white} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.expandBadgeText}>View poster</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.cardIconBox, { backgroundColor: category.accentColor }]}>
              <SolarIcon name={category.icon} size={16} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardGarment, { color: category.accentDark }]}>UPCYCLE YOUR {category.garment}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.cardTagline}>{category.tagline}</Text>
            </View>
          </View>
          {category.tutorials.length > 0 && (
            <>
              <View style={styles.pillSectionHeader}>
                <SolarIcon name="logo-youtube" size={10} color={colors.error} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.pillSectionTitle}>Watch & make</Text>
              </View>
              <View style={styles.pillRow}>
                {category.tutorials.map((t) => (
                  <TutorialPill key={t.label} tutorial={t} accent={category.accentColor} accentLight={category.accentLight} accentDark={category.accentDark} />
                ))}
              </View>
            </>
          )}
          {category.inspirations && category.inspirations.length > 0 && (
            <>
              <View style={styles.pillSectionHeader}>
                <SolarIcon name="bulb-outline" size={10} color={category.accentColor} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.pillSectionTitle, { color: category.accentDark }]}>Inspiration ideas</Text>
              </View>
              <View style={styles.pillRow}>
                {category.inspirations.map((label) => (
                  <InspirationPill key={label} label={label} accent={category.accentColor} accentLight={category.accentLight} accentDark={category.accentDark} />
                ))}
              </View>
            </>
          )}
          <TouchableOpacity style={[styles.repairCta, { borderColor: category.accentColor }]} onPress={() => router.push('/(tabs)/studio/repair-refresh' as any)} activeOpacity={0.8}>
            <SolarIcon name="color-palette-sharp" size={13} color={category.accentDark} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.repairCtaText, { color: category.accentDark }]}>Repair & refresh guides</Text>
            <SolarIcon name="chevron-forward" size={12} color={category.accentDark} />
          </TouchableOpacity>
        </View>
      </View>
      <Modal visible={posterVisible} transparent animationType="fade" onRequestClose={() => setPosterVisible(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setPosterVisible(false)} activeOpacity={0.85}>
            <SolarIcon name="close" size={22} color={colors.white} />
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <Image source={category.image} style={styles.modalImage} resizeMode="contain" />
          </ScrollView>
          <View style={[styles.modalCaption, { backgroundColor: category.accentColor }]}>
            <Text style={styles.modalCaptionText}>UPCYCLE YOUR {category.garment}</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function UpcycleScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <EditorialPageHeader
        title="Upcycle studio"
        subtitle="Old garments, new possibilities"
        eyebrow="Zero waste studio"
        variant="upcycle"
      >
        <HandwrittenNote style={{ marginTop: 10 }}>
          old garments, new possibilities.
        </HandwrittenNote>
      </EditorialPageHeader>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Visual Narrative: OLD GARMENT -> CUT -> REWORK -> NEW PIECE */}
        <View style={styles.narrativeCard}>
          <Text style={styles.narrativeTitle}>How upcycling works</Text>
          <View style={styles.narrativeRow}>
            <View style={styles.narrativeStep}>
              <View style={styles.narrativeIconWrap}>
                <EditorialIcon name="hanger" size={20} />
              </View>
              <Text style={styles.narrativeStepLabel}>Old garment</Text>
            </View>
            <Text style={styles.narrativeArrow}>→</Text>
            <View style={styles.narrativeStep}>
              <View style={styles.narrativeIconWrap}>
                <EditorialIcon name="scissors" size={20} />
              </View>
              <Text style={styles.narrativeStepLabel}>CUT</Text>
            </View>
            <Text style={styles.narrativeArrow}>→</Text>
            <View style={styles.narrativeStep}>
              <View style={styles.narrativeIconWrap}>
                <EditorialIcon name="sewing" size={20} />
              </View>
              <Text style={styles.narrativeStepLabel}>Rework</Text>
            </View>
            <Text style={styles.narrativeArrow}>→</Text>
            <View style={styles.narrativeStep}>
              <View style={styles.narrativeIconWrap}>
                <EditorialIcon name="sparkle" size={20} />
              </View>
              <Text style={styles.narrativeStepLabel}>New piece</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>Choose your garment</Text>
        </View>
        {UPCYCLE_DATA.map((cat) => (
          <UpcycleCard key={cat.id} category={cat} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 100 },
  narrativeCard: {
    backgroundColor: colors.paperLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 14,
    marginBottom: 20,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  narrativeTitle: {
    fontFamily: typography.handwritten,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 12,
    textAlign: 'center', includeFontPadding: false, },
  narrativeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  narrativeStep: {
    alignItems: 'center',
  },
  narrativeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  narrativeStepLabel: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.inkSoft, includeFontPadding: false, },
  narrativeArrow: {
    fontFamily: typography.handwritten,
    fontSize: 15,
    color: colors.rose,
    marginBottom: 16, includeFontPadding: false, },
  heroBanner: { flexDirection: 'row', backgroundColor: colors.ink, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: colors.borderLight, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  heroBannerLeft: { flex: 1, paddingRight: 12 },
  heroBannerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.emerald, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, marginBottom: 8 },
  heroBannerBadgeText: { fontFamily: typography.handBold, fontSize: 13, color: colors.white, includeFontPadding: false, },
  heroBannerTitle: { fontFamily: typography.headings, fontSize: 28, color: colors.white, lineHeight: 34, letterSpacing: 1.5, marginBottom: 10 },
  heroBannerSub: { fontFamily: typography.handwritten, fontSize: 14, color: colors.bgMuted, lineHeight: 22, includeFontPadding: false, },
  heroBannerRight: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroBannerStat: { alignItems: 'center' },
  heroBannerStatNum: { fontFamily: typography.headings, fontSize: 32, color: colors.gold, letterSpacing: 1 },
  heroBannerStatLabel: { fontFamily: typography.handBold, fontSize: 13, color: colors.bgMuted, textAlign: 'center', includeFontPadding: false, },
  heroBannerDivider: { width: 30, height: 1, backgroundColor: colors.bgMuted, opacity: 0.4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionDot: { width: 8, height: 8, backgroundColor: colors.emerald, borderRadius: 1 },
  sectionTitle: { fontFamily: typography.handBold, fontSize: 13, color: colors.emeraldDark, includeFontPadding: false, },
  card: { backgroundColor: colors.white, borderWidth: 1, marginBottom: 16, shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  cardImageWrapper: { width: '100%', height: 200, overflow: 'hidden', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardImageOverlay: { position: 'absolute', bottom: 8, right: 8 },
  expandBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  expandBadgeText: { fontFamily: typography.handBold, fontSize: 13, color: colors.white, includeFontPadding: false, },
  cardBody: { padding: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  cardIconBox: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight },
  cardGarment: { fontFamily: typography.handBold, fontSize: 13, includeFontPadding: false, },
  cardTagline: { fontFamily: typography.handwritten, fontSize: 14, color: colors.textMuted, marginTop: 2, lineHeight: 20, includeFontPadding: false, },
  pillSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 },
  pillSectionTitle: { fontFamily: typography.handBold, fontSize: 14, color: colors.ink, includeFontPadding: false, },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1 },
  pillText: { fontFamily: typography.handBold, fontSize: 14, includeFontPadding: false, },
  repairCta: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.cream, marginTop: 4 },
  repairCtaText: { flex: 1, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 0.2 },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center' },
  modalClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: colors.overlayLight, padding: 10, borderRadius: 50 },
  modalScroll: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 12 },
  modalImage: { width: SCREEN_W - 24, height: (SCREEN_W - 24) * 1.4 },
  modalCaption: { position: 'absolute', bottom: 40, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 7 },
  modalCaptionText: { fontFamily: typography.handBold, fontSize: 13, color: colors.white, includeFontPadding: false, },
});
