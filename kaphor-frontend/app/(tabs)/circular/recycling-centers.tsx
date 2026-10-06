import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Router, useRouter } from 'expo-router';
import { SolarIcon } from '../../../src/components/common/SolarIcon';
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
          <SolarIcon name="shield-checkmark" size={12} color={colors.emeraldDark} />
          <Text style={styles.scoreText}>{center.zeroLandfillScore}%</Text>
        </View>
      </View>

      {center.description ? (
        <Text style={styles.centerDescription}>{center.description}</Text>
      ) : null}

      <View style={styles.metaRow}>
        <SolarIcon name="navigate-outline" size={15} color={colors.textMuted} />
        <Text style={styles.metaText} numberOfLines={3}>{center.address}</Text>
      </View>
      <View style={styles.metaRow}>
        <SolarIcon name="time-outline" size={15} color={colors.textMuted} />
        <Text style={styles.metaText}>{center.operatingHours}</Text>
      </View>
      {center.phone ? (
        <View style={styles.metaRow}>
          <SolarIcon name="call-outline" size={15} color={colors.emerald} />
          <Text style={[styles.metaText, { color: colors.emeraldDark, fontWeight: '800' }]}>
            {center.phone}
          </Text>
        </View>
      ) : null}

      <View style={styles.fiberTagRow}>
        {center.acceptedFibers.map((fib, idx) => (
          <View key={idx} style={styles.fiberTag}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.fiberTagText}>{fib}</Text>
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
    // Cache-first: show the last known list immediately, refresh in the background
    const cached = await circularService.peekRecyclingCenters();
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
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
      <Header title="Recycling hubs" subtitle="Certified textile recycling" showBack />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Location Banner */}
        <View style={styles.locationBanner}>
          <SolarIcon name="location-sharp" size={16} color={colors.emerald} />
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
                <SolarIcon name="navigate-sharp" size={15} color={colors.emerald} />
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
                <SolarIcon name="map-outline" size={15} color={colors.goldDark} />
                <Text style={styles.groupHeaderText}>Other verified hubs (PAN-India)</Text>
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
          <SolarIcon name="scan-circle-outline" size={26} color={colors.ink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.aiScanTitle}>Unsure if it can be repaired?</Text>
            <Text style={styles.aiScanSub}>
              Use our AI check to decide: repair, resell or recycle →
            </Text>
          </View>
        </TouchableOpacity>

        {/* National Mail-In Free satchel */}
        <View style={styles.mailInBanner}>
          <SolarIcon name="cube-outline" size={22} color={colors.emerald} />
          <View style={{ flex: 1 }}>
            <Text style={styles.mailInTitle}>Pan-India Free Mail-In Box</Text>
            <Text style={styles.mailInSub}>
              Free prepaid bags sent anywhere in India for clothes you cannot wear.
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
    backgroundColor: colors.emeraldLight,
    borderWidth: 1,
    borderColor: colors.emerald,
    padding: 12,
    borderRadius: 2,
  },
  locationText: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.ink,
    flex: 1,
    lineHeight: 18,
    includeFontPadding: false,
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
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.ink,
    includeFontPadding: false,
  },
  centersList: {
    gap: 12,
  },
  centerCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 2,
    padding: 14,
    gap: 8,
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 2,
  },
  centerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  centerName: {
    fontFamily: typography.headings,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  centerCityDist: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    color: colors.emerald,
    marginTop: 2,
    includeFontPadding: false,
  },
  centerDescription: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.textSecond,
    lineHeight: 18,
    includeFontPadding: false,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.overlayLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 2,
  },
  scoreText: {
    fontFamily: typography.monoBold,
    fontSize: 11,
    color: colors.emeraldDark,
    includeFontPadding: false,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textSecond,
    flex: 1,
    lineHeight: 17,
    includeFontPadding: false,
  },
  fiberTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  fiberTag: {
    backgroundColor: colors.bgMuted,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 2,
  },
  fiberTagText: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.ink,
    includeFontPadding: false,
  },
  certText: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.goldDark,
    marginTop: 2,
    lineHeight: 16,
    includeFontPadding: false,
  },
  aiScanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.paperLight,
    borderWidth: 1.5,
    borderColor: colors.ink,
    padding: 12,
    borderRadius: 2,
  },
  aiScanTitle: {
    fontFamily: typography.bodyBold,
    fontSize: 14,
    color: colors.ink,
    includeFontPadding: false,
  },
  aiScanSub: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textSecond,
    lineHeight: 16,
    marginTop: 2,
    includeFontPadding: false,
  },
  mailInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.emeraldLight,
    borderWidth: 1,
    borderColor: colors.emerald,
    padding: 12,
    borderRadius: 2,
  },
  mailInTitle: {
    fontFamily: typography.bodyBold,
    fontSize: 14,
    color: colors.emeraldDark,
    includeFontPadding: false,
  },
  mailInSub: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.ink,
    lineHeight: 16,
    marginTop: 2,
    includeFontPadding: false,
  },
});