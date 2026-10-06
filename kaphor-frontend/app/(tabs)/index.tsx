import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Pressable,
  RefreshControl,
  FlatList,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useGarmentStore, prefetchDetailImages, seedGarments } from '../../src/store/garmentStore';
import { useAuthStore } from '../../src/store/authStore';
import { orderService } from '../../src/services/orderService';
import {
  recommendationService,
  RecommendedGarment,
  FairSwapRecommendation,
} from '../../src/services/recommendationService';
import { KaphorImage } from '../../src/components/KaphorImage';
import { EditorialGarmentCard } from '../../src/components/EditorialGarmentCard';
import { EditorialIcon, HandwrittenNote } from '../../src/components/editorial/IllustrationLayer';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GarmentShelfSkeleton } from '../../src/components/common/CardLoadingScreen';
import { Header } from '../../src/components/common/Header';
import api from '../../src/services/api';
import { colors, typography, spacing, radius } from '../../src/theme';
import { hapticFeedback } from '../../src/utils/haptics';
import { getErrorMessage } from '../../src/utils/errors';

const HOME_CACHE_KEY = '@kaphor_home_shelves_v1';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(220, SCREEN_WIDTH * 0.58);

// ── Categories / Sectors ───────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'ALL', label: 'ALL' },
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
    sub: 'Pre-owned clothes',
    icon: 'pricetag-sharp' as const,
    assetIcon: 'bag' as const,
    route: '/(tabs)/shop',
    accent: colors.rose,
  },
  {
    label: 'RENTALS',
    sub: 'From ₹500/day',
    icon: 'calendar-sharp' as const,
    assetIcon: 'dress' as const,
    route: '/(tabs)/rental',
    accent: colors.gold,
  },
  {
    label: 'SWAP',
    sub: 'Zero-cash trades',
    icon: 'swap-horizontal-sharp' as const,
    assetIcon: 'swap' as const,
    route: '/(tabs)/swap',
    accent: colors.forest,
  },
  {
    label: 'STUDIO',
    sub: 'AI scan & repair',
    icon: 'construct-sharp' as const,
    assetIcon: 'sewing' as const,
    route: '/(tabs)/studio/repair-refresh',
    accent: colors.ink,
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
        BUY, RENT OR SWAP · CHECKED & VERIFIED
      </Text>
      <View style={styles.statusDot} />
    </View>
  );
}

// ── 2. Editorial Hero Showcase ─────────────────────────────────────────────
const HeroShowcase = React.memo(function HeroShowcase({
  onExplore,
  onRentals,
}: {
  onExplore: () => void;
  onRentals: () => void;
}) {
  return (
    <View style={styles.heroContainer}>
      <ExpoImage
        source={require("../../assets/images/opt/muse-white-dress.webp")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="right bottom"
        cachePolicy="memory-disk"
      />
      <LinearGradient
        colors={[colors.paperLight, colors.paperGlass, "transparent"]}
        locations={[0, 0.45, 0.85]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.heroContent}>
        <View style={styles.heroBadge}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.heroBadgeText}>NEW THIS SEASON</Text>
        </View>

        <Text style={styles.heroHeadline}>
          CIRCULAR{'\n'}FASHION{'\n'}LIVES LONGER
        </Text>

        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.heroTagline}>
          Buy, sell, swap and rent pre-loved fashion with zero retail waste.
        </Text>

        <HandwrittenNote style={styles.heroNote} textStyle={{ color: colors.rose }}>
          pre-loved pieces, new beginnings.
        </HandwrittenNote>

        <View style={styles.heroActionRow}>
          <TouchableOpacity
            style={styles.heroPrimaryBtn}
            onPress={onExplore}
            activeOpacity={0.88}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.heroPrimaryBtnText}>EXPLORE SHOP</Text>
            <Text style={styles.inlineArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.heroSecondaryBtn}
            onPress={onRentals}
            activeOpacity={0.88}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.heroSecondaryBtnText}>RENTALS</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroTrustRow}>
          <View style={styles.heroTrustItem}>
            <EditorialIcon name="verified" size={17} tintColor={colors.inkSoft} />
            <Text style={styles.heroTrustText}>VERIFIED CONDITION</Text>
          </View>
          <View style={styles.heroTrustItem}>
            <EditorialIcon name="shield" size={17} tintColor={colors.inkSoft} />
            <Text style={styles.heroTrustText}>SECURE PAYMENT</Text>
          </View>
          <View style={styles.heroTrustItem}>
            <EditorialIcon name="swap" size={17} tintColor={colors.inkSoft} />
            <Text style={styles.heroTrustText}>CASHLESS SWAP</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

