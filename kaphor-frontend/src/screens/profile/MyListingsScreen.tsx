import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { userService } from '../../services/userService';
import { garmentService } from '../../services/garmentService';
import { KaphorImage } from '../../components/KaphorImage';
import { colors, typography, spacing, radius } from '../../theme';
import { safeBack, useBackHandler } from '../../utils/navigation';
import { hapticFeedback } from '../../utils/haptics';
import { getFormattedGarmentPrice } from '../../utils/priceFormatter';
import { ListingInsightsModal } from '../../components/ListingInsightsModal';

export function MyListingsScreen() {
  const router = useRouter();
  useBackHandler('/(tabs)/profile');
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInsightsGarmentId, setSelectedInsightsGarmentId] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    try {
      const data = await userService.getMyListings();
      setListings(data || []);
    } catch (err) {
      console.error('Failed to fetch listings', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const onRefresh = () => {
    setRefreshing(true);
    hapticFeedback.light();
    fetchListings();
  };

  const handleDeList = (item: any) => {
    Alert.alert(
      'De-List Asset',
      `Are you sure you want to remove "${item.title}" from the marketplace?`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'DE-LIST',
          style: 'destructive',
          onPress: async () => {
            try {
              await garmentService.deleteGarment(item.id);
              setListings((prev) => prev.filter((g) => g.id !== item.id));
              Alert.alert('De-Listed', 'Your garment listing has been removed.');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to remove listing.');
            }
          },
        },
      ]
    );
  };

  const ListingCard = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Pressable
        style={styles.cardMain}
        onPress={() => router.push(`/(tabs)/shop/${item.id}` as any)}
      >
        <KaphorImage uri={item.images?.[0]} style={styles.image} />
        <View style={styles.cardBody}>
          <View>
            <View style={styles.topRow}>
              <Text style={styles.brand} numberOfLines={1}>{item.brand || 'ATELIER'}</Text>
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
          setSelectedInsightsGarmentId(item.id);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.telemetryItem}>
          <Ionicons name="eye-outline" size={12} color={colors.gold} />
          <Text style={styles.telemetryText}>{item.insights?.views ?? item.viewCount ?? 0} views</Text>
        </View>
        <View style={styles.telemetryDivider} />
        <View style={styles.telemetryItem}>
          <Ionicons
            name="cart-outline"
            size={12}
            color={item.insights?.inCart > 0 ? '#00E5FF' : colors.textMuted}
          />
          <Text
            style={[
              styles.telemetryText,
              item.insights?.inCart > 0 && { color: '#00E5FF', fontWeight: 'bold' },
            ]}
          >
            {item.insights?.inCart ?? 0} in cart
          </Text>
        </View>
        <View style={styles.telemetryDivider} />
        <View style={styles.telemetryItem}>
          <Ionicons name="heart-outline" size={12} color={colors.crimson} />
          <Text style={styles.telemetryText}>{item.insights?.saves ?? 0} saves</Text>
        </View>
        <View style={styles.telemetryDivider} />
        <View style={styles.telemetryAction}>
          <Ionicons name="analytics-outline" size={12} color={colors.gold} />
          <Text style={styles.telemetryActionText}>INSIGHTS ›</Text>
        </View>
      </TouchableOpacity>

      {/* Quick Action Toolbar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.insightsBtn]}
          onPress={() => {
            hapticFeedback.light();
            setSelectedInsightsGarmentId(item.id);
          }}
        >
          <Ionicons name="stats-chart-outline" size={14} color={colors.gold} />
          <Text style={[styles.actionBtnText, { color: colors.gold }]}>INSIGHTS</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push(`/(tabs)/shop/${item.id}` as any)}
        >
          <Ionicons name="eye-outline" size={14} color={colors.textSecond} />
          <Text style={styles.actionBtnText}>VIEW</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => router.push(`/(tabs)/shop/edit/${item.id}` as any)}
        >
          <Ionicons name="create-outline" size={14} color={colors.textSecond} />
          <Text style={styles.actionBtnText}>EDIT</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleDeList(item)}
        >
          <Ionicons name="trash-outline" size={14} color={colors.crimson} />
          <Text style={[styles.actionBtnText, { color: colors.crimson }]}>DE-LIST</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => safeBack('/(tabs)/profile')} 
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>MY LISTINGS</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push({ pathname: '/(tabs)/shop/sell', params: { fresh: Date.now().toString() } } as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={24} color={colors.gold} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.loadingText}>Fetching your listings...</Text>
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="pricetag-outline" size={54} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Garments Listed Yet</Text>
          <Text style={styles.emptyText}>
            List your luxury garments, archival couture, or ethnic wear for sale, rent, or swap.
          </Text>
          <TouchableOpacity
            style={styles.listNowBtn}
            onPress={() => router.push({ pathname: '/(tabs)/shop/sell', params: { fresh: Date.now().toString() } } as any)}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.bg} />
            <Text style={styles.listNowText}>LIST A GARMENT</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard item={item} />}
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
    fontFamily: typography.mono,
    fontSize: 13,
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
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.bg,
    letterSpacing: 0.5,
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
    fontFamily: typography.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
    fontFamily: typography.mono,
    fontSize: 10,
    marginBottom: 3,
  },
  price: {
    color: colors.textPrimary,
    fontFamily: typography.mono,
    fontSize: 15,
    fontWeight: 'bold',
  },
  statusBadge: {
    backgroundColor: 'rgba(201, 168, 76, 0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  inactiveBadge: {
    backgroundColor: 'rgba(150, 150, 150, 0.12)',
    borderColor: colors.border,
  },
  statusText: {
    color: colors.gold,
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: 'bold',
  },
  inactiveStatusText: {
    color: colors.textMuted,
  },
  telemetryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
    fontFamily: typography.mono,
    fontSize: 10,
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
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  actionBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
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
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
  },
  editBtn: {
    backgroundColor: 'transparent',
  },
  actionBtnText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textSecond,
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    height: '100%',
  },
});
