import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { impactService } from '../../../src/services/impactService';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import { RecyclingHubsModal } from '../../../src/components/RecyclingHubsModal';

export default function CircularScreen() {
  const router = useRouter();
  const [impactData, setImpactData] = useState<any>(null);
  const [showRecyclingModal, setShowRecyclingModal] = useState(false);

  useEffect(() => {
    impactService
      .getMyImpact()
      .then((data) => setImpactData(data))
      .catch(() => setImpactData(null));
  }, []);

  const carbonSaved = impactData?.impactRecord?.carbonSavedKg ?? 13.1;
  const waterSaved = impactData?.impactRecord?.waterSavedL ?? 3040;
  const itemsCirculated = impactData?.impactRecord?.itemsCirculated ?? 12;

  const circularActions = [
    {
      id: 'sell',
      title: 'SELL ITEM',
      subtitle: 'List pre-loved archive',
      icon: 'pricetag-sharp' as const,
      color: colors.ink,
      onPress: () => router.push('/(tabs)/shop/sell'),
    },
    {
      id: 'rent',
      title: 'RENT CLOTHES',
      subtitle: 'Occasion & couture lease',
      icon: 'time-sharp' as const,
      color: '#6B46C1',
      onPress: () => router.push('/(tabs)/rental'),
    },
    {
      id: 'swap',
      title: 'SWAP ITEMS',
      subtitle: 'Cashless trade vault',
      icon: 'swap-horizontal-sharp' as const,
      color: '#8C6D3B',
      onPress: () => router.push('/(tabs)/swap'),
    },
    {
      id: 'repair',
      title: 'REPAIR & REFRESH',
      subtitle: 'Atelier restoration & care',
      icon: 'color-palette-sharp' as const,
      color: colors.terracotta || '#C85A32',
      onPress: () => router.push('/(tabs)/studio/repair-refresh'),
    },
    {
      id: 'condition',
      title: 'CONDITION SCAN',
      subtitle: 'AI fiber wear check',
      icon: 'scan-sharp' as const,
      color: '#2563EB',
      onPress: () => router.push('/(tabs)/circular/condition-check'),
    },
    {
      id: 'recycle',
      title: 'RECYCLING HUBS',
      subtitle: 'Zero-landfill centers & pickup',
      icon: 'leaf-sharp' as const,
      color: colors.forest || '#1E3B2F',
      badge: 'HUBS',
      onPress: () => setShowRecyclingModal(true),
    },
    {
      id: 'ai',
      title: 'AI STYLIST & CARE',
      subtitle: 'Instant curation chat',
      icon: 'sparkles-sharp' as const,
      color: '#4F46E5',
      onPress: () => router.push('/(tabs)/studio/chat'),
    },
    {
      id: 'impact',
      title: 'ECO DOSSIER',
      subtitle: 'Sustainability metrics',
      icon: 'analytics-sharp' as const,
      color: '#059669',
      onPress: () => router.push('/(tabs)/impact'),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <Header title="CIRCULAR HUB" />

      <View style={styles.container}>
        {/* Compact Eco Impact Strip */}
        <TouchableOpacity
          style={styles.impactStrip}
          onPress={() => router.push('/(tabs)/impact')}
          activeOpacity={0.88}
        >
          <View style={styles.impactStripCol}>
            <Text style={styles.impactStripNum}>
              {typeof carbonSaved === 'number' ? carbonSaved.toFixed(1) : carbonSaved}
              <Text style={styles.impactStripUnit}> kg</Text>
            </Text>
            <Text style={styles.impactStripLbl}>CO₂ SAVED</Text>
          </View>
          <View style={styles.impactDivider} />
          <View style={styles.impactStripCol}>
            <Text style={styles.impactStripNum}>
              {typeof waterSaved === 'number' ? waterSaved.toLocaleString() : waterSaved}
              <Text style={styles.impactStripUnit}> L</Text>
            </Text>
            <Text style={styles.impactStripLbl}>WATER SAVED</Text>
          </View>
          <View style={styles.impactDivider} />
          <View style={styles.impactStripCol}>
            <Text style={styles.impactStripNum}>
              {itemsCirculated}
              <Text style={styles.impactStripUnit}> pcs</Text>
            </Text>
            <Text style={styles.impactStripLbl}>CIRCULATED</Text>
          </View>
          <View style={styles.impactStripLink}>
            <Ionicons name="arrow-forward" size={14} color={colors.ink} />
          </View>
        </TouchableOpacity>

        {/* 2-Column Balanced Compact Grid - All in 1 screen */}
        <View style={styles.gridContainer}>
          {circularActions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.actionCard}
              onPress={item.onPress}
              activeOpacity={0.85}
            >
              <View style={[styles.actionIconBox, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon} size={18} color={colors.white} />
              </View>
              <View style={styles.actionTextBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.actionTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.badge ? (
                    <View style={styles.actionMiniBadge}>
                      <Text style={styles.actionMiniBadgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.actionSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgba(0,0,0,0.3)" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Direct Recycling Centers Info Link */}
        <TouchableOpacity
          style={styles.recyclingBanner}
          onPress={() => setShowRecyclingModal(true)}
          activeOpacity={0.88}
        >
          <View style={styles.recyclingBannerLeft}>
            <Ionicons name="location-sharp" size={14} color={colors.forest || '#1E3B2F'} />
            <Text style={styles.recyclingBannerText}>
              Find 15+ Verified Textile Recycling Hubs Across India
            </Text>
          </View>
          <Text style={styles.recyclingBannerAction}>VIEW MAP →</Text>
        </TouchableOpacity>
      </View>

      {/* Full Recycling Centers Directory Modal */}
      <RecyclingHubsModal
        visible={showRecyclingModal}
        onClose={() => setShowRecyclingModal(false)}
        garment={null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  // Compact Eco Impact Strip
  impactStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 2,
  },
  impactStripCol: {
    flex: 1,
    alignItems: 'center',
  },
  impactStripNum: {
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '900',
    color: colors.ink,
  },
  impactStripUnit: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
  },
  impactStripLbl: {
    fontFamily: typography.mono,
    fontSize: 7.5,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  impactDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  impactStripLink: {
    paddingLeft: 4,
    paddingRight: 2,
  },

  // 2-Column Grid
  gridContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignContent: 'stretch',
  },
  actionCard: {
    width: '48.5%',
    flexGrow: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 2,
  },
  actionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextBox: {
    flex: 1,
  },
  actionTitle: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 0.4,
  },
  actionSubtitle: {
    fontFamily: typography.mono,
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 1,
  },
  actionMiniBadge: {
    backgroundColor: '#DEF7EC',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  actionMiniBadgeText: {
    fontFamily: typography.mono,
    fontSize: 7,
    fontWeight: '900',
    color: '#03543F',
  },

  // Bottom Recycling Banner
  recyclingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F1',
    borderWidth: 1,
    borderColor: colors.forest || '#1E3B2F',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 8,
    marginBottom: 80,
  },
  recyclingBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  recyclingBannerText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    color: colors.ink,
    fontWeight: '700',
  },
  recyclingBannerAction: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.forest || '#1E3B2F',
  },
});
