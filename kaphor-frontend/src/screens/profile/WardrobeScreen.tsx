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
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography } from '../../theme';
import { KaphorImage } from '../../components/KaphorImage';
import { Header } from '../../components/common/Header';
import { DossierLoading } from '../../components/common/DossierLoading';
import { cachedGet, fetchFresh, invalidateCache } from '../../services/api';
import api from '../../services/api';
import { hapticFeedback } from '../../utils/haptics';
import {
  outfitExtractionService,
  ExtractedGarment,
} from '../../services/outfitExtractionService';

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
  SELL_INTENT: { label: 'SELL READY', color: colors.orange, icon: 'pricetag', description: 'Ready to be relisted' },
  DECLINE: { label: 'DECLINED', color: colors.copper, icon: 'trending-down', description: 'Showing low interest' },
  CIRCULATION: { label: 'COOLDOWN', color: colors.navy, icon: 'refresh', description: 'In circulation cooldown' },
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
  onAction: (action: string, garmentId: string) => void;
}

const WardrobeItemCard = React.memo(({ item, onAction }: WardrobeItemProps) => {
  const state = item.lifecycleState || 'OWNERSHIP';
  const config = getStateConfig(state);
  const imageUrl = item.images?.[0] || '';

  return (
    <View style={styles.card}>
      {/* Image */}
      <View style={styles.imageWrapper}>
        <KaphorImage uri={imageUrl} style={styles.cardImage} contentFit="cover" />
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
              style={[styles.actionBtn, { borderColor: colors.forest }]}
              onPress={() => onAction('LOG_WEAR', item.id)}
            >
              <Ionicons name="footsteps" size={13} color={colors.forest} />
              <Text style={[styles.actionBtnText, { color: colors.forest }]}>I WORE THIS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.charcoal }]}
              onPress={() => onAction('INITIATE_RESELL', item.id)}
            >
              <Ionicons name="pricetag" size={13} color={colors.charcoal} />
              <Text style={[styles.actionBtnText, { color: colors.charcoal }]}>SELL</Text>
            </TouchableOpacity>
          </>
        )}
        {state === 'SELL_INTENT' && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.forest, flex: 1 }]}
            onPress={() => onAction('RELIST', item.id)}
          >
            <Ionicons name="arrow-up-circle" size={14} color={colors.forest} />
            <Text style={[styles.actionBtnText, { color: colors.forest }]}>RELIST NOW</Text>
          </TouchableOpacity>
        )}
        {state === 'CIRCULATION' && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.navy, flex: 1 }]}
            onPress={() => onAction('CIRCULAR_END', item.id)}
          >
            <Ionicons name="leaf" size={14} color={colors.navy} />
            <Text style={[styles.actionBtnText, { color: colors.navy }]}>END OF LIFE</Text>
          </TouchableOpacity>
        )}
        {state === 'REUSE_UPCYCLE_RECYCLE' && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.textMuted, flex: 1, opacity: 0.6 }]}
            disabled
          >
            <Ionicons name="checkmark-done" size={14} color={colors.textMuted} />
            <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>COMPLETED</Text>
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
        {(state === 'DECLINE' || state === 'LISTED' || state === 'INTEREST') && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.charcoal, flex: 1 }]}
            onPress={() => onAction('VIEW', item.id)}
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
function WardrobeStats({ garments }: { garments: any[] }) {
  const owned = garments.filter(g => g.lifecycleState === 'OWNERSHIP').length;
  const sellReady = garments.filter(g => g.lifecycleState === 'SELL_INTENT').length;
  const inCirculation = garments.filter(g =>
    ['DECLINE', 'CIRCULATION', 'REUSE_UPCYCLE_RECYCLE'].includes(g.lifecycleState)
  ).length;

  return (
    <View style={styles.statsContainer}>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{owned}</Text>
          <Text style={styles.statLabel}>IN CLOSET</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: colors.orange }]}>{sellReady}</Text>
          <Text style={styles.statLabel}>SELL READY</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: colors.navy }]}>{inCirculation}</Text>
          <Text style={styles.statLabel}>CIRCULATING</Text>
        </View>
      </View>

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

  // ── Google Wardrobe AI Scanner State ─────────────────────────────
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStepMessage, setScanStepMessage] = useState('Analyzing outfit composition with Gemini Vision...');
  const [sourceImageUri, setSourceImageUri] = useState<string | null>(null);
  const [extractedItems, setExtractedItems] = useState<ExtractedGarment[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [savingToWardrobe, setSavingToWardrobe] = useState(false);

  const pickAndScanOutfit = async (useCamera: boolean = false) => {
    try {
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (perm.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          `Please grant ${useCamera ? 'camera' : 'photo library'} access to digitize outfits.`
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uri = result.assets[0].uri;
      setSourceImageUri(uri);
      setScannerVisible(true);
      setScanning(true);
      setExtractedItems([]);
      setSelectedItemIds(new Set());
      setScanStepMessage('Analyzing outfit composition with Gemini Vision...');

      const timer1 = setTimeout(() => {
        setScanStepMessage('Segmenting pieces & generating studio cutouts with Photoroom API...');
      }, 3500);

      const items = await outfitExtractionService.extractFromOutfit(uri);
      clearTimeout(timer1);

      setExtractedItems(items);
      setSelectedItemIds(new Set(items.map((i) => i.id)));
      hapticFeedback.success();
    } catch (err: any) {
      console.error('Extraction failed', err);
      Alert.alert(
        'Scan Notice',
        err?.response?.data?.message || err?.message || 'Unable to extract garments from this photo. Please try a clearer outfit photo.'
      );
      setScannerVisible(false);
    } finally {
      setScanning(false);
    }
  };

  const params = useLocalSearchParams<{ autoScan?: string }>();

  useEffect(() => {
    if (params?.autoScan === 'true') {
      const timer = setTimeout(() => {
        Alert.alert(
          '📸 Digitize Full Outfit',
          'Select an outfit photo or mirror selfie to extract individual pieces and studio cutouts:',
          [
            { text: 'Take Photo', onPress: () => pickAndScanOutfit(true) },
            { text: 'Choose from Library', onPress: () => pickAndScanOutfit(false) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [params?.autoScan]);

  const handleToggleSelectItem = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItemIds(next);
  };

  const handleSaveSelectedToWardrobe = async () => {
    const toSave = extractedItems.filter((item) => selectedItemIds.has(item.id));
    if (toSave.length === 0) {
      Alert.alert('Select Items', 'Please select at least one garment to add to your closet.');
      return;
    }

    setSavingToWardrobe(true);
    try {
      await outfitExtractionService.addItemsToWardrobe(toSave);
      hapticFeedback.success();
      invalidateCache('/users/me/wardrobe');
      invalidateCache('/impact');
      await loadWardrobe();
      Alert.alert(
        '✨ Added to Digital Closet!',
        `Successfully added ${toSave.length} ${toSave.length === 1 ? 'garment' : 'garments'} with studio cutouts to your personal digital wardrobe.`
      );
      setScannerVisible(false);
    } catch (err: any) {
      Alert.alert('Save Error', err?.response?.data?.message || 'Failed to save items to wardrobe.');
    } finally {
      setSavingToWardrobe(false);
    }
  };

  const handleListExtractedPiece = (item: ExtractedGarment) => {
    setScannerVisible(false);
    router.push({
      pathname: '/(tabs)/shop/sell',
      params: {
        prefillTitle: item.title,
        prefillCategory: item.category,
        prefillBrand: item.brand,
        prefillPrice: String(item.estimatedPrice),
        prefillRentalDay: String(item.suggestedRentalPriceDay),
        prefillImage: item.imageUrl,
        prefillCondition: item.condition,
        prefillFabric: item.material?.join(', ') || '',
        prefillColor: item.color?.[0] || '',
      },
    });
  };

  const loadWardrobe = useCallback(async () => {
    try {
      const data = await cachedGet('/users/me/wardrobe');
      setWardrobe(Array.isArray(data) ? data : []);
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

  const handleAction = async (action: string, garmentId: string) => {
    try {
      switch (action) {
        case 'LOG_WEAR': {
          const res = await api.post('/interactions', { garmentId, eventType: 'LOG_WEAR' });
          const wearImpact = res?.data?.data?.wearImpact;
          const co2 = wearImpact?.carbonSavedKg || 0.35;
          const water = wearImpact?.waterSavedL || 120;
          const wearCountText = wearImpact?.totalWears ? ` (Worn ${wearImpact.totalWears}x)` : '';

          Alert.alert(
            '🌱 Impact Saved!',
            `+${co2} kg CO₂ & +${water}L Water saved by wearing what you own${wearCountText}!\n\nYour wardrobe utilization increased and decay was reset.`
          );
          invalidateCache('/users/me/wardrobe');
          invalidateCache('/impact');
          loadWardrobe();
          break;
        }

        case 'INITIATE_RESELL':
          await api.post(`/garments/${garmentId}/initiate-resell`);
          Alert.alert('📦 Sell Intent', 'Garment marked for resale. Go to Listings to complete the relist.');
          invalidateCache('/users/me/wardrobe');
          invalidateCache('/impact');
          loadWardrobe();
          break;

        case 'RELIST':
          await api.post(`/garments/${garmentId}/relist`);
          Alert.alert('✅ Relisted!', 'Your garment is back on the marketplace.');
          invalidateCache('/users/me/wardrobe');
          invalidateCache('/impact');
          loadWardrobe();
          break;

        case 'CIRCULAR_END':
          Alert.alert(
            '♻️ End of Life',
            'Send this garment to the circular end-of-life path? It will be routed to reuse, upcycling, or recycling, diverting 450g of textile waste.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Send to Circular End',
                style: 'destructive',
                onPress: async () => {
                  await api.post(`/garments/${garmentId}/circular-end`);
                  Alert.alert('✅ Done!', 'Garment routed to circular end-of-life. +450g textile waste diversion credited to your Impact Dossier!');
                  invalidateCache('/users/me/wardrobe');
                  invalidateCache('/impact');
                  loadWardrobe();
                },
              },
            ]
          );
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
            Digitize your existing wardrobe from mirror selfies using AI Outfit Scanner, or browse the circular marketplace.
          </Text>
          <View style={styles.emptyActionButtons}>
            <TouchableOpacity
              style={styles.scanEmptyBtn}
              onPress={() => pickAndScanOutfit(false)}
            >
              <Ionicons name="camera" size={16} color={colors.white} />
              <Text style={styles.scanEmptyBtnText}>📸 SCAN OUTFIT WITH AI</Text>
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
          {/* AI Closet Digitizer Action Banner */}
          <View style={styles.aiBanner}>
            <View style={styles.aiBannerHeader}>
              <View style={styles.aiBannerIconWrap}>
                <Ionicons name="sparkles" size={16} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiBannerTitle}>AI CLOSET SCANNER</Text>
                <Text style={styles.aiBannerSub}>
                  Digitize outfits from mirror selfies • Segment pieces with Photoroom studio cutouts
                </Text>
              </View>
            </View>
            <View style={styles.aiBannerBtnRow}>
              <TouchableOpacity
                style={styles.aiScanBtnPrimary}
                onPress={() => pickAndScanOutfit(true)}
              >
                <Ionicons name="camera" size={14} color={colors.white} />
                <Text style={styles.aiScanBtnPrimaryText}>TAKE OUTFIT PHOTO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aiScanBtnSecondary}
                onPress={() => pickAndScanOutfit(false)}
              >
                <Ionicons name="images-outline" size={14} color={colors.charcoal} />
                <Text style={styles.aiScanBtnSecondaryText}>FROM LIBRARY</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats & Impact Multiplier */}
          <WardrobeStats garments={wardrobe} />

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

      {/* ── Google Wardrobe AI Scanner Modal ── */}
      <Modal visible={scannerVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View>
              <View style={styles.modalBadgeRow}>
                <View style={styles.geminiBadge}>
                  <Ionicons name="sparkles" size={10} color={colors.white} />
                  <Text style={styles.geminiBadgeText}>GEMINI VISION + PHOTOROOM</Text>
                </View>
              </View>
              <Text style={styles.modalTitle}>AI CLOSET SCANNER</Text>
            </View>
            <TouchableOpacity
              onPress={() => !scanning && setScannerVisible(false)}
              disabled={scanning}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={24} color={colors.charcoal} />
            </TouchableOpacity>
          </View>

          {scanning ? (
            <View style={styles.scanningContainer}>
              {sourceImageUri && (
                <View style={styles.sourcePhotoPreview}>
                  <Image source={{ uri: sourceImageUri }} style={styles.sourcePhoto} />
                  <View style={styles.scanningPulseRing} />
                </View>
              )}
              <ActivityIndicator size="large" color={colors.crimson} style={{ marginTop: 24 }} />
              <Text style={styles.scanningHeading}>EXTRACTING OUTFIT PIECES</Text>
              <Text style={styles.scanningSubtext}>{scanStepMessage}</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={styles.resultsBanner}>
                <Ionicons name="shirt" size={16} color={colors.forest} />
                <Text style={styles.resultsBannerText}>
                  FOUND {extractedItems.length} PIECES WITH STUDIO CUTOUTS
                </Text>
              </View>

              <ScrollView contentContainerStyle={styles.extractedList} showsVerticalScrollIndicator={false}>
                {extractedItems.map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  return (
                    <View key={item.id} style={[styles.extractedCard, isSelected && styles.extractedCardSelected]}>
                      <TouchableOpacity
                        style={styles.extractedCardTop}
                        onPress={() => handleToggleSelectItem(item.id)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.cutoutImageWrap}>
                          <Image source={{ uri: item.imageUrl }} style={styles.cutoutImage} resizeMode="contain" />
                          <View style={styles.photoroomTag}>
                            <Ionicons name="cut" size={9} color={colors.white} />
                            <Text style={styles.photoroomTagText}>STUDIO CUTOUT</Text>
                          </View>
                        </View>

                        <View style={styles.extractedDetails}>
                          <View style={styles.extractedCategoryRow}>
                            <Text style={styles.extractedCategory}>{item.category?.toUpperCase()}</Text>
                            <View style={[styles.selectCheckbox, isSelected && styles.selectCheckboxActive]}>
                              {isSelected && <Ionicons name="checkmark" size={14} color={colors.white} />}
                            </View>
                          </View>

                          <Text style={styles.extractedTitle} numberOfLines={2}>
                            {item.title}
                          </Text>
                          <Text style={styles.extractedBrand}>{item.brand} • {item.size || 'M'}</Text>

                          <View style={styles.extractedValuationRow}>
                            <Text style={styles.extractedValuationLabel}>EST. RESALE</Text>
                            <Text style={styles.extractedPrice}>₹{item.estimatedPrice.toLocaleString()}</Text>
                          </View>
                          <Text style={styles.extractedRentalRate}>
                            Rent: ₹{item.suggestedRentalPriceDay}/day
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.extractedCardActions}>
                        <TouchableOpacity
                          style={styles.listPieceBtn}
                          onPress={() => handleListExtractedPiece(item)}
                        >
                          <Ionicons name="pricetag-outline" size={12} color={colors.charcoal} />
                          <Text style={styles.listPieceBtnText}>LIST FOR SALE / RENT →</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Bottom Action Footer */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.saveToWardrobeBtn, (selectedItemIds.size === 0 || savingToWardrobe) && { opacity: 0.6 }]}
                  onPress={handleSaveSelectedToWardrobe}
                  disabled={selectedItemIds.size === 0 || savingToWardrobe}
                >
                  {savingToWardrobe ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="folder-open" size={16} color={colors.white} />
                      <Text style={styles.saveToWardrobeBtnText}>
                        ADD {selectedItemIds.size} {selectedItemIds.size === 1 ? 'PIECE' : 'PIECES'} TO WARDROBE
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.scanAnotherBtn}
                  onPress={() => pickAndScanOutfit(false)}
                >
                  <Text style={styles.scanAnotherBtnText}>SCAN ANOTHER PHOTO</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
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
  scanEmptyBtn: {
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
  scanEmptyBtnText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // AI Closet Digitizer Banner
  aiBanner: {
    backgroundColor: '#FAF5EE',
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  aiBannerHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  aiBannerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.crimson,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiBannerTitle: {
    fontFamily: typography.headings,
    fontSize: 16,
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  aiBannerSub: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.textMuted,
    lineHeight: 13,
    marginTop: 1,
  },
  aiBannerBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  aiScanBtnPrimary: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.charcoal,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  aiScanBtnPrimaryText: {
    color: colors.cream,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  aiScanBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  aiScanBtnSecondaryText: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  geminiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 3,
  },
  geminiBadgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  modalTitle: {
    fontFamily: typography.headings,
    fontSize: 22,
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  modalCloseBtn: {
    padding: 6,
  },

  // Scanning Progress State
  scanningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  sourcePhotoPreview: {
    width: 180,
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    position: 'relative',
  },
  sourcePhoto: {
    width: '100%',
    height: '100%',
  },
  scanningPulseRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: colors.crimson,
  },
  scanningHeading: {
    fontFamily: typography.headings,
    fontSize: 20,
    color: colors.charcoal,
    marginTop: 16,
    letterSpacing: 0.5,
  },
  scanningSubtext: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
    maxWidth: 280,
  },

  // Results State
  resultsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(30,59,47,0.06)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,59,47,0.15)',
  },
  resultsBannerText: {
    fontFamily: typography.mono,
    fontSize: 10.5,
    fontWeight: '900',
    color: colors.forest,
    letterSpacing: 0.8,
  },
  extractedList: {
    padding: 16,
    gap: 14,
    paddingBottom: 30,
  },
  extractedCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: 'rgba(30,31,34,0.2)',
    padding: 12,
  },
  extractedCardSelected: {
    borderColor: colors.charcoal,
    borderWidth: 2,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  extractedCardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  cutoutImageWrap: {
    width: 100,
    height: 120,
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  cutoutImage: {
    width: '90%',
    height: '90%',
  },
  photoroomTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(30,31,34,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  photoroomTagText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  extractedDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  extractedCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  extractedCategory: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  selectCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectCheckboxActive: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  extractedTitle: {
    fontFamily: typography.headings,
    fontSize: 16,
    color: colors.charcoal,
    marginTop: 2,
  },
  extractedBrand: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    color: colors.crimson,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  extractedValuationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  extractedValuationLabel: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    fontWeight: '800',
  },
  extractedPrice: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: colors.charcoal,
  },
  extractedRentalRate: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
  },
  extractedCardActions: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.08)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  listPieceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  listPieceBtnText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },

  // Modal Footer
  modalFooter: {
    padding: 16,
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderTopColor: colors.charcoal,
    gap: 8,
  },
  saveToWardrobeBtn: {
    backgroundColor: colors.charcoal,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  saveToWardrobeBtnText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  scanAnotherBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanAnotherBtnText: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
});