// ── 3. Quick Atelier Pillars ───────────────────────────────────────────────
const QuickAtelierGrid = React.memo(function QuickAtelierGrid({ onNavigate }: { onNavigate: (route: string) => void }) {
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
            <EditorialIcon name={pillar.assetIcon} size={28} />
          </View>
          <Text style={styles.quickActionLabel} numberOfLines={2}>{pillar.label}</Text>
          <Text style={styles.quickActionDesc} numberOfLines={1}>{pillar.sub}</Text>
        </Pressable>
      ))}
    </View>
  );
});

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
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sectionTagText, { color: tagColor }]}>{tag}</Text>
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

// ── Horizontal shelf (virtualised) ─────────────────────────────────────────
function Shelf<T>({
  data,
  renderItem,
  keyExtractor,
}: {
  data: T[];
  renderItem: (info: { item: T; index: number }) => React.ReactElement | null;
  keyExtractor: (item: T, index: number) => string;
}) {
  return (
    <FlatList
      horizontal
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.shelfScroll}
      initialNumToRender={4}
      maxToRenderPerBatch={6}
      windowSize={7}
      removeClippedSubviews={Platform.OS === 'android'}
    />
  );
}

const itemKey = (g: { id: string }) => g.id;
const swapKey = (s: FairSwapRecommendation, i: number) => s.recommendedSwap.id || String(i);

// ── 5. Editorial Garment Card imported from src/components/EditorialGarmentCard ─────

