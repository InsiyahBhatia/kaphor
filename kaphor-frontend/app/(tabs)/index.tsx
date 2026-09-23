import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useGarmentStore } from '../../src/store/garmentStore';
import { useAuthStore } from '../../src/store/authStore';
import { cartService } from '../../src/services/cartService';
import {
  recommendationService,
  RecommendedGarment,
  FairSwapRecommendation,
} from '../../src/services/recommendationService';
import { KaphorImage } from '../../src/components/KaphorImage';
import { EditorialGarmentCard } from '../../src/components/EditorialGarmentCard';
import { DossierLoading } from '../../src/components/common/DossierLoading';
import { GarmentShelfSkeleton } from '../../src/components/common/CardLoadingScreen';
import { Header } from '../../src/components/common/Header';
import api from '../../src/services/api';
import { colors, typography, spacing, radius } from '../../src/theme';
import { hapticFeedback } from '../../src/utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(220, SCREEN_WIDTH * 0.58);

// ── Categories / Sectors ───────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'ALL', label: 'ALL ARCHIVE' },
  { id: 'WOMEN', label: 'WOMENSWEAR', category: 'Womenswear' },
  { id: 'MEN', label: 'MENSWEAR', category: 'Menswear' },
  { id: 'ETHNIC', label: 'ETHNIC & BRIDAL', category: 'Ethnic' },
  { id: 'RENTAL', label: 'OCCASION LEASES', route: '/(tabs)/rental' },
  { id: 'SWAP', label: 'BARTER DECK', route: '/(tabs)/swap' },
  { id: 'ACCESSORIES', label: 'ACCESSORIES', category: 'Accessories' },
];

// ── Quick Atelier Pillars ──────────────────────────────────────────────────
const QUICK_PILLARS = [
  {
    label: 'BUY & SELL',
    sub: 'Pre-owned luxury',
    icon: 'pricetag-sharp' as const,
    route: '/(tabs)/shop',
    accent: colors.red,
  },
  {
    label: 'OCCASION LEASE',
    sub: 'From ₹500/day',
    icon: 'calendar-sharp' as const,
    route: '/(tabs)/rental',
    accent: colors.copper,
  },
  {
    label: 'FAIR SWAPS',
    sub: 'Zero-cash trades',
    icon: 'swap-horizontal-sharp' as const,
    route: '/(tabs)/swap',
    accent: colors.forest,
  },
  {
    label: 'DIGITAL ATELIER',
    sub: 'AI scan & repair',
    icon: 'construct-sharp' as const,
    route: '/(tabs)/studio/repair-refresh',
    accent: colors.navy,
  },
];

// ── Price Formatter Helper ─────────────────────────────────────────────────
function formatCurrency(amount?: number | null): string {
  if (!amount || amount <= 0) return '0';
  return amount.toLocaleString('en-IN');
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. Brand Status Bar ────────────────────────────────────────────────────
function BrandStatusBar() {
  return (
    <View style={styles.statusBar}>
      <View style={styles.statusDot} />
      <Text style={styles.statusText} numberOfLines={1}>
        AUTHENTICATED LUXURY ARCHIVE · 100% CIRCULAR VERIFIED · BUY, LEASE & BARTER
      </Text>
      <View style={styles.statusDot} />
    </View>
  );
}

// ── 2. Editorial Hero Showcase ─────────────────────────────────────────────
function HeroShowcase({
  onExplore,
  onRentals,
}: {
  onExplore: () => void;
  onRentals: () => void;
}) {
  return (
    <View style={styles.heroContainer}>
      <Image
        source={{
          uri: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=1600&auto=format&fit=crop',
        }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <View style={styles.heroGradientOverlay} />

      <View style={styles.heroContent}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>EDITORIAL ARCHIVE · SS26</Text>
        </View>

        <Text style={styles.heroHeadline}>
          CIRCULAR{'\n'}MARKETPLACE
        </Text>

        <Text style={styles.heroTagline}>
          Curated pre-loved designer archives, occasion leases and fine barter with zero retail waste.
        </Text>

        <View style={styles.heroActionRow}>
          <TouchableOpacity
            style={styles.heroPrimaryBtn}
            onPress={onExplore}
            activeOpacity={0.88}
          >
            <Text style={styles.heroPrimaryBtnText}>EXPLORE ARCHIVE</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.heroSecondaryBtn}
            onPress={onRentals}
            activeOpacity={0.88}
          >
            <Text style={styles.heroSecondaryBtnText}>OCCASION LEASES</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroTrustRow}>
          <View style={styles.heroTrustItem}>
            <Ionicons name="shield-checkmark-outline" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.heroTrustText}>VERIFIED CONDITION</Text>
          </View>
          <View style={styles.heroTrustItem}>
            <Ionicons name="lock-closed-outline" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.heroTrustText}>ESCROW PROTECTION</Text>
          </View>
          <View style={styles.heroTrustItem}>
            <Ionicons name="repeat-outline" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.heroTrustText}>CASHLESS SWAP</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── 3. Quick Atelier Pillars ───────────────────────────────────────────────
