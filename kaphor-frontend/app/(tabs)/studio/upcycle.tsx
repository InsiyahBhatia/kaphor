import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { promptPhotoSelection } from '../../../src/utils/imagePicker';
import * as FileSystem from 'expo-file-system/legacy';
import api from '../../../src/services/api';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { EditorialPageHeader, HandwrittenNote, IllustrationLayer } from '../../../src/components/editorial/IllustrationLayer';
import { colors, typography } from '../../../src/theme';

const UPCYCLE_YOUTUBE_TUTORIALS = [
  {
    id: 'yt-1',
    title: 'DIY Clothes Upcycling: Transform Old Clothes Into Trendy Outfits',
    channel: 'Coolirpa',
    videoId: '04Y_c20_92k',
    thumbnail: 'https://img.youtube.com/vi/04Y_c20_92k/hqdefault.jpg',
    vibe: 'BEGINNER FRIENDLY',
  },
  {
    id: 'yt-2',
    title: 'Thrift Flip & Denim Re-imagining: Old Jeans to Designer Co-ord',
    channel: 'Withwendy',
    videoId: 'W6LgQd59xWg',
    thumbnail: 'https://img.youtube.com/vi/W6LgQd59xWg/hqdefault.jpg',
    vibe: 'DENIM & OUTERWEAR',
  },
  {
    id: 'yt-3',
    title: 'Turn Heavy Old Sari / Dupatta into Modern Indo-Western Jacket & Dress',
    channel: 'Kriti Atelier DIY',
    videoId: 'fQ7rW1u5K_U',
    thumbnail: 'https://img.youtube.com/vi/fQ7rW1u5K_U/hqdefault.jpg',
    vibe: 'ETHNIC FUSION',
  },
  {
    id: 'yt-4',
    title: 'Sashiko Visible Mending & Japanese Patchwork Technique',
    channel: 'Minimalist Crafting',
    videoId: 'P6S911v0wWw',
    thumbnail: 'https://img.youtube.com/vi/P6S911v0wWw/hqdefault.jpg',
    vibe: 'ARTISANAL REPAIR',
  },
];

