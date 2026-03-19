import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../src/components/common/Button';
import { Badge } from '../../../src/components/Badge';
import { garmentService } from '../../../src/services/garmentService';
import { Garment } from '../../../src/store/garmentStore';
import { useAuth } from '../../../src/context/AuthContext';
import api from '../../../src/services/api';

const { width } = Dimensions.get('window');

export default function GarmentDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [garment, setGarment] = useState<Garment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadGarment();
    }
  }, [id]);

  const loadGarment = async () => {
    setLoading(true);
    try {
      const data = await garmentService.getGarmentById(id as string);
      setGarment(data);
    } catch (error) {
      console.error('Failed to load garment', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#C9A84C" />
      </View>
    );
  }

  if (!garment) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: 'white' }}>Garment not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#C9A84C', marginTop: 20 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: garment.images[0] || 'https://images.unsplash.com/photo-1580000000000?q=80&w=800&auto=format&fit=crop' }} 
            style={styles.image}
          />
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.wishlistButton}>
            <Ionicons name="heart-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>{garment.brand || 'Kaphor Archive'}</Text>
              <Text style={styles.title}>{garment.title}</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>₹{garment.price ? (garment.price / 100).toLocaleString() : 'N/A'}</Text>
              <Text style={styles.originalPrice}>₹{(garment.price ? (garment.price / 100) * 2 : 0).toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.badges}>
            <Badge variant="fitScore" label="98% MATCH" />
            <Badge variant="condition" label={garment.condition || 'PRISTINE'} subType="Pristine" />
            <Badge variant="status" label="NEW RELEASE" />
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>DESCRIPTION</Text>
            <Text style={styles.description}>
              {garment.description || 'No description available for this heritage piece.'}
            </Text>
          </View>

          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/swap/index')}
            >
              <Ionicons name="repeat" size={24} color="#C9A84C" />
              <Text style={styles.actionTitle}>SWAP</Text>
              <Text style={styles.actionDesc}>Exchange for items</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionCard} 
              onPress={() => router.push(`/(tabs)/rental/${id}`)}
            >
              <Ionicons name="calendar-outline" size={24} color="#C9A84C" />
              <Text style={styles.actionTitle}>RENT</Text>
              <Text style={styles.actionDesc}>₹4,500 / 3 days</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {garment && user && garment.sellerId === user.id ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={[styles.buyButton, { flex: 1, backgroundColor: '#9B1B30' }]}
              onPress={async () => {
                try {
                  await api.delete(`/garments/${id}`);
                  Alert.alert('Deleted', 'Garment removed.', [{ text: 'OK', onPress: () => router.back() }]);
                } catch { Alert.alert('Error', 'Failed to delete.'); }
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700', letterSpacing: 2 }}>DELETE</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Button 
            title="PURCHASE NOW" 
            onPress={() => router.push(`/(tabs)/shop/checkout/${id}`)} 
            style={styles.buyButton} 
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0C10',
  },
  imageContainer: {
    width: width,
    height: width * 1.2,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wishlistButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  brand: {
    color: '#D4AF37',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: 'CormorantGaramond_700Bold',
    color: 'white',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  originalPrice: {
    fontSize: 14,
    color: '#6B5C52',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  infoSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#6B5C52',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    color: '#FFF5E1',
    fontSize: 14,
    lineHeight: 22,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 80,
  },
  actionCard: {
    flex: 1,
    height: 120,
    backgroundColor: '#2A1C20',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A2C30',
  },
  actionTitle: {
    color: '#C9A84C',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  actionDesc: {
    color: '#6B5C52',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#3A2C30',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A0C10',
  },
  buyButton: {
    width: '100%',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
