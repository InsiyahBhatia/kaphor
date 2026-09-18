import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  AppState,
  AppStateStatus,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../theme';
import { KaphorImage } from '../../components/KaphorImage';
import { Header } from '../../components/common/Header';
import { DossierLoading } from '../../components/common/DossierLoading';
import { RecyclingHubsModal } from '../../components/RecyclingHubsModal';
import { cachedGet, fetchFresh, invalidateCache } from '../../services/api';
import api from '../../services/api';
import { hapticFeedback } from '../../utils/haptics';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

// ── Lifecycle state display config ───────────────────────────────
interface StateConfig {
  label: string;
  color: string;
  icon: string;
  description: string;
}

const STATE_CONFIG: Record<string, StateConfig> = {
  OWNERSHIP: { label: 'OWNED', color: colors.forest, icon: 'checkmark-circle', description: 'In your possession' },
  RENTED: { label: 'ON RENTAL', color: '#6B46C1', icon: 'time', description: 'Active rental in your wardrobe' },
  SELL_INTENT: { label: 'SELL READY', color: colors.orange, icon: 'pricetag', description: 'Ready to be relisted' },
  DECLINE: { label: 'DECLINED', color: colors.copper, icon: 'trending-down', description: 'Showing low interest' },
  CIRCULATION: { label: 'CIRCULATING', color: colors.navy, icon: 'refresh', description: 'Active circular rotation' },
  REUSE_UPCYCLE_RECYCLE: { label: 'END OF LIFE', color: colors.textMuted, icon: 'leaf', description: 'Routed to circular end' },
  PURCHASE_INTENT: { label: 'IN TRANSIT', color: colors.orange, icon: 'cart', description: 'Checkout in progress' },
  LISTED: { label: 'LISTED', color: colors.forest, icon: 'checkmark', description: 'Active on marketplace' },
  INTEREST: { label: 'POPULAR', color: colors.gold, icon: 'flame', description: 'High interest' },
};

function getStateConfig(state: string): StateConfig {
  return STATE_CONFIG[state] || { label: state, color: colors.textMuted, icon: 'ellipse', description: '' };
}

// ── Wardrobe Item Card ──────────────────────────────────────────
interface WardrobeItemProps {
  item: any;
  onAction: (action: string, item: any) => void;
}

const WardrobeItemCard = React.memo(({ item, onAction }: WardrobeItemProps) => {
  const state = item.isRented ? 'RENTED' : (item.lifecycleState || 'OWNERSHIP');
  const config = getStateConfig(state);
  const imageUrl = item.images?.[0] || '';

  return (
    <View style={styles.card}>
      {/* Image */}
      <View style={styles.imageWrapper}>
        <KaphorImage uri={imageUrl} style={styles.cardImage} contentFit="contain" />
        {/* State badge overlay */}
        <View style={[styles.stateBadge, { backgroundColor: config.color }]}>
          <Ionicons name={config.icon as any} size={10} color={colors.white} />
          <Text style={styles.stateBadgeText}>{config.label}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardBrand} numberOfLines={1}>{item.brand || 'Brand'}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardStateDesc}>{config.description}</Text>
      </View>

      {/* Actions per lifecycle state */}
      <View style={styles.cardActions}>
        {state === 'OWNERSHIP' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.forest, flex: 1 }]}
              onPress={() => onAction('LOG_WEAR', item)}
            >
              <Ionicons name="footsteps" size={12} color={colors.forest} />
              <Text style={[styles.actionBtnText, { color: colors.forest }]}>I WORE THIS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.charcoal }]}
              onPress={() => onAction('INITIATE_RESELL', item)}
            >
              <Ionicons name="pricetag" size={12} color={colors.charcoal} />
              <Text style={[styles.actionBtnText, { color: colors.charcoal }]}>SELL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: '#8C6D3B', paddingHorizontal: 6 }]}
              onPress={() => onAction('RECYCLE_HUBS', item)}
              accessibilityLabel="Recycle this garment"
            >
              <Ionicons name="leaf-outline" size={12} color="#8C6D3B" />
            </TouchableOpacity>
          </>
        )}
        {state === 'SELL_INTENT' && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.forest, flex: 1 }]}
            onPress={() => onAction('RELIST', item)}
          >
            <Ionicons name="arrow-up-circle" size={14} color={colors.forest} />
            <Text style={[styles.actionBtnText, { color: colors.forest }]}>RELIST NOW</Text>
          </TouchableOpacity>
        )}
        {state === 'RENTED' && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: '#6B46C1', flex: 1, backgroundColor: 'rgba(107,70,193,0.06)' }]}
            onPress={() => onAction('VIEW_RENTAL', item)}
          >
            <Ionicons name="time" size={13} color="#6B46C1" />
            <Text style={[styles.actionBtnText, { color: '#6B46C1' }]}>VIEW RENTAL</Text>
          </TouchableOpacity>
        )}
        {state === 'CIRCULATION' && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.navy, flex: 1, backgroundColor: 'rgba(30,58,138,0.06)' }]}
            onPress={() => onAction('VIEW', item)}
          >
            <Ionicons name="eye" size={13} color={colors.navy} />
            <Text style={[styles.actionBtnText, { color: colors.navy }]}>VIEW ITEM</Text>
          </TouchableOpacity>
        )}
        {state === 'REUSE_UPCYCLE_RECYCLE' && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.forest, flex: 1, backgroundColor: 'rgba(40,54,24,0.06)' }]}
            onPress={() => onAction('RECYCLE_HUBS', item)}
          >
            <Ionicons name="location" size={13} color={colors.forest} />
            <Text style={[styles.actionBtnText, { color: colors.forest }]}>RECYCLING HUBS</Text>
          </TouchableOpacity>
        )}
        {state === 'PURCHASE_INTENT' && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.orange, flex: 1, opacity: 0.6 }]}
            disabled
          >
            <Ionicons name="time" size={14} color={colors.orange} />
            <Text style={[styles.actionBtnText, { color: colors.orange }]}>AWAITING PAYMENT</Text>
          </TouchableOpacity>
        )}
        {state === 'DECLINE' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.charcoal, flex: 1 }]}
              onPress={() => onAction('VIEW', item)}
            >
              <Ionicons name="eye" size={13} color={colors.charcoal} />
              <Text style={[styles.actionBtnText, { color: colors.charcoal }]}>VIEW</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.navy, flex: 1 }]}
              onPress={() => onAction('RECYCLE_HUBS', item)}
            >
              <Ionicons name="leaf" size={13} color={colors.navy} />
              <Text style={[styles.actionBtnText, { color: colors.navy }]}>RECYCLE</Text>
            </TouchableOpacity>
          </>
        )}
        {(state === 'LISTED' || state === 'INTEREST') && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.charcoal, flex: 1 }]}
            onPress={() => onAction('VIEW', item)}
          >
            <Ionicons name="eye" size={14} color={colors.charcoal} />
            <Text style={[styles.actionBtnText, { color: colors.charcoal }]}>VIEW</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// ── Summary stats for wardrobe header ───────────────────────────
