import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Router, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import { CenterCardsLoading } from '../../../src/components/common/CardLoadingScreen';
import {
  circularService,
  RecyclingCenter,
  RecyclingCentersResponse,
} from '../../../src/services/circularService';

function CenterCard({ center, router }: { center: RecyclingCenter; router: Router }) {
  return (
    <View style={styles.centerCard}>
      <View style={styles.centerTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.centerName}>{center.name}</Text>
          <Text style={styles.centerCityDist}>
            {center.city}, {center.state} • {center.distance || 'In your city'}
          </Text>
        </View>
        <View style={styles.scorePill}>
          <Ionicons name="shield-checkmark" size={12} color="#283618" />
          <Text style={styles.scoreText}>{center.zeroLandfillScore}%</Text>
        </View>
      </View>

      {center.description ? (
        <Text style={styles.centerDescription}>{center.description}</Text>
      ) : null}

      <View style={styles.metaRow}>
        <Ionicons name="navigate-outline" size={15} color={colors.textMuted} />
        <Text style={styles.metaText} numberOfLines={3}>{center.address}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={15} color={colors.textMuted} />
        <Text style={styles.metaText}>{center.operatingHours}</Text>
      </View>
      {center.phone ? (
        <View style={styles.metaRow}>
          <Ionicons name="call-outline" size={15} color={colors.emerald} />
          <Text style={[styles.metaText, { color: colors.emeraldDark, fontWeight: '800' }]}>
            {center.phone}
          </Text>
        </View>
      ) : null}

      <View style={styles.fiberTagRow}>
        {center.acceptedFibers.map((fib, idx) => (
          <View key={idx} style={styles.fiberTag}>
            <Text style={styles.fiberTagText}>{fib}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.certText} numberOfLines={2}>
        Certs: {center.certifications.join(' • ')}
      </Text>
    </View>
  );
}

export default function RecyclingCentersScreen() {
  const router = useRouter();
  const [data, setData] = useState<RecyclingCentersResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCenters();
  }, []);

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

  const nearest = (data?.centers || []).filter(
    (c) => c.isClosestMatch || (c.distance && c.distance.includes('km'))
  );
  const others = (data?.centers || []).filter(
    (c) => !c.isClosestMatch && !(c.distance && c.distance.includes('km'))
  );

  return (
    <View style={styles.screen}>
      <Header title="RECYCLING HUBS" subtitle="CERTIFIED TEXTILE RECYCLING" showBack />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Location Banner */}
        <View style={styles.locationBanner}>
          <Ionicons name="location-sharp" size={16} color={colors.emerald} />
          <Text style={styles.locationText}>
            Verified drop-off centers near{' '}
            <Text style={styles.locationBold}>{data?.userLocation?.city || 'Your Area'}</Text>
            {data?.userLocation?.pincode ? ` (${data.userLocation.pincode})` : ''}
          </Text>
        </View>

        {loading ? (
          <CenterCardsLoading count={3} />
        ) : (
          <>
            {nearest.length > 0 && (
              <View style={styles.groupHeader}>
                <Ionicons name="navigate-sharp" size={15} color={colors.emerald} />
                <Text style={styles.groupHeaderText}>
                  NEAREST TO {data?.userLocation?.city?.toUpperCase() || 'YOU'}
                </Text>
              </View>
            )}
            {nearest.length > 0 && (
              <View style={styles.centersList}>
                {nearest.map((center) => (
                  <CenterCard key={center.id} center={center} router={router} />
                ))}
              </View>
            )}

            {others.length > 0 && (
              <View style={[styles.groupHeader, { marginTop: 8 }]}>
                <Ionicons name="map-outline" size={15} color={colors.goldDark} />
                <Text style={styles.groupHeaderText}>OTHER VERIFIED HUBS (PAN-INDIA)</Text>
              </View>
            )}
            {others.length > 0 && (
              <View style={styles.centersList}>
                {others.map((center) => (
                  <CenterCard key={center.id} center={center} router={router} />
                ))}
              </View>
            )}
          </>
        )}

        {/* AI Condition Scan Promo */}
        <TouchableOpacity
          style={styles.aiScanCard}
          onPress={() => router.push('/(tabs)/circular/condition-check')}
          activeOpacity={0.85}
        >
          <Ionicons name="scan-circle-outline" size={26} color={colors.ink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.aiScanTitle}>Unsure if it can be repaired?</Text>
            <Text style={styles.aiScanSub}>
              Run our AI Multimodal Fiber & Condition Assessment to decide between Repair, Resale, or Certified Recycling →
            </Text>
          </View>
        </TouchableOpacity>

        {/* National Mail-In Free satchel */}
        <View style={styles.mailInBanner}>
          <Ionicons name="cube-outline" size={22} color={colors.emerald} />
          <View style={{ flex: 1 }}>
            <Text style={styles.mailInTitle}>Pan-India Free Mail-In Box</Text>
            <Text style={styles.mailInSub}>
              Free prepaid courier collection satchels sent anywhere across India for unwearable garments.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 48,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3FAF6',
    borderWidth: 1,
    borderColor: colors.emerald,
    padding: 12,
    borderRadius: 2,
  },
  locationText: {
    fontFamily: typography.mono,
    fontSize: 15.5,
    color: colors.ink,
    flex: 1,
    lineHeight: 16,
  },
  locationBold: {
    fontWeight: '900',
    color: colors.emeraldDark,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
  },
  groupHeaderText: {
    fontFamily: typography.monoBold,
    fontSize: 14.5,
    color: colors.ink,
    letterSpacing: 1,
  },
  centersList: {
    gap: 12,
  },
  centerCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 2,
    padding: 14,
    gap: 8,
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 0,
    elevation: 3,
  },
  centerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  centerName: {
    fontFamily: typography.headings,
    fontSize: 24.5,
    color: colors.ink,
    letterSpacing: 0.8,
  },
  centerCityDist: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.emerald,
    marginTop: 3,
  },
  centerDescription: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    color: colors.textSecond,
    lineHeight: 16,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(40,54,24,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  scoreText: {
    fontFamily: typography.monoBold,
    fontSize: 13.5,
    color: '#283618',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaText: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    color: colors.textSecond,
    flex: 1,
    lineHeight: 16,
  },
  fiberTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  fiberTag: {
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  fiberTagText: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
  },
  certText: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    color: colors.goldDark,
    fontWeight: '700',
    marginTop: 2,
    lineHeight: 14,
  },
  aiScanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7F5EE',
    borderWidth: 1.5,
    borderColor: colors.ink,
    padding: 14,
    borderRadius: 2,
  },
  aiScanTitle: {
    fontFamily: typography.monoBold,
    fontSize: 15.5,
    color: colors.ink,
  },
  aiScanSub: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    color: colors.textSecond,
    lineHeight: 15,
    marginTop: 2,
  },
  mailInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F3FAF6',
    borderWidth: 1,
    borderColor: colors.emerald,
    padding: 12,
    borderRadius: 2,
  },
  mailInTitle: {
    fontFamily: typography.monoBold,
    fontSize: 15,
    color: colors.emeraldDark,
  },
  mailInSub: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    color: colors.ink,
    lineHeight: 15,
    marginTop: 3,
  },
});