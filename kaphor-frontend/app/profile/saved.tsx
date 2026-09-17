import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, Image, Dimensions, Alert, Linking, RefreshControl } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { garmentService } from '../../src/services/garmentService';
import { cartService } from '../../src/services/cartService';
import { EditorialGarmentCard } from '../../src/components/EditorialGarmentCard';
import { DossierLoading } from '../../src/components/common/DossierLoading';
import { colors, typography } from '../../src/theme';
import {
  loadSavedRepairs,
  removeSavedRepair,
  SavedRepairItem,
} from '../../src/services/savedRepairService';
import {
  youTubeUrl,
  difficultyColor,
} from '../../src/services/repairService';
import { hapticFeedback } from '../../src/utils/haptics';

import { Header } from '../../src/components/common/Header';
import { safeBack, useBackHandler } from '../../src/utils/navigation';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2;

export default function SavedAssetsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useBackHandler('/(tabs)/profile');
  const [savedAssets, setSavedAssets] = useState<any[]>([]);
  const [savedRepairs, setSavedRepairs] = useState<SavedRepairItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'shop' | 'repairs'>('shop');

  const fetchSavedAssets = useCallback(async () => {
    try {
      const data = await garmentService.getWishlist();
      setSavedAssets(data);
    } catch (error) {
      console.error('Failed to fetch saved assets', error);
    }
  }, []);

  const fetchSavedRepairs = useCallback(async () => {
    try {
      const items = await loadSavedRepairs();
      setSavedRepairs(items);
    } catch (error) {
      console.error('Failed to fetch saved repairs', error);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hapticFeedback.light();
    await Promise.all([fetchSavedAssets(), fetchSavedRepairs()]);
    setRefreshing(false);
  }, [fetchSavedAssets, fetchSavedRepairs]);

  const handleAddToCart = async (item: any) => {
    try {
      await cartService.addToCart(item.id);
      Alert.alert('✓ Added', `${item.title} has been added to your cart.`);
    } catch (error) {
      Alert.alert('Error', 'Could not add to cart. Please try again.');
      console.error(error);
    }
  };

  const handleRemoveRepair = async (id: string) => {
    try {
      await removeSavedRepair(id);
      setSavedRepairs((prev) => prev.filter((i) => i.id !== id));
    } catch {
      Alert.alert('Error', 'Could not remove item. Please try again.');
    }
  };

  const handleOpenYouTube = (videoId: string) => {
    Linking.openURL(youTubeUrl(videoId)).catch(() => {
      Alert.alert('Error', 'Could not open YouTube.');
    });
  };

  useEffect(() => {
    Promise.all([fetchSavedAssets(), fetchSavedRepairs()]).finally(() =>
      setLoading(false)
    );
  }, [fetchSavedAssets, fetchSavedRepairs]);

  // ── Render repair item ─────────────────────────────────────────
  const renderRepairItem = (item: SavedRepairItem) => {
    if (item.type === 'guide' && item.guide) {
      const g = item.guide;
      return (
        <View key={item.id} style={styles.repairCard}>
          <View style={styles.repairCardHeader}>
            <View style={[styles.repairTypeBadge, {
              backgroundColor: g.doc_type === 'repair' ? '#1E3B2F' :
                g.doc_type === 'upcycle' ? '#C95F12' : '#4A2E1A'
            }]}>
              <Text style={styles.repairTypeText}>{g.doc_type.toUpperCase()}</Text>
            </View>
            <View style={[styles.repairDiffBadge, { borderColor: difficultyColor(g.difficulty) }]}>
              <Text style={[styles.repairDiffText, { color: difficultyColor(g.difficulty) }]}>
                {g.difficulty}
              </Text>
            </View>
          </View>
          <Text style={styles.repairTitle}>{g.title}</Text>
          <Text style={styles.repairTechnique}>{g.technique_style}</Text>
          {item.garmentLabel && (
            <Text style={styles.repairGarment}>For: {item.garmentLabel}</Text>
          )}
          {g.steps.length > 0 && (
            <View style={styles.repairSteps}>
              {g.steps.slice(0, 2).map((step, si) => (
                <View key={si} style={styles.repairStepRow}>
                  <Text style={styles.repairStepBullet}>•</Text>
                  <Text style={styles.repairStepText} numberOfLines={1}>{step}</Text>
                </View>
              ))}
              {g.steps.length > 2 && (
                <Text style={styles.repairMoreSteps}>+{g.steps.length - 2} more steps</Text>
              )}
            </View>
          )}
          <View style={styles.repairTools}>
            <Text style={styles.repairToolsLabel}>
              ⏱ {g.time_minutes} min · {g.tools_required.slice(0, 3).join(', ')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.repairRemoveBtn}
            onPress={() => handleRemoveRepair(item.id)}
          >
            <Ionicons name="trash-outline" size={14} color={colors.red} />
            <Text style={styles.repairRemoveText}>REMOVE</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (item.type === 'youtube' && item.video) {
      const v = item.video;
      return (
        <TouchableOpacity
          key={item.id}
          style={styles.youtubeCard}
          onPress={() => handleOpenYouTube(v.videoId)}
          activeOpacity={0.85}
        >
          <View style={styles.youtubeThumbWrap}>
            {v.thumbnail ? (
              <Image source={{ uri: v.thumbnail }} style={styles.youtubeThumb} />
            ) : (
              <View style={styles.youtubeThumbPlaceholder}>
                <Ionicons name="image-outline" size={20} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.youtubePlayOverlay}>
              <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
          <View style={styles.youtubeInfo}>
            <Text style={styles.youtubeTitle} numberOfLines={2}>{v.title}</Text>
            <Text style={styles.youtubeChannel}>{v.channelTitle}</Text>
            {item.garmentLabel && (
              <Text style={styles.youtubeGarment}>{item.garmentLabel}</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.youtubeRemoveBtn}
            onPress={() => handleRemoveRepair(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.red} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    }

    return null;
  };

  const renderShopItem = ({ item }: { item: any }) => (
    <View style={styles.cardContainer}>
      <EditorialGarmentCard
        item={item}
        onPress={() => router.push(`/(tabs)/shop/${item.id}` as any)}
        onAddToCart={() => handleAddToCart(item)}
        style={{ width: '100%', marginRight: 0 }}
      />
    </View>
  );

  // ── Combined empty state ────────────────────────────────────────
  const bothEmpty = savedAssets.length === 0 && savedRepairs.length === 0;

  return (
    <View style={styles.container}>
      <Header title="THE VAULT" showBack fallbackPath="/(tabs)/profile" />

      {loading ? (
        <View style={styles.loader}>
          <DossierLoading variant="shop" compact />
        </View>
      ) : bothEmpty ? (
        <View style={styles.emptyState}>
          <Ionicons name="heart-dislike-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>THE VAULT IS EMPTY</Text>
          <Text style={styles.emptySub}>Save items from the shop or bookmark repair guides & video tutorials to see them here.</Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push('/(tabs)/shop')}
          >
            <Text style={styles.ctaText}>GO SHOPPING →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.crimson}
              colors={[colors.crimson]}
            />
          }
        >
          {/* ── Tab Switcher ─────────────────────────────────────── */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'shop' && styles.tabActive]}
              onPress={() => setActiveTab('shop')}
            >
              <Ionicons
                name="bag-outline"
                size={16}
                color={activeTab === 'shop' ? colors.cream : colors.charcoal}
              />
              <Text style={[styles.tabText, activeTab === 'shop' && styles.tabTextActive]}>
                SHOP ({savedAssets.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'repairs' && styles.tabActive]}
              onPress={() => setActiveTab('repairs')}
            >
              <Ionicons
                name="construct-outline"
                size={16}
                color={activeTab === 'repairs' ? colors.cream : colors.charcoal}
              />
              <Text style={[styles.tabText, activeTab === 'repairs' && styles.tabTextActive]}>
                REPAIRS ({savedRepairs.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Shop Tab ─────────────────────────────────────────── */}
          {activeTab === 'shop' && (
            savedAssets.length === 0 ? (
              <View style={styles.tabEmptyState}>
                <Ionicons name="bag-outline" size={40} color={colors.textMuted} />
                <Text style={styles.tabEmptyText}>No saved shop items yet.</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/shop')}>
                  <Text style={styles.tabEmptyAction}>Browse the marketplace →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.gridWrap}>
                <View style={styles.vaultHeader}>
                  <Text style={styles.vaultTitle}>MANIFESTED ASSETS</Text>
                  <View style={styles.badgeLine}>
                    <Text style={styles.badgeText}>TOTAL: {savedAssets.length} ITEMS</Text>
                  </View>
                </View>
                <View style={styles.grid}>
                  {savedAssets.map((item) => (
                    <View key={item.id} style={styles.gridCol}>
                      {renderShopItem({ item })}
                    </View>
                  ))}
                </View>
              </View>
            )
          )}

          {/* ── Repairs Tab ────────────────────────────────────────── */}
          {activeTab === 'repairs' && (
            savedRepairs.length === 0 ? (
              <View style={styles.tabEmptyState}>
                <Ionicons name="construct-outline" size={40} color={colors.textMuted} />
                <Text style={styles.tabEmptyText}>No saved repair sessions yet.</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/studio/repair-refresh')}>
                  <Text style={styles.tabEmptyAction}>Try Repair & Refresh →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.repairsSection}>
                <View style={styles.vaultHeader}>
                  <Text style={styles.vaultTitle}>SAVED REPAIRS</Text>
                  <View style={styles.badgeLine}>
                    <Text style={styles.badgeText}>TOTAL: {savedRepairs.length} ITEMS</Text>
                  </View>
                </View>

                {/* Guides */}
                {savedRepairs.filter(r => r.type === 'guide').length > 0 && (
                  <>
                    <View style={styles.repairSubHeader}>
                      <Ionicons name="book-outline" size={16} color={colors.charcoal} />
                      <Text style={styles.repairSubTitle}>GUIDES</Text>
                    </View>
                    {savedRepairs
                      .filter(r => r.type === 'guide')
                      .map(renderRepairItem)}
                  </>
                )}

                {/* YouTube */}
                {savedRepairs.filter(r => r.type === 'youtube').length > 0 && (
                  <>
                    <View style={[styles.repairSubHeader, { marginTop: 12 }]}>
                      <Ionicons name="logo-youtube" size={16} color="#FF0000" />
                      <Text style={styles.repairSubTitle}>VIDEO TUTORIALS</Text>
                    </View>
                    {savedRepairs
                      .filter(r => r.type === 'youtube')
                      .map(renderRepairItem)}
                  </>
                )}
              </View>
            )
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 60,
  },
  cardContainer: {
    flex: 1,
    padding: 6,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontFamily: typography.headings,
    fontSize: 32,
    color: colors.charcoal,
    marginTop: 20,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  ctaButton: {
    marginTop: 32,
    backgroundColor: colors.charcoal,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  ctaText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '800',
  },

  // ── Tab Bar ────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 20,
    backgroundColor: colors.white,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  tabActive: {
    backgroundColor: colors.charcoal,
  },
  tabText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  tabTextActive: {
    color: colors.cream,
  },

  // ── Tab Empty State ────────────────────────────────────────────
  tabEmptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  tabEmptyText: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  tabEmptyAction: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.charcoal,
    textDecorationLine: 'underline',
    marginTop: 4,
  },

  // ── Shop / Grid ────────────────────────────────────────────────
  gridWrap: {
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCol: {
    width: '50%',
    padding: 6,
  },

  // ── Vault Header ────────────────────────────────────────────────
  vaultHeader: {
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  vaultTitle: {
    fontFamily: typography.headings,
    fontSize: 28,
    color: colors.charcoal,
  },
  badgeLine: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  badgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Repairs Section ────────────────────────────────────────────
  repairsSection: {
    marginBottom: 20,
  },
  repairSubHeader: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 10,
    marginTop: 4,
  },
  repairSubTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 1.5,
  },

  // ── Repair Guide Card ──────────────────────────────────────────
  repairCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 12,
    position: 'relative',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  repairCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  repairTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  repairTypeText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 1,
  },
  repairDiffBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  repairDiffText: {
    fontFamily: typography.mono,
    fontSize: 7,
    fontWeight: '700',
  },
  repairTitle: {
    fontFamily: typography.headings,
    fontSize: 18,
    color: colors.charcoal,
    marginBottom: 4,
    lineHeight: 22,
  },
  repairTechnique: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 8,
  },
  repairGarment: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  repairSteps: {
    gap: 4,
    marginBottom: 8,
  },
  repairStepRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  repairStepBullet: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.charcoal,
  },
  repairStepText: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.charcoal,
    lineHeight: 16,
  },
  repairMoreSteps: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginLeft: 14,
  },
  repairTools: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  repairToolsLabel: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
  },
  repairRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  repairRemoveText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '700',
    color: colors.red,
    letterSpacing: 1,
  },

  // ── YouTube Card ────────────────────────────────────────────────
  youtubeCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    position: 'relative',
  },
  youtubeThumbWrap: {
    width: 100,
    height: 75,
    position: 'relative',
  },
  youtubeThumb: {
    width: '100%',
    height: '100%',
  },
  youtubeThumbPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cream,
  },
  youtubePlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  youtubeInfo: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  youtubeTitle: {
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: '700',
    color: colors.charcoal,
    lineHeight: 16,
    marginBottom: 2,
  },
  youtubeChannel: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
  },
  youtubeGarment: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  youtubeRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
  },
});
