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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';

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
  icon: keyof typeof Ionicons.glyphMap;
  image: any;
  tutorials: Tutorial[];
  inspirations?: string[];
}

const UPCYCLE_DATA: UpcycleCategory[] = [
  {
    id: 'jeans',
    garment: 'JEANS',
    tagline: 'Turn denim into something extraordinary',
    accentColor: '#3A6EA5',
    accentLight: '#EAF1FA',
    accentDark: '#1A3A5C',
    icon: 'cut-outline',
    image: require('../../../assets/upcycle/jeans.png'),
    tutorials: [
      { label: 'JEANS POUCH', url: 'https://youtube.com/shorts/o08upOyjZg0' },
      { label: 'KEYCHAIN', url: 'https://youtube.com/shorts/C84XqM9n9yM' },
      { label: 'SHOULDER BAG', url: 'https://youtube.com/shorts/tyhXeOIIRWk' },
      { label: 'DENIM VEST', url: 'https://youtube.com/shorts/Qd9Hbq42toU' },
      { label: 'DENIM TIES', url: 'https://youtube.com/shorts/FGB9LtrBWsg' },
      { label: 'DENIM SKIRT', url: 'https://youtube.com/shorts/zfYrMeWjZjM' },
    ],
    inspirations: [],
  },
  {
    id: 'shirt',
    garment: 'SHIRT',
    tagline: 'Your old shirt — creatively reimagined',
    accentColor: '#C85A32',
    accentLight: '#FCEEE8',
    accentDark: '#8B3617',
    icon: 'shirt-outline',
    image: require('../../../assets/upcycle/shirt.png'),
    tutorials: [
      { label: 'PLAID-IT UP', url: 'https://youtube.com/shorts/Ej01U_CfXM8' },
      { label: 'TIE-IT UP', url: 'https://youtube.com/shorts/sGG5oNH7u2A' },
      { label: 'SKIRT-IT UP', url: 'https://youtube.com/shorts/FpLDyrKg-KU' },
      { label: 'PAINT-IT UP', url: 'https://youtube.com/shorts/L5vFfCdzy5U' },
      { label: 'BUTTON & PATCH', url: 'https://youtube.com/shorts/pMja3OU-kos' },
    ],
    inspirations: [],
  },
  {
    id: 'tshirt',
    garment: 'T-SHIRT',
    tagline: 'Elevate your boring basics',
    accentColor: '#141414',
    accentLight: '#EAE6DF',
    accentDark: '#000000',
    icon: 'color-palette-outline',
    image: require('../../../assets/upcycle/tshirt.png'),
    tutorials: [
      { label: 'BUTTON PATCH', url: 'https://youtube.com/shorts/pMja3OU-kos' },
      { label: 'CUTTING ART', url: 'https://youtu.be/zQDyu7O9O5g' },
      { label: 'FABRIC PAINTING', url: 'https://youtube.com/shorts/6jDXF95oGoQ' },
      { label: 'BLEACH ART', url: 'https://youtube.com/shorts/pYDTvFYWx8I' },
    ],
    inspirations: [],
  },
  {
    id: 'saree',
    garment: 'SAREE',
    tagline: "Got mom's old saree? Turn it into something new",
    accentColor: '#B8337A',
    accentLight: '#FCEEF5',
    accentDark: '#7A1A4A',
    icon: 'sparkles-outline',
    image: require('../../../assets/upcycle/saree.png'),
    tutorials: [],
    inspirations: ['A TOP', 'A SHARARA', 'A DRESS', 'A SHIRT', 'A BAG'],
  },
  {
    id: 'socks',
    garment: 'SOCKS',
    tagline: 'Why leave out the socks? Give them new life',
    accentColor: '#0F5C46',
    accentLight: '#E6F4EF',
    accentDark: '#072B20',
    icon: 'happy-outline',
    image: require('../../../assets/upcycle/socks.png'),
    tutorials: [],
    inspirations: ['HAND WARMERS', 'SOFT TOY', 'SMALL POUCH', 'LEG WARMERS'],
  },
];

