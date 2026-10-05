import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Platform, TextInput, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useGarmentStore, prefetchDetailImages } from '../../../src/store/garmentStore';
import { useAuthStore } from '../../../src/store/authStore';
import { orderService } from '../../../src/services/orderService';
import { EditorialGarmentCard } from '../../../src/components/EditorialGarmentCard';
import { EditorialIcon, EditorialPageHeader, HandwrittenNote } from '../../../src/components/editorial/IllustrationLayer';
import { GarmentGridSkeleton } from '../../../src/components/common/CardLoadingScreen';
import { colors, typography } from '../../../src/theme';
import { 
  MARKET_CATEGORIES, 
  MARKET_CONDITIONS, 
  MARKET_SIZES 
} from '../../../src/constants/market';
import { getErrorMessage } from '../../../src/utils/errors';

const ShopGridCard = React.memo(function ShopGridCard({
  item,
  onOpen,
  onBuy,
}: {
  item: any;
  onOpen: (id: string) => void;
  onBuy: (item: any) => void;
}) {
  const press = useCallback(() => onOpen(item.id), [onOpen, item.id]);
  const buy = useCallback(() => onBuy(item), [onBuy, item]);
  return (
    <View style={styles.cardWrapper}>
      <EditorialGarmentCard item={item} onPress={press} onBuyRequest={buy} style={CARD_STYLE} />
    </View>
  );
});

const CATEGORY_CHIPS = ['ALL', ...MARKET_CATEGORIES.map((g) => g.group)];
const CARD_STYLE = { width: '100%', marginRight: 0 } as const;

