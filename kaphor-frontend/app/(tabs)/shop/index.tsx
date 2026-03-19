import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGarmentStore } from '../../../src/store/garmentStore';

export default function ShopScreen() {
  const router = useRouter();
  const { garments, isLoading, fetchGarments } = useGarmentStore();

  useEffect(() => {
    fetchGarments();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Kaphor Shop</Text>
          <TouchableOpacity 
            style={styles.sellButton}
            onPress={() => router.push('/(tabs)/shop/sell')}
          >
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.sellText}>SELL</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#6B5C52" />
          <TextInput 
            placeholder="SEARCH HERITAGE PIECES" 
            placeholderTextColor="#6B5C52"
            style={styles.searchInput}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#C9A84C" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.filterSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['ALL', 'SAREES', 'LEHENGAS', 'SUITS', 'ACCESSORIES'].map((cat) => (
                <TouchableOpacity key={cat} style={[styles.filterChip, cat === 'ALL' && styles.activeChip]}>
                  <Text style={[styles.filterText, cat === 'ALL' && styles.activeFilterText]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.grid}>
            {garments.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.productCard}
                onPress={() => router.push(`/(tabs)/shop/${item.id}`)}
              >
                <View style={styles.imageOverlay}>
                  <View style={styles.fitBadge}>
                    <Text style={styles.fitText}>98% FIT</Text>
                  </View>
                </View>
                <Image 
                  source={{ uri: item.images[0] || 'https://images.unsplash.com/photo-1580000000000?q=80&w=400&auto=format&fit=crop' }} 
                  style={styles.productImage}
                />
                <View style={styles.productInfo}>
                  <Text style={styles.brand}>{item.brand}</Text>
                  <Text style={styles.itemName}>{item.title}</Text>
                  <Text style={styles.price}>₹{item.price ? (item.price / 100).toLocaleString() : 'N/A'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0C10',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'CormorantGaramond_700Bold',
    color: '#C9A84C',
  },
  sellButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9B1B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  sellText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A1C20',
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 14,
    letterSpacing: 1,
  },
  loader: {
    paddingVertical: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A2C30',
    marginRight: 8,
  },
  activeChip: {
    backgroundColor: '#C9A84C',
    borderColor: '#C9A84C',
  },
  filterText: {
    color: '#6B5C52',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  activeFilterText: {
    color: '#1A0C10',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    backgroundColor: '#2A1C20',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 220,
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 1,
  },
  fitBadge: {
    backgroundColor: 'rgba(201, 168, 76, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fitText: {
    color: '#1A0C10',
    fontSize: 10,
    fontWeight: '800',
  },
  productInfo: {
    padding: 12,
  },
  brand: {
    color: '#C9A84C',
    fontSize: 10,
    letterSpacing: 1,
  },
  itemName: {
    color: 'white',
    fontSize: 13,
    marginTop: 4,
  },
  price: {
    color: 'white',
    fontWeight: '700',
    marginTop: 8,
    fontSize: 15,
  },
});
