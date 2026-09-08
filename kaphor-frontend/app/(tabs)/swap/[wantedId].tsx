import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { garmentService } from '../../../src/services/garmentService';
import api from '../../../src/services/api';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { safeBack } from '../../../src/utils/navigation';

export default function SwapWithWantedScreen() {
  const { wantedId } = useLocalSearchParams();
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
          garmentService.getGarmentById(wantedId as string),
          api.get('/garments/me').then((r) => r.data.data).catch(() => []),
        ]);
        setGarment(gData);
        setMyGarments(Array.isArray(myData) ? myData : []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [wantedId]);

  const handleSwap = async () => {
    if (!selectedOffer) {
      Alert.alert('Select a garment', 'Choose one of your garments to offer.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/swaps', {
        garmentOfferedId: selectedOffer,
        garmentWantedId: wantedId,
        message: message.trim() || undefined,
      });
      Alert.alert('Swap Requested!', 'The owner has been notified.', [
        { text: 'OK', onPress: () => safeBack('/(tabs)/swap') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Swap request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={[styles.container, styles.center]}><DossierLoading variant="swap" compact /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/swap')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SWAP REQUEST</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {garment && (
          <View style={styles.wantedCard}>
            <KaphorImage uri={garment.images?.[0]} style={styles.wantedImage} contentFit="cover" />
            <View style={styles.wantedInfo}>
              <Text style={styles.label}>YOU WANT</Text>
              <Text style={styles.wantedTitle}>{garment.title}</Text>
              <Text style={styles.wantedBrand}>{garment.brand}</Text>
            </View>
          </View>
        )}

        <View style={styles.arrowContainer}>
          <Ionicons name="swap-vertical" size={32} color={colors.red} />
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
                <KaphorImage uri={g.images?.[0]} style={styles.offerImage} contentFit="cover" />
                <Text style={styles.offerTitle} numberOfLines={1}>{g.title}</Text>
                {selectedOffer === g.id && (
                  <View style={styles.checkmark}><Ionicons name="checkmark-circle" size={24} color={colors.red} /></View>
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
          {submitting ? <ActivityIndicator color={colors.cream} /> : <Text style={styles.swapBtnText}>SEND SWAP REQUEST</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: colors.charcoal, backgroundColor: colors.cream,
  },
  headerTitle: { color: colors.charcoal, fontSize: 14, fontFamily: typography.mono, fontWeight: '900', letterSpacing: 2 },
  content: { padding: 20, paddingBottom: 120 },
  wantedCard: { flexDirection: 'row', backgroundColor: colors.white, borderWidth: 2, borderColor: colors.charcoal, overflow: 'hidden', marginBottom: 8 },
  wantedImage: { width: 100, height: 120 },
  wantedInfo: { flex: 1, padding: 16, justifyContent: 'center' },
  label: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  wantedTitle: { color: colors.charcoal, fontFamily: typography.headings, fontSize: 22 },
  wantedBrand: { color: colors.red, fontFamily: typography.mono, fontSize: 11, marginTop: 4, fontWeight: '700' },
  arrowContainer: { alignItems: 'center', marginVertical: 16 },
  sectionTitle: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 16, marginTop: 8 },
  messageInput: {
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.charcoal,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 90,
    color: colors.charcoal, textAlignVertical: 'top', fontSize: 14,
    marginBottom: 12,
  },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 12 },
  linkText: { color: colors.red, fontFamily: typography.mono, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 12 },
  offerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  offerCard: { width: '47%', backgroundColor: colors.white, borderWidth: 2, borderColor: colors.charcoal, overflow: 'hidden', position: 'relative' },
  offerCardSelected: { borderColor: colors.red, borderWidth: 2 },
  offerImage: { width: '100%', height: 150 },
  offerTitle: { color: colors.charcoal, fontFamily: typography.headings, fontSize: 14, padding: 10 },
  checkmark: { position: 'absolute', top: 8, right: 8 },
  footer: { padding: 20, borderTopWidth: 2, borderTopColor: colors.charcoal, backgroundColor: colors.cream, position: 'absolute', bottom: 0, left: 0, right: 0 },
  swapBtn: { backgroundColor: colors.charcoal, height: 56, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.charcoal },
  swapBtnText: { color: colors.cream, fontFamily: typography.mono, fontSize: 13, fontWeight: '900', letterSpacing: 2 },
});
