import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import api from '../../../src/services/api';
import { colors, typography } from '../../../src/theme';
import { youTubeUrl } from '../../../src/services/repairService';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';

const DIFFICULTY_COLORS: Record<string, string> = {
  BEGINNER: '#1E3B2F',
  INTERMEDIATE: '#C95F12',
  ADVANCED: '#A82222',
};

export default function UpcycleRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useBackHandler('/(tabs)/circular');
  const params = useLocalSearchParams<{
    garmentId?: string;
    garmentTitle?: string;
    suggestions?: string;
    // New repair assessment params
    damageInfoJson?: string;
    guidesJson?: string;
    youtubeJson?: string;
  }>();

  const garmentId = params.garmentId || '';
  const garmentTitle = params.garmentTitle || 'this garment';

  // Parse AI suggestions (from repair-refresh guides or existing flow)
  let initialSuggestions: any[] = [];
  try {
    if (params.suggestions) initialSuggestions = JSON.parse(params.suggestions);
    if (params.guidesJson && initialSuggestions.length === 0) {
      const guides = JSON.parse(params.guidesJson);
      initialSuggestions = guides.map((g: any) => ({
        title: g.title,
        description: g.steps?.slice(0, 3).join('. ') || g.technique_style || '',
        difficulty: g.difficulty,
        estimatedTime: `${g.time_minutes} min`,
        materialsNeeded: g.tools_required || [],
      }));
    }
  } catch {}

  // Parse repair assessment data
  let damageInfo: any = null;
  try {
    if (params.damageInfoJson) damageInfo = JSON.parse(params.damageInfoJson);
  } catch {}
  let youtubeVids: any[] = [];
  try {
    if (params.youtubeJson) youtubeVids = JSON.parse(params.youtubeJson);
  } catch {}

  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    initialSuggestions.length > 0 ? 0 : null
  );
  const [customIdea, setCustomIdea] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!pick.canceled) {
      setPhotos((prev) => [...prev, pick.assets[0].uri]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (selectedIndex === null && !customIdea.trim()) {
      Alert.alert('Selection Required', 'Pick an AI suggestion or describe your custom idea.');
      return;
    }

    setSubmitting(true);
    try {
      const base64Photos = await Promise.all(
        photos.map(async (uri) => {
          const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
          return `data:image/jpeg;base64,${b64}`;
        }),
      );

      // Build the notes payload with repair assessment context
      const enhancedNotes = [
        notes.trim() || null,
        damageInfo ? `--- AI Assessment ---\nCondition: ${(damageInfo.condition_score * 100).toFixed(0)}%\nDamage types: ${(damageInfo.damage_types || []).join(', ')}\nFeasibility: ${damageInfo.repair_feasibility || ''}` : null,
      ].filter(Boolean).join('\n\n');

      if (garmentId) {
        // Full submission with garment in database
        await api.post('/upcycling/request', {
          garmentId,
          suggestionIndex: selectedIndex,
          customIdea: customIdea.trim() || null,
          notes: enhancedNotes || null,
          images: base64Photos,
        });
      } else {
        // No garment ID — send a general inquiry to the bespoke endpoint
        await api.post('/studio/bespoke-request', {
          description: [
            `Upcycling interest for: ${garmentTitle}`,
            customIdea.trim() ? `\nIdea: ${customIdea.trim()}` : null,
            enhancedNotes ? `\n${enhancedNotes}` : null,
          ].filter(Boolean).join('\n'),
          contactEmail: 'user@kaphor.app',
        });
      }

      Alert.alert(
        'Request Submitted',
        garmentId
          ? 'Your upcycling request has been sent to our team. We will review it and get back to you.'
          : 'Your upcycling interest has been noted. Our team will reach out with options.',
        [{ text: 'OK', onPress: () => safeBack('/(tabs)/circular') }],
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Could not submit request. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/circular')} 
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>UPCYCLE REQUEST</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.garmentLabel}>
          Garment: <Text style={styles.garmentName}>{garmentTitle}</Text>
        </Text>

        {/* ── AI Assessment Summary (from Repair & Refresh) ────────── */}
        {damageInfo && (
          <View style={styles.assessmentCard}>
            <View style={styles.assessmentHeader}>
              <Ionicons name="scan-outline" size={20} color={colors.charcoal} />
              <Text style={styles.assessmentTitle}>AI DAMAGE ASSESSMENT</Text>
            </View>
            <View style={styles.assessmentRow}>
              <Text style={styles.assessmentLabel}>Condition</Text>
              <View style={styles.assessmentBadge}>
                <Text style={styles.assessmentBadgeText}>
                  {(damageInfo.condition_score * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
            {damageInfo.damage_types?.length > 0 && (
              <View style={styles.assessmentTags}>
                {damageInfo.damage_types.map((dt: string, i: number) => (
                  <View key={i} style={styles.assessmentTag}>
                    <Text style={styles.assessmentTagText}>{dt}</Text>
                  </View>
                ))}
              </View>
            )}
            {damageInfo.repair_feasibility && (
              <Text style={styles.assessmentFeasibility}>{damageInfo.repair_feasibility}</Text>
            )}
          </View>
        )}

        {/* ── YouTube References (from Repair & Refresh) ──────────── */}
        {youtubeVids.length > 0 && (
          <View style={styles.ytSection}>
            <View style={styles.ytHeader}>
              <Ionicons name="logo-youtube" size={16} color="#FF0000" />
              <Text style={styles.ytTitle}>REFERENCE TUTORIALS</Text>
            </View>
            <View style={styles.ytRow}>
              {youtubeVids.slice(0, 3).map((yt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.ytChip}
                  onPress={() => Linking.openURL(youTubeUrl(yt.videoId)).catch(() => {})}
                >
                  {yt.thumbnail ? (
                    <Image source={{ uri: yt.thumbnail }} style={styles.ytThumb} />
                  ) : (
                    <View style={[styles.ytThumb, { backgroundColor: colors.cream, justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="play" size={16} color={colors.charcoal} />
                    </View>
                  )}
                  <Text style={styles.ytChipTitle} numberOfLines={2}>{yt.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── AI Suggestions ──────────────────────────────────────── */}
        {initialSuggestions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>AI SUGGESTIONS</Text>
            <Text style={styles.sectionSub}>Tap one to select it, or write your own idea below</Text>
            {initialSuggestions.map((s: any, i: number) => (
              <TouchableOpacity
                key={i}
                style={[styles.suggestionCard, selectedIndex === i && styles.suggestionCardSelected]}
                onPress={() => {
                  setSelectedIndex(selectedIndex === i ? null : i);
                  setCustomIdea('');
                }}
              >
                <View style={styles.suggestionHeader}>
                  <View style={[styles.numberBadge, selectedIndex === i && styles.numberBadgeSelected]}>
                    <Text style={[styles.numberText, selectedIndex === i && styles.numberTextSelected]}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.suggestionTitle, selectedIndex === i && styles.suggestionTitleSelected]}>
                      {s.title || `Idea ${i + 1}`}
                    </Text>
                    {s.difficulty && (
                      <View style={styles.metaRow}>
                        <View style={[styles.diffBadge, { backgroundColor: (DIFFICULTY_COLORS[s.difficulty.toUpperCase()] || '#555') + '20', borderColor: DIFFICULTY_COLORS[s.difficulty.toUpperCase()] || '#555' }]}>
                          <Text style={[styles.diffText, { color: DIFFICULTY_COLORS[s.difficulty.toUpperCase()] || '#555' }]}>{s.difficulty}</Text>
                        </View>
                        {s.estimatedTime && <Text style={styles.timeText}>⏱ {s.estimatedTime}</Text>}
                      </View>
                    )}
                  </View>
                  {selectedIndex === i && <Ionicons name="checkmark-circle" size={22} color={colors.crimson} />}
                </View>
                <Text style={styles.suggestionDesc}>{s.description}</Text>
                {s.materialsNeeded?.length > 0 && (
                  <Text style={styles.materialsText}>Materials: {s.materialsNeeded.join(', ')}</Text>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>OR CUSTOM IDEA</Text>
        <TextInput
          style={[styles.textArea, selectedIndex !== null && { opacity: 0.3 }]}
          placeholder="Describe your own upcycling vision..."
          placeholderTextColor={colors.textMuted}
          value={customIdea}
          onChangeText={(v) => { setCustomIdea(v); if (v) setSelectedIndex(null); }}
          multiline
          editable={selectedIndex === null}
        />

        <Text style={styles.sectionTitle}>NOTES FOR OUR TEAM</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Any specific requests, budget, timeline... AI assessment data will be sent automatically."
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <Text style={styles.sectionTitle}>ADDITIONAL PHOTOS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
          {photos.map((uri, i) => (
            <View key={i} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)}>
                <Ionicons name="close-circle" size={20} color={colors.crimson} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhoto}>
            <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
            <Text style={styles.addPhotoText}>ADD</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.cream} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="leaf-outline" size={18} color={colors.cream} />
              <Text style={styles.submitBtnText}>
                {garmentId ? 'SUBMIT UPCYCLE REQUEST' : 'SEND INTEREST →'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  backBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 14, fontFamily: typography.headings, color: colors.charcoal, letterSpacing: 2 },
  content: { padding: 20, paddingBottom: 60 },
  garmentLabel: { fontSize: 13, fontFamily: typography.body, color: colors.textMuted, marginBottom: 20 },
  garmentName: { color: colors.charcoal, fontWeight: '700' },

  // AI Assessment Card
  assessmentCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 16,
    marginBottom: 20,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  assessmentHeader: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  assessmentTitle: { fontFamily: typography.mono, fontSize: 10, fontWeight: '900', color: colors.textMuted, letterSpacing: 1.5 },
  assessmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  assessmentLabel: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted },
  assessmentBadge: { backgroundColor: colors.charcoal, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.charcoal },
  assessmentBadgeText: { fontFamily: typography.mono, fontSize: 12, fontWeight: '800', color: colors.cream },
  assessmentTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  assessmentTag: { backgroundColor: colors.cream, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.charcoal },
  assessmentTagText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '700', color: colors.charcoal },
  assessmentFeasibility: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, lineHeight: 16, fontStyle: 'italic' },

  // YouTube References
  ytSection: { marginBottom: 20 },
  ytHeader: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 10 },
  ytTitle: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 1 },
  ytRow: { flexDirection: 'column', gap: 8 },
  ytChip: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.white, padding: 8, borderWidth: 1, borderColor: colors.charcoal },
  ytThumb: { width: 40, height: 40, borderWidth: 1, borderColor: colors.charcoal },
  ytChipTitle: { flex: 1, fontFamily: typography.mono, fontSize: 9, color: colors.charcoal, lineHeight: 14 },

  sectionTitle: {
    fontSize: 12,
    fontFamily: typography.headings,
    color: colors.charcoal,
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 4,
  },
  sectionSub: { fontSize: 11, fontFamily: typography.body, color: colors.textMuted, marginBottom: 12 },
  suggestionCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  suggestionCardSelected: {
    borderColor: colors.crimson,
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  suggestionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  numberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.bgMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberBadgeSelected: { backgroundColor: colors.crimson },
  numberText: { fontSize: 13, fontWeight: '700', color: colors.charcoal },
  numberTextSelected: { color: colors.white },
  suggestionTitle: { fontSize: 15, fontWeight: '700', color: colors.charcoal, marginBottom: 4 },
  suggestionTitleSelected: { color: colors.crimson },
  metaRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  diffText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  timeText: { color: colors.textMuted, fontSize: 11 },
  suggestionDesc: { color: colors.textSecond, fontSize: 13, lineHeight: 20, marginBottom: 8 },
  materialsText: { color: colors.textMuted, fontSize: 11 },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.charcoal,
    fontSize: 13,
    fontFamily: typography.body,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 8,
    backgroundColor: colors.white,
  },
  photoStrip: { flexDirection: 'row', marginTop: 12, marginBottom: 8 },
  photoWrapper: { marginRight: 10, position: 'relative' },
  photo: { width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  photoRemove: { position: 'absolute', top: -6, right: -6 },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
  },
  addPhotoText: { color: colors.textMuted, fontSize: 9, fontFamily: typography.headings, letterSpacing: 1, marginTop: 4 },
  submitBtn: {
    width: '100%',
    height: 52,
    backgroundColor: colors.charcoal,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnText: { color: colors.cream, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
});
