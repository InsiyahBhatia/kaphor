import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { impactService } from '../../../src/services/impactService';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import { RecyclingHubsModal } from '../../../src/components/RecyclingHubsModal';

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

  const carbonSaved = impactData?.impactRecord?.carbonSavedKg ?? 13.1;
  const waterSaved = impactData?.impactRecord?.waterSavedL ?? 3040;
  const itemsCirculated = impactData?.impactRecord?.itemsCirculated ?? 12;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header title="CIRCULAR HUB" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── SECTION 1: AI & INTELLIGENCE (Orange / Terracotta) ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDotTerracotta} />
          <Text style={styles.sectionTitleTerracotta}>AI & INTELLIGENCE</Text>
        </View>

        {/* Hero Card: KAPHOR AI ADVISOR */}
        <TouchableOpacity
          style={styles.heroAiCard}
          onPress={() => router.push('/(tabs)/studio/chat')}
          activeOpacity={0.88}
        >
          <View style={styles.heroAiTopRow}>
            <View style={styles.heroAiBadge}>
              <Ionicons name="sparkles" size={12} color={colors.white} />
              <Text style={styles.heroAiBadgeText}>FEATURED AI TOOL</Text>
            </View>
            <View style={styles.heroGoldChip}>
              <Text style={styles.heroGoldChipText}>CURATED MATCH</Text>
            </View>
          </View>

          <View style={styles.heroAiMain}>
            <View style={styles.heroAiIconBox}>
              <Ionicons name="sparkles-sharp" size={26} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroAiTitle}>KAPHOR AI ADVISOR</Text>
              <Text style={styles.heroAiDesc}>
                Instant style curation, fabric care guidelines & real-time garment intelligence.
              </Text>
            </View>
          </View>

          <View style={styles.heroAiCtaBtn}>
            <Text style={styles.heroAiCtaText}>LAUNCH AI STYLIST & CARE CHAT</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.ink} />
          </View>
        </TouchableOpacity>

        {/* Secondary AI Tool: CONDITION SCAN */}
        <TouchableOpacity
          style={styles.aiSubCard}
          onPress={() => router.push('/(tabs)/circular/condition-check')}
          activeOpacity={0.85}
        >
          <View style={styles.aiSubIconBox}>
            <Ionicons name="scan-sharp" size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.aiSubTitle}>CONDITION SCAN</Text>
              <View style={styles.aiGoldChip}>
                <Text style={styles.aiGoldChipText}>AI EDIT</Text>
              </View>
            </View>
            <Text style={styles.aiSubDesc}>Scan item state, fiber degradation & automated resale routing</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.ink} />
        </TouchableOpacity>

        {/* ── SECTION 2: SUSTAINABILITY & IMPACT (Green / Emerald) ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDotEmerald} />
          <Text style={styles.sectionTitleEmerald}>SUSTAINABILITY & IMPACT</Text>
        </View>

        {/* Featured Live Stat Card: MY ECO RECORDS */}
        <TouchableOpacity
          style={styles.impactCard}
          onPress={() => router.push('/(tabs)/impact')}
          activeOpacity={0.88}
        >
          <View style={styles.impactHeader}>
            <View style={styles.impactHeaderLeft}>
              <View style={styles.impactIconBox}>
                <Ionicons name="leaf" size={16} color={colors.white} />
              </View>
              <View>
                <Text style={styles.impactTitle}>MY ECO RECORDS</Text>
                <Text style={styles.impactSubtitle}>LIVE CIRCULAR FOOTPRINT</Text>
              </View>
            </View>
            <View style={styles.impactCtaChip}>
              <Text style={styles.impactCtaText}>DOSSIER →</Text>
            </View>
          </View>

          {/* Live Stats Row */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>
                {typeof carbonSaved === 'number' ? carbonSaved.toFixed(1) : carbonSaved}
                <Text style={styles.statUnit}> KG</Text>
              </Text>
              <Text style={styles.statLabel}>CO₂ SAVED</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statNum}>
                {typeof waterSaved === 'number' ? waterSaved.toLocaleString() : waterSaved}
                <Text style={styles.statUnit}> L</Text>
              </Text>
              <Text style={styles.statLabel}>WATER SAVED</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statNum}>
                {itemsCirculated}
                <Text style={styles.statUnit}> PCS</Text>
              </Text>
              <Text style={styles.statLabel}>CIRCULATED</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── SECTION 3: UPCYCLE STUDIO ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDotTerracotta} />
          <Text style={styles.sectionTitleTerracotta}>UPCYCLE STUDIO</Text>
        </View>

        {/* Hero Upcycle Card */}
        <TouchableOpacity
          style={styles.upcycleHeroCard}
          onPress={() => router.push('/(tabs)/circular/upcycle' as any)}
          activeOpacity={0.88}
        >
          <View style={styles.upcycleTopRow}>
            <View style={styles.upcycleBadge}>
              <Ionicons name="leaf-sharp" size={10} color={colors.white} />
              <Text style={styles.upcycleBadgeText}>ZERO WASTE</Text>
            </View>
            <View style={styles.upcycleCountChip}>
              <Text style={styles.upcycleCountText}>15+ VIDEOS</Text>
            </View>
          </View>
          <View style={styles.upcycleMain}>
            <View style={styles.upcycleIconBox}>
              <Ionicons name="cut-sharp" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.upcycleTitle}>UPCYCLE STUDIO</Text>
              <Text style={styles.upcycleDesc}>
                Jeans → Bags · Shirts → Skirts · Sarees → Tops · T-shirts → Art
              </Text>
            </View>
          </View>
          <View style={styles.upcycleCtaRow}>
            <View style={styles.upcyclePillsPreview}>
              {['JEANS', 'SHIRT', 'T-SHIRT', 'SAREE', 'SOCKS'].map((g) => (
                <View key={g} style={styles.upcycleGarmentPill}>
                  <Text style={styles.upcycleGarmentPillText}>{g}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.upcycleCtaBtn}>
            <Text style={styles.upcycleCtaBtnText}>EXPLORE UPCYCLING IDEAS</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.ink} />
          </View>
        </TouchableOpacity>

        {/* ── SECTION 4: CIRCULAR MARKETPLACE (Compact Action Cards) ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDotInk} />
          <Text style={styles.sectionTitleInk}>CIRCULAR MARKETPLACE</Text>
        </View>

        <View style={styles.marketplaceGrid}>
          {/* Sell */}
          <TouchableOpacity
            style={styles.marketCard}
            onPress={() => router.push('/(tabs)/shop/sell')}
            activeOpacity={0.85}
          >
            <View style={styles.marketIconBox}>
              <Ionicons name="pricetag-sharp" size={18} color={colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.marketTitle}>SELL ITEM</Text>
              <Text style={styles.marketDesc}>List pre-loved designer pieces for direct P2P sale</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.ink} />
          </TouchableOpacity>

          {/* Rental */}
          <TouchableOpacity
            style={styles.marketCard}
            onPress={() => router.push('/(tabs)/rental')}
            activeOpacity={0.85}
          >
            <View style={styles.marketIconBox}>
              <Ionicons name="time-sharp" size={18} color={colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.marketTitle}>RENT CLOTHES</Text>
              <Text style={styles.marketDesc}>Borrow couture & occasion wear for short-term leases</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.ink} />
          </TouchableOpacity>

          {/* Swap */}
          <TouchableOpacity
            style={styles.marketCard}
            onPress={() => router.push('/(tabs)/swap')}
            activeOpacity={0.85}
          >
            <View style={styles.marketIconBox}>
              <Ionicons name="swap-horizontal-sharp" size={18} color={colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.marketTitle}>SWAP ITEMS</Text>
              <Text style={styles.marketDesc}>Trade fashion items cashless with deposit protection</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.ink} />
          </TouchableOpacity>

          {/* Repair & Refresh */}
          <TouchableOpacity
            style={styles.marketCard}
            onPress={() => router.push('/(tabs)/studio/repair-refresh')}
            activeOpacity={0.85}
          >
            <View style={styles.marketIconBox}>
              <Ionicons name="color-palette-sharp" size={18} color={colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.marketTitle}>REPAIR & REFRESH</Text>
              <Text style={styles.marketDesc}>Custom upcycling, tailoring & garment restoration</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.ink} />
          </TouchableOpacity>

          {/* Recycling Hubs */}
          <TouchableOpacity
            style={[styles.marketCard, styles.marketCardEmerald]}
            onPress={() => setShowRecyclingModal(true)}
            activeOpacity={0.85}
          >
            <View style={[styles.marketIconBox, styles.marketIconBoxEmerald]}>
              <Ionicons name="leaf" size={18} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.marketTitle, { color: colors.emeraldDark }]}>RECYCLING HUBS</Text>
                <View style={styles.verifiedChip}>
                  <Text style={styles.verifiedChipText}>VERIFIED</Text>
                </View>
              </View>
              <Text style={styles.marketDesc}>Zero-landfill textile drop-off & recovery facilities</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.emeraldDark} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Full Recycling Centers Directory Modal */}
      <RecyclingHubsModal
        visible={showRecyclingModal}
        onClose={() => setShowRecyclingModal(false)}
        garment={null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },

  // ── Upcycle Hero Card (Terracotta) ────────────────────────────
  upcycleHeroCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.terracotta,
    padding: 14,
    marginBottom: 10,
    shadowColor: colors.terracottaDark,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 3,
  },
  upcycleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  upcycleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.emerald,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  upcycleBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.8,
  },
  upcycleCountChip: {
    backgroundColor: colors.terracottaLight,
    borderWidth: 1.5,
    borderColor: colors.terracotta,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  upcycleCountText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.terracottaDark,
    letterSpacing: 0.8,
  },
  upcycleMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  upcycleIconBox: {
    width: 44,
    height: 44,
    backgroundColor: colors.terracotta,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  upcycleTitle: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.terracottaDark,
    letterSpacing: 1.2,
  },
  upcycleDesc: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 14,
  },
  upcycleCtaRow: {
    marginBottom: 10,
  },
  upcyclePillsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  upcycleGarmentPill: {
    backgroundColor: colors.terracottaLight,
    borderWidth: 1,
    borderColor: colors.terracotta,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  upcycleGarmentPillText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.terracottaDark,
    letterSpacing: 0.5,
  },
  upcycleCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cream,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  upcycleCtaBtnText: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 0.8,
  },

  // ── Section Headers ───────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 10,
  },
  sectionDotTerracotta: {
    width: 8,
    height: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 1,
  },
  sectionTitleTerracotta: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.terracottaDark,
    letterSpacing: 1.5,
  },
  sectionDotEmerald: {
    width: 8,
    height: 8,
    backgroundColor: colors.emerald,
    borderRadius: 1,
  },
  sectionTitleEmerald: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.emeraldDark,
    letterSpacing: 1.5,
  },
  sectionDotInk: {
    width: 8,
    height: 8,
    backgroundColor: colors.ink,
    borderRadius: 1,
  },
  sectionTitleInk: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 1.5,
  },

  // ── Hero AI Advisor (Orange / Terracotta Accent) ───────────────
  heroAiCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 14,
    marginBottom: 10,
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 3,
  },
  heroAiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroAiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.terracotta,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 2,
  },
  heroAiBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.8,
  },
  heroGoldChip: {
    backgroundColor: colors.gold,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 2,
  },
  heroGoldChipText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.goldDark,
    letterSpacing: 0.8,
  },
  heroAiMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  heroAiIconBox: {
    width: 44,
    height: 44,
    backgroundColor: colors.terracotta,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  heroAiTitle: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: 1.2,
  },
  heroAiDesc: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textPrimary,
    marginTop: 2,
    lineHeight: 14,
  },
  heroAiCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cream,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  heroAiCtaText: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 0.8,
  },

  // ── Secondary AI Card (Condition Scan) ────────────────────────
  aiSubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 11,
    gap: 12,
    marginBottom: 6,
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 0,
    elevation: 2,
  },
  aiSubIconBox: {
    width: 38,
    height: 38,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiSubTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 0.8,
  },
  aiGoldChip: {
    backgroundColor: colors.gold,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  aiGoldChipText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: colors.goldDark,
  },
  aiSubDesc: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    color: colors.textMuted,
    marginTop: 2,
  },

  // ── Emerald Impact Card (Green / Sustainability) ─────────────
  impactCard: {
    backgroundColor: colors.emeraldLight,
    borderWidth: 2,
    borderColor: colors.emerald,
    padding: 14,
    marginBottom: 6,
    shadowColor: colors.emeraldDark,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 3,
  },
  impactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  impactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  impactIconBox: {
    width: 32,
    height: 32,
    backgroundColor: colors.emerald,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
  },
  impactTitle: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: colors.emeraldDark,
    letterSpacing: 0.8,
  },
  impactSubtitle: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.emeraldDark,
    opacity: 0.8,
  },
  impactCtaChip: {
    backgroundColor: colors.white,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: colors.emeraldDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  impactCtaText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.emeraldDark,
    letterSpacing: 0.8,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.emeraldDark,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.emeraldDark,
  },
  statUnit: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.emeraldDark,
  },
  statLabel: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: colors.emeraldDark,
    marginTop: 1,
    letterSpacing: 0.4,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.emeraldDark,
    opacity: 0.25,
  },

  // ── Circular Marketplace (Compact Cards) ────────────────────
  marketplaceGrid: {
    gap: 8,
    marginBottom: 40,
  },
  marketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 0,
    elevation: 2,
  },
  marketCardEmerald: {
    borderColor: colors.emerald,
    backgroundColor: '#F7FCFA',
  },
  marketIconBox: {
    width: 36,
    height: 36,
    backgroundColor: colors.bgMuted,
    borderWidth: 1.5,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketIconBoxEmerald: {
    backgroundColor: colors.emerald,
    borderColor: colors.emeraldDark,
  },
  marketTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 0.8,
  },
  marketDesc: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 13,
  },
  verifiedChip: {
    backgroundColor: colors.emeraldLight,
    borderWidth: 1,
    borderColor: colors.emerald,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  verifiedChipText: {
    fontFamily: typography.mono,
    fontSize: 7,
    fontWeight: '900',
    color: colors.emeraldDark,
    letterSpacing: 0.5,
  },
});
