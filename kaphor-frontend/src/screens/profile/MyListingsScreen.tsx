import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  Pressable,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { SolarIcon } from '../../components/common/SolarIcon';
import { userService } from '../../services/userService';
import { garmentService } from '../../services/garmentService';
import { KaphorImage } from '../../components/KaphorImage';
import { colors, typography, spacing, radius } from '../../theme';
import { safeBack, useBackHandler } from '../../utils/navigation';
import { hapticFeedback } from '../../utils/haptics';
import { getFormattedGarmentPrice } from '../../utils/priceFormatter';
import { ListingInsightsModal } from '../../components/ListingInsightsModal';
import { DelistOptionsModal } from '../../components/DelistOptionsModal';
import { Loader } from '../../components/common/Loader';

const ListingCard = React.memo(function ListingCard({ item, onInsights, onManage, onOpen, onEdit }: { item: any; onInsights: (id: string) => void; onManage: (item: any) => void; onOpen: (id: string) => void; onEdit: (id: string) => void }) {
  return (
    <View style={styles.card}>
      <Pressable
        style={styles.cardMain}
        onPress={() => onOpen(item.id)}
      >
        <KaphorImage uri={item.images?.[0]} style={styles.image} width={110} recyclingKey={item.id} />
        <View style={styles.cardBody}>
          <View>
            <View style={styles.topRow}>
              <Text style={styles.brand} numberOfLines={1}>{item.brand || 'KAPHOR'}</Text>
              <View style={[styles.statusBadge, !item.isActive && styles.inactiveBadge]}>
                <Text style={[styles.statusText, !item.isActive && styles.inactiveStatusText]}>
                  {item.isActive ? (item.lifecycleState || 'LIVE') : 'INACTIVE'}
                </Text>
              </View>
            </View>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>SIZE: {item.size || 'M'} · {item.category || 'Garment'}</Text>
            {(() => {
              const p = getFormattedGarmentPrice(item);
              return (
                <Text style={[styles.price, p.isSwap && { color: colors.crimson, fontSize: 11 }]}>
                  {p.displayPrice}{p.priceUnit || ''}
                </Text>
              );
            })()}
          </View>
        </View>
      </Pressable>

      {/* Live Telemetry Ticker Bar */}
      <TouchableOpacity
        style={styles.telemetryBar}
        onPress={() => {
          hapticFeedback.light();
          onInsights(item.id);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.telemetryItem}>
          <SolarIcon name="eye-outline" size={12} color={colors.gold} />
          <Text style={styles.telemetryText}>{item.insights?.views ?? item.viewCount ?? 0} views</Text>
        </View>
        <View style={styles.telemetryDivider} />
        <View style={styles.telemetryItem}>
          <SolarIcon name="heart-outline" size={12} color={colors.crimson} />
          <Text style={styles.telemetryText}>{item.insights?.saves ?? 0} saves</Text>
        </View>
        <View style={styles.telemetryDivider} />
        <View style={styles.telemetryAction}>
          <SolarIcon name="analytics-outline" size={12} color={colors.gold} />
          <Text style={styles.telemetryActionText}>INSIGHTS ›</Text>
        </View>
      </TouchableOpacity>

      {/* Quick Action Toolbar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.insightsBtn]}
          onPress={() => {
            hapticFeedback.light();
            onInsights(item.id);
          }}
        >
          <SolarIcon name="stats-chart-outline" size={14} color={colors.gold} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.actionBtnText, { color: colors.gold }]}>INSIGHTS</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onOpen(item.id)}
        >
          <SolarIcon name="eye-outline" size={14} color={colors.textSecond} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>VIEW</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => onEdit(item.id)}
        >
          <SolarIcon name="create-outline" size={14} color={colors.textSecond} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.actionBtnText}>EDIT</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onManage(item)}
        >
          <SolarIcon
            name={item.isActive ? 'options-outline' : 'pause-circle-outline'}
            size={14}
            color={item.isActive ? colors.charcoal : colors.orange}
          />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
            style={[
              styles.actionBtnText,
              { color: item.isActive ? colors.charcoal : colors.orange },
            ]}
          >
            {item.isActive ? 'MANAGE' : 'PAUSED'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const listingKey = (item: any) => item.id;
let cachedListings: any[] | null = null;

export function MyListingsScreen() {
  const router = useRouter();
  useBackHandler('/(tabs)/profile');
  const [listings, setListings] = useState<any[]>(cachedListings ?? []);
  const [loading, setLoading] = useState(cachedListings === null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInsightsGarmentId, setSelectedInsightsGarmentId] = useState<string | null>(null);
  const [manageItem, setManageItem] = useState<any | null>(null);

  const fetchListings = useCallback(async () => {
    try {
      const data = await userService.getMyListings();
      cachedListings = data || [];
      setListings(cachedListings as any[]);
    } catch (err) {
      console.error('Failed to fetch listings', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchListings();
    }, [fetchListings])
  );

  const onInsights = useCallback((id: string) => {
    hapticFeedback.light();
    setSelectedInsightsGarmentId(id);
  }, []);
  const onOpen = useCallback((id: string) => router.push(`/(tabs)/shop/${id}` as any), [router]);
  const onEdit = useCallback((id: string) => router.push(`/(tabs)/shop/edit/${id}` as any), [router]);
  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <ListingCard item={item} onInsights={onInsights} onManage={setManageItem} onOpen={onOpen} onEdit={onEdit} />
    ),
    [onInsights, onOpen, onEdit]
  );

  const onRefresh = () => {
    setRefreshing(true);
    hapticFeedback.light();
    fetchListings();
  };

  const handleTogglePause = async (item: any) => {
    const res = await garmentService.pauseGarment(item.id);
    setListings((prev) =>
      prev.map((g) => (g.id === item.id ? { ...g, isActive: res.isActive } : g))
    );
    Alert.alert(
      res.isActive ? 'Listing Resumed' : 'Listing Paused',
      res.message || (res.isActive ? 'Listing is now live.' : 'Listing is paused.')
    );
  };

  const handleMoveToWardrobe = async (item: any) => {
    await garmentService.moveToWardrobe(item.id);
    setListings((prev) =>
      prev.map((g) => (g.id === item.id ? { ...g, isActive: false, lifecycleState: 'OWNERSHIP' } : g))
    );
    Alert.alert(
      'Moved to Wardrobe',
      'This garment has been moved to your private wardrobe closet and removed from the marketplace.'
    );
  };

  const handlePermanentDelete = async (item: any) => {
    await garmentService.deleteGarment(item.id);
    setListings((prev) => prev.filter((g) => g.id !== item.id));
    Alert.alert('Deleted', 'Your listing has been permanently removed.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" 
          onPress={() => safeBack('/(tabs)/profile')} 
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <SolarIcon name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>MY LISTINGS</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add"
          style={styles.addBtn}
          onPress={() => router.push({ pathname: '/(tabs)/shop/sell', params: { fresh: Date.now().toString() } } as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <SolarIcon name="add" size={24} color={colors.gold} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <Loader variant="default" />
      ) : listings.length === 0 ? (
        <View style={styles.center}>
          <SolarIcon name="pricetag-outline" size={54} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Garments Listed Yet</Text>
          <Text style={styles.emptyText}>
            List clothes or ethnic wear to sell, rent or swap.
          </Text>
          <TouchableOpacity
            style={styles.listNowBtn}
            onPress={() => router.push({ pathname: '/(tabs)/shop/sell', params: { fresh: Date.now().toString() } } as any)}
          >
            <SolarIcon name="add-circle-outline" size={18} color={colors.bg} />
            <Text style={styles.listNowText}>LIST A GARMENT</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={listingKey}
          renderItem={renderItem}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
        />
      )}

      {/* Seller Listing Performance Telemetry Modal */}
      <ListingInsightsModal
        visible={!!selectedInsightsGarmentId}
        garmentId={selectedInsightsGarmentId}
        onClose={() => setSelectedInsightsGarmentId(null)}
      />

      {/* Delist, Pause & Wardrobe Lifecycle Management Modal */}
      <DelistOptionsModal
        visible={!!manageItem}
        item={manageItem}
        onClose={() => setManageItem(null)}
        onPauseToggle={handleTogglePause}
        onMoveToWardrobe={handleMoveToWardrobe}
        onDelete={handlePermanentDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontFamily: typography.headings,
    fontSize: 18,
    letterSpacing: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 19,
    marginTop: spacing.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: typography.headings,
    fontSize: 20,
    marginTop: spacing.md,
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: typography.body,
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  listNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  listNowText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 18,
    color: colors.bg,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardMain: {
    flexDirection: 'row',
  },
  image: {
    width: 100,
    height: 125,
  },
  cardBody: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  brand: {
    color: colors.gold,
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 17,
    maxWidth: 140,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  metaRow: {
    marginTop: spacing.xs,
  },
  metaText: {
    color: colors.textMuted,
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 17,
    marginBottom: 3,
  },
  price: {
    color: colors.textPrimary,
    fontFamily: typography.mono,
    fontSize: 15,
    fontWeight: 'bold',
  },
  statusBadge: {
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  inactiveBadge: {
    backgroundColor: colors.overlayLight,
    borderColor: colors.border,
  },
  statusText: {
    color: colors.gold,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
  },
  inactiveStatusText: {
    color: colors.textMuted,
  },
  telemetryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.overlayLight,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  telemetryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  telemetryText: {
    color: colors.textMuted,
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 17,
  },
  telemetryDivider: {
    width: 1,
    height: 10,
    backgroundColor: colors.border,
  },
  telemetryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  telemetryActionText: {
    color: colors.gold,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
  },
  actionBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.overlayLight,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  insightsBtn: {
    backgroundColor: colors.goldLight,
  },
  editBtn: {
    backgroundColor: 'transparent',
  },
  actionBtnText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.textSecond,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    height: '100%',
  },
});
