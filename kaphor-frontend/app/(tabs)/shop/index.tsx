import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AIStar } from '../../../src/components/AIStar';
import { useGarmentStore } from '../../../src/store/garmentStore';
import { useAuthStore } from '../../../src/store/authStore';
import { cartService } from '../../../src/services/cartService';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { EditorialGarmentCard } from '../../../src/components/EditorialGarmentCard';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { GarmentGridSkeleton } from '../../../src/components/common/CardLoadingScreen';
import { colors, typography } from '../../../src/theme';
import { 
  MARKET_CATEGORIES, 
  MARKET_CONDITIONS, 
  MARKET_SIZES 
} from '../../../src/constants/market';

export default function ShopScreen() {
  const router = useRouter();
  const isFirstRender = React.useRef(true);
  const categories = ['ALL', ...MARKET_CATEGORIES.map(g => g.group)];
  const SIZES = MARKET_SIZES;
  const CONDITIONS = MARKET_CONDITIONS;

  const { garments, isLoading, fetchError, fetchFeed } = useGarmentStore();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      applyFilters();
      return;
    }

    const timer = setTimeout(() => {
      applyFilters();
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [searchQuery, selectedFilters]);

  const applyFilters = () => {
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
    
    fetchFeed(params);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      applyFilters();
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  const handleAddToCart = async (item: any) => {
    try {
      await cartService.addToCart(item.id);
      Alert.alert('✓ Added', `${item.title} has been added to your cart.`);
    } catch (error) {
      Alert.alert('Error', 'Could not add to cart. Please try again.');
      console.error(error);
    }
  };

  const toggleFilter = (type: keyof typeof selectedFilters, value: any) => {
    setSelectedFilters(prev => {
      const current = prev[type] as any[];
      const next = current.includes(value)
        ? current.filter(i => i !== value)
        : [...current, value];
      return { ...prev, [type]: next };
    });
  };

  const showInitialLoader = isLoading && garments.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Text style={styles.title}>THE DECK // BROWSE</Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <LinearGradient
              colors={['#E4714A', '#C81E2C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aiHeaderBtn}
            >
              <TouchableOpacity
                style={styles.aiHeaderBtnInner}
                onPress={() => router.push('/(tabs)/shop/ai-chat')}
                activeOpacity={0.85}
              >
                <AIStar size={13} color="#FFFFFF" />
                <Text style={styles.aiHeaderBtnText}>AI STYLIST</Text>
              </TouchableOpacity>
            </LinearGradient>
            <TouchableOpacity style={styles.filterToggleBtn} onPress={() => setShowFilters(true)}>
              <Ionicons name="options-sharp" size={20} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cartHeaderButton} onPress={() => router.push('/(tabs)/cart')}>
              <Ionicons name="briefcase" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.searchBar}>
          <Text style={styles.searchPrefix}>{'>'}</Text>
          <TextInput
            placeholder="QUERY_DATABASE"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {showInitialLoader ? (
        <GarmentGridSkeleton count={6} />
      ) : (
        <View style={{ flex: 1 }}>
          {isLoading && garments.length > 0 && (
             <View style={{ height: 2, backgroundColor: colors.red, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }} />
          )}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.gold}
                colors={[colors.gold]}
              />
            }
          >
            <View style={styles.activeFiltersRow}>
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

            {(() => {
              const currentUserId = useAuthStore.getState().user?.id;
              const saleItems = garments.filter(
                (item) =>
                  item.listingType === 'SALE' &&
                  item.isActive !== false &&
                  !['OWNERSHIP', 'RESERVED_SALE', 'PURCHASE_INTENT'].includes((item as any).lifecycleState || '') &&
                  !(item as any).reservedOrderId &&
                  item.sellerId !== currentUserId &&
                  (item as any).seller?.id !== currentUserId
              );
              if (saleItems.length === 0) {
                const hasActiveFilters =
                  searchQuery.trim().length > 0 ||
                  selectedFilters.categories.length > 0 ||
                  selectedFilters.sizes.length > 0 ||
                  selectedFilters.conditions.length > 0;

                if (fetchError) {
                  return (
                    <View style={styles.emptyState}>
                      <Ionicons name="cloud-offline-outline" size={30} color={colors.textMuted} />
                      <Text style={styles.emptyText}>{fetchError}</Text>
                      <TouchableOpacity style={styles.emptyActionBtn} onPress={applyFilters} activeOpacity={0.85}>
                        <Text style={styles.emptyActionText}>RETRY</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name={hasActiveFilters ? 'funnel-outline' : 'bag-handle-outline'}
                      size={30}
                      color={colors.textMuted}
                    />
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
                        <Ionicons name="swap-horizontal" size={14} color={colors.emerald} />
                        <Text style={[styles.emptyFallbackText, { color: colors.emeraldDark }]}>EXPLORE SWAP</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.emptyFallbackBtn}
                        onPress={() => router.push('/(tabs)/rental' as any)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="time-outline" size={14} color={colors.goldDark} />
                        <Text style={[styles.emptyFallbackText, { color: colors.goldDark }]}>EXPLORE RENTAL</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }
              return (
                <View style={styles.grid}>
                  {saleItems.map((item) => (
                    <View key={item.id} style={styles.cardWrapper}>
                      <EditorialGarmentCard
                        item={item}
                        onPress={() => router.push(`/(tabs)/shop/${item.id}`)}
                        onAddToCart={() => handleAddToCart(item)}
                        style={{ width: '100%', marginRight: 0 }}
                      />
                    </View>
                  ))}
                </View>
              );
            })()}
          </ScrollView>

          {/* FILTER MODAL OVERLAY */}
          {showFilters && (
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>FILTERS // REFINEMENT</Text>
                  <TouchableOpacity onPress={() => setShowFilters(false)}>
                    <Ionicons name="close-sharp" size={24} color={colors.charcoal} />
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
                    <Text style={styles.resetBtnText}>RESET</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilters(false)}>
                    <Text style={styles.applyBtnText}>APPLY FILTERS</Text>
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
    paddingTop: 24,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: colors.charcoal,
    paddingBottom: 20,
    backgroundColor: colors.cream,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
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
  cartHeaderButton: {
    width: 40,
    height: 40,
    backgroundColor: colors.red,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  sellText: {
    color: colors.cream,
    fontSize: 15.5,
    fontFamily: typography.mono,
    fontWeight: '700',
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
    fontFamily: typography.mono,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: typography.mono,
    fontSize: 15.5,
    color: colors.charcoal,
    letterSpacing: 1,
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
    fontSize: 15.5,
    fontFamily: typography.mono,
    fontWeight: '700',
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
  cardWrapper: {
    width: '48%',
    marginBottom: 24,
  },
  shopCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  shopCardImageWrap: {
    width: '100%',
    aspectRatio: 0.8,
    backgroundColor: '#F3EFE9',
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
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.4,
  },
  shopSize: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    color: colors.textMuted,
    fontWeight: '700',
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
    fontSize: 18,
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
    fontFamily: typography.mono,
    fontSize: 13.5,
    color: colors.charcoal,
    fontWeight: '700',
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
    fontFamily: typography.mono,
    fontSize: 15.5,
    color: colors.charcoal,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 16,
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
    fontFamily: typography.monoBold,
    fontSize: 14.5,
    color: colors.cream,
    letterSpacing: 1.5,
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
    fontFamily: typography.monoBold,
    fontSize: 13,
    letterSpacing: 0.8,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,26,26,0.5)',
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
    fontFamily: typography.mono,
    fontSize: 13.5,
    color: colors.red,
    fontWeight: '800',
    letterSpacing: 2,
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
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '700',
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
    borderTopColor: 'rgba(26,26,26,0.1)',
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
    fontFamily: typography.mono,
    fontSize: 15.5,
    fontWeight: '800',
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
    fontFamily: typography.mono,
    fontSize: 15.5,
    fontWeight: '800',
    color: colors.white,
  },
  modalSubLabel: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
  },
  aiHeaderBtn: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: '#5C0B12',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  aiHeaderBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  aiHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    fontFamily: typography.monoBold,
    letterSpacing: 1,
  },
});

