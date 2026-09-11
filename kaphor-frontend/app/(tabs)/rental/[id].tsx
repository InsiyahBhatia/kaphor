import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { garmentService } from '../../../src/services/garmentService';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors } from '../../../src/theme';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';

export default function RentalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [garment, setGarment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useBackHandler('/(tabs)/shop');

  useEffect(() => {
    (async () => {
      try {
        const data = await garmentService.getGarmentById(id as string);
        setGarment(data);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return <DossierLoading variant="rental" />;
  }

  if (!garment) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: colors.textPrimary }}>Item not found</Text>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/shop')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={{ color: colors.crimson, marginTop: 16 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const dayRate = (garment.rentalPriceDay || 0) / 100;
  const weekRate = (garment.rentalPriceWeek || 0) / 100;
  const topInset = Math.max(insets.top + 8, 48);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <KaphorImage uri={garment.images?.[0]} style={styles.image} contentFit="cover" />
        <TouchableOpacity 
          style={[styles.backButton, { top: topInset }]} 
          onPress={() => safeBack('/(tabs)/shop')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.brand}>{garment.brand}</Text>
          <Text style={styles.title}>{garment.title}</Text>
          <Text style={styles.desc}>{garment.description}</Text>

          <View style={styles.rateCard}>
            <Text style={styles.rateTitle}>RENTAL RATES</Text>
            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>PER DAY</Text>
              <Text style={styles.rateValue}>₹{dayRate.toLocaleString()}</Text>
            </View>
            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>PER WEEK</Text>
              <Text style={styles.rateValue}>₹{weekRate.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.details}>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>SIZE</Text><Text style={styles.detailValue}>{garment.size}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>CONDITION</Text><Text style={styles.detailValue}>{garment.condition}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>CATEGORY</Text><Text style={styles.detailValue}>{garment.category}</Text></View>
          </View>


        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.reserveButton}
          onPress={() => router.push({ pathname: '/(tabs)/rental/reserve', params: { garmentId: garment.id, dayRate: String(dayRate) } })}
        >
          <Text style={styles.reserveButtonText}>RESERVE NOW</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: 420 },
  backButton: { position: 'absolute', top: 60, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  content: { padding: 24 },
  brand: { color: colors.crimson, fontSize: 12, letterSpacing: 2, fontWeight: '800' },
  title: { color: colors.textPrimary, fontSize: 32, fontFamily: 'BebasNeue_400Regular', marginTop: 4, marginBottom: 12 },
  desc: { color: colors.textSecond, fontSize: 15, lineHeight: 24, marginBottom: 24 },
  rateCard: { backgroundColor: colors.bgCard, borderRadius: 20, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  rateTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 2, marginBottom: 20 },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  rateLabel: { color: colors.textMuted, fontSize: 12, letterSpacing: 1, fontWeight: '700' },
  rateValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  details: { marginBottom: 24 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: 12, letterSpacing: 1, fontWeight: '700' },
  detailValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  impactCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, backgroundColor: 'rgba(76,175,80,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(76,175,80,0.2)', marginBottom: 100 },
  impactText: { color: '#2E7D32', fontSize: 13, flex: 1, lineHeight: 18, fontWeight: '600' },
  footer: { padding: 24, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, position: 'absolute', bottom: 0, left: 0, right: 0 },
  reserveButton: { 
    backgroundColor: colors.crimson, 
    height: 60, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  reserveButtonText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
});
