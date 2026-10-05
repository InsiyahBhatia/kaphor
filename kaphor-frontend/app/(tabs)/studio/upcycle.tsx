import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SolarIcon } from '../../../src/components/common/SolarIcon';
import * as ImagePicker from 'expo-image-picker';
import { promptPhotoSelection } from '../../../src/utils/imagePicker';
import * as FileSystem from 'expo-file-system/legacy';
import api from '../../../src/services/api';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { EditorialPageHeader, HandwrittenNote, IllustrationLayer } from '../../../src/components/editorial/IllustrationLayer';
import { colors, typography } from '../../../src/theme';
import { Spinner } from '../../../src/components/common/Loader';
import { cleanText, formatValue } from '../../../src/utils/formatText';

/** Turn whatever the server sends into a clean idea card (never raw JSON). */
function normalizeIdea(raw: any, index: number) {
  if (typeof raw === 'string') {
    return { title: `Idea ${index + 1}`, description: cleanText(raw), difficulty: '', estimatedTime: '', materials: [] as string[], impact: '' };
  }
  const r = raw && typeof raw === 'object' ? raw : {};
  const materials = Array.isArray(r.materialsNeeded) ? r.materialsNeeded.map((m: any) => formatValue(m)).filter(Boolean) : [];
  return {
    title: cleanText(r.title || r.name, `Idea ${index + 1}`),
    description: cleanText(r.description || r.suggestion || r.idea || r.text, ''),
    difficulty: cleanText(r.difficulty, ''),
    estimatedTime: cleanText(r.estimatedTime, ''),
    materials,
    impact: cleanText(r.sustainabilityImpact, ''),
  };
}

