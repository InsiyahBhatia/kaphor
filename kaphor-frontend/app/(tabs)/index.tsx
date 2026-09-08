import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Dimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useGarmentStore } from '../../src/store/garmentStore';
import { cartService } from '../../src/services/cartService';
import { PlayingCard } from '../../src/components/PlayingCard';
import { DossierLoading } from '../../src/components/common/DossierLoading';
import { colors, typography } from '../../src/theme';
import { Header } from '../../src/components/common/Header';

const CARD_W = 185;

// ── Platform Impact Metrics ────────────────────────────────────────────────
// Real-time metrics come from GET /api/v1/impact/platform-summary
// Hook in with useImpactStore or a fetch call here
// Impact metrics fetched from GET /api/v1/impact/platform-summary
// Set this state from the API when available to reveal the ImpactDashboard section
const IMPACT_METRICS: {
  garmentsRescued: number;
  co2Saved: number;
  waterSaved: number;
  activeUsers: number;
} | null = null;

// ── Sector Categories ───────────────────────────────────────────────────────
// Sector categories — count values come from GET /api/v1/garments/category-counts
// TODO: replace hardcoded count with API response
const SECTORS = [
  { name: 'ETHNIC', id: 'S-01', img: 'https://images.unsplash.com/photo-1603400521630-9f2de124b33b?q=80&w=400&auto=format&fit=crop' },
  { name: 'APPAREL', id: 'S-02', img: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=400&auto=format&fit=crop' },
  { name: 'ACCESSORIES', id: 'S-03', img: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?q=80&w=400&auto=format&fit=crop' },
  { name: 'FOOTWEAR', id: 'S-04', img: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=400&auto=format&fit=crop' },
  { name: 'SWAP', id: 'S-05', img: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?q=80&w=400&auto=format&fit=crop' },
];

// ── Quick Actions ───────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { 
    label: 'SELL', 
    icon: 'pricetag-sharp' as const, 
    route: '/(tabs)/shop/sell',
    desc: 'List your asset',
    color: colors.red,
  },
  { 
    label: 'SWAP', 
    icon: 'swap-horizontal-sharp' as const, 
    route: '/(tabs)/swap',
    desc: 'Trade garments',
    color: colors.forest,
  },
  { 
    label: 'REPAIR', 
    icon: 'construct-sharp' as const, 
    route: '/(tabs)/studio/repair-refresh',
    desc: 'AI repair guides',
    color: colors.copper,
  },
  { 
    label: 'CHECK', 
    icon: 'scan-sharp' as const, 
    route: '/(tabs)/circular/condition-check',
    desc: 'AI assessment',
    color: colors.navy,
  },
];

// ── Scanner Overlay ─────────────────────────────────────────────────────────
function ScannerOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 30 }).map((_, i) => (
        <View key={i} style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 3 }} />
      ))}
    </View>
  );
}

// ── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ value, unit, label, icon, color }: {
  value: string | number;
  unit: string;
  label: string;
  icon: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Impact Section ──────────────────────────────────────────────────────────
function ImpactDashboard() {
  const metrics = IMPACT_METRICS;
  
  // Don't render until real platform metrics are loaded from API
  if (!metrics) return null;
  
  return (
    <View style={styles.impactSection}>
      <View style={styles.impactHeader}>
        <View style={styles.impactLiveDot} />
        <Text style={styles.impactTitle}>PLATFORM IMPACT</Text>
        <View style={styles.impactBadge}>
          <Text style={styles.impactBadgeText}>LIVE</Text>
        </View>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.impactScroll}>
        <StatCard 
          value={metrics.garmentsRescued.toLocaleString()}
          unit="garments"
          label="Rescued from landfill"
          icon="shirt-outline"
          color={colors.red}
        />
        <StatCard 
          value={`${metrics.co2Saved}kg`}
          unit="CO₂"
          label="Carbon emissions saved"
          icon="leaf-outline"
          color={colors.forest}
        />
        <StatCard 
          value={`${(metrics.waterSaved / 1000).toLocaleString()}K`}
          unit="litres"
          label="Water conserved"
          icon="water-outline"
          color={colors.teal}
        />
        <StatCard 
          value={metrics.activeUsers.toLocaleString()}
          unit="agents"
          label="Active this week"
          icon="people-outline"
          color={colors.purple}
        />
      </ScrollView>
    </View>
  );
}