export default function ShopScreen() {
  const router = useRouter();
  const categories = CATEGORY_CHIPS;
  const SIZES = MARKET_SIZES;
  const CONDITIONS = MARKET_CONDITIONS;

  const garments = useGarmentStore((s) => s.garments);
  const isLoading = useGarmentStore((s) => s.isLoading);
  const fetchError = useGarmentStore((s) => s.fetchError);
  const fetchFeed = useGarmentStore((s) => s.fetchFeed);
  const loadMore = useGarmentStore((s) => s.loadMore);
  const isLoadingMore = useGarmentStore((s) => s.isLoadingMore);
  const hasMore = useGarmentStore((s) => Boolean(s.pagination.nextCursor));

  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    categories: [] as string[],
    sizes: [] as string[],
    priceRange: [0, 1000000],
    conditions: [] as string[],
  });

  const { category: filterCategory, openFilters } = useLocalSearchParams();

  useEffect(() => {
    if (openFilters === 'true') {
      setShowFilters(true);
    }
    if (filterCategory) {
      setSelectedFilters(prev => ({ 
        ...prev, 
        categories: Array.from(new Set([...prev.categories, filterCategory as string]))
      }));
    }
  }, [filterCategory, openFilters]);

  // Revalidate feed whenever user focuses the Shop tab or when filters change
  const applyFilters = useCallback(() => {
    const params: any = {};
    if (searchQuery) params.q = searchQuery;
    
    let selectedCats = [...selectedFilters.categories];
    
    // If a Group is selected in the top scroll, include all its items
    selectedFilters.categories.forEach(cat => {
      const group = MARKET_CATEGORIES.find(g => g.group === cat);
      if (group) {
        selectedCats = [...selectedCats, ...group.items];
      }
    });
    // Strip group labels so only concrete market categories reach the API
    const groupLabels = new Set(MARKET_CATEGORIES.map(g => g.group));
    selectedCats = selectedCats.filter(cat => !groupLabels.has(cat));

    if (selectedCats.length > 0 && !selectedCats.includes('ALL')) {
      params.category = Array.from(new Set(selectedCats)).join(',');
    }
    if (selectedFilters.sizes.length > 0) params.size = selectedFilters.sizes.join(',');
    if (selectedFilters.conditions.length > 0) params.condition = selectedFilters.conditions.join(',');
    
    // Ensure we only show SALE items in the main shop feed
    params.listingType = 'SALE';
    
    return fetchFeed(params);
  }, [searchQuery, selectedFilters, fetchFeed]);

  useFocusEffect(
    useCallback(() => {
      applyFilters();
    }, [applyFilters])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await applyFilters();
    } finally {
      setRefreshing(false);
    }
  }, [applyFilters]);

  const onEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore && !isLoading) loadMore();
  }, [hasMore, isLoadingMore, isLoading, loadMore]);

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
      Alert.alert('Error', getErrorMessage(error, 'Could not submit purchase request. Please try again.'));
    }
  }, [router]);

  const toggleFilter = (type: keyof typeof selectedFilters, value: any) => {
    setSelectedFilters(prev => {
      const current = prev[type] as any[];
      const next = current.includes(value)
        ? current.filter(i => i !== value)
        : [...current, value];
      return { ...prev, [type]: next };
    });
  };

  const currentUserId = useAuthStore((s) => s.user?.id);
  const saleItems = useMemo(() => {
    const hasOtherListings = currentUserId
      ? garments.some((g) => g.sellerId !== currentUserId && (g as any).seller?.id !== currentUserId)
      : false;
    return garments.filter(
      (item) =>
        item.listingType === 'SALE' &&
        item.isActive !== false &&
        !['OWNERSHIP', 'RESERVED_SALE', 'PURCHASE_INTENT'].includes((item as any).lifecycleState || '') &&
        !(item as any).reservedOrderId &&
        (hasOtherListings ? (item.sellerId !== currentUserId && (item as any).seller?.id !== currentUserId) : true)
    );
  }, [garments, currentUserId]);

  useEffect(() => {
    prefetchDetailImages(saleItems, 4);
  }, [saleItems]);

  const keyExtractor = useCallback((item: any) => item.id, []);
  const openItem = useCallback((id: string) => router.push(`/(tabs)/shop/${id}` as any), [router]);
  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <ShopGridCard item={item} onOpen={openItem} onBuy={handleBuyRequest} />
    ),
    [openItem, handleBuyRequest]
  );

  const renderEmpty = () => {
    if (isLoading) return <GarmentGridSkeleton count={6} />;

                const hasActiveFilters =
                  searchQuery.trim().length > 0 ||
                  selectedFilters.categories.length > 0 ||
                  selectedFilters.sizes.length > 0 ||
                  selectedFilters.conditions.length > 0;

                if (fetchError) {
                  return (
                    <View style={styles.emptyState}>
                      <EditorialIcon name="mail" size={32} />
                      <Text style={styles.emptyText}>{fetchError}</Text>
                      <TouchableOpacity style={styles.emptyActionBtn} onPress={applyFilters} activeOpacity={0.85}>
                        <Text style={styles.emptyActionText}>RETRY</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
                  <View style={styles.emptyState}>
                    <EditorialIcon name={hasActiveFilters ? 'filter' : 'bag'} size={34} />
                    <Text style={styles.emptyText}>
                      {hasActiveFilters
                        ? 'NO SALE ASSETS MATCH YOUR FILTERS'
                        : 'NO SALE ASSETS RIGHT NOW'}
                    </Text>
                    {(selectedFilters.categories.length > 0 ||
                      selectedFilters.sizes.length > 0 ||
                      selectedFilters.conditions.length > 0) && (
                      <TouchableOpacity
                        style={styles.emptyActionBtn}
                        onPress={() =>
                          setSelectedFilters({ categories: [], sizes: [], priceRange: [0, 1000000], conditions: [] })
                        }
                        activeOpacity={0.85}
                      >
                        <Text style={styles.emptyActionText}>CLEAR FILTERS</Text>
                      </TouchableOpacity>
                    )}
                    <View style={styles.emptyFallbackRow}>
                      <TouchableOpacity
                        style={styles.emptyFallbackBtn}
                        onPress={() => router.push('/(tabs)/swap' as any)}
                        activeOpacity={0.85}
                      >
                        <EditorialIcon name="swap" size={18} />
                        <Text style={[styles.emptyFallbackText, { color: colors.emeraldDark }]}>EXPLORE SWAP</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.emptyFallbackBtn}
                        onPress={() => router.push('/(tabs)/rental' as any)}
                        activeOpacity={0.85}
                      >
                        <EditorialIcon name="dress" size={18} />
                        <Text style={[styles.emptyFallbackText, { color: colors.goldDark }]}>EXPLORE RENTAL</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
  };

  const showInitialLoader = isLoading && garments.length === 0;

  return (
    <View style={styles.container}>
      <EditorialPageHeader
        title="THE SHOP"
        subtitle="PRE-LOVED PIECES, NEW BEGINNINGS."
        eyebrow="BUY & SELL"
        variant="archive"
        style={styles.header}
      >
        <HandwrittenNote>every piece keeps a story moving.</HandwrittenNote>
        <View style={styles.headerActionRow}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.aiHeaderBtn}
              onPress={() => router.push('/(tabs)/shop/ai-chat')}
              activeOpacity={0.85}
            >
              <View style={styles.aiHeaderBtnInner}>
                <EditorialIcon name="sparkle" size={16} allowTint tintColor={colors.gold} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.aiHeaderBtnText}>AI STYLIST</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterToggleBtn} onPress={() => setShowFilters(true)} activeOpacity={0.85}>
              <EditorialIcon name="filter" size={22} allowTint tintColor={colors.cream} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.searchBar}>
          <Text style={styles.searchPrefix}>{'>'}</Text>
          <TextInput accessibilityLabel="Search pieces"
            placeholder="Search brand, style, category…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={() => setSearchQuery(searchInput.trim())}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </EditorialPageHeader>

      {showInitialLoader ? (
        <GarmentGridSkeleton count={6} />
      ) : (
        <View style={{ flex: 1 }}>
          {isLoading && garments.length > 0 && (
             <View style={{ height: 2, backgroundColor: colors.red, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }} />
          )}
          <FlatList
            data={saleItems}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            numColumns={2}
            columnWrapperStyle={styles.columnWrap}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
            ListHeaderComponent={
            <View style={styles.activeFiltersRow}>
              <View style={styles.countRow}>
                <Text style={styles.resultCount}>
                  {saleItems.length} {saleItems.length === 1 ? 'PIECE' : 'PIECES'}
                </Text>
                <View style={styles.saleTag}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.saleTagText}>SALE ONLY</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {categories.map((cat: string) => {
                  const isActive = selectedFilters.categories.includes(cat) || (cat === 'ALL' && selectedFilters.categories.length === 0);
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.filterChip, isActive && styles.activeChip]}
                      onPress={() => {
                        if (cat === 'ALL') {
                          setSelectedFilters(prev => ({ ...prev, categories: [] }));
                        } else {
                          toggleFilter('categories', cat);
                        }
                      }}
                    >
                      <Text style={[styles.filterText, isActive && styles.activeFilterText]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            }
            ListEmptyComponent={renderEmpty}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.6}
            ListFooterComponent={isLoadingMore ? <GarmentGridSkeleton count={4} /> : null}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.gold}
                colors={[colors.gold]}
              />
            }
          />

          {/* FILTER MODAL OVERLAY */}
          {showFilters && (
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>FILTERS // REFINEMENT</Text>
                  <TouchableOpacity onPress={() => setShowFilters(false)}>
                    <EditorialIcon name="close" size={26} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalSectionLabel}>CATEGORIES</Text>
                  {MARKET_CATEGORIES.map(group => (
                    <View key={group.group} style={{ marginBottom: 12 }}>
                      <Text style={styles.modalSubLabel}>{group.group}</Text>
                      <View style={styles.modalOptionGrid}>
                        {group.items.map(cat => (
                          <TouchableOpacity
                            key={cat}
                            style={[styles.modalOption, selectedFilters.categories.includes(cat) && styles.modalOptionActive]}
                            onPress={() => toggleFilter('categories', cat)}
                          >
                            <Text style={[styles.modalOptionText, selectedFilters.categories.includes(cat) && styles.modalOptionTextActive]}>{cat}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}

                  <Text style={styles.modalSectionLabel}>SIZES</Text>
                  <View style={styles.modalOptionGrid}>
                    {SIZES.map(size => (
                      <TouchableOpacity
                        key={size}
                        style={[styles.modalOption, selectedFilters.sizes.includes(size) && styles.modalOptionActive]}
                        onPress={() => toggleFilter('sizes', size)}
                      >
                        <Text style={[styles.modalOptionText, selectedFilters.sizes.includes(size) && styles.modalOptionTextActive]}>{size}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.modalSectionLabel}>CONDITION</Text>
                  <View style={styles.modalOptionGrid}>
                    {CONDITIONS.map(cond => (
                      <TouchableOpacity
                        key={cond.id}
                        style={[styles.modalOption, selectedFilters.conditions.includes(cond.id) && styles.modalOptionActive]}
                        onPress={() => toggleFilter('conditions', cond.id)}
                      >
                        <Text style={[styles.modalOptionText, selectedFilters.conditions.includes(cond.id) && styles.modalOptionTextActive]}>{cond.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity style={styles.resetBtn} onPress={() => setSelectedFilters({ categories: [], sizes: [], priceRange: [0, 1000000], conditions: [] })}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.resetBtnText}>RESET</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilters(false)}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.applyBtnText}>APPLY FILTERS</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    marginBottom: 20,
  },
  headerActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 14,
  },
  title: {
    fontSize: 37,
    fontFamily: typography.headings,
    color: colors.charcoal,
    letterSpacing: 2,
  },
  sellButton: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  sellText: {
    color: colors.cream,
    fontSize: 20,
    fontFamily: typography.handBold,
    includeFontPadding: false,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    height: 48,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  searchPrefix: {
    fontFamily: typography.mono,
    fontSize: 18,
    color: colors.red,
    marginRight: 8,
    fontWeight: 'bold',
  },
  searchInput: {
    flex: 1,
    color: colors.charcoal,
    fontSize: 18,
    fontFamily: typography.body,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginRight: 12,
    backgroundColor: colors.white,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  filterText: {
    color: colors.charcoal,
    fontSize: 12,
    fontFamily: typography.handBold,
    includeFontPadding: false,
  },
  activeFilterText: {
    color: colors.cream,
  },
  activeChip: {
    backgroundColor: colors.charcoal,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.red,
    marginRight: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  columnWrap: { justifyContent: 'space-between', paddingHorizontal: 16 },
  listContent: { paddingBottom: 100 },
  cardWrapper: {
    width: '48%',
    marginBottom: 24,
  },
  shopCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  shopCardImageWrap: {
    width: '100%',
    aspectRatio: 0.8,
    backgroundColor: colors.paper,
    position: 'relative',
  },
  shopCardImage: {
    width: '100%',
    height: '100%',
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
    fontSize: 10,
  },
  shopCardInfo: {
    padding: 10,
  },
  shopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 6,
  },
  shopBrand: {
    flex: 1,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.charcoal,
  },
  shopSize: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.textMuted,
  },
  shopTitle: {
    fontFamily: typography.body,
    fontSize: 15.5,
    fontWeight: '600',
    color: colors.charcoal,
    marginBottom: 8,
  },
  shopPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shopPrice: {
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '900',
    color: colors.charcoal,
  },
  quickAddBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: -2,
  },
  swapBtn: {
    flex: 1,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.charcoal,
    paddingVertical: 8,
    alignItems: 'center',
    borderRightWidth: 1,
  },
  swapBtnText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 11,
    color: colors.charcoal,
  },
  filterToggleBtn: {
    width: 40,
    height: 40,
    backgroundColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  activeFiltersRow: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    padding: 32,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderStyle: 'dashed',
    marginHorizontal: 16,
  },
  emptyText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  emptyActionBtn: {
    marginTop: 16,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  emptyActionText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.cream,
  },
  emptyFallbackRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  emptyFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  emptyFallbackText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    zIndex: 1000,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.cream,
    height: '80%',
    borderTopWidth: 4,
    borderTopColor: colors.charcoal,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: typography.headings,
    fontSize: 28,
    color: colors.charcoal,
    letterSpacing: 2,
  },
  modalScroll: {
    flex: 1,
  },
  modalSectionLabel: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 13,
    color: colors.red,
    marginBottom: 12,
    marginTop: 16,
  },
  modalOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  modalOptionActive: {
    backgroundColor: colors.charcoal,
  },
  modalOptionText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.charcoal,
  },
  modalOptionTextActive: {
    color: colors.white,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    alignItems: 'center',
  },
  resetBtnText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.charcoal,
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: colors.charcoal,
    alignItems: 'center',
  },
  applyBtnText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 14,
    color: colors.white,
  },
  modalSubLabel: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
    marginTop: 4,
  },
  aiHeaderBtn: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.charcoal,
    shadowColor: colors.crimsonDark,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  aiHeaderBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  aiHeaderBtnText: {
    color: colors.cream,
    fontSize: 12,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    letterSpacing: 1,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  resultCount: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  saleTag: {
    borderWidth: 1,
    borderColor: colors.forest,
    backgroundColor: colors.paperLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  saleTagText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 9,
    color: colors.forest,
    letterSpacing: 0.5,
  },
});
