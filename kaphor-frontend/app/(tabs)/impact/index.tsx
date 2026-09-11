import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { impactService } from '../../../src/services/impactService';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';

export default function ImpactScreen() {
  const router = useRouter();
  const [impact, setImpact] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      (async () => {
        try {
          const data = await impactService.getMyImpact();
          if (isMounted) setImpact(data);
        } catch {
          if (isMounted) setImpact(null);
        } finally {
          if (isMounted) setLoading(false);
        }
      })();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  const stats = [
    { icon: 'leaf-sharp', label: 'CO₂ SAVED', value: `${(impact?.impactRecord?.carbonSavedKg || 0).toFixed(1)} KG`, color: colors.forest },
    { icon: 'water-sharp', label: 'WATER SAVED', value: `${((impact?.impactRecord?.waterSavedL || 0) / 1000).toFixed(1)} KL`, color: colors.navy },
    { icon: 'leaf', label: 'TREES SAVED', value: `${impact?.equivalentTrees || 0}`, color: colors.forest },
    { icon: 'trash-sharp', label: 'WASTE SAVED', value: `${((impact?.impactRecord?.wasteSavedG || 0) / 1000).toFixed(1)} KG`, color: colors.charcoal },
    { icon: 'swap-horizontal-sharp', label: 'CIRCULATED', value: `${impact?.impactRecord?.itemsCirculated || 0}`, color: colors.red },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>IMPACT DOSSIER</Text>
        <Text style={styles.subtitle}>VERIFIED SUSTAINABILITY RECORDS</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <DossierLoading variant="impact" compact />
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {stats.map((stat) => (
              <View key={stat.label} style={[styles.card, { borderTopColor: stat.color }]}>
                <View style={styles.cardTopRow}>
                  <Ionicons name={stat.icon as any} size={24} color={stat.color} />
                  <Text style={styles.cardLabel}>{stat.label}</Text>
                </View>
                <Text style={[styles.cardValue, { color: stat.color }]}>{stat.value}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.auditReportBtn}
            onPress={() => router.push('/(tabs)/impact/report')}
            activeOpacity={0.85}
          >
            <Ionicons name="document-text" size={18} color={colors.cream} />
            <Text style={styles.auditReportBtnText}>VIEW DETAILED AUDIT REPORT →</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingTop: 24, paddingBottom: 100 },
  header: { marginBottom: 32 },
  title: { fontSize: 48, fontFamily: typography.headings, color: colors.charcoal, letterSpacing: 2 },
  subtitle: { fontSize: 10, fontFamily: typography.mono, color: colors.red, marginTop: 8, letterSpacing: 1, fontWeight: '800' },
  
  loader: { alignItems: 'center', marginTop: 100, gap: 16 },
  loadingText: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 12, fontWeight: '700' },
  
  grid: { gap: 16 },
  card: {
    backgroundColor: colors.white,
    padding: 24,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderTopWidth: 8,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  cardValue: { fontSize: 64, fontFamily: typography.headings, lineHeight: 64 },
  cardLabel: { fontSize: 12, fontFamily: typography.mono, letterSpacing: 1, fontWeight: '800', color: colors.charcoal },
  auditReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.charcoal,
    paddingVertical: 16,
    marginTop: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  auditReportBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: 1,
  },
});