function QuickAtelierGrid({ onNavigate }: { onNavigate: (route: string) => void }) {
  return (
    <View style={styles.quickActionGrid}>
      {QUICK_PILLARS.map((pillar, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [
            styles.quickActionCard,
            { borderColor: pillar.accent + '40' },
            pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
          ]}
          onPress={() => {
            hapticFeedback.light();
            onNavigate(pillar.route);
          }}
        >
          <View style={[styles.quickActionIconWrap, { backgroundColor: pillar.accent + '14' }]}>
            <Ionicons name={pillar.icon} size={22} color={pillar.accent} />
          </View>
          <Text style={styles.quickActionLabel} numberOfLines={2}>{pillar.label}</Text>
          <Text style={styles.quickActionDesc} numberOfLines={1}>{pillar.sub}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── 4. Section Header ──────────────────────────────────────────────────────
function SectionHeader({
  title,
  tag,
  tagBg = colors.charcoal,
  tagColor = colors.gold,
  onSeeAll,
}: {
  title: string;
  tag?: string;
  tagBg?: string;
  tagColor?: string;
  onSeeAll?: () => void;
}) {
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
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.seeAllText}>VIEW ALL →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── 5. Editorial Garment Card imported from src/components/EditorialGarmentCard ─────

// ── 6. Occasion Rental Card (Accurate Daily Rate) ───────────────────────────
function OccasionRentalCard({
  item,
  onPress,
}: {
  item: RecommendedGarment;
  onPress: () => void;
}) {
  const [isLiked, setIsLiked] = useState<boolean>(Boolean((item as any).isLiked));
  const assetValue = (item as any).originalPrice && Number((item as any).originalPrice) > 0
    ? Math.round(Number((item as any).originalPrice))
    : (item.price ? Math.round(item.price) : 0);
  const dailyRate = item.rentalPriceDay && item.rentalPriceDay > 0
    ? Math.round(item.rentalPriceDay)
    : assetValue > 0
    ? Math.round(assetValue * 0.04)
    : 160;

  const handleToggleLike = async (e: any) => {
    e.stopPropagation();
    hapticFeedback.selection();
    const nextState = !isLiked;
    setIsLiked(nextState);

    try {
      await api.post('/interactions', {
        garmentId: item.id,
        eventType: 'WISHLIST',
      });
    } catch (err) {
      setIsLiked(!nextState);
    }
  };

  return (
    <TouchableOpacity
      style={styles.rentalCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.rentalImageWrap}>
        <KaphorImage
          uri={item.images?.[0]}
          brand={item.brand}
          category={item.category}
          style={styles.garmentImage}
          contentFit="cover"
        />

        <TouchableOpacity
          style={styles.wishlistBtn}
          onPress={handleToggleLike}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={18}
            color={isLiked ? colors.crimson : colors.charcoal}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.rentalInfo}>
        <View style={styles.garmentMetaRow}>
          <Text style={styles.garmentBrand} numberOfLines={1}>
            {(item.brand || 'DESIGNER COUTURE').toUpperCase()}
          </Text>
          <Text style={styles.garmentSize}>SIZE {item.size || 'M'}</Text>
        </View>

        <Text style={styles.garmentTitle} numberOfLines={1}>
          {item.title}
        </Text>

        <View style={styles.rentalPricingBlock}>
          <View style={styles.rentalRateRow}>
            <Text style={styles.rentalDayRate}>₹{formatCurrency(dailyRate)}</Text>
            <Text style={styles.rentalPerDayUnit}>/ DAY</Text>
          </View>
          <Text style={styles.rentalRetailVal}>
            Retail Val: ₹{formatCurrency(assetValue)}
          </Text>
        </View>

        <View style={styles.rentalReserveCta}>
          <Text style={styles.rentalReserveText}>REQUEST RENTAL • CHECK DATES</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.charcoal} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── 7. Fair Swap Barter Card (Accurate Valuation Parity) ─────────────────────
function FairSwapCard({
  item,
  onPress,
}: {
  item: FairSwapRecommendation;
  onPress: () => void;
}) {
  const swapItem = item.recommendedSwap;
  const [isLiked, setIsLiked] = useState<boolean>(Boolean((swapItem as any).isLiked));
  const valuation = swapItem.price ? Math.round(swapItem.price) : 0;

  const handleToggleLike = async (e: any) => {
    e.stopPropagation();
    hapticFeedback.selection();
    const nextState = !isLiked;
    setIsLiked(nextState);

    try {
      await api.post('/interactions', {
        garmentId: swapItem.id,
        eventType: 'WISHLIST',
      });
    } catch (err) {
      setIsLiked(!nextState);
    }
  };

  return (
    <TouchableOpacity
      style={styles.swapCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.swapImageWrap}>
        <KaphorImage
          uri={swapItem.images?.[0]}
          brand={swapItem.brand}
          category={swapItem.category}
          style={styles.garmentImage}
          contentFit="cover"
        />

        <TouchableOpacity
          style={styles.wishlistBtn}
          onPress={handleToggleLike}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={18}
            color={isLiked ? colors.crimson : colors.charcoal}
          />
        </TouchableOpacity>

        <View style={styles.swapParityPill}>
          <Ionicons name="swap-horizontal" size={11} color={colors.white} />
          <Text style={styles.swapParityText}>
            {item.isFairSwap ? 'EQUAL VALUE TRADE' : `±${item.variancePercent}% PARITY`}
          </Text>
        </View>
      </View>

      <View style={styles.swapInfo}>
        <View style={styles.garmentMetaRow}>
          <Text style={styles.garmentBrand} numberOfLines={1}>
            {(swapItem.brand || 'ARCHIVE TRADE').toUpperCase()}
          </Text>
          <View style={styles.zeroCashBadge}>
            <Text style={styles.zeroCashBadgeText}>CASHLESS</Text>
          </View>
        </View>

        <Text style={styles.garmentTitle} numberOfLines={1}>
          {swapItem.title}
        </Text>

        <View style={styles.swapValuationRow}>
          <View>
            <Text style={styles.swapValuationLabel}>EST. TRADE VALUE</Text>
            <Text style={styles.swapValuationValue}>₹{formatCurrency(valuation)}</Text>
          </View>
          <View style={styles.swapTradeAction}>
            <Text style={styles.swapTradeActionText}>PROPOSE SWAP →</Text>
          </View>
        </View>

        {item.myGarment && (
          <View style={styles.swapCounterpartBox}>
            <Text style={styles.swapCounterpartText} numberOfLines={1}>
              Matched against your "{item.myGarment.title}"
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HOMESCREEN
// ══════════════════════════════════════════════════════════════════════════════

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { garments, isLoading, fetchFeed } = useGarmentStore();

  const [forYouItems, setForYouItems] = useState<RecommendedGarment[]>([]);
  const [rentalPicks, setRentalPicks] = useState<RecommendedGarment[]>([]);
  const [fairSwaps, setFairSwaps] = useState<FairSwapRecommendation[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [forYouLoading, setForYouLoading] = useState<boolean>(true);
  const [rentalsLoading, setRentalsLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    try {
      setForYouLoading(true);
      setRentalsLoading(true);
      fetchFeed({ listingType: 'SALE' });
      let [forYou, rentals, swaps] = await Promise.all([
        recommendationService.getPersonalizedFeed(8),
        recommendationService.getRentalPicks(8),
        recommendationService.getFairSwaps(8),
      ]);

      // Cold-start fallback for Curated For You:
      // If personalized feed is empty (new user / no history), gracefully serve top curated editorial pieces
      if (!forYou || forYou.length === 0) {
        try {
          const res = await api.get('/garments?limit=10');
          const fallbackCandidates = (res.data?.data || res.data?.garments || res.data || [])
            .filter((g: any) => g.isActive !== false)
            .map((g: any) => ({
              ...g,
              seller: g.seller || { id: g.sellerId, username: 'Curator' },
            }));
          if (fallbackCandidates.length > 0) {
            forYou = fallbackCandidates;
          }
        } catch (err) {
          console.warn('Fallback for-you fetch error', err);
        }
      }

      // Robust fallback: If recommendation service returned 0 rentals, fetch directly from garments
      if (!rentals || rentals.length === 0) {
        try {
          const res = await api.get('/garments?listingType=RENTAL&limit=10');
          const fallbackRentals = (res.data?.data || res.data?.garments || res.data || [])
            .filter((g: any) => g.listingType === 'RENTAL');
          if (fallbackRentals.length > 0) {
            rentals = fallbackRentals;
          }
        } catch (err) {
          console.warn('Fallback rental fetch error', err);
        }
      }

      setForYouItems(forYou || []);
      setRentalPicks(rentals || []);
      setFairSwaps(swaps || []);
    } catch (e) {
      console.warn('Failed to load homepage feeds', e);
    } finally {
      setForYouLoading(false);
      setRentalsLoading(false);
    }
  }, [fetchFeed]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);

  const handleAddToCart = useCallback(async (item: any) => {
    try {
      await cartService.addToCart(item.id);
      Alert.alert('✓ Added to Bag', `"${item.title}" added to your shopping bag.`);
    } catch (error: any) {
      if (error?.response?.status === 409 || error?.response?.data?.error === 'ALREADY_IN_CART') {
        Alert.alert('Already in Bag', 'This unique circular piece is already in your shopping bag.');
      } else {
        Alert.alert('Notice', error?.response?.data?.message || 'Item could not be added. Please try again.');
      }
    }
  }, []);

  const navigateToItem = useCallback((id: string) => {
    router.push(`/(tabs)/shop/${id}` as any);
  }, [router]);

  const navigateToSwap = useCallback((id: string) => {
    router.push(`/(tabs)/swap/${id}` as any);
  }, [router]);

  const navigateToRoute = useCallback((route: string, params?: any) => {
    router.push({ pathname: route as any, params } as any);
  }, [router]);

  // Filter sale garments for New Arrivals shelf (excluding current user's own items)
  const currentUserId = useAuthStore((s) => s.user?.id);
  const newArrivals = garments
    .filter(
      (g) =>
        g.listingType === 'SALE' &&
        g.isActive !== false &&
        !['OWNERSHIP', 'RESERVED_SALE', 'PURCHASE_INTENT'].includes((g as any).lifecycleState || '') &&
        !(g as any).reservedOrderId &&
        g.sellerId !== currentUserId &&
        (g as any).seller?.id !== currentUserId
    )
    .slice(0, 10);

  const accessoriesList = garments
    .filter(
      (g) =>
        (g.category?.toLowerCase().includes('accessor') ||
          (g as any).subCategory?.toLowerCase().includes('accessor') ||
          g.listingType === 'ACCESSORY_SWAP' ||
          ['jewel', 'watch', 'bag', 'belt', 'sunglass', 'hat', 'scarf', 'clutch'].some((keyword) =>
            (g.title + ' ' + (g.category || '') + ' ' + (g.subCategory || '')).toLowerCase().includes(keyword)
          )) &&
        g.isActive !== false &&
        g.sellerId !== currentUserId &&
        (g as any).seller?.id !== currentUserId
    )
    .slice(0, 10);

  return (
    <View style={styles.container}>
      <Header showLogo />
      <BrandStatusBar />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.charcoal}
            colors={[colors.charcoal, colors.crimson]}
          />
        }
      >
        {/* HERO SHOWCASE */}
        <HeroShowcase
          onExplore={() => navigateToRoute('/(tabs)/shop')}
          onRentals={() => navigateToRoute('/(tabs)/rental')}
        />

        {/* CATEGORY PILL NAVIGATION */}
        <View style={styles.categoryStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                  onPress={() => {
                    hapticFeedback.light();
                    setActiveCategory(cat.id);
                    if (cat.route) {
                      navigateToRoute(cat.route);
                    } else if (cat.category) {
                      navigateToRoute('/(tabs)/shop', { category: cat.category });
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* QUICK ATELIER PILLARS */}
        <QuickAtelierGrid onNavigate={(route) => navigateToRoute(route)} />

        {/* 1. CURATED FOR YOU (AI EDIT - COLD-START RESILIENT) */}
        <View style={styles.sectionContainer}>
          <SectionHeader
            title="CURATED FOR YOU"
            tag="AI EDIT"
            tagBg={colors.charcoal}
            tagColor={colors.gold}
            onSeeAll={() => navigateToRoute('/(tabs)/shop')}
          />
          <Text style={styles.sectionSubtitle}>
            Personalized architectural & circular archive · Learns & refines as you explore.
          </Text>
          {forYouLoading && forYouItems.length === 0 ? (
            <GarmentShelfSkeleton count={3} cardWidth={CARD_WIDTH} />
          ) : forYouItems.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfScroll}>
              {forYouItems.map((item) => (
                <EditorialGarmentCard
                  key={item.id}
                  item={item}
                  onPress={() => navigateToItem(item.id)}
                  onAddToCart={() => handleAddToCart(item)}
                />
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity
              style={styles.emptyPromptBox}
              onPress={() => navigateToRoute('/(tabs)/shop')}
              activeOpacity={0.85}
            >
              <Ionicons name="sparkles-outline" size={24} color={colors.gold} />
              <Text style={styles.emptyPromptTitle}>DISCOVER YOUR STYLE DOSSIER</Text>
              <Text style={styles.emptyPromptDesc}>
                Browse the catalog to train your AI stylist and unlock bespoke recommendations.
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 2. OCCASION LEASES & RENTALS (GUARANTEED PRESENT) */}
        <View style={styles.sectionContainer}>
          <SectionHeader
            title="OCCASION LEASES & RENTALS"
            tag="PER DAY"
            tagBg={colors.copper}
            tagColor={colors.white}
            onSeeAll={() => navigateToRoute('/(tabs)/rental')}
          />
          <Text style={styles.sectionSubtitle}>
            Designer eveningwear, bridal & couture available for 3, 7 or 14-day leases with zero retail waste.
          </Text>
          {rentalsLoading && rentalPicks.length === 0 ? (
            <GarmentShelfSkeleton count={3} cardWidth={CARD_WIDTH} />
          ) : rentalPicks.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfScroll}>
              {rentalPicks.map((item) => (
                <OccasionRentalCard
                  key={item.id}
                  item={item}
                  onPress={() => router.push(`/(tabs)/rental/${item.id}` as any)}
                />
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity
              style={styles.emptyPromptBox}
              onPress={() => navigateToRoute('/(tabs)/rental')}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={24} color={colors.copper} />
              <Text style={styles.emptyPromptTitle}>BROWSE OCCASION LEASE VAULT</Text>
              <Text style={styles.emptyPromptDesc}>
                Explore sarees, lehengas, and couture eveningwear available for short-term booking.
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 3. FAIR ACCESSORY SWAPS (BARTER WITH PARITY PRICING) */}
        {fairSwaps.length > 0 && (
          <View style={styles.sectionContainer}>
            <SectionHeader
              title="FAIR ACCESSORY SWAPS"
              tag="VALUATION PARITY"
              tagBg={colors.forest}
              tagColor={colors.white}
              onSeeAll={() => navigateToRoute('/(tabs)/swap')}
            />
            <Text style={styles.sectionSubtitle}>
              Cashless 1-to-1 luxury trades with AI valuation matching. Zero monetary exchange.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfScroll}>
              {fairSwaps.map((swap, idx) => (
                <FairSwapCard
                  key={swap.recommendedSwap.id || idx}
                  item={swap}
                  onPress={() => navigateToSwap(swap.recommendedSwap.id)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* 4. ACCESSORIES ARCHIVE */}
        {accessoriesList.length > 0 && (
          <View style={styles.sectionContainer}>
            <SectionHeader
              title="ACCESSORIES ARCHIVE"
              tag="LUXURY HARDWARE"
              tagBg={colors.navy}
              tagColor={colors.white}
              onSeeAll={() => navigateToRoute('/(tabs)/shop', { category: 'Accessories' })}
            />
            <Text style={styles.sectionSubtitle}>
              Fine jewelry, watches, designer handbags, and leather goods ready for instant purchase or barter.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfScroll}>
              {accessoriesList.map((item) => (
                <EditorialGarmentCard
                  key={item.id}
                  item={{
                    ...item,
                    price: item.price ? Math.round(item.price) : 0,
                    condition: item.condition || 'Pristine',
                  }}
                  onPress={() => navigateToItem(item.id)}
                  onAddToCart={() => handleAddToCart(item)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* 5. NEW ARRIVALS (DIRECT SALE WITH ACTUAL PRICING) */}
        <View style={styles.sectionContainer}>
          <SectionHeader
            title="NEW ARRIVALS"
            tag="AUTHENTICATED"
            tagBg={colors.charcoal}
            tagColor={colors.white}
            onSeeAll={() => navigateToRoute('/(tabs)/shop')}
          />
          {isLoading && newArrivals.length === 0 ? (
            <GarmentShelfSkeleton count={3} cardWidth={CARD_WIDTH} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfScroll}>
              {newArrivals.map((item) => (
                <EditorialGarmentCard
                  key={item.id}
                  item={{
                    ...item,
                    price: item.price ? Math.round(item.price) : 0,
                    condition: item.condition || 'Excellent',
                    fitScore: 0,
                    matchReason: 'Fresh Arrival',
                    seller: (item as any).seller || { id: item.sellerId, username: 'Curator' },
                  } as RecommendedGarment}
                  onPress={() => navigateToItem(item.id)}
                  onAddToCart={() => handleAddToCart(item)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* BOTTOM SPACING */}
        <View style={{ height: 100 }} />
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
    paddingBottom: 32,
  },

  // ── Status Bar ──────────────────────────────────────────────────
  statusBar: {
    backgroundColor: colors.charcoal,
    paddingVertical: 7,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.gold,
  },
  statusText: {
    color: 'rgba(255,255,255,0.92)',
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  // ── Hero ────────────────────────────────────────────────────────
  heroContainer: {
    marginHorizontal: 16,
    marginTop: 14,
    minHeight: 330,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.12)',
  },
  heroGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 19, 23, 0.48)',
  },
  heroContent: {
    padding: 22,
    justifyContent: 'flex-end',
    flex: 1,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroHeadline: {
    fontFamily: typography.headings,
    fontSize: 39.5,
    lineHeight: 36,
    color: colors.white,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  heroTagline: {
    fontFamily: typography.body,
    fontSize: 15.5,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 20,
    maxWidth: '92%',
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
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
  heroPrimaryBtnText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroSecondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  heroSecondaryBtnText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  heroTrustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroTrustText: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // ── Categories ──────────────────────────────────────────────────
  categoryStrip: {
    marginTop: 18,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.1)',
  },
  categoryPillActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  categoryPillText: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  categoryPillTextActive: {
    color: colors.white,
  },

  // ── Quick Action Pillars (Classic Kaphor Brutalist 4-column Grid) ───────
  quickActionGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 20,
  },
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
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
    lineHeight: 11,
  },
  quickActionDesc: {
    fontFamily: typography.mono,
    color: colors.textMuted,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: 1,
  },

  // ── Section ─────────────────────────────────────────────────────
  sectionContainer: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: typography.headings,
    fontSize: 24.5,
    letterSpacing: 0.8,
    color: colors.charcoal,
  },
  sectionSubtitle: {
    fontFamily: typography.body,
    fontSize: 14.5,
    color: colors.textMuted,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  sectionTagText: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  seeAllText: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.crimson,
    letterSpacing: 0.5,
  },
  shelfScroll: {
    paddingHorizontal: 16,
    gap: 14,
    paddingVertical: 6,
  },

  // ── Garment Card (Editorial) ────────────────────────────────────
  garmentCard: {
    width: CARD_WIDTH,
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
  garmentImageWrap: {
    width: '100%',
    height: CARD_WIDTH * 1.25,
    backgroundColor: '#F3EFE9',
    position: 'relative',
  },
  garmentImage: {
    width: '100%',
    height: '100%',
  },
  matchPill: {
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
  matchPillText: {
    color: colors.gold,
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '800',
  },
  conditionPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 3,
  },
  conditionPillText: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  garmentInfo: {
    padding: 12,
  },
  garmentMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  garmentBrand: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.6,
    flex: 1,
  },
  garmentSize: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  garmentTitle: {
    fontFamily: typography.body,
    fontSize: 16.5,
    fontWeight: '600',
    color: colors.charcoal,
    marginBottom: 8,
  },
  garmentPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  priceWithDiscountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  garmentPrice: {
    fontFamily: typography.mono,
    fontSize: 18.5,
    fontWeight: '800',
    color: colors.charcoal,
  },
  discountBadge: {
    backgroundColor: 'rgba(168, 34, 34, 0.12)',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  discountBadgeText: {
    color: colors.crimson,
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '800',
  },
  garmentOriginalPrice: {
    fontFamily: typography.mono,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  quickAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Rental Card ─────────────────────────────────────────────────
  rentalCard: {
    width: CARD_WIDTH,
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
  rentalImageWrap: {
    width: '100%',
    height: CARD_WIDTH * 1.25,
    backgroundColor: '#F3EFE9',
    position: 'relative',
  },
  rentalBadgePill: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.copper,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
  },
  rentalBadgePillText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rentalInfo: {
    padding: 12,
  },
  rentalPricingBlock: {
    backgroundColor: '#FAF6F0',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  rentalRateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  rentalDayRate: {
    fontFamily: typography.mono,
    fontSize: 19.5,
    fontWeight: '900',
    color: colors.copper,
  },
  rentalPerDayUnit: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  rentalRetailVal: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  rentalReserveCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.12)',
    paddingVertical: 7,
    borderRadius: 3,
  },
  rentalReserveText: {
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.6,
  },

  // ── Swap Card ───────────────────────────────────────────────────
  swapCard: {
    width: CARD_WIDTH,
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
  swapImageWrap: {
    width: '100%',
    height: CARD_WIDTH * 1.25,
    backgroundColor: '#F3EFE9',
    position: 'relative',
  },
  swapParityPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.forest,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
  },
  swapParityText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  swapInfo: {
    padding: 12,
  },
  zeroCashBadge: {
    backgroundColor: 'rgba(30, 59, 47, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  zeroCashBadgeText: {
    color: colors.forest,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
  },
  swapValuationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#F2F7F4',
    padding: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  swapValuationLabel: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.forest,
    letterSpacing: 0.5,
  },
  swapValuationValue: {
    fontFamily: typography.mono,
    fontSize: 18,
    fontWeight: '900',
    color: colors.charcoal,
  },
  swapTradeAction: {
    backgroundColor: colors.forest,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
  },
  swapTradeActionText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
  },
  swapCounterpartBox: {
    paddingTop: 4,
  },
  swapCounterpartText: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },

  // ── Empty Prompt Box ─────────────────────────────────────────────
  emptyPromptBox: {
    marginHorizontal: 16,
    padding: 24,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: 'rgba(30,31,34,0.12)',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyPromptTitle: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  emptyPromptDesc: {
    fontFamily: typography.body,
    fontSize: 15.5,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
