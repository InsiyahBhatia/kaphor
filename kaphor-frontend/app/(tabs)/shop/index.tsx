import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGarmentStore } from '../../../src/store/garmentStore';
import { useAuthStore } from '../../../src/store/authStore';
import { cartService } from '../../../src/services/cartService';
import { PlayingCard } from '../../../src/components/PlayingCard';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
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

  const { garments, isLoading, fetchFeed } = useGarmentStore();

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

  const getDeterminants = (id: string, index: number) => {
    const suits: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
    const bgs = [colors.charcoal, colors.navy, colors.forest, colors.copper, colors.purple, colors.teal];
    const charCode = id ? id.charCodeAt(id.length - 1) : index;
    return {
      suit: suits[(charCode + index) % suits.length],
      rank: ranks[(charCode * 2 + index) % ranks.length],
      bg: bgs[(charCode + index * 3) % bgs.length],
    };
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
            <TouchableOpacity 
              style={styles.aiHeaderBtn} 
              onPress={() => router.push('/(tabs)/shop/ai-chat')}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={17} color="#E5D5A4" />
              <Text style={styles.aiHeaderBtnText}>AI STYLIST</Text>
            </TouchableOpacity>
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
        <DossierLoading variant="shop" />
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
                  item.sellerId !== currentUserId &&
                  (item as any).seller?.id !== currentUserId
              );
              if (saleItems.length === 0) {
                return (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>NO SALE ASSETS MATCHING QUERY</Text>
                  </View>
                );
              }
              return (
                <View style={styles.grid}>
                  {saleItems.map((item, index) => {
                    const { rank, suit } = getDeterminants(item.id, index);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.cardWrapper}
                        onPress={() => router.push(`/(tabs)/shop/${item.id}`)}
                      >
                        <PlayingCard
                          rank={rank}
                          suit={suit}
                          productName={item.title}
                          size={item.size || 'OS'}
                          price={item.price ? Math.round(item.price) : 0}
                          imageUrl={item.images?.[0] || undefined}
                          category={item.category || undefined}
                          subCategory={item.subCategory || undefined}
                          condition={item.condition || "Excellent"}
                          onAddToCart={() => handleAddToCart(item)}
                          buttonText={
                            item.listingType === 'SALE' ? 'BUY ASSET' :
                            item.listingType === 'RENTAL' ? 'RENT ASSET' : 'SWAP REQUEST'
                          }
                          onSwapRequest={() => router.push(`/(tabs)/shop/${item.id}`)}
                          style={{ width: '100%' }}
                        />
                      </TouchableOpacity>
                    );
                  })}
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
    fontSize: 32,
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
    fontSize: 12,
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
    fontSize: 14,
    color: colors.red,
    marginRight: 8,
    fontWeight: 'bold',
  },
  searchInput: {
    flex: 1,
    color: colors.charcoal,
    fontSize: 14,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 10,
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
    fontSize: 12,
    color: colors.charcoal,
    fontWeight: '800',
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
    fontSize: 24,
    color: colors.charcoal,
    letterSpacing: 2,
  },
  modalScroll: {
    flex: 1,
  },
  modalSectionLabel: {
    fontFamily: typography.mono,
    fontSize: 10,
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
    fontSize: 10,
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
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
  },
  modalSubLabel: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
  },
  aiHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  aiHeaderBtnText: {
    color: '#E5D5A4',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: typography.mono,
    letterSpacing: 1,
  },
  floatingAiBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#181818',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#C9A84C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 99,
  },
  floatingAiText: {
    color: '#F4E7C3',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: typography.mono,
    letterSpacing: 1.5,
  },
});

