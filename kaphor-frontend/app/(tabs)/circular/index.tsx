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
    <View style={styles.screen}>
      <Header title="CIRCULAR HUB" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. SECTION 01: AI & INTELLIGENCE (WARM TERRACOTTA & GOLD) ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={[styles.sectionIndex, { color: colors.terracotta }]}>01</Text>
            <Text style={styles.sectionTitle}>AI INTELLIGENCE ENGINES</Text>
          </View>
          <View style={styles.sectionTagTerracotta}>
            <Text style={styles.sectionTagTerracottaText}>V2.4 MODEL</Text>
          </View>
        </View>

        {/* Hero Card: KAPHOR AI ADVISOR (Terracotta Accent) */}
        <TouchableOpacity
          style={styles.aiAdvisorCard}
          onPress={() => router.push('/(tabs)/studio/chat')}
          activeOpacity={0.88}
        >
          <View style={styles.cardTopRow}>
            <View style={styles.badgeTerracotta}>
              <Ionicons name="sparkles" size={11} color={colors.terracottaDark} />
              <Text style={styles.badgeTerracottaText}>NEURAL STYLIST</Text>
            </View>
            <View style={styles.badgeGold}>
              <Text style={styles.badgeGoldText}>♔ CURATED MATCH</Text>
            </View>
          </View>

          <View style={styles.cardBodyRow}>
            <View style={styles.iconBoxTerracotta}>
              <Ionicons name="sparkles-sharp" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeadline}>KAPHOR AI ADVISOR</Text>
              <Text style={styles.cardSub}>
                Instant style curation, fabric care guidelines & real-time valuation intelligence.
              </Text>
            </View>
          </View>

          {/* Micro-Pills */}
          <View style={styles.pillRow}>
            <View style={styles.pillTerracotta}>
              <Text style={styles.pillTerracottaText}>✦ REMIX</Text>
            </View>
            <View style={styles.pillTerracotta}>
              <Text style={styles.pillTerracottaText}>◈ VALUATION</Text>
            </View>
            <View style={styles.pillTerracotta}>
              <Text style={styles.pillTerracottaText}>◆ FABRIC CARE</Text>
            </View>
          </View>

          <View style={styles.actionBtnTerracotta}>
            <Text style={styles.actionBtnTerracottaText}>LAUNCH AI STYLIST & CARE CHAT</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.white} />
          </View>
        </TouchableOpacity>

        {/* Secondary AI Tool: CONDITION SCAN */}
        <TouchableOpacity
          style={styles.conditionCard}
          onPress={() => router.push('/(tabs)/circular/condition-check')}
          activeOpacity={0.88}
        >
          <View style={styles.cardCompactLeft}>
            <View style={styles.iconBoxInk}>
              <Ionicons name="scan-sharp" size={20} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.cardCompactTitle}>AI CONDITION SCAN</Text>
                <View style={styles.badgeGoldTiny}>
                  <Text style={styles.badgeGoldTinyText}>GLIE SCANNER</Text>
                </View>
              </View>
              <Text style={styles.cardCompactSub}>
                Autonomous computer-vision inspection for fiber wear, seams & resale routing.
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.ink} />
        </TouchableOpacity>

        {/* ── 2. SECTION 02: SUSTAINABILITY & IMPACT (VIBRANT EMERALD) ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={[styles.sectionIndex, { color: colors.emerald }]}>02</Text>
            <Text style={styles.sectionTitle}>SUSTAINABILITY & IMPACT</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/impact')}>
            <Text style={styles.sectionActionEmerald}>FULL AUDIT →</Text>
          </TouchableOpacity>
        </View>

        {/* Live Stat Card: MY ECO RECORDS */}
        <TouchableOpacity
          style={styles.impactCard}
          onPress={() => router.push('/(tabs)/impact')}
          activeOpacity={0.88}
        >
          <View style={styles.impactHeader}>
            <View style={styles.badgeEmerald}>
              <Ionicons name="leaf" size={11} color={colors.emeraldLight} />
              <Text style={styles.badgeEmeraldText}>VERIFIED CONSERVATION</Text>
            </View>
            <Text style={styles.impactSubtitle}>LIVE CIRCULAR LEDGER</Text>
          </View>

          {/* Live Stats Row */}
          <View style={styles.statsScoreboard}>
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>
                {typeof carbonSaved === 'number' ? carbonSaved.toFixed(1) : carbonSaved}
              </Text>
              <Text style={styles.statUnits}>KG CO₂</Text>
              <Text style={styles.statSub}>OFFSET</Text>
            </View>

            <View style={styles.statRule} />

            <View style={styles.statCol}>
              <Text style={styles.statNumber}>
                {typeof waterSaved === 'number' ? waterSaved.toLocaleString('en-IN') : waterSaved}
              </Text>
              <Text style={styles.statUnits}>LITRES</Text>
              <Text style={styles.statSub}>WATER</Text>
            </View>

            <View style={styles.statRule} />

            <View style={styles.statCol}>
              <Text style={styles.statNumber}>{itemsCirculated}</Text>
              <Text style={styles.statUnits}>PIECES</Text>
              <Text style={styles.statSub}>CIRCULATED</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── 3. SECTION 03: UPCYCLE STUDIO (GOLD & CRAFT ACCENTS) ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={[styles.sectionIndex, { color: colors.goldDark }]}>03</Text>
            <Text style={styles.sectionTitle}>UPCYCLE STUDIO</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/circular/upcycle')}>
            <Text style={styles.sectionActionGold}>ALL GUIDES (5) →</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Upcycle Card */}
        <TouchableOpacity
          style={styles.upcycleHeroCard}
          onPress={() => router.push('/(tabs)/circular/upcycle' as any)}
          activeOpacity={0.88}
        >
          <View style={styles.cardTopRow}>
            <View style={styles.badgeEmerald}>
              <Ionicons name="leaf-sharp" size={10} color={colors.emeraldLight} />
              <Text style={styles.badgeEmeraldText}>ZERO WASTE FASHION</Text>
            </View>
            <View style={styles.badgeGold}>
              <Text style={styles.badgeGoldText}>15+ DIY VIDEOS</Text>
            </View>
          </View>

          <View style={styles.cardBodyRow}>
            <View style={styles.iconBoxInk}>
              <Ionicons name="cut-sharp" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeadline}>UPCYCLE ATELIER</Text>
              <Text style={styles.cardSub}>
                Transform old denim, shirts, sarees & basics into bespoke bags, vests and accessories with step-by-step video tutorials.
              </Text>
            </View>
          </View>

          {/* Color-Coded Garment Project Pills */}
          <View style={styles.pillRow}>
            <View style={[styles.garmentPillColored, { backgroundColor: colors.cream, borderColor: colors.ink }]}>
              <Text style={[styles.garmentPillColoredText, { color: colors.ink }]}>✂ JEANS (6)</Text>
            </View>
            <View style={[styles.garmentPillColored, { backgroundColor: colors.terracottaLight, borderColor: colors.terracotta }]}>
              <Text style={[styles.garmentPillColoredText, { color: colors.terracottaDark }]}>✂ SHIRT (5)</Text>
            </View>
            <View style={[styles.garmentPillColored, { backgroundColor: colors.bgMuted, borderColor: colors.ink }]}>
              <Text style={[styles.garmentPillColoredText, { color: colors.ink }]}>✂ T-SHIRT (4)</Text>
            </View>
            <View style={[styles.garmentPillColored, { backgroundColor: colors.goldLight, borderColor: colors.gold }]}>
              <Text style={[styles.garmentPillColoredText, { color: colors.goldDark }]}>✂ SAREE (5)</Text>
            </View>
            <View style={[styles.garmentPillColored, { backgroundColor: colors.emeraldLight, borderColor: colors.emerald }]}>
              <Text style={[styles.garmentPillColoredText, { color: colors.emeraldDark }]}>✂ SOCKS (4)</Text>
            </View>
          </View>

          <View style={styles.actionBtnGold}>
            <Text style={styles.actionBtnGoldText}>EXPLORE 5 UPCYCLE WORKSHOPS</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.white} />
          </View>
        </TouchableOpacity>

        {/* ── 4. SECTION 04: CIRCULAR MARKETPLACE (COLOR-CODED GRID) ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={[styles.sectionIndex, { color: colors.ink }]}>04</Text>
            <Text style={styles.sectionTitle}>CIRCULAR MARKETPLACE</Text>
          </View>
        </View>

        <View style={styles.pathwayGrid}>
          {/* Sell (Crimson Accent) */}
          <TouchableOpacity
            style={[styles.pathwayCard, { borderTopColor: colors.crimson, borderTopWidth: 4 }]}
            onPress={() => router.push('/(tabs)/shop/sell')}
            activeOpacity={0.88}
          >
            <View style={styles.pathwayHead}>
              <View style={[styles.pathwayIconWrap, { backgroundColor: colors.crimsonLight }]}>
                <Ionicons name="pricetag-sharp" size={16} color={colors.crimson} />
              </View>
              <Text style={[styles.pathwayIndex, { color: colors.crimson }]}>01</Text>
            </View>
            <Text style={styles.pathwayName}>SELL</Text>
            <Text style={styles.pathwayDesc}>List pre-loved designer pieces for direct P2P sale</Text>
            <View style={styles.pathwayFoot}>
              <Text style={[styles.pathwayCta, { color: colors.crimson }]}>LIST PIECE</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.crimson} />
            </View>
          </TouchableOpacity>

          {/* Rental (Gold Accent) */}
          <TouchableOpacity
            style={[styles.pathwayCard, { borderTopColor: colors.gold, borderTopWidth: 4 }]}
            onPress={() => router.push('/(tabs)/rental')}
            activeOpacity={0.88}
          >
            <View style={styles.pathwayHead}>
              <View style={[styles.pathwayIconWrap, { backgroundColor: colors.goldLight }]}>
                <Ionicons name="time-sharp" size={16} color={colors.goldDark} />
              </View>
              <Text style={[styles.pathwayIndex, { color: colors.goldDark }]}>02</Text>
            </View>
            <Text style={styles.pathwayName}>RENT</Text>
            <Text style={styles.pathwayDesc}>Borrow couture & occasion wear for short-term leases</Text>
            <View style={styles.pathwayFoot}>
              <Text style={[styles.pathwayCta, { color: colors.goldDark }]}>EXPLORE LEASES</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.goldDark} />
            </View>
          </TouchableOpacity>

          {/* Swap (Emerald Accent) */}
          <TouchableOpacity
            style={[styles.pathwayCard, { borderTopColor: colors.emerald, borderTopWidth: 4 }]}
            onPress={() => router.push('/(tabs)/swap')}
            activeOpacity={0.88}
          >
            <View style={styles.pathwayHead}>
              <View style={[styles.pathwayIconWrap, { backgroundColor: colors.emeraldLight }]}>
                <Ionicons name="swap-horizontal-sharp" size={16} color={colors.emerald} />
              </View>
              <Text style={[styles.pathwayIndex, { color: colors.emerald }]}>03</Text>
            </View>
            <Text style={styles.pathwayName}>SWAP</Text>
            <Text style={styles.pathwayDesc}>Trade fashion items cashless with deposit protection</Text>
            <View style={styles.pathwayFoot}>
              <Text style={[styles.pathwayCta, { color: colors.emeraldDark }]}>BARTER VAULT</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.emeraldDark} />
            </View>
          </TouchableOpacity>

          {/* Repair & Refresh (Terracotta Accent) */}
          <TouchableOpacity
            style={[styles.pathwayCard, { borderTopColor: colors.terracotta, borderTopWidth: 4 }]}
            onPress={() => router.push('/(tabs)/studio/repair-refresh')}
            activeOpacity={0.88}
          >
            <View style={styles.pathwayHead}>
              <View style={[styles.pathwayIconWrap, { backgroundColor: colors.terracottaLight }]}>
                <Ionicons name="color-palette-sharp" size={16} color={colors.terracottaDark} />
              </View>
              <Text style={[styles.pathwayIndex, { color: colors.terracottaDark }]}>04</Text>
            </View>
            <Text style={styles.pathwayName}>REPAIR & REFRESH</Text>
            <Text style={styles.pathwayDesc}>Guides to mend, revive & refresh your clothes yourself</Text>
            <View style={styles.pathwayFoot}>
              <Text style={[styles.pathwayCta, { color: colors.terracottaDark }]}>VIEW GUIDES</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.terracottaDark} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Recycling Hubs Card (Emerald Accent) */}
        <TouchableOpacity
          style={styles.recoveryCard}
          onPress={() => setShowRecyclingModal(true)}
          activeOpacity={0.88}
        >
          <View style={styles.recoveryLeft}>
            <View style={styles.recoveryIconBox}>
              <Ionicons name="leaf" size={20} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.recoveryHeadline}>RECYCLING HUBS</Text>
                <View style={styles.badgeEmeraldTiny}>
                  <Text style={styles.badgeEmeraldTinyText}>VERIFIED</Text>
                </View>
              </View>
              <Text style={styles.recoverySub}>
                Zero-landfill textile drop-off & recovery facilities across India.
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.emeraldDark} />
        </TouchableOpacity>
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
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 64,
    gap: 16,
  },

  // ── SECTION HEADERS ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIndex: {
    fontFamily: typography.headings,
    fontSize: 22,
  },
  sectionTitle: {
    fontFamily: typography.monoBold,
    fontSize: 13.5,
    color: colors.ink,
    letterSpacing: 1.5,
  },
  sectionTagTerracotta: {
    backgroundColor: colors.terracottaLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.terracotta,
    borderRadius: 2,
  },
  sectionTagTerracottaText: {
    fontFamily: typography.monoBold,
    fontSize: 11,
    color: colors.terracottaDark,
    letterSpacing: 0.8,
  },
  sectionActionEmerald: {
    fontFamily: typography.monoBold,
    fontSize: 13,
    color: colors.emerald,
    letterSpacing: 1,
  },
  sectionActionGold: {
    fontFamily: typography.monoBold,
    fontSize: 13,
    color: colors.goldDark,
    letterSpacing: 1,
  },

  // ── AI ADVISOR CARD (TERRACOTTA) ──
  aiAdvisorCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderTopWidth: 4,
    borderTopColor: colors.terracotta,
    borderRadius: 2,
    padding: 16,
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  iconBoxTerracotta: {
    width: 44,
    height: 44,
    backgroundColor: colors.terracotta,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
  },
  iconBoxInk: {
    width: 38,
    height: 38,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
  },
  cardHeadline: {
    fontFamily: typography.headings,
    fontSize: 28,
    color: colors.ink,
    letterSpacing: 1.2,
  },
  cardSub: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 14.5,
  },
  badgeTerracotta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.terracottaLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.terracotta,
    borderRadius: 2,
  },
  badgeTerracottaText: {
    fontFamily: typography.monoBold,
    fontSize: 11,
    color: colors.terracottaDark,
    letterSpacing: 1,
  },
  badgeGold: {
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  badgeGoldText: {
    fontFamily: typography.monoBold,
    fontSize: 11,
    color: colors.goldDark,
    letterSpacing: 1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  pillTerracotta: {
    backgroundColor: colors.terracottaLight,
    borderWidth: 1,
    borderColor: colors.terracotta,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  pillTerracottaText: {
    fontFamily: typography.monoBold,
    fontSize: 11,
    color: colors.terracottaDark,
    letterSpacing: 0.6,
  },
  actionBtnTerracotta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.terracotta,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 2,
  },
  actionBtnTerracottaText: {
    fontFamily: typography.monoBold,
    fontSize: 13,
    color: colors.white,
    letterSpacing: 1,
  },

  // ── CONDITION SCAN COMPACT ──
  conditionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 2,
    padding: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  cardCompactLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  cardCompactTitle: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: 1,
  },
  cardCompactSub: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 12,
    marginTop: 2,
  },
  badgeGoldTiny: {
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  badgeGoldTinyText: {
    fontFamily: typography.monoBold,
    fontSize: 10,
    color: colors.goldDark,
    letterSpacing: 0.5,
  },

  // ── SUSTAINABILITY & IMPACT CARD ──
  impactCard: {
    backgroundColor: '#F3FAF6',
    borderWidth: 2,
    borderColor: colors.emerald,
    borderRadius: 2,
    padding: 16,
    shadowColor: colors.emeraldDark,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  impactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  badgeEmerald: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.emerald,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  badgeEmeraldText: {
    fontFamily: typography.monoBold,
    fontSize: 11,
    color: colors.emeraldLight,
    letterSpacing: 1,
  },
  impactSubtitle: {
    fontFamily: typography.monoBold,
    fontSize: 11,
    color: colors.emeraldDark,
    letterSpacing: 1,
  },
  statsScoreboard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontFamily: typography.headings,
    fontSize: 39.5,
    color: colors.emeraldDark,
    lineHeight: 34,
  },
  statUnits: {
    fontFamily: typography.monoBold,
    fontSize: 11.5,
    color: colors.emeraldDark,
    letterSpacing: 1,
    marginTop: 2,
  },
  statSub: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.emerald,
    letterSpacing: 0.5,
  },
  statRule: {
    width: 1,
    height: 34,
    backgroundColor: 'rgba(15, 92, 70, 0.25)',
  },

  // ── UPCYCLE HERO CARD (GOLD & CRAFT) ──
  upcycleHeroCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderTopWidth: 4,
    borderTopColor: colors.gold,
    borderRadius: 2,
    padding: 16,
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  garmentPillColored: {
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  garmentPillColoredText: {
    fontFamily: typography.monoBold,
    fontSize: 11.5,
    letterSpacing: 0.8,
  },
  actionBtnGold: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 2,
  },
  actionBtnGoldText: {
    fontFamily: typography.monoBold,
    fontSize: 13,
    color: colors.cream,
    letterSpacing: 1,
  },

  // ── 2x2 PATHWAY GRID ──
  pathwayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pathwayCard: {
    width: '48.5%',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 2,
    padding: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  pathwayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pathwayIconWrap: {
    width: 30,
    height: 30,
    borderWidth: 1.5,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
  },
  pathwayIndex: {
    fontFamily: typography.headings,
    fontSize: 19.5,
  },
  pathwayName: {
    fontFamily: typography.headings,
    fontSize: 24.5,
    color: colors.ink,
    letterSpacing: 1,
    marginBottom: 4,
  },
  pathwayDesc: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 13,
    minHeight: 38,
  },
  pathwayFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.bgMuted,
  },
  pathwayCta: {
    fontFamily: typography.monoBold,
    fontSize: 11.5,
    letterSpacing: 0.8,
  },

  // ── RECOVERY CARD ──
  recoveryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F9F5',
    borderWidth: 2,
    borderColor: colors.emerald,
    borderRadius: 2,
    padding: 14,
    shadowColor: colors.emeraldDark,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  recoveryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  recoveryIconBox: {
    width: 38,
    height: 38,
    backgroundColor: colors.emerald,
    borderWidth: 1.5,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
  },
  recoveryHeadline: {
    fontFamily: typography.headings,
    fontSize: 19.5,
    color: colors.emeraldDark,
    letterSpacing: 0.8,
  },
  badgeEmeraldTiny: {
    backgroundColor: colors.emeraldLight,
    borderWidth: 1,
    borderColor: colors.emerald,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  badgeEmeraldTinyText: {
    fontFamily: typography.monoBold,
    fontSize: 10,
    color: colors.emeraldDark,
    letterSpacing: 0.5,
  },
  recoverySub: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 12,
  },
});
