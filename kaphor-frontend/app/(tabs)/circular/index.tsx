import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { impactService } from '../../../src/services/impactService';

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
        <Text style={styles.title}>Circular Hub</Text>
        <Text style={styles.subtitle}>Extend the life of your luxury pieces</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#C9A84C" style={{ marginVertical: 20 }} />
      ) : (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statLine}>{impact?.itemsCirculated || 0}</Text>
            <Text style={styles.statLabel}>CIRCULATED</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLine}>{(impact?.carbonSavedKg || 0).toFixed(1)}</Text>
            <Text style={styles.statLabel}>KG CO₂ SAVED</Text>
          </View>
        </View>
      )}

      <View style={styles.options}>
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/shop/sell')}>
          <View style={styles.cardIcon}><Ionicons name="pricetag-outline" size={28} color="#C9A84C" /></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>SELL ON KAPHOR</Text>
            <Text style={styles.cardText}>List your garments for sale</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6B5C52" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/rental')}>
          <View style={styles.cardIcon}><Ionicons name="time-outline" size={28} color="#C9A84C" /></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>HERITAGE RENTAL</Text>
            <Text style={styles.cardText}>Rent occasion-wear sustainably</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6B5C52" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/swap')}>
          <View style={styles.cardIcon}><Ionicons name="swap-horizontal-outline" size={28} color="#C9A84C" /></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>SWAP & TRADE</Text>
            <Text style={styles.cardText}>Exchange accessories with others</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6B5C52" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/studio')}>
          <View style={styles.cardIcon}><Ionicons name="color-palette-outline" size={28} color="#C9A84C" /></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>UPCYCLE STUDIO</Text>
            <Text style={styles.cardText}>Redesign legacy pieces into new heirlooms</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6B5C52" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/impact')}>
          <View style={styles.cardIcon}><Ionicons name="leaf-outline" size={28} color="#C9A84C" /></View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>MY IMPACT</Text>
            <Text style={styles.cardText}>View your full sustainability dashboard</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6B5C52" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0C10',
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: 'CormorantGaramond_700Bold',
    color: '#C9A84C',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B5C52',
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    height: 100,
    backgroundColor: '#2A1C20',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.2)',
  },
  statLine: {
    fontSize: 24,
    fontFamily: 'CormorantGaramond_700Bold',
    color: '#C9A84C',
  },
  statLabel: {
    fontSize: 10,
    color: '#6B5C52',
    marginTop: 4,
    letterSpacing: 2,
  },
  options: {
    gap: 16,
    marginBottom: 40,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#2A1C20',
    borderRadius: 12,
    padding: 20,
    gap: 20,
    alignItems: 'center',
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(201, 168, 76, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: '#C9A84C',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardText: {
    color: '#6B5C52',
    fontSize: 12,
    marginTop: 4,
  },
});