function WardrobeStats({
  garments,
  onOpenRecyclingModal,
}: {
  garments: any[];
  onOpenRecyclingModal: () => void;
}) {
  const owned = garments.filter(g => (g.lifecycleState === 'OWNERSHIP' || !g.lifecycleState) && !g.isRented).length;
  const rented = garments.filter(g => g.lifecycleState === 'RENTED' || g.isRented).length;
  const sellReady = garments.filter(g => g.lifecycleState === 'SELL_INTENT').length;
  const inCirculation = garments.filter(g =>
    ['DECLINE', 'CIRCULATION'].includes(g.lifecycleState)
  ).length;

  return (
    <View style={styles.statsContainer}>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{owned}</Text>
          <Text style={styles.statLabel}>IN CLOSET</Text>
        </View>
        {rented > 0 ? (
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#6B46C1' }]}>{rented}</Text>
            <Text style={styles.statLabel}>ON RENTAL</Text>
          </View>
        ) : null}
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: colors.orange }]}>{sellReady}</Text>
          <Text style={styles.statLabel}>SELL READY</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: colors.navy }]}>{inCirculation}</Text>
          <Text style={styles.statLabel}>CIRCULATING</Text>
        </View>
      </View>

      {/* End-of-Life Recycling Banner */}
      <TouchableOpacity
        style={styles.recycleBanner}
        onPress={onOpenRecyclingModal}
        activeOpacity={0.8}
      >
        <View style={styles.recycleIconWrap}>
          <Ionicons name="location" size={15} color="#283618" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.recycleBannerTitle}>END-OF-LIFE TEXTILE ROUTING</Text>
          <Text style={styles.recycleBannerSub}>
            Have damaged or worn garments? View certified recycling centers near you with free doorstep pickup →
          </Text>
        </View>
      </TouchableOpacity>

      {/* Impact Multiplier Banner */}
      <View style={styles.impactBanner}>
        <View style={styles.impactIconWrap}>
          <Ionicons name="leaf" size={16} color={colors.forest} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.impactBannerTitle}>CLOSET IMPACT MULTIPLIER</Text>
          <Text style={styles.impactBannerSub}>
            Tap "I WORE THIS" to log rewearing. Each wear prevents ~0.35kg CO₂ and credits your verified Impact Dossier.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Main Component ──────────────────────────────────────────────