export default function UpcycleSuggestionsScreen() {
  const router = useRouter();
  useBackHandler('/(tabs)/circular');
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = () => {
    promptPhotoSelection({
      title: 'Add Garment Photo',
      quality: 0.85,
      base64: true,
      onImagePicked: (res) => {
        if (res.uri) setImage(res.uri);
      },
      onError: (err) => {
        Alert.alert('Error', err?.message || 'Failed to capture or pick photo');
      },
    });
  };

  const handleSubmit = async () => {
    if (!description && !image) { Alert.alert('Input Required', 'Add a photo or describe your garment.'); return; }
    setLoading(true);
    try {
      let base64Image: string | undefined;
      if (image) {
        const b64 = await FileSystem.readAsStringAsync(image, { encoding: 'base64' });
        base64Image = `data:image/jpeg;base64,${b64}`;
      }

      // Use vision endpoint when image is available, fall back to text-only
      if (base64Image) {
        const { data } = await api.post('/ai/assess-condition', {
          image: base64Image,
          description: description || 'Analyze and provide upcycling ideas'
        }, { timeout: 60000 });
        setResult(data.data?.upcycleSuggestions || []);
      } else {
        const { data } = await api.post('/ai/upcycle-suggestions', { description, imageUrl: undefined });
        setResult(data.data);
      }
    } catch {
      Alert.alert('Error', 'Could not get suggestions. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/studio')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.cream} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>UPCYCLE STUDIO</Text>
        <View style={{ width: 28 }} />
      </View>

      <EditorialPageHeader
        title="UPCYCLE STUDIO"
        subtitle="OLD GARMENT // CUT // REWORK // NEW PIECE"
        eyebrow="DIGITAL ATELIER"
        variant="upcycle"
        style={styles.editorialHeader}
      >
        <HandwrittenNote>old garments, new possibilities.</HandwrittenNote>
      </EditorialPageHeader>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
      >
        {!result ? (
          <>
            <View style={styles.heroSection}>
              <IllustrationLayer variant="upcycle" muted />
              <View style={styles.atelierIcon}>
                <Ionicons name="cut-outline" size={30} color={colors.goldDark} />
              </View>
              <Text style={styles.title}>AI Upcycle Ideas</Text>
              <Text style={styles.subtitle}>Upload a photo or describe a garment and our AI will suggest creative ways to transform it.</Text>
              <View style={styles.processRow}>
                {['OLD GARMENT', 'CUT', 'REWORK', 'NEW PIECE'].map((step, index) => (
                  <React.Fragment key={step}>
                    <Text style={styles.processStep}>{step}</Text>
                    {index < 3 && <Ionicons name="arrow-forward" size={13} color={colors.textMuted} />}
                  </React.Fragment>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.imageArea} onPress={pickImage}>
              {image ? (
                <Image source={{ uri: image }} style={styles.previewImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <View style={styles.cameraCircle}>
                    <Ionicons name="camera" size={28} color={colors.goldDark} />
                  </View>
                  <Text style={styles.imageText}>TAKE OR UPLOAD PHOTO</Text>
                  <Text style={styles.imageSubtext}>Camera or gallery (unlocks AI vision)</Text>
                </View>
              )}
            </TouchableOpacity>
            {image && (
              <TouchableOpacity onPress={() => setImage(null)} style={styles.removeBtn}>
                <Ionicons name="close-circle" size={16} color="#F44336" />
                <Text style={styles.removeBtnText}>Remove Photo</Text>
              </TouchableOpacity>
            )}

            <TextInput
              style={styles.input}
              placeholder="Describe the garment (fabric, style, condition)..."
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <TouchableOpacity
              style={[styles.mainBtn, (!image && !description) && { opacity: 0.4 }]}
              onPress={handleSubmit}
              disabled={loading || (!image && !description)}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.goldDark} />
                  <Text style={styles.mainBtnText}>  {image ? 'ANALYZING IMAGE...' : 'GETTING IDEAS...'}</Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <Ionicons name="sparkles" size={18} color={colors.goldDark} />
                  <Text style={styles.mainBtnText}>  GET AI SUGGESTIONS</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ── YouTube Upcycling Masterclass Tutorials ───────────────────────────── */}
            <View style={{ marginTop: 32, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                <Text style={{ fontFamily: typography.headings, fontSize: 18, color: colors.charcoal, letterSpacing: 1.5 }}>
                  UPCYCLING VIDEO TUTORIALS
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                {UPCYCLE_YOUTUBE_TUTORIALS.map((yt) => (
                  <TouchableOpacity
                    key={yt.id}
                    style={{
                      width: 210,
                      backgroundColor: '#FAF7F0',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: 'rgba(20,20,20,0.16)',
                      overflow: 'hidden',
                    }}
                    onPress={async () => {
                      try {
                        await Linking.openURL(`https://www.youtube.com/watch?v=${yt.videoId}`);
                      } catch {
                        Alert.alert('Unable to open video', 'Please ensure you have a browser or YouTube app installed.');
                      }
                    }}
                    activeOpacity={0.88}
                  >
                    <View style={{ width: '100%', height: 120, position: 'relative' }}>
                      <Image source={{ uri: yt.thumbnail }} style={{ width: '100%', height: '100%' }} />
                      <View style={{
                        position: 'absolute',
                        top: 0, bottom: 0, left: 0, right: 0,
                        backgroundColor: 'rgba(0,0,0,0.35)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.9)" />
                      </View>
                      <View style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        backgroundColor: colors.gold,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 3,
                      }}>
                        <Text style={{ color: colors.goldDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }}>
                          {yt.vibe}
                        </Text>
                      </View>
                    </View>
                    <View style={{ padding: 10 }}>
                      <Text style={{ color: colors.charcoal, fontSize: 12, fontWeight: '700', lineHeight: 16 }} numberOfLines={2}>
                        {yt.title}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>
                        Channel: {yt.channel}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>Your Upcycle Ideas</Text>
            <View style={styles.suggestionsContainer}>
              {(Array.isArray(result) ? result : [result]).map((s: any, i: number) => (
                <View key={i} style={styles.suggestionCard}>
                  <View style={styles.suggestionHeader}>
                    <View style={styles.numberBadge}><Text style={styles.numberText}>{i + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionTitle}>{s.title || `Idea ${i + 1}`}</Text>
                      {s.difficulty && (
                        <View style={styles.metaRow}>
                          <View style={styles.diffBadge}><Text style={styles.diffText}>{s.difficulty}</Text></View>
                          {s.estimatedTime && <Text style={styles.timeText}>⏱ {s.estimatedTime}</Text>}
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.suggestionText}>{s.description || (typeof s === 'string' ? s : s.suggestion || s.idea || JSON.stringify(s))}</Text>
                  {s.materialsNeeded && s.materialsNeeded.length > 0 && (
                    <Text style={styles.materialsText}>Materials: {s.materialsNeeded.join(', ')}</Text>
                  )}
                  {s.sustainabilityImpact && (
                    <View style={styles.impactRow}>
                      <Ionicons name="leaf" size={14} color="#4CAF50" />
                      <Text style={styles.impactText}>{s.sustainabilityImpact}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setResult(null); setDescription(''); setImage(null); }}>
              <Text style={styles.secondaryBtnText}>TRY ANOTHER GARMENT</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { paddingTop: 24, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.charcoal, paddingBottom: 16 },
  headerTitle: { color: colors.cream, fontSize: 14, fontFamily: typography.headings, letterSpacing: 2 },
  editorialHeader: { marginBottom: 0 },
  content: { padding: 24, paddingBottom: 180 },
  heroSection: { alignItems: 'center', marginBottom: 28, position: 'relative', overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(20,20,20,0.16)', backgroundColor: '#FAF7F0', padding: 20 },
  atelierIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.goldLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(184,145,47,0.25)' },
  title: { fontSize: 26, fontFamily: typography.headings, color: colors.charcoal, marginTop: 4, marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 22, textAlign: 'center', paddingHorizontal: 12, marginBottom: 4 },
  processRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 16 },
  processStep: { fontFamily: typography.monoBold, fontSize: 9, color: colors.charcoal, letterSpacing: 0.8, backgroundColor: colors.cream, borderWidth: 1, borderColor: 'rgba(20,20,20,0.14)', paddingHorizontal: 7, paddingVertical: 4 },
  imageArea: { width: '100%', height: 200, borderWidth: 1.5, borderColor: colors.charcoal, borderStyle: 'dashed', borderRadius: 8, overflow: 'hidden', marginBottom: 12, backgroundColor: '#FAF7F0' },
  previewImage: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.goldLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(184,145,47,0.22)' },
  imageText: { color: colors.goldDark, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  imageSubtext: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', marginBottom: 16 },
  removeBtnText: { color: '#F44336', fontSize: 12 },
  input: { borderWidth: 1.5, borderColor: colors.charcoal, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, color: colors.charcoal, backgroundColor: '#FAF7F0', fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 24 },
  mainBtn: { width: '100%', height: 56, backgroundColor: colors.gold, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.charcoal },
  mainBtnText: { color: colors.goldDark, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  suggestionsContainer: { gap: 16, marginBottom: 24, marginTop: 16 },
  suggestionCard: { backgroundColor: '#FAF7F0', borderRadius: 8, padding: 20, borderLeftWidth: 3, borderLeftColor: colors.gold, borderWidth: 1, borderColor: 'rgba(20,20,20,0.12)' },
  suggestionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  numberBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center' },
  numberText: { color: colors.goldDark, fontSize: 14, fontWeight: '800' },
  suggestionTitle: { color: colors.charcoal, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  metaRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  diffBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(201, 168, 76, 0.1)', borderWidth: 1, borderColor: 'rgba(201, 168, 76, 0.2)' },
  diffText: { color: colors.goldDark, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  timeText: { color: colors.textMuted, fontSize: 12 },
  suggestionText: { color: colors.textSecond, fontSize: 14, lineHeight: 22, marginBottom: 10 },
  materialsText: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  impactRow: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  impactText: { color: '#4CAF50', fontSize: 12, flex: 1 },
  secondaryBtn: { width: '100%', height: 56, borderWidth: 1.5, borderColor: colors.charcoal, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF7F0' },
  secondaryBtnText: { color: colors.charcoal, fontSize: 14, fontWeight: '700', letterSpacing: 2 },
});
