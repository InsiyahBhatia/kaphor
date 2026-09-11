import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { garmentService } from '../../../src/services/garmentService';
import api from '../../../src/services/api';
import { swapService } from '../../../src/services/swapService';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';
import { KaphorImage } from '../../../src/components/KaphorImage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { safeBack } from '../../../src/utils/navigation';

import { isAccessoryCategory } from '../../../src/constants/market';

export default function SwapDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [garment, setGarment] = useState<any>(null);
  const [myGarments, setMyGarments] = useState<any[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [conditionPhotos, setConditionPhotos] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [gData, myData] = await Promise.all([
          garmentService.getGarmentById(id as string),
          api.get('/garments/me').then((r) => r.data.data).catch(() => []),
        ]);
        setGarment(gData);
        const accessoriesOnly = (Array.isArray(myData) ? myData : []).filter((item: any) =>
          isAccessoryCategory(item.category, item.subCategory) || item.listingType === 'ACCESSORY_SWAP'
        );
        setMyGarments(accessoriesOnly);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [id]);

  const pickConditionPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Grant photo access to add condition evidence.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) {
      setConditionPhotos((prev) => [...prev, result.assets[0].uri].slice(0, 3));
    }
  };

  const uploadPhoto = async (uri: string): Promise<string> => {
    // Convert local file URI to base64 for API transmission
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      return `data:image/jpeg;base64,${base64}`;
    } catch {
      return uri; // Fallback: send raw URI (backend may handle it)
    }
  };

  const handleSwap = async () => {
    if (!selectedOffer) {
      Alert.alert('Select a garment', 'Choose one of your garments to offer.');
      return;
    }
    setSubmitting(true);
    try {
      // Convert condition photos to base64 before sending
      const photoData = conditionPhotos.length > 0
        ? await Promise.all(conditionPhotos.map(uploadPhoto))
        : undefined;

      await swapService.createSwapRequest({
        garmentOfferedId: selectedOffer,
        garmentWantedId: id as string,
        message: message.trim() || undefined,
        conditionPhotos: photoData,
      });
      Alert.alert('Swap Requested!', 'The owner has been notified. Next step: both parties review and sign the swap agreement.', [
        { text: 'OK', onPress: () => safeBack('/(tabs)/circular') },
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
          onPress={() => safeBack('/(tabs)/circular')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
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

        {/* Secure Swap Steps Indicator */}
        <View style={styles.stepsIndicator}>
          {['Request', 'Agree', 'Ship', 'Track', 'Complete'].map((step, i) => (
            <View key={step} style={styles.stepItem}>
              <View style={[styles.stepDot, i === 0 && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, i === 0 && styles.stepDotTextActive]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepLabel, i === 0 && styles.stepLabelActive]}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <Ionicons name="shield-checkmark" size={16} color={colors.navy} />
          <Text style={styles.securityNoticeText}>
            Secure escrow swap: Both parties protected. Refundable ₹500 deposit required before shipping.
          </Text>
        </View>

        <View style={styles.arrowContainer}>
          <Ionicons name="swap-vertical" size={32} color={colors.charcoal} />
        </View>

        <Text style={styles.sectionTitle}>SELECT AN ACCESSORY TO OFFER</Text>
        {myGarments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>You don't have any accessories listed for swap yet.</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/shop/sell')}>
              <Text style={styles.linkText}>LIST AN ACCESSORY</Text>
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
                  <View style={styles.checkmark}><Ionicons name="checkmark-circle" size={24} color={colors.crimson} /></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Condition Photos */}
        <Text style={styles.sectionTitle}>CONDITION EVIDENCE (RECOMMENDED)</Text>
        <Text style={styles.sectionSubtext}>
          Add close-up photos of your garment's condition. This protects both parties in case of disputes.
        </Text>
        <View style={styles.photoRow}>
          {conditionPhotos.map((uri, idx) => (
            <View key={idx} style={styles.photoThumb}>
              <Image source={{ uri }} style={styles.photoThumbImg} />
              <TouchableOpacity
                style={styles.photoRemove}
                onPress={() => setConditionPhotos((prev) => prev.filter((_, i) => i !== idx))}
              >
                <Ionicons name="close-circle" size={20} color={colors.red} />
              </TouchableOpacity>
            </View>
          ))}
          {conditionPhotos.length < 3 && (
            <TouchableOpacity style={styles.photoAddBtn} onPress={pickConditionPhoto}>
              <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
              <Text style={styles.photoAddText}>ADD PHOTO</Text>
            </TouchableOpacity>
          )}
        </View>

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
          {submitting ? <ActivityIndicator color={colors.cream} /> : <Text style={styles.swapBtnText}>SEND SECURE SWAP REQUEST</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 24, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { color: colors.charcoal, fontSize: 16, fontFamily: typography.mono, fontWeight: '900', letterSpacing: 2 },
  content: { padding: 20, paddingBottom: 120 },

  stepsIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(30,31,34,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(30,31,34,0.15)',
  },
  stepDotActive: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  stepDotText: { fontFamily: typography.mono, fontSize: 10, fontWeight: '800', color: colors.charcoal },
  stepDotTextActive: { color: colors.cream },
  stepLabel: { fontFamily: typography.mono, fontSize: 7, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  stepLabelActive: { color: colors.charcoal, fontWeight: '900' },

  securityNotice: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(28,43,74,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(28,43,74,0.12)',
    marginBottom: 8,
    alignItems: 'center',
  },
  securityNoticeText: {
    flex: 1,
    fontFamily: typography.mono,
    fontSize: 9,
    color: colors.navy,
    lineHeight: 14,
  },

  wantedCard: { flexDirection: 'row', backgroundColor: colors.white, borderWidth: 2, borderColor: colors.charcoal, overflow: 'hidden', marginBottom: 8 },
  wantedImage: { width: 100, height: 120 },
  wantedInfo: { flex: 1, padding: 16, justifyContent: 'center' },
  label: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.5, marginBottom: 4, fontWeight: '800' },
  wantedTitle: { color: colors.charcoal, fontFamily: typography.headings, fontSize: 20 },
  wantedBrand: { color: colors.red, fontFamily: typography.mono, fontSize: 11, marginTop: 4, fontWeight: '700' },
  arrowContainer: { alignItems: 'center', marginVertical: 16 },
  sectionTitle: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 16, marginTop: 8 },
  sectionSubtext: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, lineHeight: 14, marginBottom: 12, marginTop: -12 },
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
  offerCardSelected: { borderColor: colors.charcoal, borderWidth: 2, backgroundColor: 'rgba(30,31,34,0.02)' },
  offerImage: { width: '100%', height: 150 },
  offerTitle: { color: colors.charcoal, fontFamily: typography.headings, fontSize: 14, padding: 10 },
  checkmark: { position: 'absolute', top: 8, right: 8 },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  photoThumb: { width: 90, height: 90, position: 'relative', borderWidth: 2, borderColor: colors.charcoal },
  photoThumbImg: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: -8, right: -8 },
  photoAddBtn: {
    width: 90, height: 90,
    borderWidth: 2, borderStyle: 'dashed', borderColor: colors.charcoal,
    justifyContent: 'center', alignItems: 'center', gap: 4,
    backgroundColor: colors.white,
  },
  photoAddText: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, fontWeight: '700' },

  footer: { padding: 20, borderTopWidth: 2, borderTopColor: colors.charcoal, backgroundColor: colors.cream, position: 'absolute', bottom: 0, left: 0, right: 0 },
  swapBtn: {
    backgroundColor: colors.charcoal, height: 56,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  swapBtnText: { color: colors.cream, fontFamily: typography.mono, fontSize: 13, fontWeight: '900', letterSpacing: 2 },
});
