import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { impactService } from '../../../src/services/impactService';
import { colors, typography } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';

export default function CircularScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Impact calculation removed for performance
    setLoading(false);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="CIRCULAR HUB" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={{ height: 20 }} />

      <View style={styles.options}>
        {/* AI Stylist & Care Chat */}
        <TouchableOpacity 
          style={styles.card} 
          onPress={() => router.push('/(tabs)/studio/chat')}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="sparkles" size={26} color={colors.charcoal} />
          </View>
          <View style={styles.cardContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.cardTitle}>KAPHOR AI ADVISOR</Text>
              <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
            </View>
            <Text style={styles.cardText}>Instant style suggestions, fabric care & garment guidance</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.charcoal} />
        </TouchableOpacity>

        {/* AI Condition Check */}
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/circular/condition-check')}>
          <View style={styles.cardIcon}><Ionicons name="scan-sharp" size={28} color={colors.charcoal} /></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>CONDITION SCAN</Text>
            <Text style={styles.cardText}>Use our AI to check the state of your items</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.charcoal} />
        </TouchableOpacity>

        {/* Sell */}
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/shop/sell')}>
          <View style={styles.cardIcon}><Ionicons name="pricetag-sharp" size={28} color={colors.charcoal} /></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>SELL ITEM</Text>
            <Text style={styles.cardText}>List your clothes on the marketplace</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.charcoal} />
        </TouchableOpacity>

        {/* Rental */}
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/rental')}>
          <View style={styles.cardIcon}><Ionicons name="time-sharp" size={28} color={colors.charcoal} /></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>RENT CLOTHES</Text>
            <Text style={styles.cardText}>Borrow fashion items for a short time</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.charcoal} />
        </TouchableOpacity>

        {/* Swap */}
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/swap')}>
          <View style={styles.cardIcon}><Ionicons name="swap-horizontal-sharp" size={28} color={colors.charcoal} /></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>SWAP ITEMS</Text>
            <Text style={styles.cardText}>Trade clothes directly with other users</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.charcoal} />
        </TouchableOpacity>

        {/* Upcycle */}
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/studio')}>
          <View style={styles.cardIcon}><Ionicons name="color-palette-sharp" size={28} color={colors.charcoal} /></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>REPAIR & REFRESH</Text>
            <Text style={styles.cardText}>Give your old clothes a new life</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.charcoal} />
        </TouchableOpacity>

        {/* Impact */}
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/impact')}>
          <View style={styles.cardIcon}><Ionicons name="leaf-sharp" size={28} color={colors.charcoal} /></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>MY ECO RECORDS</Text>
            <Text style={styles.cardText}>View your full sustainability history</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.charcoal} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 48,
    fontFamily: typography.headings,
    color: colors.charcoal,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 10,
    fontFamily: typography.mono,
    color: colors.red,
    marginTop: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statsContainer: {
    marginBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  statCardHalf: {
    flex: 1,
    backgroundColor: colors.charcoal,
    padding: 12,
    borderWidth: 2,
    borderColor: colors.charcoal,
    position: 'relative',
    height: 90,
    justifyContent: 'center',
  },
  statRank: {
    position: 'absolute',
    top: 6,
    left: 6,
    fontFamily: typography.ranks,
    color: colors.cream,
    fontSize: 16,
  },
  statLabel: {
    fontFamily: typography.mono,
    color: colors.red,
    fontSize: 10,
    marginBottom: 2,
    marginTop: 12,
  },
  statValue: {
    fontFamily: typography.headings,
    color: colors.white,
    fontSize: 32,
    lineHeight: 32,
  },
  statSub: {
    fontFamily: typography.mono,
    color: 'rgba(245, 240, 232, 0.5)',
    fontSize: 10,
  },
  statCardFull: {
    backgroundColor: colors.red,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    position: 'relative',
    height: 100,
    justifyContent: 'center',
  },
  statRankFull: {
    position: 'absolute',
    top: 6,
    left: 6,
    fontFamily: typography.ranks,
    color: colors.white,
    fontSize: 16,
  },
  statLabelFull: {
    fontFamily: typography.mono,
    color: colors.white,
    fontSize: 12,
    marginBottom: 0,
    marginTop: 12,
  },
  statValueFull: {
    fontFamily: typography.headings,
    color: colors.white,
    fontSize: 44,
    lineHeight: 44,
  },
  statSubFull: {
    fontFamily: typography.mono,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
  },
  options: {
    gap: 16,
    marginBottom: 40,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: 20,
    gap: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  cardIcon: {
    width: 56,
    height: 56,
    backgroundColor: colors.bgMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: colors.charcoal,
    fontFamily: typography.mono,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardText: {
    color: colors.textPrimary,
    fontFamily: typography.mono,
    fontSize: 10,
    marginTop: 6,
    lineHeight: 16,
  },
  aiBadge: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    fontFamily: typography.mono,
    letterSpacing: 0.5,
  },
});
