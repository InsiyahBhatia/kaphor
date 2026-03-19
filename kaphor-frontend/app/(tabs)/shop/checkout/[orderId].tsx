import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { garmentService } from '../../../../src/services/garmentService';
import api from '../../../../src/services/api';

export default function CheckoutScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const [garment, setGarment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    loadGarment();
  }, [orderId]);

  const loadGarment = async () => {
    try {
      const data = await garmentService.getGarmentById(orderId as string);
      setGarment(data);
    } catch { }
    finally { setLoading(false); }
  };

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      await api.post('/orders', { garmentId: orderId });
      Alert.alert('Order Placed!', 'Your sustainable luxury item is being prepared.', [
        { text: 'DONE', onPress: () => router.replace('/(tabs)/shop/order-confirmed') },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Payment failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#C9A84C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SECURE CHECKOUT</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {garment && (
          <>
            <View style={styles.itemCard}>
              <Image
                source={{ uri: garment.images?.[0] || 'https://picsum.photos/400/500' }}
                style={styles.itemImage}
              />
              <View style={styles.itemInfo}>
                <Text style={styles.brand}>{garment.brand}</Text>
                <Text style={styles.title}>{garment.title}</Text>
                <Text style={styles.condition}>{garment.condition}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>ITEM PRICE</Text>
              <Text style={styles.priceValue}>₹{((garment.price || 0) / 100).toLocaleString()}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>AUTHENTICATION</Text>
              <Text style={styles.priceValue}>₹0</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>DELIVERY</Text>
              <Text style={styles.priceValue}>₹199</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>₹{(((garment.price || 0) / 100) + 199).toLocaleString()}</Text>
            </View>

            <View style={styles.impactCard}>
              <Ionicons name="leaf" size={20} color="#4CAF50" />
              <Text style={styles.impactText}>This purchase saves ~10kg CO₂ and 1,000L water vs. buying new</Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.buyButton} onPress={handlePurchase} disabled={purchasing}>
          {purchasing ? (
            <ActivityIndicator color="#1A0C10" />
          ) : (
            <Text style={styles.buyButtonText}>CONFIRM PURCHASE</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.secureText}>
          <Ionicons name="lock-closed" size={12} color="#6B5C52" /> SECURED BY KAPHOR
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0C10' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 60, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { color: '#C9A84C', fontSize: 16, fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 2 },
  content: { padding: 24, paddingBottom: 140 },
  itemCard: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  itemImage: { width: 100, height: 120, borderRadius: 8 },
  itemInfo: { flex: 1, justifyContent: 'center' },
  brand: { color: '#C9A84C', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { color: 'white', fontSize: 18, fontFamily: 'CormorantGaramond_700Bold', marginTop: 4 },
  condition: { color: '#6B5C52', fontSize: 12, marginTop: 4, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: '#3A2C30', marginVertical: 20 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  priceLabel: { color: '#6B5C52', fontSize: 12, letterSpacing: 1 },
  priceValue: { color: 'white', fontSize: 14, fontWeight: '600' },
  totalLabel: { color: '#C9A84C', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  totalValue: { color: '#C9A84C', fontSize: 20, fontWeight: '700' },
  impactCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: 'rgba(76,175,80,0.08)', borderRadius: 12, marginTop: 24, borderWidth: 1, borderColor: 'rgba(76,175,80,0.15)' },
  impactText: { color: '#A5D6A7', fontSize: 12, flex: 1 },
  footer: { padding: 24, borderTopWidth: 1, borderTopColor: '#3A2C30', backgroundColor: '#1A0C10' },
  buyButton: { backgroundColor: '#C9A84C', height: 56, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  buyButtonText: { color: '#1A0C10', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  secureText: { color: '#6B5C52', fontSize: 11, textAlign: 'center', marginTop: 12, letterSpacing: 1 },
});