export function WardrobeScreen() {
  const router = useRouter();
  const [wardrobe, setWardrobe] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recyclingGarment, setRecyclingGarment] = useState<any | null>(null);
  const [showRecyclingModal, setShowRecyclingModal] = useState(false);

  const loadWardrobe = useCallback(async () => {
    try {
      const data = await cachedGet('/users/me/wardrobe');
      setWardrobe(Array.isArray(data) ? data : []);
      // Fetch fresh in background to ensure recently bought/rented items show up immediately
      fetchFresh('/users/me/wardrobe').then((fresh) => {
        if (Array.isArray(fresh)) setWardrobe(fresh);
      }).catch(() => {});
    } catch (error) {
      console.error('Failed to load wardrobe', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hapticFeedback.light();
    try {
      const data = await fetchFresh('/users/me/wardrobe');
      setWardrobe(Array.isArray(data) ? data : []);
    } catch {
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Initial mount: load cached data instantly
  useEffect(() => {
    loadWardrobe();
  }, [loadWardrobe]);

  // Screen focus: always fetch fresh wardrobe to reflect any recent purchases or rentals
  useFocusEffect(
    useCallback(() => {
      fetchFresh('/users/me/wardrobe').then((data) => {
        setWardrobe(Array.isArray(data) ? data : []);
      }).catch(() => {});
    }, [])
  );

  // On app foreground: force fresh fetch
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        fetchFresh('/users/me/wardrobe').then((data) => {
          setWardrobe(Array.isArray(data) ? data : []);
        }).catch(() => { });
      }
    });
    return () => sub.remove();
  }, []);

  const handleAction = async (action: string, itemOrId: any) => {
    const garmentId = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
    const item = typeof itemOrId === 'object' ? itemOrId : wardrobe.find((g) => g.id === garmentId);

    try {
      switch (action) {
        case 'RECYCLE_HUBS':
        case 'CIRCULAR_END':
          if (item?.isRented || item?.lifecycleState === 'RENTED') {
            Alert.alert('Rental Garment', 'This piece is an active rental on lease and cannot be routed to recycling.');
            return;
          }
          setRecyclingGarment(item);
          setShowRecyclingModal(true);
          break;

        case 'LOG_WEAR': {
          const res = await api.post('/interactions', { garmentId, eventType: 'LOG_WEAR' });
          const wearImpact = res?.data?.data?.wearImpact;
          const co2 = wearImpact?.carbonSavedKg || 0.35;
          const water = wearImpact?.waterSavedL || 120;
          const wearCountText = wearImpact?.totalWears ? ` (Worn ${wearImpact.totalWears}x)` : '';

          Alert.alert(
            'Impact Saved',
            `+${co2} kg CO₂ & +${water}L Water saved by wearing what you own${wearCountText}!\n\nYour wardrobe utilization increased and decay was reset.`
          );
          invalidateCache('/users/me/wardrobe');
          invalidateCache('/impact');
          loadWardrobe();
          break;
        }

        case 'INITIATE_RESELL':
          await api.post(`/garments/${garmentId}/initiate-resell`);
          Alert.alert('Sell Intent', 'Garment marked for resale. Go to Listings to complete the relist.');
          invalidateCache('/users/me/wardrobe');
          invalidateCache('/impact');
          loadWardrobe();
          break;

        case 'RELIST':
          await api.post(`/garments/${garmentId}/relist`);
          Alert.alert('Relisted', 'Your garment is back on the marketplace.');
          invalidateCache('/users/me/wardrobe');
          invalidateCache('/impact');
          loadWardrobe();
          break;

        case 'VIEW_RENTAL':
          if (item?.rentalId) {
            router.push('/(tabs)/rental?tab=my' as any);
          } else {
            router.push(`/(tabs)/rental/${garmentId}` as any);
          }
          break;

        case 'VIEW':
          router.push(`/(tabs)/shop/${garmentId}` as any);
          break;
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Action failed');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="DIGITAL CLOSET" showBack={true} fallbackPath="/(tabs)/profile" />

      {loading ? (
        <View style={styles.center}>
          <DossierLoading compact />
        </View>
      ) : wardrobe.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="shirt-outline" size={64} color={colors.charcoal} style={{ opacity: 0.3 }} />
          <Text style={styles.emptyTitle}>YOUR CLOSET IS EMPTY</Text>
          <Text style={styles.emptySubtext}>
            Curate your luxury collection by listing archive pieces for sale, rent, or swap, or explore the circular marketplace.
          </Text>
          <View style={styles.emptyActionButtons}>
            <TouchableOpacity
              style={styles.listEmptyBtn}
              onPress={() => router.push('/(tabs)/shop/sell')}
            >
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.listEmptyBtnText}>LIST AN ARCHIVE PIECE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shopBtn}
              onPress={() => router.push('/(tabs)/shop')}
            >
              <Text style={styles.shopBtnText}>BROWSE MARKETPLACE →</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
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
          {/* Stats & Recycling Guide Banner */}
          <WardrobeStats
            garments={wardrobe}
            onOpenRecyclingModal={() => {
              setRecyclingGarment(null);
              setShowRecyclingModal(true);
            }}
          />

          {/* Section label */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ALL ITEMS ({wardrobe.length})</Text>
            <View style={styles.legendHint}>
              <View style={[styles.legendDot, { backgroundColor: colors.forest }]} />
              <Text style={styles.legendText}>Owned</Text>
              <View style={[styles.legendDot, { backgroundColor: colors.orange }]} />
              <Text style={styles.legendText}>Sell-ready</Text>
              <View style={[styles.legendDot, { backgroundColor: colors.navy }]} />
              <Text style={styles.legendText}>Circulating</Text>
            </View>
          </View>

          {/* Grid */}
          <View style={styles.grid}>
            {wardrobe.map((item) => (
              <View key={item.id} style={styles.cardWrapper}>
                <WardrobeItemCard item={item} onAction={handleAction} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Certified Textile Recycling Hubs Guided Modal */}
      <RecyclingHubsModal
        visible={showRecyclingModal}
        onClose={() => setShowRecyclingModal(false)}
        garment={recyclingGarment}
        onSuccess={loadWardrobe}
      />
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 16 },
  scroll: { padding: 16, paddingBottom: 100 },

  // Stats
  statsContainer: { marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox: {
    flex: 1, backgroundColor: colors.white, padding: 14,
    borderWidth: 2, borderColor: colors.charcoal,
    alignItems: 'center',
    shadowColor: colors.charcoal, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  statValue: { fontSize: 32, fontFamily: typography.headings, color: colors.forest },
  statLabel: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, fontWeight: '800', marginTop: 2, letterSpacing: 1 },

  // Recycling Guide Banner
  recycleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F5ED',
    borderWidth: 1.5,
    borderColor: '#283618',
    padding: 12,
    gap: 10,
    marginBottom: 10,
    borderRadius: 4,
  },
  recycleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(40,54,24,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recycleBannerTitle: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: '#283618',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  recycleBannerSub: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.charcoal,
    lineHeight: 12,
  },

  // Impact Banner
  impactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3EFE6',
    borderWidth: 1.5,
    borderColor: colors.forest,
    padding: 12,
    gap: 10,
  },
  impactIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(40,54,24,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  impactBannerTitle: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.forest,
    letterSpacing: 1,
    marginBottom: 2,
  },
  impactBannerSub: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.charcoal,
    lineHeight: 12,
  },

  // Section header
  sectionHeader: { marginBottom: 16 },
  sectionTitle: { fontFamily: typography.mono, fontSize: 11, color: colors.charcoal, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  legendHint: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, fontWeight: '700' },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cardWrapper: { width: CARD_WIDTH },

  // Card
  card: {
    backgroundColor: colors.white,
    borderWidth: 2, borderColor: colors.charcoal,
    overflow: 'hidden',
    shadowColor: colors.charcoal, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  imageWrapper: { position: 'relative' },
  cardImage: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.bgMuted },

  // State badge
  stateBadge: {
    position: 'absolute', top: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  stateBadgeText: { color: colors.white, fontFamily: typography.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },

  // Card info
  cardInfo: { padding: 10 },
  cardBrand: { fontFamily: typography.mono, fontSize: 8, color: colors.red, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  cardTitle: { fontFamily: typography.headings, fontSize: 16, color: colors.charcoal, marginTop: 2 },
  cardStateDesc: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, marginTop: 4 },

  // Actions
  cardActions: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingBottom: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3,
    paddingVertical: 6, borderWidth: 1.5, borderColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  actionBtnText: { fontFamily: typography.mono, fontSize: 7.5, fontWeight: '900', letterSpacing: 0.5 },

  // Empty state
  emptyTitle: { fontFamily: typography.mono, fontSize: 14, color: colors.charcoal, fontWeight: '800', letterSpacing: 1, marginTop: 16, textAlign: 'center' },
  emptySubtext: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, lineHeight: 16, textAlign: 'center' },
  shopBtn: {
    backgroundColor: colors.charcoal, paddingVertical: 12, paddingHorizontal: 24,
    borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3,
  },
  shopBtnText: { color: colors.cream, fontFamily: typography.mono, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  // Empty State Actions
  emptyActionButtons: {
    gap: 10,
    alignItems: 'center',
    width: '100%',
  },
  listEmptyBtn: {
    backgroundColor: colors.crimson,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  listEmptyBtnText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
