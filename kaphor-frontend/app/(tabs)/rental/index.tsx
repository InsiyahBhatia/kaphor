import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { rentalService } from '../../../src/services/rentalService';

export default function RentalScreen() {
  const router = useRouter();
  const [rentals, setRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await rentalService.getAvailableRentals();
        setRentals(Array.isArray(data) ? data : []);
      } catch {
        setRentals([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Heritage Rental</Text>
        <Text style={styles.subtitle}>Occasion-wear for the conscious curator</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#C9A84C" style={{ marginTop: 60 }} />
      ) : rentals.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#3A2C30" />
          <Text style={styles.emptyText}>NO RENTALS AVAILABLE YET</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/(tabs)/shop/index')}>
            <Text style={styles.buttonText}>BROWSE ARCHIVE</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.grid}>
          {rentals.map((item: any) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => router.push(`/(tabs)/rental/${item.id}`)}
            >
              {item.images?.[0] && (
                <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
              )}
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardPrice}>₹{item.pricePerDay}/day</Text>
            </TouchableOpacity>
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
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#3A2C30', fontSize: 14, fontWeight: '700', marginVertical: 20, letterSpacing: 2 },
  button: { backgroundColor: '#C9A84C', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 4 },
  buttonText: { color: '#1A0C10', fontWeight: '700', fontSize: 12 },
  grid: { gap: 16 },
  card: {
    backgroundColor: '#2A1C20',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.1)',
  },
  cardImage: { width: '100%', height: 200 },
  cardTitle: { fontSize: 16, color: 'white', fontWeight: '600', paddingHorizontal: 16, paddingTop: 12 },
  cardPrice: { fontSize: 14, color: '#C9A84C', paddingHorizontal: 16, paddingBottom: 12, marginTop: 4 },
});
