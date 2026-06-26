import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { rentalService } from '../../../src/services/rentalService';
import { PlayingCard } from '../../../src/components/PlayingCard';
import { colors, typography } from '../../../src/theme';

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
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Text style={styles.title}>RENTAL HUB</Text>
        </View>
        <Text style={styles.subtitle}>SHORT-TERM ASSET LEASING</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.red} />
          <Text style={styles.loadingText}>SCANNING ARCHIVE...</Text>
        </View>
      ) : rentals.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-sharp" size={48} color={colors.charcoal} />
          <Text style={styles.emptyText}>NO LEASABLE ASSETS FOUND</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/(tabs)/shop')}>
            <Text style={styles.buttonText}>RETURN TO DECK →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.grid}>
            {rentals.map((item: any, index: number) => {
              const suits: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];
              const ranks = ['K', 'Q', 'J', '10', '9'];
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.cardWrapper}
                  onPress={() => router.push(`/(tabs)/shop/${item.id}` as any)}
                >
                  <PlayingCard
                    rank={ranks[index % ranks.length]}
                    suit={suits[index % 4]}
                    productName={item.title}
                    size="OS"
                    category={item.category}
                    subCategory={item.subCategory}
                    price={item.rentalPriceDay ? item.rentalPriceDay / 100 : 0}
                    imageUrl={item.images?.[0]}
                    condition="Pristine"
                    buttonText="Request Lease"
                    onSwapRequest={() => router.push(`/(tabs)/rental/${item.id}` as any)}
                    style={{ width: '100%' }}
                  />
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    paddingTop: 24, paddingHorizontal: 20, marginBottom: 20,
    borderBottomWidth: 2, borderBottomColor: colors.charcoal,
    paddingBottom: 20, backgroundColor: colors.cream,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 48, fontFamily: typography.headings, color: colors.charcoal, letterSpacing: 2 },
  subtitle: { fontFamily: typography.mono, fontSize: 10, color: colors.red, fontWeight: '800', letterSpacing: 1 },
  
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: typography.mono, fontSize: 12, color: colors.charcoal, letterSpacing: 1 },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: 20 },
  emptyText: { color: colors.charcoal, fontSize: 12, fontFamily: typography.mono, fontWeight: '800', marginVertical: 24, letterSpacing: 2 },
  button: { 
    backgroundColor: colors.charcoal, paddingHorizontal: 28, paddingVertical: 14, 
    borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0
  },
  buttonText: { color: colors.cream, fontFamily: typography.mono, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' },
  cardWrapper: { width: '48%', marginBottom: 24 },
  cardActions: { marginTop: -2, borderWidth: 2, borderColor: colors.charcoal, backgroundColor: colors.cream },
  leaseBtn: { paddingVertical: 10, alignItems: 'center' },
  leaseBtnText: { fontFamily: typography.mono, fontSize: 11, color: colors.charcoal, fontWeight: '800', letterSpacing: 1 },
});
