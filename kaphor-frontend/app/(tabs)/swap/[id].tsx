import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { garmentService } from '../../../src/services/garmentService';
import api from '../../../src/services/api';
import { colors } from '../../../src/theme';

export default function SwapDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [garment, setGarment] = useState<any>(null);
  const [myGarments, setMyGarments] = useState<any[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  const [message, setMessage] = useState('');
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
        message: message.trim() || undefined,
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
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={colors.crimson} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
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
          <Ionicons name="swap-vertical" size={32} color={colors.crimson} />
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
                  <View style={styles.checkmark}><Ionicons name="checkmark-circle" size={24} color={colors.crimson} /></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>MESSAGE THE OWNER (OPTIONAL)</Text>
        <TextInput
          style={styles.messageInput}
          placeholder="Add a note about condition, timing, or delivery…"
          placeholderTextColor={colors.textMuted}
          value={message}
          onChangeText={setMessage}
          multiline
        />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.swapBtn, !selectedOffer && { opacity: 0.5 }]}
          onPress={handleSwap}
          disabled={!selectedOffer || submitting}
        >
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.swapBtnText}>SEND SWAP REQUEST</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 24, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontFamily: 'BebasNeue_400Regular', letterSpacing: 2 },
  content: { padding: 24, paddingBottom: 100 },
  wantedCard: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 16, overflow: 'hidden', marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  wantedImage: { width: 100, height: 120 },
  wantedInfo: { flex: 1, padding: 16, justifyContent: 'center' },
  label: { color: colors.textMuted, fontSize: 10, letterSpacing: 2, marginBottom: 4, fontWeight: '800' },
  wantedTitle: { color: colors.textPrimary, fontSize: 18, fontFamily: 'BebasNeue_400Regular' },
  wantedBrand: { color: colors.crimson, fontSize: 13, marginTop: 4, fontWeight: '700' },
  arrowContainer: { alignItems: 'center', marginVertical: 16 },
  sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '800', letterSpacing: 2, marginBottom: 16 },
  messageInput: {
    marginTop: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 90,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  linkText: { color: colors.crimson, fontSize: 14, fontWeight: '800', letterSpacing: 1, marginTop: 12 },
  offerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  offerCard: { width: '47%', backgroundColor: colors.bgCard, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, position: 'relative' },
  offerCardSelected: { borderColor: colors.crimson, borderWidth: 2 },
  offerImage: { width: '100%', height: 150 },
  offerTitle: { color: colors.textPrimary, fontSize: 13, padding: 12, fontWeight: '700' },
  checkmark: { position: 'absolute', top: 8, right: 8 },
  footer: { padding: 24, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  swapBtn: { 
    backgroundColor: colors.crimson, 
    height: 60, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  swapBtnText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
});
