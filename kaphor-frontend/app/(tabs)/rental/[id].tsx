import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { garmentService } from '../../../src/services/garmentService';

export default function RentalDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [garment, setGarment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color="#C9A84C" /></View>;
  }

  if (!garment) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: 'white' }}>Item not found</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: '#C9A84C', marginTop: 16 }}>Go Back</Text></TouchableOpacity>
      </View>
    );
  }

  const dayRate = (garment.rentalPriceDay || 0) / 100;
  const weekRate = (garment.rentalPriceWeek || 0) / 100;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={{ uri: garment.images?.[0] || 'https://picsum.photos/600/700' }} style={styles.image} />
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="white" />
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

          <View style={styles.impactCard}>
            <Ionicons name="leaf" size={18} color="#4CAF50" />
            <Text style={styles.impactText}>Renting saves ~90% of the environmental impact of buying new</Text>
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
  container: { flex: 1, backgroundColor: '#1A0C10' },
  center: { justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: 400 },
  backButton: { position: 'absolute', top: 60, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  content: { padding: 24 },
  brand: { color: '#C9A84C', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { color: 'white', fontSize: 26, fontFamily: 'CormorantGaramond_700Bold', marginTop: 4, marginBottom: 12 },
  desc: { color: '#6B5C52', fontSize: 14, lineHeight: 22, marginBottom: 24 },
  rateCard: { backgroundColor: '#2A1C20', borderRadius: 12, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)' },
  rateTitle: { color: '#C9A84C', fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 16 },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  rateLabel: { color: '#6B5C52', fontSize: 12, letterSpacing: 1 },
  rateValue: { color: 'white', fontSize: 16, fontWeight: '700' },
  details: { marginBottom: 24 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3A2C30' },
  detailLabel: { color: '#6B5C52', fontSize: 12, letterSpacing: 1 },
  detailValue: { color: 'white', fontSize: 14, fontWeight: '600' },
  impactCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: 'rgba(76,175,80,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(76,175,80,0.15)', marginBottom: 80 },
  impactText: { color: '#A5D6A7', fontSize: 12, flex: 1 },
  footer: { padding: 24, borderTopWidth: 1, borderTopColor: '#3A2C30', backgroundColor: '#1A0C10' },
  reserveButton: { backgroundColor: '#C9A84C', height: 56, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  reserveButtonText: { color: '#1A0C10', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
});
