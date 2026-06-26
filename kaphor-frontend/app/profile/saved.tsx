import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { garmentService } from '../../src/services/garmentService';
import { cartService } from '../../src/services/cartService';
import { PlayingCard } from '../../src/components/PlayingCard';
import { colors, typography } from '../../src/theme';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2; // Grid layout

export default function SavedAssetsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [savedAssets, setSavedAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSavedAssets = useCallback(async () => {
    try {
      const data = await garmentService.getWishlist();
      setSavedAssets(data);
    } catch (error) {
      console.error('Failed to fetch saved assets', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddToCart = async (item: any) => {
    try {
      await cartService.addToCart(item.id);
      Alert.alert('✓ Added', `${item.title} has been added to your cart.`);
    } catch (error) {
      Alert.alert('Error', 'Could not add to cart. Please try again.');
      console.error(error);
    }
  };

  useEffect(() => {
    fetchSavedAssets();
  }, [fetchSavedAssets]);

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <View style={styles.cardContainer}>
      <TouchableOpacity 
        onPress={() => router.push(`/(tabs)/shop/${item.id}` as any)}
        activeOpacity={0.9}
      >
        <PlayingCard
          rank={['A', 'K', 'Q', 'J'][index % 4]}
          suit={(['♠', '♥', '♦', '♣'] as const)[index % 4]}
          productName={item.title}
          price={item.price ? item.price / 100 : 0}
          size={item.size || 'OS'}
          imageUrl={item.images[0]}
          matchPercent={Math.floor(Math.random() * 20) + 80}
          condition={item.condition || "Excellent"}
          onAddToCart={() => handleAddToCart(item)}
          onSwapRequest={() => router.push(`/(tabs)/shop/${item.id}` as any)}
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen 
        options={{ 
          title: 'THE VAULT',
          headerTitleStyle: { fontFamily: typography.headings, fontSize: 24 },
          headerBackTitleVisible: false,
          headerTintColor: colors.charcoal,
          headerTransparent: true, // Allow custom padding behavior
        }} 
      />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.red} />
          <Text style={styles.loaderText}>UNLOCKING THE VAULT...</Text>
        </View>
      ) : savedAssets.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="heart-dislike-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>THE VAULT IS EMPTY</Text>
          <Text style={styles.emptySub}>Save items from the shop to see them here.</Text>
          <TouchableOpacity 
            style={styles.ctaButton}
            onPress={() => router.push('/(tabs)/shop')}
          >
            <Text style={styles.ctaText}>GO SHOPPING →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={savedAssets}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <View style={styles.vaultHeader}>
              <Text style={styles.vaultTitle}>MANIFESTED ASSETS</Text>
              <View style={styles.badgeLine}>
                <Text style={styles.badgeText}>TOTAL: {savedAssets.length} ITEMS</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  gridContent: {
    padding: 12,
    paddingBottom: 40,
  },
  cardContainer: {
    flex: 1,
    padding: 6,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 16,
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontFamily: typography.headings,
    fontSize: 32,
    color: colors.charcoal,
    marginTop: 20,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  ctaButton: {
    marginTop: 32,
    backgroundColor: colors.charcoal,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  ctaText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 14,
    fontWeight: '800',
  },
  vaultHeader: {
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  vaultTitle: {
    fontFamily: typography.headings,
    fontSize: 28,
    color: colors.charcoal,
  },
  badgeLine: {
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  badgeText: {
    color: colors.white,
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
  },
});
