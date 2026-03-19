import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useGarmentStore } from '../../src/store/garmentStore';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { garments, isLoading, fetchGarments } = useGarmentStore();

  useEffect(() => {
    fetchGarments();
  }, []);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>NAMASTE,</Text>
          <Text style={styles.userName}>{user?.displayName?.toUpperCase() || 'CURATOR'}</Text>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/(tabs)/notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#C9A84C" />
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <View style={styles.heroSection}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1610030469668-935142b96fe4?q=80&w=1974&auto=format&fit=crop' }}
          style={styles.heroImage}
        />
        <View style={styles.heroOverlay}>
          <Text style={styles.heroTitle}>The Silk Revival</Text>
          <Text style={styles.heroSubtitle}>Exclusive circular collection available now</Text>
          <TouchableOpacity
            style={styles.heroButton}
            onPress={() => router.push('/(tabs)/shop')}
          >
            <Text style={styles.heroButtonText}>EXPLORE</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>CURATED FOR YOU</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/shop')}>
            <Text style={styles.viewAll}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator size="small" color="#C9A84C" style={{ marginVertical: 40 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {garments.slice(0, 5).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.garmentCard}
                onPress={() => router.push(`/(tabs)/shop/${item.id}`)}
              >
                <Image
                  source={{ uri: item.images[0] || 'https://images.unsplash.com/photo-1580000000000?q=80&w=400&auto=format&fit=crop' }}
                  style={styles.garmentImage}
                />
                <View style={styles.cardInfo}>
                  <Text style={styles.brandName}>{item.brand}</Text>
                  <Text style={styles.itemName}>{item.title}</Text>
                  <Text style={styles.price}>₹{item.price ? (item.price / 100).toLocaleString() : 'N/A'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 12,
    color: '#6B5C52',
    letterSpacing: 2,
  },
  userName: {
    fontSize: 24,
    fontFamily: 'CormorantGaramond_700Bold',
    color: '#C9A84C',
  },
  notificationButton: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: 2,
    top: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9B1B30',
  },
  heroSection: {
    height: 400,
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 32,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    padding: 24,
  },
  heroTitle: {
    fontSize: 32,
    fontFamily: 'CormorantGaramond_700Bold',
    color: 'white',
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    marginBottom: 20,
  },
  heroButton: {
    backgroundColor: '#C9A84C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    color: '#1A0C10',
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 12,
  },
  section: {
    paddingLeft: 12,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#C9A84C',
    fontSize: 14,
    letterSpacing: 2,
    fontWeight: '600',
  },
  viewAll: {
    color: '#6B5C52',
    fontSize: 12,
    letterSpacing: 1,
  },
  horizontalScroll: {
    paddingRight: 12,
  },
  garmentCard: {
    width: 200,
    marginRight: 16,
    backgroundColor: '#2A1C20',
    borderRadius: 12,
    overflow: 'hidden',
  },
  garmentImage: {
    width: '100%',
    height: 240,
  },
  cardInfo: {
    padding: 12,
  },
  brandName: {
    color: '#C9A84C',
    fontSize: 10,
    letterSpacing: 1,
  },
  itemName: {
    color: 'white',
    fontSize: 14,
    marginTop: 4,
  },
  price: {
    color: 'white',
    fontWeight: '600',
    marginTop: 8,
  },
});
