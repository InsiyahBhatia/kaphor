import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { impactService } from '../../../src/services/impactService';

export default function ImpactScreen() {
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

  const stats = [
    { icon: 'leaf', label: 'CO₂ SAVED', value: `${(impact?.carbonSavedKg || 0).toFixed(1)} kg`, color: '#4CAF50' },
    { icon: 'water', label: 'WATER SAVED', value: `${(impact?.waterSavedL || 0).toFixed(0)} L`, color: '#2196F3' },
    { icon: 'swap-horizontal', label: 'ITEMS CIRCULATED', value: `${impact?.itemsCirculated || 0}`, color: '#C9A84C' },
    { icon: 'color-palette', label: 'ITEMS UPCYCLED', value: `${impact?.itemsUpcycled || 0}`, color: '#FF9800' },
    { icon: 'refresh', label: 'ITEMS RECYCLED', value: `${impact?.itemsRecycled || 0}`, color: '#9C27B0' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Impact</Text>
        <Text style={styles.subtitle}>Track your contribution to sustainable fashion</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#C9A84C" style={{ marginTop: 60 }} />
      ) : (
        <View style={styles.grid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.card}>
              <Ionicons name={stat.icon as any} size={28} color={stat.color} />
              <Text style={[styles.cardValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.cardLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0C10' },
  content: { padding: 24, paddingBottom: 100 },
  header: { marginTop: 40, marginBottom: 32 },
  title: { fontSize: 28, fontFamily: 'CormorantGaramond_700Bold', color: '#C9A84C' },
  subtitle: { fontSize: 14, color: '#6B5C52', marginTop: 8 },
  grid: { gap: 16 },
  card: {
    backgroundColor: '#2A1C20',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.1)',
  },
  cardValue: { fontSize: 28, fontWeight: '700' },
  cardLabel: { fontSize: 11, color: '#6B5C52', letterSpacing: 1.5 },
});