// ── Hero Section ────────────────────────────────────────────────────────────
function HeroBanner({ onShop }: { onShop: () => void }) {
  return (
    <View style={styles.hero}>
      <Image 
        source={{ uri: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop' }} 
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(26,26,26,0.55)' }]} />
      <ScannerOverlay />
      
      {/* Corner brackets */}
      <View style={styles.heroCornerTL} />
      <View style={styles.heroCornerTR} />
      <View style={styles.heroCornerBL} />
      <View style={styles.heroCornerBR} />
      
      <View style={styles.heroContent}>
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>● LIVE DROP</Text>
          </View>
          <View style={styles.heroBadgeSecondary}>
            <Text style={styles.heroBadgeSecondaryText}>SS26</Text>
          </View>
        </View>
        
        <Text style={styles.heroTitle}>CIRCULAR{`\n`}FASHION{`\n`}MARKETPLACE</Text>
        
        <View style={styles.heroMeta}>
          <View style={styles.heroMetaItem}>
            <View style={styles.heroMetaDot} />
            <Text style={styles.heroMetaText}>PRE-LOVED MARKETPLACE</Text>
          </View>
          <View style={styles.heroMetaItem}>
            <View style={[styles.heroMetaDot, { backgroundColor: colors.forest }]} />
            <Text style={styles.heroMetaText}>CIRCULAR FASHION</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.heroCta} onPress={onShop} activeOpacity={0.85}>
          <Text style={styles.heroCtaText}>BROWSE THE DECK</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.charcoal} />
        </TouchableOpacity>
      </View>
      
      {/* Bottom bar */}
      <View style={styles.heroBottom}>
        <Text style={styles.heroBottomText}>CIRCULAR FASHION · SINCE 2025</Text>
        <View style={styles.heroBottomDivider} />
        <Text style={[styles.heroBottomText, { color: colors.red }]}>RESELL · UPCYCLE · RECYCLE</Text>
      </View>
    </View>
  );
}

