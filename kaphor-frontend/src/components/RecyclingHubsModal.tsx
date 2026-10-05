import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SolarIcon } from './common/SolarIcon';
import { colors, typography } from '../theme';
import { KaphorImage } from './KaphorImage';
import { CenterCardsLoading } from './common/CardLoadingScreen';
import { circularService, RecyclingCentersResponse } from '../services/circularService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RecyclingHubsModalProps {
  visible: boolean;
  onClose: () => void;
  garment: any | null;
}

export function RecyclingHubsModal({
  visible,
  onClose,
  garment,
}: RecyclingHubsModalProps) {
  const router = useRouter();
  const [data, setData] = useState<RecyclingCentersResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadCenters();
    }
  }, [visible]);

  const loadCenters = async () => {
    setLoading(true);
    try {
      const res = await circularService.getRecyclingCenters();
      setData(res);
    } catch (e) {
      console.warn('Failed to load recycling centers', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAiScan = () => {
    onClose();
    router.push('/(tabs)/circular/condition-check' as any);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrap}>
                <SolarIcon name="leaf" size={14} color={colors.white} />
              </View>
              <Text style={styles.headerTitle}>TEXTILE RECYCLING HUBS</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <SolarIcon name="close" size={22} color={colors.charcoal} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Garment Summary Card - Only display if owned eligible item */}
            {garment && !garment.isRented && garment.lifecycleState !== 'RENTED' && (
              <View style={styles.garmentCard}>
                <KaphorImage uri={garment.images?.[0] || ''} style={styles.garmentThumb} contentFit="cover" />
                <View style={styles.garmentInfo}>
                  <Text style={styles.garmentBrand} numberOfLines={1}>
                    {garment.brand || 'Saved Piece'}
                  </Text>
                  <Text style={styles.garmentTitle} numberOfLines={1}>
                    {garment.title}
                  </Text>
                  <View style={styles.eolBadge}>
                    <SolarIcon name="shield-checkmark" size={10} color={colors.goldDark} />
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.eolBadgeText}>100% ZERO LANDFILL ROUTING</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Location Pill */}
            <View style={styles.locationBanner}>
              <SolarIcon name="location-sharp" size={14} color={colors.forest} />
              <Text style={styles.locationText}>
                Nearest certified recyclers for{' '}
                <Text style={styles.locationBold}>
                  {data?.userLocation?.city || 'Your Area'}
                </Text>
                {data?.userLocation?.pincode ? ` (${data.userLocation.pincode})` : ''}
              </Text>
            </View>

            {/* Centers List */}
            {loading ? (
              <CenterCardsLoading count={3} />
            ) : (
              <View style={styles.centersList}>
                {(data?.centers || []).slice(0, 3).map((center) => {
                  return (
                    <View key={center.id} style={styles.centerCard}>
                      <View style={styles.centerTopRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.centerName}>{center.name}</Text>
                          <Text style={styles.centerCityDist}>
                            {center.city}, {center.state} • {center.distance || 'In your city'}
                          </Text>
                        </View>
                        <View style={styles.scorePill}>
                          <Text style={styles.scoreText}>{center.zeroLandfillScore}% RECOVERY</Text>
                        </View>
                      </View>

                      {/* Address */}
                      <View style={styles.metaRow}>
                        <SolarIcon name="navigate-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText} numberOfLines={2}>
                          {center.address}
                        </Text>
                      </View>

                      {/* Operating Hours */}
                      <View style={styles.metaRow}>
                        <SolarIcon name="time-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText}>{center.operatingHours}</Text>
                      </View>

                      {/* Accepted Fibers */}
                      <View style={styles.fiberTagRow}>
                        {center.acceptedFibers.slice(0, 3).map((fib, idx) => (
                          <View key={idx} style={styles.fiberTag}>
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.fiberTagText}>{fib}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Certifications */}
                      <Text style={styles.certText} numberOfLines={1}>
                        Certs: {center.certifications.join(' • ')}
                      </Text>

                      {/* Direct Hub Information & Drop-Off Protocol */}
                      <View style={styles.facilityDetailsBox}>
                        <View style={styles.detailRow}>
                          <SolarIcon name="call-outline" size={12} color={colors.forest} />
                          <Text style={styles.detailPhoneText}>Helpline: {center.phone || '+91 1800-CIRCULAR'}</Text>
                        </View>
                        <Text style={styles.dropOffInstructions}>
                          Drop-Off Depot: Bring clean post-consumer textiles directly to the facility reception. Garments are mechanically shredded or chemically converted into recycled yarn.
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* AI Condition Scan Promo */}
            <TouchableOpacity style={styles.aiScanCard} onPress={handleRunAiScan} activeOpacity={0.85}>
              <SolarIcon name="scan-circle-outline" size={24} color={colors.charcoal} />
              <View style={{ flex: 1 }}>
                <Text style={styles.aiScanTitle}>Unsure if it can be repaired?</Text>
                <Text style={styles.aiScanSub}>
                  Run our AI Multimodal Fiber & Condition Assessment to decide between Repair, Resale, or Certified Recycling →
                </Text>
              </View>
            </TouchableOpacity>

            {/* National Mail-In Free satchel */}
            <View style={styles.mailInBanner}>
              <SolarIcon name="cube-outline" size={20} color={colors.forest} />
              <View style={{ flex: 1 }}>
                <Text style={styles.mailInTitle}>Pan-India Free Mail-In Box</Text>
                <Text style={styles.mailInSub}>
                  Free prepaid bags sent anywhere in India for clothes that cannot be worn.
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: Math.min(SCREEN_WIDTH - 32, 420),
    maxHeight: '88%',
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderRadius: 6,
    shadowColor: colors.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconWrap: {
    backgroundColor: colors.goldDark,
    padding: 4,
    borderRadius: 3,
  },
  headerTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 20,
    color: colors.charcoal,
  },
  scrollContent: {
    padding: 14,
    gap: 12,
  },
  garmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
  },
  garmentThumb: {
    width: 44,
    height: 48,
    borderRadius: 3,
    backgroundColor: colors.cream,
  },
  garmentInfo: {
    flex: 1,
  },
  garmentBrand: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 18,
    color: colors.copper,
  },
  garmentTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 19,
    color: colors.charcoal,
    marginBottom: 4,
  },
  eolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.emeraldLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  eolBadgeText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.goldDark,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.paper,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.overlayLight,
  },
  locationText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 19,
    color: colors.charcoal,
    flex: 1,
    lineHeight: 24,
  },
  locationBold: {
    fontWeight: '900',
    color: colors.forest,
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 19,
    color: colors.textMuted,
  },
  centersList: {
    gap: 10,
  },
  centerCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 12,
    borderRadius: 4,
    gap: 6,
  },
  centerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  centerName: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 20,
    color: colors.charcoal,
  },
  centerCityDist: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.forest,
    marginTop: 2,
  },
  scorePill: {
    backgroundColor: colors.emeraldLight,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 2,
  },
  scoreText: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: colors.goldDark,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 18,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 23,
  },
  fiberTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  fiberTag: {
    backgroundColor: colors.paper,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 2,
  },
  fiberTagText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 19,
    color: colors.charcoal,
  },
  certText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 18,
    color: colors.copper,
    marginTop: 2,
    lineHeight: 23,
  },
  facilityDetailsBox: {
    backgroundColor: colors.paperLight,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    borderRadius: 3,
    padding: 8,
    marginTop: 4,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailPhoneText: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.forest,
  },
  dropOffInstructions: {
    fontFamily: typography.body,
    fontSize: 16,
    color: colors.charcoal,
    lineHeight: 17,
  },
  aiScanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.paperLight,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 12,
    borderRadius: 4,
  },
  aiScanTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 20,
    color: colors.charcoal,
  },
  aiScanSub: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 18,
    color: colors.textMuted,
    lineHeight: 23,
    marginTop: 2,
  },
  mailInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.forest,
    padding: 10,
    borderRadius: 4,
  },
  mailInTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 19,
    color: colors.goldDark,
  },
  mailInSub: {
    fontFamily: typography.handwritten,
    includeFontPadding: false,
    fontSize: 18,
    color: colors.charcoal,
    lineHeight: 23,
    marginTop: 2,
  },
});
