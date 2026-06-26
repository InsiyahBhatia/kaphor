import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useGarmentStore } from '../../../src/store/garmentStore';
import { PlayingCard } from '../../../src/components/PlayingCard';
import { LoadingSkeleton } from '../../../src/components/common/LoadingSkeleton';
import { colors, typography } from '../../../src/theme';

export default function SwapFeedScreen() {
  const router = useRouter();
  const { garments, isLoading, fetchFeed } = useGarmentStore();

  useEffect(() => {
    fetchFeed({ listingType: 'ACCESSORY_SWAP' });
  }, []);

  // Strictly filter for swap items only
  const swappableItems = garments.filter(g => 
    g.listingType === 'ACCESSORY_SWAP'
  );

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
            {swappableItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>NO SWAPPABLE ASSETS DETECTED</Text>
              </View>
            ) : (
              swappableItems.map((item, index) => {
                const suits: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];
                const ranks = ['J', 'Q', 'K', 'A', '8', '7'];

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
                      size="M"
                      category={item.category}
                      subCategory={item.subCategory}
                      price={item.price ? item.price / 100 : 0}
                      matchPercent={Math.floor(Math.random() * 20) + 70}
                      imageUrl={item.images[0]}
                      condition="Like New"
                      buttonText="SWAP REQUEST"
                      onSwapRequest={() => router.push(`/(tabs)/swap/${item.id}` as any)}
                      style={{ width: '100%' }}
                    />
                  </TouchableOpacity>
                );
              })
            )}
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
  cartButton: {
    width: 60,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.crimson,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    padding: 32,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderStyle: 'dashed',
    width: '100%',
  },
  emptyText: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.charcoal,
    fontWeight: '800',
  },
});