// ── 6. Occasion Rental Card (Accurate Daily Rate) ───────────────────────────
const OccasionRentalCard = React.memo(function OccasionRentalCard({
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
          width={CARD_WIDTH}
          recyclingKey={item.id}
        />

        <TouchableOpacity
          style={styles.wishlistBtn}
          onPress={handleToggleLike}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.8}
        >
          <EditorialIcon name={isLiked ? 'heartFilled' : 'heart'} size={18} tintColor={isLiked ? colors.red : colors.ink} />
        </TouchableOpacity>
      </View>

      <View style={styles.rentalInfo}>
        <View style={styles.garmentMetaRow}>
          <Text style={styles.garmentBrand} numberOfLines={1}>
            {(item.brand || 'DESIGNER FASHION').toUpperCase()}
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
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.rentalReserveText}>REQUEST RENTAL • CHECK DATES</Text>
          <Text style={styles.cardArrow}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ── 7. Fair Swap Barter Card (Accurate Valuation Parity) ─────────────────────
const FairSwapCard = React.memo(function FairSwapCard({
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
          width={CARD_WIDTH}
          recyclingKey={swapItem.id}
        />

        <TouchableOpacity
          style={styles.wishlistBtn}
          onPress={handleToggleLike}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.8}
        >
          <EditorialIcon name={isLiked ? 'heartFilled' : 'heart'} size={18} tintColor={isLiked ? colors.red : colors.ink} />
        </TouchableOpacity>

        <View style={styles.swapParityPill}>
          <EditorialIcon name="swap" size={14} />
          <Text style={styles.swapParityText}>
            {item.isFairSwap ? 'EQUAL VALUE TRADE' : `±${item.variancePercent}% PARITY`}
          </Text>
        </View>
      </View>

      <View style={styles.swapInfo}>
        <View style={styles.garmentMetaRow}>
          <Text style={styles.garmentBrand} numberOfLines={1}>
            {(swapItem.brand || 'SWAP').toUpperCase()}
          </Text>
          <View style={styles.zeroCashBadge}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.zeroCashBadgeText}>CASHLESS</Text>
          </View>
        </View>

        <Text style={styles.garmentTitle} numberOfLines={1}>
          {swapItem.title}
        </Text>

        <View style={styles.swapValuationRow}>
          <View>
            <Text numberOfLines={1} style={styles.swapValuationLabel}>EST. TRADE VALUE</Text>
            <Text style={styles.swapValuationValue}>₹{formatCurrency(valuation)}</Text>
          </View>
          <View style={styles.swapTradeAction}>
            <Text numberOfLines={1} style={styles.swapTradeActionText}>PROPOSE SWAP →</Text>
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
});

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HOMESCREEN
// ══════════════════════════════════════════════════════════════════════════════

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const garments = useGarmentStore((s) => s.garments);
  const isLoading = useGarmentStore((s) => s.isLoading);
  const fetchFeed = useGarmentStore((s) => s.fetchFeed);

  const [forYouItems, setForYouItems] = useState<RecommendedGarment[]>([]);
  const [rentalPicks, setRentalPicks] = useState<RecommendedGarment[]>([]);
  const [fairSwaps, setFairSwaps] = useState<FairSwapRecommendation[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [forYouLoading, setForYouLoading] = useState<boolean>(true);
  const [rentalsLoading, setRentalsLoading] = useState<boolean>(true);

  // Cache-first: hydrate shelves from disk so the home page paints instantly
  const hydrated = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(HOME_CACHE_KEY)
      .then((raw) => {
        if (!raw || hydrated.current) return;
        try {
          const c = JSON.parse(raw);
          setForYouItems((cur) => (cur.length ? cur : (c.forYou || []).filter((g: any) => !g.listingType || g.listingType === 'SALE')));
          setRentalPicks((cur) => (cur.length ? cur : c.rentals || []));
          setFairSwaps((cur) => (cur.length ? cur : c.swaps || []));
          if (c.forYou?.length) setForYouLoading(false);
          if (c.rentals?.length) setRentalsLoading(false);
        } catch {}
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    try {
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
          const res = await api.get('/garments?listingType=SALE&limit=10');
          const fallbackCandidates = (res.data?.data || res.data?.garments || res.data || [])
            .filter((g: any) => g.isActive !== false && g.listingType === 'SALE')
            .map((g: any) => ({
              ...g,
              seller: g.seller || { id: g.sellerId, username: 'Member' },
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

      // Safety net: the buy-only shelf must never show swap/rental assets
      // (e.g. server-side cache served before the listingType filter deployed)
      forYou = (forYou || []).filter((g: any) => !g.listingType || g.listingType === 'SALE');

      seedGarments(rentals);
      seedGarments(swaps?.map((x: any) => x.recommendedSwap));
      setForYouItems(forYou || []);
      setRentalPicks(rentals || []);
      setFairSwaps(swaps || []);
      hydrated.current = true;
      AsyncStorage.setItem(
        HOME_CACHE_KEY,
        JSON.stringify({ forYou: (forYou || []).slice(0, 8), rentals: (rentals || []).slice(0, 8), swaps: (swaps || []).slice(0, 8) })
      ).catch(() => {});
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

  const handleBuyRequest = useCallback(async (item: any) => {
    try {
      const order = await orderService.requestPurchase(item.id);
      const orderId = order?.orderId;
      if (!orderId) {
        throw new Error('Could not start the purchase request');
      }
      if (order?.isApproved) {
        router.push({
          pathname: '/(tabs)/shop/checkout/delivery',
          params: { orderId },
        } as any);
      } else {
        Alert.alert(
          'Purchase Request Sent 🛍️',
          'Your purchase request has been submitted to the seller for approval. No payment is taken until the seller approves.',
          [
            {
              text: 'View Order Status',
              onPress: () => router.push(`/(tabs)/shop/orders/${orderId}` as any),
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Notice', getErrorMessage(error, 'Could not submit purchase request. Please try again.'));
    }
  }, [router]);

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
  const newArrivals = useMemo(() => garments
    .filter(
      (g) =>
        g.listingType === 'SALE' &&
        g.isActive !== false &&
        !['OWNERSHIP', 'RESERVED_SALE', 'PURCHASE_INTENT'].includes((g as any).lifecycleState || '') &&
        !(g as any).reservedOrderId &&
        g.sellerId !== currentUserId &&
        (g as any).seller?.id !== currentUserId
    )
    .slice(0, 10), [garments, currentUserId]);

  const accessoriesList = useMemo(() => garments
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
    .slice(0, 10), [garments, currentUserId]);

  const accessoryCards = useMemo(
    () => accessoriesList.map((item) => ({
      ...item,
      price: item.price ? Math.round(item.price) : 0,
      condition: item.condition || 'Pristine',
    })),
    [accessoriesList]
  );
  const newArrivalCards = useMemo(
    () => newArrivals.map((item) => ({
      ...item,
      price: item.price ? Math.round(item.price) : 0,
      condition: item.condition || 'Excellent',
      fitScore: 0,
      matchReason: 'Fresh Arrival',
      seller: (item as any).seller || { id: item.sellerId, username: 'Member' },
    }) as any),
    [newArrivals]
  );

  useEffect(() => {
    prefetchDetailImages(forYouItems, 3);
  }, [forYouItems]);

  const renderSaleItem = useCallback(
    ({ item }: { item: any }) => (
      <EditorialGarmentCard
        item={item}
        onPress={() => navigateToItem(item.id)}
        onBuyRequest={() => handleBuyRequest(item)}
      />
    ),
    [navigateToItem, handleBuyRequest]
  );
  const renderRental = useCallback(
    ({ item }: { item: RecommendedGarment }) => (
      <OccasionRentalCard item={item} onPress={() => router.push(`/(tabs)/rental/${item.id}` as any)} />
    ),
    [router]
  );
  const renderSwap = useCallback(
    ({ item }: { item: FairSwapRecommendation }) => (
      <FairSwapCard item={item} onPress={() => navigateToSwap(item.recommendedSwap.id)} />
    ),
    [navigateToSwap]
  );
  const onExploreShop = useCallback(() => navigateToRoute('/(tabs)/shop'), [navigateToRoute]);
  const onOpenRentals = useCallback(() => navigateToRoute('/(tabs)/rental'), [navigateToRoute]);
  const onPillarNavigate = useCallback((route: string) => navigateToRoute(route), [navigateToRoute]);

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
        <HeroShowcase onExplore={onExploreShop} onRentals={onOpenRentals} />

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
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* QUICK ATELIER PILLARS */}
        <QuickAtelierGrid onNavigate={onPillarNavigate} />

        {/* 1. CURATED FOR YOU (AI EDIT - COLD-START RESILIENT) */}
        <View style={styles.sectionContainer}>
          <SectionHeader
            title="PICKED FOR YOU"
            tag="AI EDIT"
            tagBg={colors.charcoal}
            tagColor={colors.gold}
            onSeeAll={() => navigateToRoute('/(tabs)/shop')}
          />
          <Text style={styles.sectionSubtitle}>
            Picked for you. Gets better as you browse.
          </Text>
          {forYouLoading && forYouItems.length === 0 ? (
            <GarmentShelfSkeleton count={3} cardWidth={CARD_WIDTH} />
          ) : forYouItems.length > 0 ? (
            <Shelf data={forYouItems} renderItem={renderSaleItem} keyExtractor={itemKey} />
          ) : (
            <TouchableOpacity
              style={styles.emptyPromptBox}
              onPress={() => navigateToRoute('/(tabs)/shop')}
              activeOpacity={0.85}
            >
              <EditorialIcon name="sparkle" size={28} />
              <Text style={styles.emptyPromptTitle}>FIND YOUR STYLE</Text>
              <Text style={styles.emptyPromptDesc}>
                Browse items to help the AI stylist learn what you like.
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
            Party and wedding wear to rent for 3, 7 or 14 days.
          </Text>
          {rentalsLoading && rentalPicks.length === 0 ? (
            <GarmentShelfSkeleton count={3} cardWidth={CARD_WIDTH} />
          ) : rentalPicks.length > 0 ? (
            <Shelf data={rentalPicks} renderItem={renderRental} keyExtractor={itemKey} />
          ) : (
            <TouchableOpacity
              style={styles.emptyPromptBox}
              onPress={() => navigateToRoute('/(tabs)/rental')}
              activeOpacity={0.85}
            >
              <EditorialIcon name="dress" size={30} />
              <Text style={styles.emptyPromptTitle}>RENT FOR AN OCCASION</Text>
              <Text style={styles.emptyPromptDesc}>
                Sarees, lehengas and party wear to rent for a few days.
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
              Swap one item for another. No cash needed.
            </Text>
            <Shelf data={fairSwaps} renderItem={renderSwap} keyExtractor={swapKey} />
          </View>
        )}

        {/* 4. ACCESSORIES ARCHIVE */}
        {accessoriesList.length > 0 && (
          <View style={styles.sectionContainer}>
            <SectionHeader
              title="ACCESSORIES"
              tag="JEWELRY & MORE"
              tagBg={colors.navy}
              tagColor={colors.white}
              onSeeAll={() => navigateToRoute('/(tabs)/shop', { category: 'Accessories' })}
            />
            <Text style={styles.sectionSubtitle}>
              Fine jewelry, watches, designer handbags, and leather goods ready for instant purchase or barter.
            </Text>
            <Shelf data={accessoryCards} renderItem={renderSaleItem} keyExtractor={itemKey} />
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
            <Shelf data={newArrivalCards} renderItem={renderSaleItem} keyExtractor={itemKey} />
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
    borderBottomColor: colors.borderLight,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.gold,
  },
  statusText: {
    color: colors.paperGlass,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
  },

  // ── Hero ────────────────────────────────────────────────────────
  heroContainer: {
    marginHorizontal: 16,
    marginTop: 14,
    minHeight: 390,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.paperDark,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  heroGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.goldDark,
  },
  heroContent: {
    padding: 22,
    justifyContent: 'flex-end',
    flex: 1,
    maxWidth: '76%',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.goldLight,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: colors.goldDark,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
  },
  heroHeadline: {
    fontFamily: typography.headings,
    fontSize: 28,
    lineHeight: 34,
    color: colors.ink,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  heroTagline: {
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkSoft,
    marginBottom: 10,
    maxWidth: '92%',
  },
  heroNote: {
    marginBottom: 18,
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
    backgroundColor: colors.crimson,
    borderWidth: 1,
    borderColor: colors.crimson,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radius.sm,
    gap: 8,
  },
  heroPrimaryBtnText: {
    color: colors.cream,
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  inlineArrow: {
    color: colors.cream,
    fontFamily: typography.bodyBold,
    fontSize: 15,
    lineHeight: 16,
  },
  heroSecondaryBtn: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.charcoal,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.sm,
  },
  heroSecondaryBtnText: {
    color: colors.charcoal,
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  heroTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.25)",
  },
  heroTrustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroTrustText: {
    color: colors.inkSoft,
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.8,
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
    borderColor: colors.overlayLight,
  },
  categoryPillActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  categoryPillText: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  categoryPillTextActive: {
    color: colors.white,
    fontFamily: typography.bodyBold,
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
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 6,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
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
    fontFamily: typography.bodyBold,
    color: colors.charcoal,
    fontSize: 11,
    letterSpacing: 0.6,
    textAlign: 'center',
    lineHeight: 12,
  },
  quickActionDesc: {
    fontFamily: typography.body,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.2,
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
    fontSize: 20,
    letterSpacing: 0.8,
    color: colors.charcoal,
  },
  sectionSubtitle: {
    fontFamily: typography.body,
    fontSize: 11,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
  },
  seeAllText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.crimson,
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
    borderColor: colors.overlayLight,
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  garmentImageWrap: {
    width: '100%',
    height: CARD_WIDTH * 1.25,
    backgroundColor: colors.paper,
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
    backgroundColor: colors.overlay,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  matchPillText: {
    color: colors.gold,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
  },
  conditionPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: colors.paperGlass,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 3,
  },
  conditionPillText: {
    color: colors.charcoal,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
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
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
    flex: 1,
  },
  garmentSize: {
    fontFamily: typography.handSemi,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.textMuted,
  },
  garmentTitle: {
    fontFamily: typography.body,
    fontSize: 12,
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
    fontSize: 15,
    fontWeight: '800',
    color: colors.charcoal,
  },
  discountBadge: {
    backgroundColor: colors.crimsonLight,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  discountBadgeText: {
    color: colors.crimson,
    fontFamily: typography.bodyBold,
    includeFontPadding: false,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  garmentOriginalPrice: {
    fontFamily: typography.mono,
    fontSize: 11,
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
    borderColor: colors.overlayLight,
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  rentalImageWrap: {
    width: '100%',
    height: CARD_WIDTH * 1.25,
    backgroundColor: colors.paper,
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
    fontFamily: typography.bodyBold,
    includeFontPadding: false,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  rentalInfo: {
    padding: 12,
  },
  rentalPricingBlock: {
    backgroundColor: colors.paperLight,
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
    fontSize: 16,
    fontWeight: '900',
    color: colors.copper,
  },
  rentalPerDayUnit: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
  },
  rentalRetailVal: {
    fontFamily: typography.mono,
    fontSize: 11,
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
    borderColor: colors.overlayLight,
    paddingVertical: 7,
    borderRadius: 3,
  },
  rentalReserveText: {
    fontFamily: typography.bodyBold,
    includeFontPadding: false,
    fontSize: 10,
    letterSpacing: 0.3,
    color: colors.charcoal,
  },
  cardArrow: {
    fontFamily: typography.monoBold,
    fontSize: 13,
    color: colors.charcoal,
  },

  // ── Swap Card ───────────────────────────────────────────────────
  swapCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  swapImageWrap: {
    width: '100%',
    height: CARD_WIDTH * 1.25,
    backgroundColor: colors.paper,
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  swapInfo: {
    padding: 12,
  },
  zeroCashBadge: {
    backgroundColor: colors.emeraldLight,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 2,
  },
  zeroCashBadgeText: {
    color: colors.forest,
    fontFamily: typography.bodyBold,
    includeFontPadding: false,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  swapValuationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: colors.paperLight,
    padding: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  swapValuationLabel: {
    fontFamily: typography.bodyBold,
    includeFontPadding: false,
    fontSize: 10,
    letterSpacing: 0.3,
    color: colors.forest,
  },
  swapValuationValue: {
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '900',
    color: colors.charcoal,
  },
  swapTradeAction: {
    flexShrink: 0,
    backgroundColor: colors.forest,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
  },
  swapTradeActionText: {
    color: colors.white,
    fontFamily: typography.bodyBold,
    includeFontPadding: false,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  swapCounterpartBox: {
    paddingTop: 4,
  },
  swapCounterpartText: {
    fontFamily: typography.body,
    fontSize: 11,
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
    backgroundColor: colors.paperGlass,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
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
    borderColor: colors.overlayLight,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyPromptTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
  },
  emptyPromptDesc: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