// ── Quick Actions Grid ──────────────────────────────────────────────────────
function QuickActionGrid({ onNavigate }: { onNavigate: (route: string) => void }) {
  return (
    <View style={styles.quickActionGrid}>
      {QUICK_ACTIONS.map((action, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [
            styles.quickActionCard,
            { borderColor: action.color + '40' },
            pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
          ]}
          onPress={() => onNavigate(action.route)}
        >
          <View style={[styles.quickActionIconWrap, { backgroundColor: action.color + '12' }]}>
            <Ionicons name={action.icon} size={22} color={action.color} />
          </View>
          <Text style={styles.quickActionLabel}>{action.label}</Text>
          <Text style={styles.quickActionDesc}>{action.desc}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Category Sectors ────────────────────────────────────────────────────────
function CategorySectors({ onNavigate }: { onNavigate: (route: string, params?: any) => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionLine} />
        <Text style={styles.sectionTitle}>SECTORS</Text>
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{SECTORS.length}</Text>
        </View>
        <View style={[styles.sectionLine, { flex: 0.5 }]} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
        {SECTORS.map((sector, i) => (
          <TouchableOpacity
            key={i}
            style={styles.categoryCard}
            onPress={() => onNavigate('/(tabs)/shop', { category: sector.name })}
            activeOpacity={0.85}
          >
            <Image source={{ uri: sector.img }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(26,26,26,0.45)' }]} />
            
            {/* Scan line animation area */}
            <View style={styles.categoryScanArea}>
              <View style={styles.categoryScanLine} />
            </View>
            
            <View style={styles.categoryContent}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{sector.id}</Text>
              </View>
              <Text style={styles.categoryName}>{sector.name}</Text>
              <Text style={styles.categoryCount}>BROWSE</Text>
            </View>
            
            {/* Bottom accent bar */}
            <View style={styles.categoryAccent} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ── New Arrivals ────────────────────────────────────────────────────────────
function NewArrivals({ 
  garments, 
  isLoading, 
  onNavigateToItem, 
  onAddToCart,
  onNavigate,
}: { 
  garments: any[];
  isLoading: boolean;
  onNavigateToItem: (id: string) => void;
  onAddToCart: (item: any) => void;
  onNavigate?: (route: string, params?: any) => void;
}) {
  if (isLoading) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionTitle}>NEW ARRIVALS</Text>
          <View style={[styles.sectionLine, { flex: 1 }]} />
        </View>
        <DossierLoading variant="home" compact />
      </View>
    );
  }

  const saleGarments = garments.filter(g => g.listingType === 'SALE').slice(0, 8);
  
  if (saleGarments.length === 0) {
    return null;
  }

  const suits: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionLine} />
        <Text style={styles.sectionTitle}>NEW ARRIVALS</Text>
        <TouchableOpacity onPress={() => onNavigate?.('/(tabs)/shop')}>
          <Text style={styles.sectionSeeAll}>SEE ALL →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.arrivalsScroll}>
        {saleGarments.map((item, index) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.cardWrapper,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
            onPress={() => onNavigateToItem(item.id)}
          >
            <PlayingCard
              rank={ranks[index % ranks.length]}
              suit={suits[index % 4]}
              productName={item.title}
              price={item.price ? item.price / 100 : 0}
              size={item.size || 'M'}
              category={item.category}
              subCategory={item.subCategory}
              imageUrl={item.images?.[0]}
              condition={item.condition || 'Excellent'}
              onAddToCart={() => onAddToCart(item)}
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════════════════════

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { garments, isLoading, fetchFeed } = useGarmentStore();

  useEffect(() => {
    fetchFeed({ listingType: 'SALE' });
  }, []);

  const handleAddToCart = useCallback(async (item: any) => {
    try {
      await cartService.addToCart(item.id);
      Alert.alert('✓ Added', `${item.title} has been added to your cart.`);
    } catch (error) {
      Alert.alert('Error', 'Could not add to cart. Please try again.');
    }
  }, []);

  const navigate = useCallback((route: string, params?: any) => {
    router.push({ pathname: route as any, params } as any);
  }, []);
  const navigateToItem = useCallback((id: string) => {
    router.push(`/(tabs)/shop/${id}` as any);
  }, []);

  return (
    <View style={styles.container}>
      <Header showLogo />

      {/* System Ticker */}
      <View style={styles.ticker}>
        <View style={styles.tickerDot} />
        <Text style={styles.tickerText} numberOfLines={1}>
          {user?.displayName ? `AGENT ${user.displayName.toUpperCase()} LOGGED IN` : 'SECURE CONNECTION'} · {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()} · CIRCULAR FASHION MARKETPLACE
        </Text>
        <View style={styles.tickerDot} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      >
        {/* HERO */}
        <HeroBanner onShop={() => navigate('/(tabs)/shop')} />

        {/* IMPACT DASHBOARD */}
        <ImpactDashboard />

        {/* QUICK ACTIONS */}
        <QuickActionGrid onNavigate={(r) => navigate(r)} />

        {/* CATEGORY SECTORS */}
        <CategorySectors onNavigate={(r, p) => navigate(r, p)} />

        {/* NEW ARRIVALS */}
        <NewArrivals 
          garments={garments}
          isLoading={isLoading}
          onNavigateToItem={navigateToItem}
          onAddToCart={handleAddToCart}
          onNavigate={navigate}
        />

        {/* Bottom spacer */}
        <View style={{ height: 120 }} />
      </ScrollView>


    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.cream,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // ── Ticker ─────────────────────────────────────────────────────
  ticker: { 
    backgroundColor: colors.charcoal, 
    paddingVertical: 10, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderBottomWidth: 2, 
    borderBottomColor: colors.red,
    paddingHorizontal: 16,
  },
  tickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.red,
  },
  tickerText: { 
    color: colors.red, 
    fontFamily: typography.mono, 
    fontSize: 9, 
    fontWeight: '800', 
    letterSpacing: 1.5,
    flex: 1,
  },

  // ── Hero ───────────────────────────────────────────────────────
  hero: {
    marginHorizontal: 16,
    marginTop: 16,
    height: 300,
    borderWidth: 2,
    borderColor: colors.charcoal,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  heroCornerTL: {
    position: 'absolute', top: 8, left: 8,
    width: 16, height: 16,
    borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 10,
  },
  heroCornerTR: {
    position: 'absolute', top: 8, right: 8,
    width: 16, height: 16,
    borderTopWidth: 2, borderRightWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 10,
  },
  heroCornerBL: {
    position: 'absolute', bottom: 8, left: 8,
    width: 16, height: 16,
    borderBottomWidth: 2, borderLeftWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 10,
  },
  heroCornerBR: {
    position: 'absolute', bottom: 42, right: 8,
    width: 16, height: 16,
    borderBottomWidth: 2, borderRightWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 10,
  },
  heroContent: {
    padding: 24,
    justifyContent: 'flex-end',
    flex: 1,
    zIndex: 5,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  heroBadge: {
    backgroundColor: colors.red,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroBadgeSecondary: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroBadgeSecondaryText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    color: colors.white,
    fontFamily: typography.headings,
    fontSize: 38,
    lineHeight: 42,
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
  },
  heroMeta: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.red,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroCta: {
    backgroundColor: colors.white,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
  },
  heroCtaText: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  heroBottom: {
    height: 32,
    backgroundColor: colors.charcoal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  heroBottomText: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroBottomDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // ── Impact Dashboard ───────────────────────────────────────────
  impactSection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  impactLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  impactTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 2,
    flex: 1,
  },
  impactBadge: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  impactBadgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  impactScroll: {
    gap: 12,
    paddingRight: 16,
  },
  statCard: {
    width: 130,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 14,
    gap: 6,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontFamily: typography.headings,
    fontSize: 26,
    color: colors.charcoal,
    letterSpacing: 1,
  },
  statUnit: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statLabel: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.charcoal,
    fontWeight: '800',
    letterSpacing: 0.5,
    opacity: 0.6,
  },

  // ── Quick Actions ──────────────────────────────────────────────
  quickActionGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 20,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  quickActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  quickActionLabel: {
    fontFamily: typography.mono,
    color: colors.charcoal,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  quickActionDesc: {
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // ── Sections ───────────────────────────────────────────────────
  section: { 
    marginTop: 28,
  },
  sectionHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    marginBottom: 18, 
    gap: 12,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.charcoal,
    opacity: 0.15,
  },
  sectionTitle: { 
    color: colors.charcoal, 
    fontSize: 24, 
    lineHeight: 28,
    fontFamily: typography.headings, 
    letterSpacing: 2, 
  },
  sectionCount: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionCountText: {
    color: colors.white,
    fontSize: 10,
    fontFamily: typography.mono,
    fontWeight: '800',
  },
  sectionSeeAll: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.red,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // ── Category Cards ─────────────────────────────────────────────
  categoryScroll: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 12,
  },
  categoryCard: {
    width: 145,
    height: 175,
    backgroundColor: colors.charcoal,
    borderWidth: 2,
    borderColor: colors.charcoal,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  categoryScanArea: {
    position: 'absolute',
    top: '25%',
    left: 0,
    right: 0,
    height: 20,
    overflow: 'hidden',
    zIndex: 5,
  },
  categoryScanLine: {
    width: '60%',
    height: 2,
    backgroundColor: colors.red,
    opacity: 0.7,
    shadowColor: colors.red,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  categoryContent: {
    padding: 14,
    zIndex: 10,
  },
  categoryBadge: {
    backgroundColor: 'rgba(168,34,34,0.85)',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  categoryBadgeText: {
    fontFamily: typography.mono,
    color: colors.white,
    fontSize: 8,
    fontWeight: '900',
  },
  categoryName: {
    fontFamily: typography.headings,
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 2,
  },
  categoryCount: {
    fontFamily: typography.mono,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  categoryAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.red,
    zIndex: 10,
  },

  // ── New Arrivals ───────────────────────────────────────────────
  arrivalsScroll: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 0,
    paddingBottom: 8,
  },
  cardWrapper: { 
    width: CARD_W, 
    marginRight: 14,
  },
});


