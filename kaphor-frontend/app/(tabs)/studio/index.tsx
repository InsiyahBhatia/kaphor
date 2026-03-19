import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../../src/services/api';

export default function StudioScreen() {
  const router = useRouter();
  const [tutorials, setTutorials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/studio/tutorials');
        setTutorials(Array.isArray(data.data) ? data.data : []);
      } catch {
        setTutorials([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Upcycle Studio</Text>
        <Text style={styles.subtitle}>Redesign your legacy pieces</Text>
      </View>

      <TouchableOpacity
        style={styles.bespokeCard}
        onPress={() => router.push('/(tabs)/studio/bespoke')}
      >
        <Ionicons name="sparkles" size={24} color="#C9A84C" />
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.bespokeTitle}>BESPOKE REQUEST</Text>
          <Text style={styles.bespokeSubtitle}>Commission a custom upcycled piece</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6B5C52" />
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>TUTORIALS</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#C9A84C" style={{ marginTop: 40 }} />
      ) : tutorials.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="brush-outline" size={48} color="#3A2C30" />
          <Text style={styles.emptyText}>TUTORIALS COMING SOON</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {tutorials.map((t: any) => (
            <View key={t.id} style={styles.card}>
              <Text style={styles.cardTitle}>{t.title}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{t.description}</Text>
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
  header: { marginTop: 40, marginBottom: 24 },
  title: { fontSize: 28, fontFamily: 'CormorantGaramond_700Bold', color: '#C9A84C' },
  subtitle: { fontSize: 14, color: '#6B5C52', marginTop: 8 },
  bespokeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A1C20',
    padding: 20,
    borderRadius: 12,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.2)',
  },
  bespokeTitle: { color: '#C9A84C', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  bespokeSubtitle: { color: '#6B5C52', fontSize: 12, marginTop: 4 },
  sectionTitle: { color: '#6B5C52', fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 16 },
  emptyState: { alignItems: 'center', marginTop: 40, gap: 12 },
  emptyText: { color: '#3A2C30', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  grid: { gap: 12 },
  card: {
    backgroundColor: '#2A1C20',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.1)',
  },
  cardTitle: { color: 'white', fontSize: 16, fontWeight: '600' },
  cardDesc: { color: '#6B5C52', fontSize: 13, marginTop: 4 },
});
