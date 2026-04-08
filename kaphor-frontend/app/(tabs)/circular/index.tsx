import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { impactService } from '../../../src/services/impactService';
import { colors, typography } from '../../../src/theme';

export default function CircularScreen() {
  const router = useRouter();
  const [impact, setImpact] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await impactService.getMyImpact();
        setImpact(data);
      } catch {
        setImpact(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>MY IMPACT</Text>
        <Text style={styles.subtitle}>TRACK YOUR SUSTAINABILITY JOURNEY</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.red} style={{ marginVertical: 20 }} />
      ) : (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statLine}>{impact?.itemsCirculated || 0}</Text>
            <Text style={styles.statLabel}>ITEMS SHARED</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.red }]}>
            <Text style={[styles.statLine, { color: colors.white }]}>{(impact?.carbonSavedKg || 0).toFixed(1)}</Text>
            <Text style={[styles.statLabel, { color: colors.white }]}>KG CARBON SAVED</Text>
          </View>
        </View>
      )}

      <View style={styles.options}>
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
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    height: 110,
    backgroundColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  statLine: {
    fontSize: 42,
    fontFamily: typography.headings,
    color: colors.cream,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: typography.mono,
    color: 'rgba(245, 240, 232, 0.7)',
    marginTop: 4,
    letterSpacing: 2,
    fontWeight: '800',
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
});
