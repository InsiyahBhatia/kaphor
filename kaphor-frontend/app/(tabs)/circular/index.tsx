import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { impactService } from '../../../src/services/impactService';
import { colors, typography, spacing, radius } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import { RecyclingHubsModal } from '../../../src/components/RecyclingHubsModal';

const { width: SCREEN_W } = Dimensions.get('window');
const FEATURE_W = Math.max(150, (SCREEN_W - spacing.md * 2 - 12) / 2);

const QUICK_PILLARS = [
  { label: 'SELL', sub: 'P2P resale', icon: 'pricetag-sharp' as const, route: '/(tabs)/shop/sell', accent: colors.red },
  { label: 'RENT', sub: 'Occasion leases', icon: 'calendar-sharp' as const, route: '/(tabs)/rental', accent: colors.copper },
  { label: 'SWAP', sub: 'Zero-cash trades', icon: 'swap-horizontal-sharp' as const, route: '/(tabs)/swap', accent: colors.forest },
  { label: 'ATELIER', sub: 'Repair & refresh', icon: 'construct-sharp' as const, route: '/(tabs)/studio/repair-refresh', accent: colors.navy },
];

function SectionHeader({ title, tag, tagBg = colors.charcoal, tagColor = colors.gold }: { title: string; tag?: string; tagBg?: string; tagColor?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {tag && (
          <View style={[styles.sectionTag, { backgroundColor: tagBg }]}>
            <Text style={[styles.sectionTagText, { color: tagColor }]}>{tag}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function CircularScreen() {
  const router = useRouter();
  const [impactData, setImpactData] = useState<any>(null);
  const [showRecyclingModal, setShowRecyclingModal] = useState(false);

  useEffect(() => {
    impactService
      .getMyImpact()
      .then((data) => setImpactData(data))
      .catch(() => setImpactData(null));
  }, []);

  const carbonSaved = impactData?.impactRecord?.carbonSavedKg;
  const waterSaved = impactData?.impactRecord?.waterSavedL;
  const itemsCirculated = impactData?.impactRecord?.itemsCirculated;

  return (
    <View style={styles.screen}>
      <Header title="CIRCULAR HUB" subtitle="MAKE FASHION CIRCULAR" />

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?q=80&w=1200&auto=format&fit=crop' }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <View style={styles.heroGradientOverlay} />

          <View style={styles.heroContent}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>CIRCULAR HUB · SS26</Text>
            </View>

            <Text style={styles.heroHeadline}>
              WEAR · REPAIR{'\n'}RE-USE · RECYCLE
            </Text>

            <Text style={styles.heroTagline}>
              Keep clothes in circulation — assess, revive and pass them on instead of draining into landfill.
            </Text>

            <View style={styles.heroActionRow}>
              <TouchableOpacity style={styles.heroPrimaryBtn} onPress={() => router.push('/(tabs)/circular/condition-check')} activeOpacity={0.88}>
                <Text style={styles.heroPrimaryBtnText}>ASSESS MY GARMENT</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.white} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.heroSecondaryBtn} onPress={() => router.push('/(tabs)/impact')} activeOpacity={0.88}>
                <Text style={styles.heroSecondaryBtnText}>MY IMPACT</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.heroTrustRow}>
              <View style={styles.heroTrustItem}>
                <Ionicons name="sparkles-outline" size={12} color="rgba(255,255,255,0.85)" />
                <Text style={styles.heroTrustText}>AI CONDITION CHECK</Text>
              </View>
              <View style={styles.heroTrustItem}>
                <Ionicons name="leaf-outline" size={12} color="rgba(255,255,255,0.85)" />
                <Text style={styles.heroTrustText}>VERIFIED DROP-OFF</Text>
              </View>
              <View style={styles.heroTrustItem}>
                <Ionicons name="repeat-outline" size={12} color="rgba(255,255,255,0.85)" />
                <Text style={styles.heroTrustText}>ZERO WASTE</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.quickActionGrid}>
          {QUICK_PILLARS.map((pillar, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.quickActionCard, { borderColor: pillar.accent + '40' }]}
              onPress={() => router.push(pillar.route as any)}
              activeOpacity={0.9}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: pillar.accent + '14' }]}>
                <Ionicons name={pillar.icon} size={21} color={pillar.accent} />
              </View>
              <Text style={styles.quickActionLabel} numberOfLines={2}>{pillar.label}</Text>
              <Text style={styles.quickActionDesc} numberOfLines={1}>{pillar.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionContainer}>
          <SectionHeader title="GIVE IT A SECOND ACT" tag="KAPHOR STUDIO" />
          <View style={styles.featureRow}>
            <TouchableOpacity style={styles.featureCard} onPress={() => router.push('/(tabs)/circular/condition-check')} activeOpacity={0.9}>
              <View style={styles.featureImageWrap}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?q=80&w=600&auto=format&fit=crop' }}
                  style={styles.featureImage}
                  resizeMode="cover"
                />
                <View style={styles.featureTag}>
                  <Ionicons name="scan-outline" size={10} color={colors.white} />
                  <Text style={styles.featureTagText}>AI SCAN</Text>
                </View>
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>CONDITION SCAN</Text>
                <Text style={styles.featureDesc}>See what is wrong and where it should go next.</Text>
                <View style={styles.featureCta}>
                  <Text style={styles.featureCtaText}>START SCAN</Text>
                  <Ionicons name="arrow-forward" size={12} color={colors.charcoal} />
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.featureCard} onPress={() => router.push('/(tabs)/circular/upcycle')} activeOpacity={0.9}>
              <View style={styles.featureImageWrap}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=600&auto=format&fit=crop' }}
                  style={styles.featureImage}
                  resizeMode="cover"
                />
                <View style={styles.featureTag}>
                  <Ionicons name="cut-outline" size={10} color={colors.white} />
                  <Text style={styles.featureTagText}>WATCH & MAKE</Text>
                </View>
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>UPCYCLE STUDIO</Text>
                <Text style={styles.featureDesc}>Turn old clothes into something new.</Text>
                <View style={styles.featureCta}>
                  <Text style={styles.featureCtaText}>EXPLORE IDEAS</Text>
                  <Ionicons name="arrow-forward" size={12} color={colors.charcoal} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <SectionHeader title="DROP-OFF" tag="LAST STOP BEFORE LANDFILL" tagBg={colors.forest} tagColor={colors.white} />
          <TouchableOpacity style={styles.recycleCard} onPress={() => setShowRecyclingModal(true)} activeOpacity={0.9}>
            <View style={styles.recycleIconWrap}>
              <Ionicons name="leaf" size={20} color={colors.forest} />
            </View>
            <View style={styles.recycleText}>
              <Text style={styles.recycleTitle}>RECYCLING HUBS</Text>
              <Text style={styles.recycleDesc}>Zero-landfill drop-off & recovery facilities near you</Text>
            </View>
            <View style={styles.recycleChevron}>
              <Ionicons name="chevron-forward" size={16} color={colors.forest} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionContainer}>
          <SectionHeader title="YOUR IMPACT" tag="LIVE NUMBERS" tagBg={colors.forest} tagColor={colors.white} />
          <TouchableOpacity style={styles.impactCard} onPress={() => router.push('/(tabs)/impact')} activeOpacity={0.9}>
            <View style={styles.impactCol}>
              <Ionicons name="cloud-outline" size={16} color={colors.forest} />
              <Text style={styles.impactValue}>
                {carbonSaved != null ? carbonSaved.toFixed(1) : '–'}
                <Text style={styles.impactUnit}> KG</Text>
              </Text>
              <Text style={styles.impactLabel}>CO₂ SAVED</Text>
            </View>

            <View style={styles.impactDivider} />

            <View style={styles.impactCol}>
              <Ionicons name="water-outline" size={16} color={colors.forest} />
              <Text style={styles.impactValue}>
                {waterSaved != null ? waterSaved.toLocaleString() : '–'}
                <Text style={styles.impactUnit}> L</Text>
              </Text>
              <Text style={styles.impactLabel}>WATER SAVED</Text>
            </View>

            <View style={styles.impactDivider} />

            <View style={styles.impactCol}>
              <Ionicons name="sync-outline" size={16} color={colors.forest} />
              <Text style={styles.impactValue}>
                {itemsCirculated != null ? itemsCirculated : '–'}
                <Text style={styles.impactUnit}> PCS</Text>
              </Text>
              <Text style={styles.impactLabel}>CIRCULATED</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <RecyclingHubsModal visible={showRecyclingModal} onClose={() => setShowRecyclingModal(false)} garment={null} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 40 },

  heroContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    minHeight: 320,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.12)',
  },
  heroGradientOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18, 19, 23, 0.5)' },
  heroContent: { padding: 22, justifyContent: 'flex-end', flex: 1 },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  heroBadgeText: { color: colors.white, fontFamily: typography.mono, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  heroHeadline: {
    fontFamily: typography.headings,
    fontSize: 32,
    lineHeight: 34,
    color: colors.white,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  heroTagline: {
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 20,
    maxWidth: '95%',
  },
  heroActionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  heroPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.sm,
    gap: 8,
  },
  heroPrimaryBtnText: { color: colors.white, fontFamily: typography.mono, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  heroSecondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  heroSecondaryBtnText: { color: colors.white, fontFamily: typography.mono, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  heroTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  heroTrustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroTrustText: { color: 'rgba(255,255,255,0.8)', fontFamily: typography.mono, fontSize: 8.5, fontWeight: '600', letterSpacing: 0.5 },

  quickActionGrid: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: 8, marginTop: spacing.lg },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderRadius: 2,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 6,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  quickActionIconWrap: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  quickActionLabel: { fontFamily: typography.mono, color: colors.charcoal, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, textAlign: 'center', lineHeight: 11 },
  quickActionDesc: { fontFamily: typography.mono, color: colors.textMuted, fontSize: 7, fontWeight: '700', letterSpacing: 0.3, textAlign: 'center', marginTop: 1 },

  sectionContainer: { marginTop: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: 8 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: typography.headings, fontSize: 21, letterSpacing: 0.8, color: colors.charcoal },
  sectionTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 },
  sectionTagText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  featureRow: { flexDirection: 'row', gap: 12, paddingHorizontal: spacing.md },
  featureCard: {
    width: FEATURE_W,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  featureImageWrap: { width: '100%', height: FEATURE_W, backgroundColor: '#F3EFE9', position: 'relative' },
  featureImage: { width: '100%', height: '100%' },
  featureTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(30,31,34,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  featureTagText: { color: colors.gold, fontFamily: typography.mono, fontSize: 8.5, fontWeight: '800' },
  featureInfo: { padding: 12 },
  featureTitle: { fontFamily: typography.headings, fontSize: 19, color: colors.charcoal, letterSpacing: 0.4 },
  featureDesc: { fontFamily: typography.body, fontSize: 10, color: colors.textMuted, lineHeight: 14, marginTop: 3 },
  featureCta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  featureCtaText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', color: colors.charcoal, letterSpacing: 0.5 },

  recycleCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  recycleIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.emeraldLight, justifyContent: 'center', alignItems: 'center' },
  recycleText: { flex: 1, marginHorizontal: 12 },
  recycleTitle: { fontFamily: typography.headings, fontSize: 18, letterSpacing: 0.5, color: colors.charcoal },
  recycleDesc: { fontFamily: typography.body, fontSize: 10, color: colors.textMuted, marginTop: 2 },
  recycleChevron: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.emerald, justifyContent: 'center', alignItems: 'center' },

  impactCard: {
    marginHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(15,92,70,0.2)',
    paddingVertical: 16,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  impactCol: { flex: 1, alignItems: 'center' },
  impactValue: { fontFamily: typography.headings, fontSize: 19, color: colors.forest, marginTop: 3 },
  impactUnit: { fontFamily: typography.monoBold, fontSize: 9, color: colors.forest },
  impactLabel: { fontFamily: typography.mono, fontSize: 7.5, fontWeight: '700', color: colors.textMuted, marginTop: 1, letterSpacing: 0.5 },
  impactDivider: { width: 1, height: 34, backgroundColor: colors.forest, opacity: 0.2 },
});