function TutorialPill({ tutorial, accent, accentLight, accentDark }: {
  tutorial: Tutorial; accent: string; accentLight: string; accentDark: string;
}) {
  const handlePress = async () => {
    const supported = await Linking.canOpenURL(tutorial.url);
    if (supported) { await Linking.openURL(tutorial.url); }
    else { Alert.alert('Cannot open link', tutorial.url); }
  };
  return (
    <TouchableOpacity style={[styles.pill, { backgroundColor: accentLight, borderColor: accent }]} onPress={handlePress} activeOpacity={0.75}>
      <Ionicons name="logo-youtube" size={11} color="#FF0000" />
      <Text style={[styles.pillText, { color: accentDark }]}>{tutorial.label}</Text>
      <Ionicons name="open-outline" size={10} color={accentDark} style={{ opacity: 0.6 }} />
    </TouchableOpacity>
  );
}

function InspirationPill({ label, accent, accentLight, accentDark }: {
  label: string; accent: string; accentLight: string; accentDark: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: accentLight, borderColor: accent }]}>
      <Ionicons name="bulb-outline" size={11} color={accentDark} />
      <Text style={[styles.pillText, { color: accentDark }]}>{label}</Text>
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
              <Ionicons name="expand-outline" size={12} color="#FFF" />
              <Text style={styles.expandBadgeText}>VIEW POSTER</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.cardIconBox, { backgroundColor: category.accentColor }]}>
              <Ionicons name={category.icon} size={16} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardGarment, { color: category.accentDark }]}>UPCYCLE YOUR {category.garment}</Text>
              <Text style={styles.cardTagline}>{category.tagline}</Text>
            </View>
          </View>
          {category.tutorials.length > 0 && (
            <>
              <View style={styles.pillSectionHeader}>
                <Ionicons name="logo-youtube" size={10} color="#FF0000" />
                <Text style={styles.pillSectionTitle}>WATCH & MAKE</Text>
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
                <Ionicons name="bulb-outline" size={10} color={category.accentColor} />
                <Text style={[styles.pillSectionTitle, { color: category.accentDark }]}>INSPIRATION IDEAS</Text>
              </View>
              <View style={styles.pillRow}>
                {category.inspirations.map((label) => (
                  <InspirationPill key={label} label={label} accent={category.accentColor} accentLight={category.accentLight} accentDark={category.accentDark} />
                ))}
              </View>
            </>
          )}
          <TouchableOpacity style={[styles.repairCta, { borderColor: category.accentColor }]} onPress={() => router.push('/(tabs)/studio/repair-refresh' as any)} activeOpacity={0.8}>
            <Ionicons name="color-palette-sharp" size={13} color={category.accentDark} />
            <Text style={[styles.repairCtaText, { color: category.accentDark }]}>BOOK A KAPHOR UPCYCLE SESSION</Text>
            <Ionicons name="chevron-forward" size={12} color={category.accentDark} />
          </TouchableOpacity>
        </View>
      </View>
      <Modal visible={posterVisible} transparent animationType="fade" onRequestClose={() => setPosterVisible(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setPosterVisible(false)} activeOpacity={0.85}>
            <Ionicons name="close" size={22} color="#FFF" />
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
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header title="UPCYCLE STUDIO" showBack fallbackPath="/(tabs)/circular" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBanner}>
          <View style={styles.heroBannerLeft}>
            <View style={styles.heroBannerBadge}>
              <Ionicons name="leaf-sharp" size={10} color="#FFF" />
              <Text style={styles.heroBannerBadgeText}>ZERO WASTE FASHION</Text>
            </View>
            <Text style={styles.heroBannerTitle}>UPCYCLE{'\n'}YOUR{'\n'}CLOTHES</Text>
            <Text style={styles.heroBannerSub}>Breathe new life into old garments.{'\n'}Watch tutorials, get inspired &{'\n'}book a Kaphor upcycle session.</Text>
          </View>
          <View style={styles.heroBannerRight}>
            <View style={styles.heroBannerStat}>
              <Text style={styles.heroBannerStatNum}>5</Text>
              <Text style={styles.heroBannerStatLabel}>GARMENT{'\n'}TYPES</Text>
            </View>
            <View style={styles.heroBannerDivider} />
            <View style={styles.heroBannerStat}>
              <Text style={styles.heroBannerStatNum}>15+</Text>
              <Text style={styles.heroBannerStatLabel}>VIDEO{'\n'}GUIDES</Text>
            </View>
          </View>
        </View>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>CHOOSE YOUR GARMENT</Text>
        </View>
        {UPCYCLE_DATA.map((cat) => (
          <UpcycleCard key={cat.id} category={cat} />
        ))}
        <View style={styles.bottomCallout}>
          <Ionicons name="sparkles-sharp" size={18} color={colors.terracotta} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bottomCalloutTitle}>NEED PROFESSIONAL HELP?</Text>
            <Text style={styles.bottomCalloutDesc}>Our tailors & upcycling artists at Kaphor Studio can transform any garment for you.</Text>
          </View>
          <TouchableOpacity style={styles.bottomCalloutBtn} onPress={() => router.push('/(tabs)/studio/repair-refresh' as any)} activeOpacity={0.85}>
            <Text style={styles.bottomCalloutBtnText}>BOOK →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  heroBanner: { flexDirection: 'row', backgroundColor: colors.ink, padding: 16, marginBottom: 18, borderWidth: 2, borderColor: colors.ink, shadowColor: colors.ink, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.18, shadowRadius: 0, elevation: 4 },
  heroBannerLeft: { flex: 1, paddingRight: 12 },
  heroBannerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.emerald, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, marginBottom: 8 },
  heroBannerBadgeText: { fontFamily: typography.mono, fontSize: 7.5, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
  heroBannerTitle: { fontFamily: typography.headings, fontSize: 42, color: '#FFF', lineHeight: 40, letterSpacing: 1.5, marginBottom: 10 },
  heroBannerSub: { fontFamily: typography.mono, fontSize: 9, color: colors.bgMuted, lineHeight: 14 },
  heroBannerRight: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroBannerStat: { alignItems: 'center' },
  heroBannerStatNum: { fontFamily: typography.headings, fontSize: 32, color: colors.gold, letterSpacing: 1 },
  heroBannerStatLabel: { fontFamily: typography.mono, fontSize: 7.5, fontWeight: '900', color: colors.bgMuted, letterSpacing: 0.5, textAlign: 'center' },
  heroBannerDivider: { width: 30, height: 1, backgroundColor: colors.bgMuted, opacity: 0.4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionDot: { width: 8, height: 8, backgroundColor: colors.emerald, borderRadius: 1 },
  sectionTitle: { fontFamily: typography.mono, fontSize: 11, fontWeight: '900', color: colors.emeraldDark, letterSpacing: 1.5 },
  card: { backgroundColor: colors.white, borderWidth: 2, marginBottom: 16, shadowColor: colors.ink, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.1, shadowRadius: 0, elevation: 3 },
  cardImageWrapper: { width: '100%', height: 200, overflow: 'hidden', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardImageOverlay: { position: 'absolute', bottom: 8, right: 8 },
  expandBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  expandBadgeText: { fontFamily: typography.mono, fontSize: 8, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  cardBody: { padding: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  cardIconBox: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.ink },
  cardGarment: { fontFamily: typography.mono, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  cardTagline: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, marginTop: 2, lineHeight: 13 },
  pillSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 },
  pillSectionTitle: { fontFamily: typography.mono, fontSize: 8.5, fontWeight: '900', color: colors.ink, letterSpacing: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1.5 },
  pillText: { fontFamily: typography.mono, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  repairCta: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.cream, marginTop: 4 },
  repairCtaText: { flex: 1, fontFamily: typography.mono, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  bottomCallout: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.terracottaLight, borderWidth: 2, borderColor: colors.terracotta, padding: 14, marginTop: 4 },
  bottomCalloutTitle: { fontFamily: typography.mono, fontSize: 10, fontWeight: '900', color: colors.terracottaDark, letterSpacing: 0.8, marginBottom: 3 },
  bottomCalloutDesc: { fontFamily: typography.mono, fontSize: 8.5, color: colors.terracottaDark, lineHeight: 13 },
  bottomCalloutBtn: { backgroundColor: colors.terracotta, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1.5, borderColor: colors.terracottaDark },
  bottomCalloutBtnText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  modalClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 50 },
  modalScroll: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 12 },
  modalImage: { width: SCREEN_W - 24, height: (SCREEN_W - 24) * 1.4 },
  modalCaption: { position: 'absolute', bottom: 40, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 7 },
  modalCaptionText: { fontFamily: typography.mono, fontSize: 11, fontWeight: '900', color: '#FFF', letterSpacing: 1.5 },
});
