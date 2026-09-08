import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../../src/services/api';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StudioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>UPCYCLE LAB</Text>
        <Text style={styles.subtitle}>PHYSICAL RECONSTRUCTION // LEGACY DIVISION</Text>
      </View>

      <TouchableOpacity
        style={styles.bespokeCard}
        onPress={() => router.push('/(tabs)/studio/repair-refresh')}
      >
        <View style={[styles.bespokeIconBox, { backgroundColor: colors.forest }]}>
          <Ionicons name="construct-sharp" size={24} color={colors.white} />
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.bespokeTitle}>REPAIR & REFRESH</Text>
          <Text style={styles.bespokeSubtitle}>AI-powered repair guides, tutorials & upcycling ideas</Text>
        </View>
        <Ionicons name="arrow-forward-sharp" size={20} color={colors.charcoal} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.bespokeCard, { marginTop: 0 }]}
        onPress={() => router.push('/(tabs)/studio/bespoke')}
      >
        <View style={styles.bespokeIconBox}>
          <Ionicons name="flash-sharp" size={24} color={colors.white} />
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.bespokeTitle}>BESPOKE OVERRIDE</Text>
          <Text style={styles.bespokeSubtitle}>Commission a custom reconstructed asset</Text>
        </View>
        <Ionicons name="arrow-forward-sharp" size={20} color={colors.charcoal} />
      </TouchableOpacity>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>SYSTEM DOSSIERS // FIELD GUIDES</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <DossierLoading variant="studio" compact />
        </View>
      ) : tutorials.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>NO DATA AVAILABLE IN SECTOR</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {tutorials.map((t: any, idx: number) => (
            <View key={t.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardRank}>0{idx + 1}</Text>
                <Text style={styles.cardTitle}>{t.title}</Text>
              </View>
              <Text style={styles.cardDesc} numberOfLines={3}>{t.description}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingTop: 24, paddingBottom: 100 },
  header: { marginBottom: 32 },
  title: { fontSize: 48, fontFamily: typography.headings, color: colors.charcoal, letterSpacing: 2 },
  subtitle: { fontSize: 10, fontFamily: typography.mono, color: colors.red, letterSpacing: 1, fontWeight: '800', marginTop: 8 },
  
  bespokeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 40,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  bespokeIconBox: { width: 48, height: 48, backgroundColor: colors.red, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.charcoal },
  bespokeTitle: { color: colors.charcoal, fontSize: 13, fontFamily: typography.mono, fontWeight: '800', letterSpacing: 1 },
  bespokeSubtitle: { color: colors.textPrimary, fontSize: 11, fontFamily: typography.mono, marginTop: 4 },
  
  sectionHeader: { borderBottomWidth: 2, borderBottomColor: colors.charcoal, paddingBottom: 12, marginBottom: 24 },
  sectionTitle: { color: colors.charcoal, fontSize: 12, fontFamily: typography.mono, fontWeight: '800', letterSpacing: 2 },
  
  loader: { alignItems: 'center', marginTop: 60, gap: 16 },
  loadingText: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 12, fontWeight: '700' },
  
  emptyState: { alignItems: 'center', marginTop: 60, padding: 32, borderWidth: 2, borderColor: colors.charcoal, borderStyle: 'dashed' },
  emptyText: { color: colors.charcoal, fontSize: 12, fontFamily: typography.mono, fontWeight: '800', letterSpacing: 1 },
  
  grid: { gap: 20 },
  card: {
    backgroundColor: colors.white,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  cardRank: { fontSize: 32, fontFamily: typography.ranks, color: colors.red, lineHeight: 32 },
  cardTitle: { flex: 1, color: colors.charcoal, fontSize: 22, fontFamily: typography.headings, lineHeight: 26 },
  cardDesc: { color: colors.textPrimary, fontSize: 13, fontFamily: typography.accent, lineHeight: 20 },
});
