import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { impactService } from '../../../src/services/impactService';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';

export default function CircularScreen() {
  const router = useRouter();
  const [impactData, setImpactData] = useState<any>(null);

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
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Banner Tagline */}
        <View style={styles.bannerBar}>
          <Text style={styles.bannerTagText}>CIRCULAR FASHION ATELIER // INDIA</Text>
          <Text style={styles.bannerSubtext}>Authenticate, exchange, lease & recycle pre-loved luxury archives</Text>
        </View>

        {/* ── SECTION 1: AI & INTELLIGENCE ─────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDotInk} />
          <Text style={styles.sectionTitleInk}>AI & INTELLIGENCE</Text>
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
              <Ionicons name="sparkles-sharp" size={30} color={colors.white} />
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
            <Ionicons name="arrow-forward" size={16} color={colors.ink} />
          </View>
        </TouchableOpacity>

        {/* Secondary AI Tool: CONDITION SCAN */}
        <TouchableOpacity
          style={styles.aiSubCard}
          onPress={() => router.push('/(tabs)/circular/condition-check')}
          activeOpacity={0.85}
        >
          <View style={styles.aiSubIconBox}>
            <Ionicons name="scan-sharp" size={22} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.aiSubTitle}>CONDITION SCAN</Text>
              <View style={styles.aiGoldChip}>
                <Text style={styles.aiGoldChipText}>AI EDIT</Text>
              </View>
            </View>
            <Text style={styles.aiSubDesc}>Scan item state, fiber degradation & automated resale routing</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.ink} />
        </TouchableOpacity>

        {/* ── SECTION 2: SUSTAINABILITY & IMPACT ───────────────── */}
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

        {/* ── SECTION 3: CIRCULAR MARKETPLACE ─────────────────── */}
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
              <Ionicons name="pricetag-sharp" size={22} color={colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.marketTitle}>SELL ITEM</Text>
              <Text style={styles.marketDesc}>List pre-loved designer pieces for direct P2P sale</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink} />
          </TouchableOpacity>

          {/* Rental */}
          <TouchableOpacity
            style={styles.marketCard}
            onPress={() => router.push('/(tabs)/rental')}
            activeOpacity={0.85}
          >
            <View style={styles.marketIconBox}>
              <Ionicons name="time-sharp" size={22} color={colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.marketTitle}>RENT CLOTHES</Text>
              <Text style={styles.marketDesc}>Borrow couture & occasion wear for short-term leases</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink} />
          </TouchableOpacity>

          {/* Swap */}
          <TouchableOpacity
            style={styles.marketCard}
            onPress={() => router.push('/(tabs)/swap')}
            activeOpacity={0.85}
          >
            <View style={styles.marketIconBox}>
              <Ionicons name="swap-horizontal-sharp" size={22} color={colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.marketTitle}>SWAP ITEMS</Text>
              <Text style={styles.marketDesc}>Trade fashion items cashless with deposit protection</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink} />
          </TouchableOpacity>

          {/* Repair & Refresh */}
          <TouchableOpacity
            style={styles.marketCard}
            onPress={() => router.push('/(tabs)/studio')}
            activeOpacity={0.85}
          >
            <View style={styles.marketIconBox}>
              <Ionicons name="color-palette-sharp" size={22} color={colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.marketTitle}>REPAIR & REFRESH</Text>
              <Text style={styles.marketDesc}>Custom upcycling, tailoring & garment restoration</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: 18,
    paddingTop: 16,
    paddingBottom: 100,
  },
  bannerBar: {
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    marginBottom: 20,
  },
  bannerTagText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 1.5,
  },
  bannerSubtext: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: 'rgba(245, 241, 232, 0.75)',
    marginTop: 4,
  },

  // ── Section Headers ───────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionDotTerracotta: {
    width: 8,
    height: 8,
    backgroundColor: colors.terracotta,
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
  },
  sectionTitleInk: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 1.5,
  },

  // ── Hero AI Advisor ───────────────────────────────────────────
  heroAiCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 18,
    marginBottom: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 3,
  },
  heroAiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroAiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heroAiBadgeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 1,
  },
  heroGoldChip: {
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroGoldChipText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.goldDark,
    letterSpacing: 1,
  },
  heroAiMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  heroAiIconBox: {
    width: 48,
    height: 48,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  heroAiTitle: {
    fontFamily: typography.headings,
    fontSize: 24,
    color: colors.ink,
    letterSpacing: 1.5,
  },
  heroAiDesc: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textPrimary,
    marginTop: 2,
    lineHeight: 16,
  },
  heroAiCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cream,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  heroAiCtaText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 1,
  },

  // ── Secondary AI Card ────────────────────────────────────────
  aiSubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 14,
    gap: 14,
    marginBottom: 20,
  },
  aiSubIconBox: {
    width: 42,
    height: 42,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiSubTitle: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 1,
  },
  aiGoldChip: {
    backgroundColor: colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  aiGoldChipText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.goldDark,
  },
  aiSubDesc: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textPrimary,
    marginTop: 2,
  },

  // ── Emerald Impact Card ──────────────────────────────────────
  impactCard: {
    backgroundColor: colors.emeraldLight,
    borderWidth: 2,
    borderColor: colors.emerald,
    padding: 18,
    marginBottom: 20,
    shadowColor: colors.emeraldDark,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 3,
  },
  impactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  impactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  impactIconBox: {
    width: 36,
    height: 36,
    backgroundColor: colors.emerald,
    justifyContent: 'center',
    alignItems: 'center',
  },
  impactTitle: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '900',
    color: colors.emeraldDark,
    letterSpacing: 1,
  },
  impactSubtitle: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.emeraldDark,
    opacity: 0.8,
  },
  impactCtaChip: {
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: colors.emeraldDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  impactCtaText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.emeraldDark,
    letterSpacing: 1,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.emeraldDark,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontFamily: typography.headings,
    fontSize: 26,
    color: colors.emeraldDark,
  },
  statUnit: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.emeraldDark,
  },
  statLabel: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.emeraldDark,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.emeraldDark,
    opacity: 0.3,
  },

  // ── Circular Marketplace Grid ─────────────────────────────
  marketplaceGrid: {
    gap: 12,
    marginBottom: 40,
  },
  marketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 16,
    gap: 14,
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 2,
  },
  marketIconBox: {
    width: 44,
    height: 44,
    backgroundColor: colors.bgMuted,
    borderWidth: 1.5,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketTitle: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 1,
  },
  marketDesc: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.textPrimary,
    marginTop: 3,
    lineHeight: 15,
  },
});

