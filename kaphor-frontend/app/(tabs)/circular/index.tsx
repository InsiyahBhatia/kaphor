import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SolarIcon } from '../../../src/components/common/SolarIcon';
import { useRouter } from 'expo-router';
import { impactService } from '../../../src/services/impactService';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import { RecyclingHubsModal } from '../../../src/components/RecyclingHubsModal';
import { EditorialIcon } from '../../../src/components/editorial/EditorialIcon';

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
      <Header title="Circular hub" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. SECTION 01: AI & INTELLIGENCE (WARM TERRACOTTA & GOLD) ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={[styles.sectionIndex, { color: colors.terracotta }]}>01</Text>
            <Text style={styles.sectionTitle}>Ai intelligence engines</Text>
          </View>
          <View style={styles.sectionTagTerracotta}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.sectionTagTerracottaText}>V2.4 model</Text>
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
              <SolarIcon name="sparkles" size={11} color={colors.terracottaDark} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.badgeTerracottaText}>Neural stylist</Text>
            </View>
            <View style={styles.badgeGold}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.badgeGoldText}>♔ TOP MATCH</Text>
            </View>
          </View>

          <View style={styles.cardBodyRow}>
            <View style={[styles.iconBoxTerracotta, { backgroundColor: colors.paperLight, borderColor: colors.goldDark, borderWidth: 1 }]}>
              <EditorialIcon name="sparkle" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeadline}>Kaphor ai advisor</Text>
              <Text style={styles.cardSub}>
                Style picks, fabric care tips and live price checks.
              </Text>
            </View>
          </View>

          {/* Micro-Pills */}
          <View style={styles.pillRow}>
            <View style={styles.pillTerracotta}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.pillTerracottaText}>✦ REMIX</Text>
            </View>
            <View style={styles.pillTerracotta}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.pillTerracottaText}>◈ VALUATION</Text>
            </View>
            <View style={styles.pillTerracotta}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.pillTerracottaText}>◆ FABRIC CARE</Text>
            </View>
          </View>

          <View style={styles.actionBtnTerracotta}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnTerracottaText}>Launch ai stylist & care chat</Text>
            <SolarIcon name="arrow-forward" size={14} color={colors.white} />
          </View>
        </TouchableOpacity>

        {/* Secondary AI Tool: CONDITION SCAN */}
        <TouchableOpacity
          style={styles.conditionCard}
          onPress={() => router.push('/(tabs)/circular/condition-check')}
          activeOpacity={0.88}
        >
          <View style={styles.cardCompactLeft}>
            <View style={[styles.iconBoxInk, { backgroundColor: colors.paperLight, borderColor: colors.crimson, borderWidth: 1 }]}>
              <EditorialIcon name="search" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.cardCompactTitle}>Ai condition scan</Text>
                <View style={styles.badgeGoldTiny}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.badgeGoldTinyText}>Glie scanner</Text>
                </View>
              </View>
              <Text style={styles.cardCompactSub}>
                Quick AI check of fabric wear and seams to pick repair, resale or recycle.
              </Text>
            </View>
          </View>
          <SolarIcon name="chevron-forward" size={18} color={colors.ink} />
        </TouchableOpacity>

        {/* ── 2. SECTION 02: SUSTAINABILITY & IMPACT (VIBRANT EMERALD) ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={[styles.sectionIndex, { color: colors.emerald }]}>02</Text>
            <Text style={styles.sectionTitle}>Sustainability & impact</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/impact')}>
            <Text style={styles.sectionActionEmerald}>Full audit →</Text>
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
              <SolarIcon name="leaf" size={11} color={colors.emeraldLight} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.badgeEmeraldText}>Verified conservation</Text>
            </View>
            <Text style={styles.impactSubtitle}>Live circular ledger</Text>
          </View>

          {/* Live Stats Row */}
          <View style={styles.statsScoreboard}>
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>
                {typeof carbonSaved === 'number' ? carbonSaved.toFixed(1) : carbonSaved}
              </Text>
              <Text style={styles.statUnits}>KG CO₂</Text>
              <Text style={styles.statSub}>Offset</Text>
            </View>

            <View style={styles.statRule} />

            <View style={styles.statCol}>
              <Text style={styles.statNumber}>
                {typeof waterSaved === 'number' ? waterSaved.toLocaleString('en-IN') : waterSaved}
              </Text>
              <Text style={styles.statUnits}>Litres</Text>
              <Text style={styles.statSub}>Water</Text>
            </View>

            <View style={styles.statRule} />

            <View style={styles.statCol}>
              <Text style={styles.statNumber}>{itemsCirculated}</Text>
              <Text style={styles.statUnits}>Pieces</Text>
              <Text style={styles.statSub}>Circulated</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ── 3. SECTION 03: UPCYCLE STUDIO (GOLD & CRAFT ACCENTS) ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={[styles.sectionIndex, { color: colors.goldDark }]}>03</Text>
            <Text style={styles.sectionTitle}>Upcycle studio</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/circular/upcycle')}>
            <Text style={styles.sectionActionGold}>All guides (5) →</Text>
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
              <SolarIcon name="leaf-sharp" size={10} color={colors.emeraldLight} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.badgeEmeraldText}>Zero waste fashion</Text>
            </View>
            <View style={styles.badgeGold}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.badgeGoldText}>15+ DIY VIDEOS</Text>
            </View>
          </View>

          <View style={styles.cardBodyRow}>
            <View style={[styles.iconBoxInk, { backgroundColor: colors.paperLight, borderColor: colors.goldDark, borderWidth: 1 }]}>
              <EditorialIcon name="scissors" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeadline}>Upcycle studio</Text>
              <Text style={styles.cardSub}>
                Turn old denim, shirts and sarees into new bags and vests. Step-by-step videos.
              </Text>
            </View>
          </View>

          {/* Color-Coded Garment Project Pills */}
          <View style={styles.pillRow}>
            <View style={[styles.garmentPillColored, { backgroundColor: colors.cream, borderColor: colors.ink }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.garmentPillColoredText, { color: colors.ink }]}>✂ JEANS (6)</Text>
            </View>
            <View style={[styles.garmentPillColored, { backgroundColor: colors.terracottaLight, borderColor: colors.terracotta }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.garmentPillColoredText, { color: colors.terracottaDark }]}>✂ SHIRT (5)</Text>
            </View>
            <View style={[styles.garmentPillColored, { backgroundColor: colors.bgMuted, borderColor: colors.ink }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.garmentPillColoredText, { color: colors.ink }]}>✂ T-SHIRT (4)</Text>
            </View>
            <View style={[styles.garmentPillColored, { backgroundColor: colors.goldLight, borderColor: colors.gold }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.garmentPillColoredText, { color: colors.goldDark }]}>✂ SAREE (5)</Text>
            </View>
            <View style={[styles.garmentPillColored, { backgroundColor: colors.emeraldLight, borderColor: colors.emerald }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.garmentPillColoredText, { color: colors.emeraldDark }]}>✂ SOCKS (4)</Text>
            </View>
          </View>

          <View style={styles.actionBtnGold}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnGoldText}>Explore 5 upcycle workshops</Text>
            <SolarIcon name="arrow-forward" size={14} color={colors.white} />
          </View>
        </TouchableOpacity>

        {/* ── 4. SECTION 04: CIRCULAR MARKETPLACE (COLOR-CODED GRID) ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={[styles.sectionIndex, { color: colors.ink }]}>04</Text>
            <Text style={styles.sectionTitle}>Circular marketplace</Text>
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
              <View style={[styles.pathwayIconWrap, { backgroundColor: colors.paperLight, borderColor: colors.crimsonLight, borderWidth: 1 }]}>
                <EditorialIcon name="tag" size={20} />
              </View>
              <Text style={[styles.pathwayIndex, { color: colors.crimson }]}>01</Text>
            </View>
            <Text style={styles.pathwayName}>Sell</Text>
            <Text style={styles.pathwayDesc}>List pre-loved designer pieces for direct P2P sale</Text>
            <View style={styles.pathwayFoot}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.pathwayCta, { color: colors.crimson }]}>List piece</Text>
              <SolarIcon name="arrow-forward" size={12} color={colors.crimson} />
            </View>
          </TouchableOpacity>

          {/* Rental (Gold Accent) */}
          <TouchableOpacity
            style={[styles.pathwayCard, { borderTopColor: colors.gold, borderTopWidth: 4 }]}
            onPress={() => router.push('/(tabs)/rental')}
            activeOpacity={0.88}
          >
            <View style={styles.pathwayHead}>
              <View style={[styles.pathwayIconWrap, { backgroundColor: colors.paperLight, borderColor: colors.goldLight, borderWidth: 1 }]}>
                <EditorialIcon name="rental" size={20} />
              </View>
              <Text style={[styles.pathwayIndex, { color: colors.goldDark }]}>02</Text>
            </View>
            <Text style={styles.pathwayName}>Rent</Text>
            <Text style={styles.pathwayDesc}>Borrow fashion & occasion wear for short-term leases</Text>
            <View style={styles.pathwayFoot}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.pathwayCta, { color: colors.goldDark }]}>Explore leases</Text>
              <SolarIcon name="arrow-forward" size={12} color={colors.goldDark} />
            </View>
          </TouchableOpacity>

          {/* Swap (Emerald Accent) */}
          <TouchableOpacity
            style={[styles.pathwayCard, { borderTopColor: colors.emerald, borderTopWidth: 4 }]}
            onPress={() => router.push('/(tabs)/swap')}
            activeOpacity={0.88}
          >
            <View style={styles.pathwayHead}>
              <View style={[styles.pathwayIconWrap, { backgroundColor: colors.paperLight, borderColor: colors.emeraldLight, borderWidth: 1 }]}>
                <EditorialIcon name="swap" size={20} />
              </View>
              <Text style={[styles.pathwayIndex, { color: colors.emerald }]}>03</Text>
            </View>
            <Text style={styles.pathwayName}>Swap</Text>
            <Text style={styles.pathwayDesc}>Trade fashion items cashless with deposit protection</Text>
            <View style={styles.pathwayFoot}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.pathwayCta, { color: colors.emeraldDark }]}>Barter saved</Text>
              <SolarIcon name="arrow-forward" size={12} color={colors.emeraldDark} />
            </View>
          </TouchableOpacity>

          {/* Repair & Refresh (Terracotta Accent) */}
          <TouchableOpacity
            style={[styles.pathwayCard, { borderTopColor: colors.terracotta, borderTopWidth: 4 }]}
            onPress={() => router.push('/(tabs)/studio/repair-refresh')}
            activeOpacity={0.88}
          >
            <View style={styles.pathwayHead}>
              <View style={[styles.pathwayIconWrap, { backgroundColor: colors.paperLight, borderColor: colors.terracottaLight, borderWidth: 1 }]}>
                <EditorialIcon name="thread" size={20} />
              </View>
              <Text style={[styles.pathwayIndex, { color: colors.terracottaDark }]}>04</Text>
            </View>
            <Text style={styles.pathwayName}>Repair & refresh</Text>
            <Text style={styles.pathwayDesc}>Guides to mend, revive & refresh your clothes yourself</Text>
            <View style={styles.pathwayFoot}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.pathwayCta, { color: colors.terracottaDark }]}>View guides</Text>
              <SolarIcon name="arrow-forward" size={12} color={colors.terracottaDark} />
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
            <View style={[styles.recoveryIconBox, { backgroundColor: colors.paperLight, borderColor: colors.emerald, borderWidth: 1 }]}>
              <EditorialIcon name="recycle" size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.recoveryHeadline}>Recycling hubs</Text>
                <View style={styles.badgeEmeraldTiny}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.badgeEmeraldTinyText}>Verified</Text>
                </View>
              </View>
              <Text style={styles.recoverySub}>
                Places across India where old clothes can be dropped off and recycled.
              </Text>
            </View>
          </View>
          <SolarIcon name="chevron-forward" size={18} color={colors.emeraldDark} />
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
    fontSize: 18,
  },
  sectionTitle: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.ink, includeFontPadding: false, },
  sectionTagTerracotta: {
    backgroundColor: colors.terracottaLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.terracotta,
    borderRadius: 2,
  },
  sectionTagTerracottaText: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.terracottaDark, includeFontPadding: false, },
  sectionActionEmerald: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.emerald, includeFontPadding: false, },
  sectionActionGold: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.goldDark, includeFontPadding: false, },

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
    fontSize: 24,
    color: colors.ink,
    letterSpacing: 1.2,
  },
  cardSub: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 21, includeFontPadding: false, },
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
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.terracottaDark, includeFontPadding: false, },
  badgeGold: {
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  badgeGoldText: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.goldDark, includeFontPadding: false, },
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
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.terracottaDark, includeFontPadding: false, },
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
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.white, includeFontPadding: false, },

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
    fontSize: 18,
    color: colors.ink,
    letterSpacing: 1,
  },
  cardCompactSub: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: 2, includeFontPadding: false, },
  badgeGoldTiny: {
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  badgeGoldTinyText: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.goldDark, includeFontPadding: false, },

  // ── SUSTAINABILITY & IMPACT CARD ──
  impactCard: {
    backgroundColor: colors.emeraldLight,
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
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.emeraldLight, includeFontPadding: false, },
  impactSubtitle: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.emeraldDark, includeFontPadding: false, },
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
    fontSize: 34,
    color: colors.emeraldDark,
    lineHeight: 34,
  },
  statUnits: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.emeraldDark,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  statSub: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.emerald, includeFontPadding: false, },
  statRule: {
    width: 1,
    height: 34,
    backgroundColor: colors.emeraldLight,
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
    fontFamily: typography.handwritten,
    fontSize: 16, includeFontPadding: false, },
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
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.cream, includeFontPadding: false, },

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
    fontSize: 16,
  },
  pathwayName: {
    fontFamily: typography.headings,
    fontSize: 20,
    color: colors.ink,
    letterSpacing: 1,
    marginBottom: 4,
  },
  pathwayDesc: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 19,
    minHeight: 38, includeFontPadding: false, },
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
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },

  // ── RECOVERY CARD ──
  recoveryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.emeraldLight,
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
    fontSize: 16,
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
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.emeraldDark, includeFontPadding: false, },
  recoverySub: {
    fontFamily: typography.handwritten,
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 19, includeFontPadding: false, },
});
