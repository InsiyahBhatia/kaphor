import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useGarmentStore } from '../../../src/store/garmentStore';
import { PlayingCard } from '../../../src/components/PlayingCard';
import { LoadingSkeleton } from '../../../src/components/common/LoadingSkeleton';
import { colors, typography } from '../../../src/theme';

export default function SwapFeedScreen() {
  const router = useRouter();
  const { garments, isLoading, fetchGarments } = useGarmentStore();

  useEffect(() => {
    fetchGarments();
  }, []);

  // The backend determines true swap eligibility via garment listings not marked internal-sale
  const swappableItems = garments.filter(g => (g as any).forSale !== true);

  return (
    <View style={styles.container}>
      {/* Brutalist Header */}
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Text style={styles.title}>SWAP TERMINAL</Text>
        </View>
        <Text style={styles.subtitle}>EXCHANGE OPERATIONS // GLOBAL PEER-TO-PEER</Text>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <LoadingSkeleton height={300} width="48%" style={{ marginBottom: 16 }} />
          <LoadingSkeleton height={300} width="48%" style={{ marginBottom: 16 }} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.grid}>
            {/* If very few specific swap items, just map all for visual demo */}
            {(swappableItems.length > 0 ? swappableItems : garments).map((item, index) => {
              const suits: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];
              const ranks = ['J', 'Q', 'K', 'A', '8', '7'];

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.cardWrapper}
                  onPress={() => router.push(`/(tabs)/swap/${item.id}` as any)}
                >
                  <PlayingCard
                    rank={ranks[index % ranks.length]}
                    suit={suits[index % 4]}
                    productName={item.title}
                    size="M"
                    price={item.price ? item.price / 100 : 0}
                    matchPercent={Math.floor(Math.random() * 20) + 70}
                    imageUrl={item.images[0]}
                    flavorText="eligible for exchange"
                    style={{ width: '100%' }}
                  />
                  <View style={styles.cardActions}>
                    <View style={styles.swapBtn}>
                      <Text style={styles.swapBtnText}>REQUEST SWAP →</Text>
                    </View>
                  </View>
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
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    paddingTop: 24,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: colors.charcoal,
    paddingBottom: 20,
    backgroundColor: colors.cream,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 48,
    fontFamily: typography.headings,
    color: colors.charcoal,
    letterSpacing: 2,
  },
  subtitle: {
    fontFamily: typography.mono,
    fontSize: 10,
    color: colors.red,
    fontWeight: '800',
    letterSpacing: 1,
  },
  loader: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: '48%',
    marginBottom: 24,
  },
  cardActions: {
    marginTop: -2,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.red,
  },
  swapBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  swapBtnText: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
