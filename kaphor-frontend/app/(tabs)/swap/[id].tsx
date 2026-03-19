import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { garmentService } from '../../../src/services/garmentService';
import api from '../../../src/services/api';

export default function SwapDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [garment, setGarment] = useState<any>(null);
  const [myGarments, setMyGarments] = useState<any[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [gData, myData] = await Promise.all([
          garmentService.getGarmentById(id as string),
          api.get('/garments/me').then((r) => r.data.data).catch(() => []),
        ]);
        setGarment(gData);
        setMyGarments(Array.isArray(myData) ? myData : []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [id]);

  const handleSwap = async () => {
    if (!selectedOffer) {
      Alert.alert('Select a garment', 'Choose one of your garments to offer.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/swaps', {
        garmentOfferedId: selectedOffer,
        garmentWantedId: id,
        message: 'I would love to swap!',
      });
      Alert.alert('Swap Requested!', 'The owner has been notified.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Swap request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color="#C9A84C" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SWAP REQUEST</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {garment && (
          <View style={styles.wantedCard}>
            <Image source={{ uri: garment.images?.[0] || 'https://picsum.photos/400/500' }} style={styles.wantedImage} />
            <View style={styles.wantedInfo}>
              <Text style={styles.label}>YOU WANT</Text>
              <Text style={styles.wantedTitle}>{garment.title}</Text>
              <Text style={styles.wantedBrand}>{garment.brand}</Text>
            </View>
          </View>
        )}

        <View style={styles.arrowContainer}>
          <Ionicons name="swap-vertical" size={32} color="#C9A84C" />
        </View>

        <Text style={styles.sectionTitle}>SELECT YOUR OFFER</Text>
        {myGarments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>You don't have any garments listed yet.</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/shop/sell')}>
              <Text style={styles.linkText}>LIST A GARMENT</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.offerGrid}>
            {myGarments.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[styles.offerCard, selectedOffer === g.id && styles.offerCardSelected]}
                onPress={() => setSelectedOffer(g.id)}
              >
                <Image source={{ uri: g.images?.[0] || 'https://picsum.photos/200/250' }} style={styles.offerImage} />
                <Text style={styles.offerTitle} numberOfLines={1}>{g.title}</Text>
                {selectedOffer === g.id && (
                  <View style={styles.checkmark}><Ionicons name="checkmark-circle" size={24} color="#C9A84C" /></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.swapBtn, !selectedOffer && { opacity: 0.5 }]}
          onPress={handleSwap}
          disabled={!selectedOffer || submitting}
        >
          {submitting ? <ActivityIndicator color="#1A0C10" /> : <Text style={styles.swapBtnText}>SEND SWAP REQUEST</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0C10' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 60, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { color: '#C9A84C', fontSize: 16, fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 2 },
  content: { padding: 24, paddingBottom: 120 },
  wantedCard: { flexDirection: 'row', backgroundColor: '#2A1C20', borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  wantedImage: { width: 100, height: 120 },
  wantedInfo: { flex: 1, padding: 16, justifyContent: 'center' },
  label: { color: '#6B5C52', fontSize: 10, letterSpacing: 2, marginBottom: 4 },
  wantedTitle: { color: 'white', fontSize: 16, fontFamily: 'CormorantGaramond_700Bold' },
  wantedBrand: { color: '#C9A84C', fontSize: 12, marginTop: 4 },
  arrowContainer: { alignItems: 'center', marginVertical: 16 },
  sectionTitle: { color: '#C9A84C', fontSize: 14, fontWeight: '700', letterSpacing: 2, marginBottom: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#6B5C52', fontSize: 14 },
  linkText: { color: '#C9A84C', fontSize: 14, fontWeight: '700', letterSpacing: 1, marginTop: 12 },
  offerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  offerCard: { width: '47%', backgroundColor: '#2A1C20', borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', position: 'relative' },
  offerCardSelected: { borderColor: '#C9A84C' },
  offerImage: { width: '100%', height: 140 },
  offerTitle: { color: 'white', fontSize: 12, padding: 10 },
  checkmark: { position: 'absolute', top: 8, right: 8 },
  footer: { padding: 24, borderTopWidth: 1, borderTopColor: '#3A2C30', backgroundColor: '#1A0C10' },
  swapBtn: { backgroundColor: '#C9A84C', height: 56, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  swapBtnText: { color: '#1A0C10', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
});
