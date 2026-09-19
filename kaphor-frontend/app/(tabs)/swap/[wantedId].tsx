import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, Modal, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { garmentService } from '../../../src/services/garmentService';
import api from '../../../src/services/api';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { colors, typography } from '../../../src/theme';
import { KaphorImage } from '../../../src/components/KaphorImage';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { isAccessoryCategory } from '../../../src/constants/market';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SwapWithWantedScreen() {
  const insets = useSafeAreaInsets();
  const { wantedId } = useLocalSearchParams();
  const router = useRouter();
  useBackHandler('/(tabs)/swap');
  const [garment, setGarment] = useState<any>(null);
  const [myGarments, setMyGarments] = useState<any[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [gData, myData] = await Promise.all([
          garmentService.getGarmentById(wantedId as string),
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
  }, [wantedId]);

  const handleSwap = async () => {
    if (!selectedOffer) {
      Alert.alert('Select an Accessory', 'Choose one of your accessories to offer in exchange.');
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
    return <DossierLoading variant="swap" />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/swap')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SWAP REQUEST</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
      >
        {garment && (
          <View style={styles.wantedCard}>
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => {
                const uri = (garment as any)?.primaryImage || garment.images?.[0];
                if (uri) setZoomImageUri(uri);
              }}
              style={{ position: 'relative' }}
            >
              <KaphorImage uri={(garment as any)?.primaryImage || garment.images?.[0]} style={styles.wantedImage} contentFit="cover" />
              <View style={styles.zoomPillSmall}>
                <Ionicons name="scan-outline" size={10} color="#FFFFFF" />
                <Text style={styles.zoomPillSmallText}>ZOOM</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.wantedInfo}>
              <Text style={styles.label}>YOU WANT</Text>
              <Text style={styles.wantedTitle}>{garment.title}</Text>
              <Text style={styles.wantedBrand}>{(garment.brand || 'Kaphor Archive').toUpperCase()}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 10, fontFamily: typography.mono, color: colors.textMuted }}>
                  SIZE: {garment.size || 'OS'}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: typography.mono, color: colors.crimson, fontWeight: '700' }}>
                  {(garment.condition || 'PRISTINE').replace('_', ' ')}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.arrowContainer}>
          <Ionicons name="swap-vertical" size={32} color={colors.red} />
        </View>

        <Text style={styles.sectionTitle}>SELECT AN ACCESSORY TO OFFER</Text>
        {myGarments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>You don't have any accessories listed for swap yet.</Text>
            <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/shop/sell', params: { prefillListingType: 'ACCESSORY_SWAP', listingType: 'ACCESSORY_SWAP', fresh: Date.now().toString() } } as any)}>
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

      {/* Full Screen Pinch & Zoom Modal */}
      <Modal
        visible={!!zoomImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomImageUri(null)}
        statusBarTranslucent
      >
        <View style={styles.zoomModalBackdrop}>
          <TouchableOpacity 
            style={[styles.closeZoomBtn, { top: Math.max(insets.top + 10, 44) }]}
            onPress={() => setZoomImageUri(null)}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={[styles.zoomInstructionWrap, { top: Math.max(insets.top + 18, 52) }]}>
            <Ionicons name="scan-outline" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={styles.zoomInstructionText}>PINCH TO ZOOM</Text>
          </View>

          {zoomImageUri && (
            <ScrollView
              style={{ flex: 1, width: '100%' }}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
              maximumZoomScale={5}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <KaphorImage
                uri={zoomImageUri}
                style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }}
                contentFit="contain"
              />
            </ScrollView>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 24, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.cream },
  headerTitle: { color: colors.charcoal, fontSize: 16, fontFamily: typography.mono, fontWeight: '900', letterSpacing: 2 },
  content: { padding: 20, paddingBottom: 200 },
  wantedCard: { flexDirection: 'row', backgroundColor: colors.white, borderWidth: 2, borderColor: colors.charcoal, overflow: 'hidden' },
  wantedImage: { width: 100, height: 120 },
  wantedInfo: { flex: 1, padding: 16, justifyContent: 'center' },
  label: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.5, marginBottom: 4, fontWeight: '800' },
  wantedTitle: { color: colors.charcoal, fontFamily: typography.headings, fontSize: 20 },
  wantedBrand: { color: colors.red, fontFamily: typography.mono, fontSize: 11, marginTop: 4, fontWeight: '700' },
  arrowContainer: { alignItems: 'center', marginVertical: 16 },
  sectionTitle: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 16 },
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
  offerCardSelected: { borderColor: colors.red, borderWidth: 3 },
  offerImage: { width: '100%', height: 150 },
  offerTitle: { color: colors.charcoal, fontFamily: typography.headings, fontSize: 14, padding: 10 },
  checkmark: { position: 'absolute', top: 8, right: 8 },
  footer: { 
    padding: 20, 
    paddingBottom: 24,
    borderTopWidth: 2, 
    borderTopColor: colors.charcoal, 
    backgroundColor: colors.cream, 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0 
  },
  swapBtn: {
    backgroundColor: colors.charcoal, height: 56,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.charcoal,
    shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  swapBtnText: { color: colors.cream, fontFamily: typography.mono, fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  zoomModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeZoomBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomInstructionWrap: {
    position: 'absolute',
    left: 24,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  zoomInstructionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: typography.mono,
    fontWeight: '800',
    letterSpacing: 1,
  },
  zoomPillSmall: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  zoomPillSmallText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: typography.mono,
    fontWeight: '800',
  },
});