const UPCYCLE_YOUTUBE_TUTORIALS = [
  {
    id: 'yt-1',
    title: 'DIY Clothes Upcycling: Transform Old Clothes Into Trendy Outfits',
    channel: 'Coolirpa',
    videoId: '04Y_c20_92k',
    thumbnail: 'https://img.youtube.com/vi/04Y_c20_92k/hqdefault.jpg',
    vibe: 'Beginner friendly',
  },
  {
    id: 'yt-2',
    title: 'Thrift Flip & Denim Re-imagining: Old Jeans to Designer Co-ord',
    channel: 'Withwendy',
    videoId: 'W6LgQd59xWg',
    thumbnail: 'https://img.youtube.com/vi/W6LgQd59xWg/hqdefault.jpg',
    vibe: 'Denim & outerwear',
  },
  {
    id: 'yt-3',
    title: 'Turn Heavy Old Sari / Dupatta into Modern Indo-Western Jacket & Dress',
    channel: 'Kriti Atelier DIY',
    videoId: 'fQ7rW1u5K_U',
    thumbnail: 'https://img.youtube.com/vi/fQ7rW1u5K_U/hqdefault.jpg',
    vibe: 'Ethnic fusion',
  },
  {
    id: 'yt-4',
    title: 'Sashiko Visible Mending & Japanese Patchwork Technique',
    channel: 'Minimalist Crafting',
    videoId: 'P6S911v0wWw',
    thumbnail: 'https://img.youtube.com/vi/P6S911v0wWw/hqdefault.jpg',
    vibe: 'Artisanal repair',
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
        Alert.alert('Could not add photo', 'Please try again, or choose a different photo.');
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
        // Text-only: the condition endpoint accepts just a description
        const { data } = await api.post('/ai/assess-condition', { description }, { timeout: 60000 });
        setResult(data.data?.upcycleSuggestions || []);
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
          <SolarIcon name="chevron-back" size={28} color={colors.cream} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upcycle studio</Text>
        <View style={{ width: 28 }} />
      </View>

      <EditorialPageHeader
        title="Upcycle studio"
        subtitle="Old garment // cut // rework // new piece"
        eyebrow="Digital atelier"
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
                <SolarIcon name="cut-outline" size={30} color={colors.goldDark} />
              </View>
              <Text style={styles.title}>AI Upcycle Ideas</Text>
              <Text style={styles.subtitle}>Upload a photo or describe a garment and our AI will suggest creative ways to transform it.</Text>
              <View style={styles.processRow}>
                {['OLD GARMENT', 'CUT', 'REWORK', 'New piece'].map((step, index) => (
                  <React.Fragment key={step}>
                    <Text style={styles.processStep}>{step}</Text>
                    {index < 3 && <SolarIcon name="arrow-forward" size={13} color={colors.textMuted} />}
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
                    <SolarIcon name="camera" size={28} color={colors.goldDark} />
                  </View>
                  <Text style={styles.imageText}>Take or upload photo</Text>
                  <Text style={styles.imageSubtext}>Camera or gallery (unlocks AI vision)</Text>
                </View>
              )}
            </TouchableOpacity>
            {image && (
              <TouchableOpacity onPress={() => setImage(null)} style={styles.removeBtn}>
                <SolarIcon name="close-circle" size={16} color={colors.error} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.removeBtnText}>Remove Photo</Text>
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
                  <Spinner color={colors.goldDark} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.mainBtnText}>  {image ? 'Analyzing image...' : 'Getting ideas...'}</Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <SolarIcon name="sparkles" size={18} color={colors.goldDark} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.mainBtnText}>  GET AI SUGGESTIONS</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ── YouTube Upcycling Masterclass Tutorials ───────────────────────────── */}
            <View style={{ marginTop: 32, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <SolarIcon name="logo-youtube" size={20} color={colors.error} />
                <Text style={{ fontFamily: typography.headings, fontSize: 18, color: colors.charcoal, letterSpacing: 1.5 }}>
                  Upcycling video tutorials
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                {UPCYCLE_YOUTUBE_TUTORIALS.map((yt) => (
                  <TouchableOpacity
                    key={yt.id}
                    style={{
                      width: 210,
                      backgroundColor: colors.paperLight,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
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
                        backgroundColor: colors.overlay,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <SolarIcon name="play-circle" size={36} color={colors.paperGlass} />
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
              {(Array.isArray(result) ? result : [result]).map(normalizeIdea).map((s: any, i: number) => (
                <View key={i} style={styles.suggestionCard}>
                  <View style={styles.suggestionHeader}>
                    <View style={styles.numberBadge}><Text style={styles.numberText}>{i + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionTitle}>{s.title}</Text>
                      {!!s.difficulty && (
                        <View style={styles.metaRow}>
                          <View style={styles.diffBadge}><Text style={styles.diffText}>{s.difficulty}</Text></View>
                          {!!s.estimatedTime && <Text style={styles.timeText}>Time: {s.estimatedTime}</Text>}
                        </View>
                      )}
                    </View>
                  </View>
                  {!!s.description && <Text style={styles.suggestionText}>{s.description}</Text>}
                  {s.materials.length > 0 && (
                    <Text style={styles.materialsText}>Materials: {s.materials.join(', ')}</Text>
                  )}
                  {!!s.impact && (
                    <View style={styles.impactRow}>
                      <SolarIcon name="leaf" size={14} color={colors.success} />
                      <Text style={styles.impactText}>{s.impact}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setResult(null); setDescription(''); setImage(null); }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.secondaryBtnText}>Try another garment</Text>
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
  heroSection: { alignItems: 'center', marginBottom: 28, position: 'relative', overflow: 'hidden', borderWidth: 1.5, borderColor: colors.borderLight, backgroundColor: colors.paperLight, padding: 20 },
  atelierIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.goldLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: colors.goldLight },
  title: { fontSize: 26, fontFamily: typography.headings, color: colors.charcoal, marginTop: 4, marginBottom: 8 },
  subtitle: {
 color: colors.textMuted, fontSize: 14, lineHeight: 22, textAlign: 'center', paddingHorizontal: 12, marginBottom: 4, fontFamily: typography.body,
  },
  processRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 16 },
  processStep: { fontFamily: typography.handwritten, fontSize: 14, color: colors.charcoal, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 7, paddingVertical: 4, includeFontPadding: false, },
  imageArea: { width: '100%', height: 200, borderWidth: 1.5, borderColor: colors.charcoal, borderStyle: 'dashed', borderRadius: 8, overflow: 'hidden', marginBottom: 12, backgroundColor: colors.paperLight },
  previewImage: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.goldLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: colors.goldLight },
  imageText: {
 color: colors.goldDark, fontSize: 12, fontWeight: '700', letterSpacing: 2, fontFamily: typography.bodyBold,
  },
  imageSubtext: {
 color: colors.textMuted, fontSize: 11, marginTop: 4, fontFamily: typography.body,
  },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', marginBottom: 16 },
  removeBtnText: {
 color: colors.error, fontSize: 12, fontFamily: typography.body,
  },
  input: {
 borderWidth: 1.5, borderColor: colors.charcoal, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, color: colors.charcoal, backgroundColor: colors.paperLight, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 24, fontFamily: typography.body,
  },
  mainBtn: { width: '100%', height: 56, backgroundColor: colors.gold, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.charcoal },
  mainBtnText: {
 color: colors.goldDark, fontSize: 15, fontWeight: '800', letterSpacing: 1, fontFamily: typography.bodyBold,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  suggestionsContainer: { gap: 16, marginBottom: 24, marginTop: 16 },
  suggestionCard: { backgroundColor: colors.paperLight, borderRadius: 8, padding: 20, borderLeftWidth: 3, borderLeftColor: colors.gold, borderWidth: 1, borderColor: colors.borderLight },
  suggestionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  numberBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center' },
  numberText: {
 color: colors.goldDark, fontSize: 14, fontWeight: '800', fontFamily: typography.bodyBold,
  },
  suggestionTitle: {
 color: colors.charcoal, fontSize: 16, fontWeight: '700', marginBottom: 4, fontFamily: typography.bodyBold,
  },
  metaRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  diffBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.goldLight, borderWidth: 1, borderColor: colors.goldLight },
  diffText: {
 color: colors.goldDark, fontSize: 10, fontWeight: '700', letterSpacing: 1, fontFamily: typography.bodyBold,
  },
  timeText: {
 color: colors.textMuted, fontSize: 12, fontFamily: typography.body,
  },
  suggestionText: {
 color: colors.textSecond, fontSize: 14, lineHeight: 22, marginBottom: 10, fontFamily: typography.body,
  },
  materialsText: {
 color: colors.textMuted, fontSize: 12, marginBottom: 8, fontFamily: typography.body,
  },
  impactRow: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.overlayLight },
  impactText: {
 color: colors.success, fontSize: 12, flex: 1, fontFamily: typography.body,
  },
  secondaryBtn: { width: '100%', height: 56, borderWidth: 1.5, borderColor: colors.charcoal, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.paperLight },
  secondaryBtnText: {
 color: colors.charcoal, fontSize: 14, fontWeight: '700', letterSpacing: 2, fontFamily: typography.bodyBold,
  },
});
