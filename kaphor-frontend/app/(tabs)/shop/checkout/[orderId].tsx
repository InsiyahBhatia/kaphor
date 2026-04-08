import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { garmentService } from '../../../../src/services/garmentService';
import api from '../../../../src/services/api';
import { useAuth } from '../../../../src/context/AuthContext';
import { colors, typography } from '../../../../src/theme';

export default function CheckoutScreen() {
  const { orderId: garmentId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [garment, setGarment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [RazorpayComp, setRazorpayComp] = useState<null | React.ComponentType<any>>(null);
  const [showRazorpay, setShowRazorpay] = useState(false);

  useEffect(() => {
    loadGarment();
  }, [garmentId]);

  const loadGarment = async () => {
    try {
      const data = await garmentService.getGarmentById(garmentId as string);
      setGarment(data);
    } catch { }
    finally { setLoading(false); }
  };

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const razorpayKey = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID as string | undefined;

      if (razorpayKey) {
        if (!RazorpayComp) {
          try {
            const mod = await import('../../../../src/components/payments/RazorpayCheckout');
            setRazorpayComp(() => mod.RazorpayCheckout);
          } catch {
            Alert.alert(
              'Razorpay unavailable',
              'This build does not include WebView native modules. Create a dev build (expo run:android) to use Razorpay.'
            );
            return;
          }
        }
        setShowRazorpay(true);
      } else {
        const { data } = await api.post<{ data: { orderId: string } }>('/orders', { garmentId });
        Alert.alert('Order placed', 'Message the seller under Orders to coordinate delivery.', [
          {
            text: 'OPEN ORDER',
            onPress: () => router.replace(`/(tabs)/shop/orders/${data.data.orderId}` as any),
          },
          { text: 'HOME', onPress: () => router.replace('/(tabs)') },
        ]);
      }
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
        <ActivityIndicator size="large" color={colors.red} />
        <Text style={styles.loadingText}>AUTHORIZING...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showRazorpay && RazorpayComp ? (
        <RazorpayComp
          razorpayKeyId={process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID}
          garmentId={garmentId}
          garmentTitle={garment?.title}
          imageUrl={garment?.images?.[0]}
          buyerEmail={user?.email}
          onPaid={(orderId: string) => {
            setShowRazorpay(false);
            router.replace(`/(tabs)/shop/orders/${orderId}` as any);
          }}
          onClose={() => setShowRazorpay(false)}
        />
      ) : null}
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={colors.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SECURE CHECKOUT</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
                <Text style={styles.condition}>CONDITION: {garment.condition}</Text>
              </View>
            </View>

            <View style={styles.summarySection}>
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

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TOTAL</Text>
                <Text style={styles.totalValue}>₹{(((garment.price || 0) / 100) + 199).toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.impactCard}>
              <View style={styles.impactIconBox}>
                <Ionicons name="leaf-sharp" size={24} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.impactTitle}>ENVIRONMENTAL IMPACT</Text>
                <Text style={styles.impactText}>This purchase avoids ~10kg CO₂ and saves ~1,000L of water.</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.buyButton} onPress={handlePurchase} disabled={purchasing}>
          {purchasing ? (
            <ActivityIndicator color={colors.cream} />
          ) : (
            <Text style={styles.buyButtonText}>AUTHORIZE TRANSACTION →</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.secureText}>
          SECURED BY KAPHOR CRYPTOGRAPHIC DELEGATION
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: typography.mono, color: colors.charcoal, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  
  header: { 
    paddingTop: 24, paddingHorizontal: 20, flexDirection: 'row', 
    justifyContent: 'space-between', alignItems: 'center', 
    paddingBottom: 20, borderBottomWidth: 2, borderBottomColor: colors.charcoal, backgroundColor: colors.cream 
  },
  headerTitle: { color: colors.charcoal, fontSize: 16, fontFamily: typography.mono, letterSpacing: 2, fontWeight: '800' },
  
  content: { padding: 20, paddingBottom: 160 },
  
  itemCard: { 
    flexDirection: 'row', gap: 20, marginBottom: 32,
    backgroundColor: colors.white, padding: 16, borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4
  },
  itemImage: { width: 90, height: 110, borderWidth: 2, borderColor: colors.charcoal },
  itemInfo: { flex: 1, justifyContent: 'center' },
  brand: { color: colors.red, fontSize: 10, letterSpacing: 2, fontWeight: '800', fontFamily: typography.mono, textTransform: 'uppercase' },
  title: { color: colors.charcoal, fontSize: 28, fontFamily: typography.headings, marginTop: 4, lineHeight: 28 },
  condition: { color: colors.textPrimary, fontSize: 10, fontFamily: typography.mono, marginTop: 8, fontWeight: '700' },
  
  summarySection: {
    backgroundColor: colors.white, padding: 20, borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  priceLabel: { color: colors.textMuted, fontSize: 12, fontFamily: typography.mono, fontWeight: '800', letterSpacing: 1 },
  priceValue: { color: colors.charcoal, fontSize: 16, fontWeight: '800', fontFamily: typography.mono },
  divider: { height: 2, backgroundColor: colors.charcoal, marginVertical: 8, marginBottom: 16 },
  
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' },
  totalLabel: { color: colors.red, fontSize: 14, fontFamily: typography.mono, fontWeight: '800', letterSpacing: 2 },
  totalValue: { color: colors.charcoal, fontSize: 40, fontFamily: typography.headings },
  
  impactCard: { 
    flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, 
    backgroundColor: colors.forest, marginTop: 32, borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4
  },
  impactIconBox: { width: 48, height: 48, borderRightWidth: 2, borderRightColor: colors.white, justifyContent: 'center' },
  impactTitle: { color: colors.white, fontFamily: typography.mono, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  impactText: { color: colors.cream, fontFamily: typography.mono, fontSize: 11, lineHeight: 16 },
  
  footer: { 
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 24, paddingBottom: 40, borderTopWidth: 2, borderTopColor: colors.charcoal, backgroundColor: colors.cream
  },
  buyButton: { 
    backgroundColor: colors.charcoal, height: 60, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4
  },
  buyButtonText: { color: colors.cream, fontSize: 14, fontFamily: typography.mono, fontWeight: '800', letterSpacing: 2 },
  secureText: { color: colors.textMuted, fontSize: 10, fontFamily: typography.mono, textAlign: 'center', marginTop: 16, letterSpacing: 1, fontWeight: '700' },
});
