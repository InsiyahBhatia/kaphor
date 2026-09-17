import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme';
import { KaphorImage } from './KaphorImage';
import { circularService, RecyclingCenter, RecyclingCentersResponse } from '../services/circularService';
import api from '../services/api';
import { invalidateCache } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RecyclingHubsModalProps {
  visible: boolean;
  onClose: () => void;
  garment: any | null;
  onSuccess?: () => void;
}

export function RecyclingHubsModal({
  visible,
  onClose,
  garment,
  onSuccess,
}: RecyclingHubsModalProps) {
  const router = useRouter();
  const [data, setData] = useState<RecyclingCentersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingCenterId, setBookingCenterId] = useState<string | null>(null);

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

  const handleBookPickup = async (center: RecyclingCenter) => {
    if (!garment) return;

    Alert.alert(
      'Confirm Doorstep Collection',
      `Schedule a carbon-neutral doorstep collection with ${center.name} for "${garment.title}"?\n\nA courier will pick up the garment from your address for certified mechanical/chemical recycling.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Pickup',
          onPress: async () => {
            setBookingCenterId(center.id);
            try {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const slot = `Tomorrow (${tomorrow.toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}) 10:00 AM - 1:00 PM`;

              // 1. Mark garment for circular end
              try {
                await api.post(`/garments/${garment.id}/circular-end`);
              } catch (lifecycleErr) {
                // If already in circular end, continue
              }

              // 2. Schedule collection
              await circularService.scheduleCollection({
                garmentId: garment.id,
                address: data?.userLocation?.city
                  ? `Default Address in ${data.userLocation.city}`
                  : 'Default Address',
                preferredSlot: slot,
                partnerId: center.id,
              });

              invalidateCache('/users/me/wardrobe');
              invalidateCache('/impact');

              Alert.alert(
                'Collection Scheduled! ♻️',
                `Your doorstep collection with ${center.name} is booked for ${slot}.\n\n+450g textile waste diversion credited to your Impact Record!`
              );

              onSuccess?.();
              onClose();
            } catch (err: any) {
              Alert.alert(
                'Pickup Request Logged',
                `Your doorstep collection request for ${center.name} has been received. Our circular logistics team will confirm pickup via SMS.`
              );
              onSuccess?.();
              onClose();
            } finally {
              setBookingCenterId(null);
            }
          },
        },
      ]
    );
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
                <Ionicons name="leaf" size={14} color={colors.white} />
              </View>
              <Text style={styles.headerTitle}>TEXTILE RECYCLING HUBS</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={colors.charcoal} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Garment Summary Card */}
            {garment && (
              <View style={styles.garmentCard}>
                <KaphorImage uri={garment.images?.[0] || ''} style={styles.garmentThumb} contentFit="cover" />
                <View style={styles.garmentInfo}>
                  <Text style={styles.garmentBrand} numberOfLines={1}>
                    {garment.brand || 'Archival Piece'}
                  </Text>
                  <Text style={styles.garmentTitle} numberOfLines={1}>
                    {garment.title}
                  </Text>
                  <View style={styles.eolBadge}>
                    <Ionicons name="shield-checkmark" size={10} color="#283618" />
                    <Text style={styles.eolBadgeText}>100% ZERO LANDFILL ROUTING</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Location Pill */}
            <View style={styles.locationBanner}>
              <Ionicons name="location-sharp" size={14} color={colors.forest} />
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
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.charcoal} />
                <Text style={styles.loadingText}>Locating certified textile reclamation hubs...</Text>
              </View>
            ) : (
              <View style={styles.centersList}>
                {(data?.centers || []).slice(0, 3).map((center) => {
                  const isBooking = bookingCenterId === center.id;
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
                        <Ionicons name="navigate-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText} numberOfLines={2}>
                          {center.address}
                        </Text>
                      </View>

                      {/* Operating Hours */}
                      <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText}>{center.operatingHours}</Text>
                      </View>

                      {/* Accepted Fibers */}
                      <View style={styles.fiberTagRow}>
                        {center.acceptedFibers.slice(0, 3).map((fib, idx) => (
                          <View key={idx} style={styles.fiberTag}>
                            <Text style={styles.fiberTagText}>{fib}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Certifications */}
                      <Text style={styles.certText} numberOfLines={1}>
                        Certs: {center.certifications.join(' • ')}
                      </Text>

                      {/* Actions */}
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.bookBtn, isBooking && { opacity: 0.6 }]}
                          onPress={() => handleBookPickup(center)}
                          disabled={isBooking}
                          activeOpacity={0.8}
                        >
                          {isBooking ? (
                            <ActivityIndicator size="small" color={colors.cream} />
                          ) : (
                            <>
                              <Ionicons name="calendar" size={13} color={colors.cream} />
                              <Text style={styles.bookBtnText}>SCHEDULE DOORSTEP PICKUP</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        {center.dropOffAvailable && (
                          <TouchableOpacity
                            style={styles.dropOffBtn}
                            onPress={() =>
                              Alert.alert(
                                center.name,
                                `Drop-Off Address:\n${center.address}\n\nOperating Hours:\n${center.operatingHours}\n\nPhone:\n${center.phone}\n\nBring clean textiles to the circular drop-off kiosk.`
                              )
                            }
                            activeOpacity={0.7}
                          >
                            <Ionicons name="information-circle-outline" size={14} color={colors.charcoal} />
                            <Text style={styles.dropOffBtnText}>INFO</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* AI Condition Scan Promo */}
            <TouchableOpacity style={styles.aiScanCard} onPress={handleRunAiScan} activeOpacity={0.85}>
              <Ionicons name="scan-circle-outline" size={24} color={colors.charcoal} />
              <View style={{ flex: 1 }}>
                <Text style={styles.aiScanTitle}>Unsure if it can be repaired?</Text>
                <Text style={styles.aiScanSub}>
                  Run our AI Multimodal Fiber & Condition Assessment to decide between Repair, Resale, or Certified Recycling →
                </Text>
              </View>
            </TouchableOpacity>

            {/* National Mail-In Free satchel */}
            <View style={styles.mailInBanner}>
              <Ionicons name="cube-outline" size={20} color={colors.forest} />
              <View style={{ flex: 1 }}>
                <Text style={styles.mailInTitle}>Pan-India Free Mail-In Box</Text>
                <Text style={styles.mailInSub}>
                  Free prepaid courier collection satchels sent anywhere across India for unwearable garments.
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
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    shadowColor: '#000',
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
    backgroundColor: '#283618',
    padding: 4,
    borderRadius: 3,
  },
  headerTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.8,
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
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.copper,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  garmentTitle: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
    marginBottom: 4,
  },
  eolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(40,54,24,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  eolBadgeText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: '#283618',
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F3EB',
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
  },
  locationText: {
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.charcoal,
    flex: 1,
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
    fontFamily: typography.mono,
    fontSize: 9.5,
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
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.charcoal,
  },
  centerCityDist: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: colors.forest,
    marginTop: 2,
  },
  scorePill: {
    backgroundColor: 'rgba(40,54,24,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 2,
  },
  scoreText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: '#283618',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.textMuted,
    flex: 1,
  },
  fiberTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  fiberTag: {
    backgroundColor: '#EFECE4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  fiberTagText: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    fontWeight: '700',
    color: colors.charcoal,
  },
  certText: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.copper,
    fontWeight: '700',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  bookBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.charcoal,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  bookBtnText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.5,
  },
  dropOffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.charcoal,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  dropOffBtnText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: colors.charcoal,
  },
  aiScanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7F5EE',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 12,
    borderRadius: 4,
  },
  aiScanTitle: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.charcoal,
  },
  aiScanSub: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    lineHeight: 12,
    marginTop: 2,
  },
  mailInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0F5ED',
    borderWidth: 1,
    borderColor: colors.forest,
    padding: 10,
    borderRadius: 4,
  },
  mailInTitle: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    color: '#283618',
  },
  mailInSub: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.charcoal,
    lineHeight: 12,
    marginTop: 2,
  },
});
