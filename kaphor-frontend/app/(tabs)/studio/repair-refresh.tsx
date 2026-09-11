import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../../../src/theme';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import {
  assessRepair,
  RepairResult,
  T5GuideResult,
  YouTubeVideo,
  GARMENT_CATEGORIES,
  FIBER_TYPES,
  youTubeUrl,
  difficultyColor,
} from '../../../src/services/repairService';
import {
  isRepairSaved,
  toggleSaveGuide,
  toggleSaveYouTube,
} from '../../../src/services/savedRepairService';

export default function RepairRefreshScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useBackHandler('/(tabs)/circular');

  // ── Input state ──────────────────────────────────────────────
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [fiber, setFiber] = useState('');
  const [showFiberPicker, setShowFiberPicker] = useState(false);
  const [price, setPrice] = useState('');
  const [damageDesc, setDamageDesc] = useState('');

  // ── Result state ─────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);

  // ── Difficulty filter state ───────────────────────────────────
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);

  // ── Saved state ───────────────────────────────────────────────
  const [savedGuideIds, setSavedGuideIds] = useState<Set<string>>(new Set());
  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(new Set());

  // ── Image picker ──────────────────────────────────────────────
  const pickImage = async (useCamera = false) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Camera permission needed'); return; }
        const pick = await ImagePicker.launchCameraAsync({
          quality: 0.85,
          base64: true,
          allowsEditing: true,
        });
        if (!pick.canceled && pick.assets[0]) {
          setImageUri(pick.assets[0].uri);
          setImageBase64(pick.assets[0].base64 || null);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Gallery permission needed'); return; }
        const pick = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          base64: true,
          allowsEditing: true,
        });
        if (!pick.canceled && pick.assets[0]) {
          setImageUri(pick.assets[0].uri);
          setImageBase64(pick.assets[0].base64 || null);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', 'Could not open image picker.');
    }
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleAssess = async () => {
    if (!imageUri) { Alert.alert('Photo required', 'Upload a photo of your garment.'); return; }
    if (!imageBase64) { Alert.alert('Image Error', 'Could not read image data. Try taking a new photo.'); return; }

    setLoading(true);
    try {
      const data = await assessRepair({
        image_base64: imageBase64 || '',
        fiber_type: fiber || 'Cotton',
        garment_category: category || 'other',
        original_price_inr: parseFloat(price) || 0,
        damage_description: damageDesc || 'Garment wear analysis requested.',
      });
      setResult(data);
    } catch (e: any) {
      Alert.alert('Assessment Failed', e?.message || 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────
  const resetAll = () => {
    setResult(null);
    setImageUri(null);
    setImageBase64(null);
    setCategory('');
    setFiber('');
    setPrice('');
    setDamageDesc('');
    setDifficultyFilter(null);
    setSavedGuideIds(new Set());
    setSavedVideoIds(new Set());
  };

  // ── Load saved state when result comes in ──────────────────────
  useEffect(() => {
    if (!result) return;
    const loadSavedState = async () => {
      const guideIds = new Set<string>();
      const videoIds = new Set<string>();

      for (const guide of result.guides) {
        const id = `guide-${guide.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`;
        if (await isRepairSaved(id)) guideIds.add(id);
      }
      for (const video of result.youtube) {
        const id = `yt-${video.videoId}`;
        if (await isRepairSaved(id)) videoIds.add(id);
      }

      setSavedGuideIds(guideIds);
      setSavedVideoIds(videoIds);
    };
    loadSavedState();
  }, [result]);

  // ── Toggle save for a guide ────────────────────────────────────
  const handleToggleSaveGuide = useCallback(
    async (guide: T5GuideResult) => {
      try {
        const garmentLabel = `${category.charAt(0).toUpperCase() + category.slice(1)} — ${fiber}`;
        const damageTypes = result?.glie.damage_breakdown.damage_types.filter(d => d !== 'none') || [];
        const { saved, id } = await toggleSaveGuide(guide, garmentLabel, damageTypes);
        setSavedGuideIds((prev) => {
          const next = new Set(prev);
          if (saved) next.add(id);
          else next.delete(id);
          return next;
        });
        Alert.alert(
          saved ? '✓ Saved' : '✓ Removed',
          saved ? 'Guide saved to your Vault.' : 'Guide removed from your Vault.'
        );
      } catch {
        Alert.alert('Error', 'Could not update saved guides. Please try again.');
      }
    },
    [category, fiber, result]
  );

  // ── Toggle save for a YouTube video ────────────────────────────
  const handleToggleSaveYouTube = useCallback(
    async (video: YouTubeVideo) => {
      try {
        const garmentLabel = `${category.charAt(0).toUpperCase() + category.slice(1)} — ${fiber}`;
        const damageTypes = result?.glie.damage_breakdown.damage_types.filter(d => d !== 'none') || [];
        const { saved, id } = await toggleSaveYouTube(video, garmentLabel, damageTypes);
        setSavedVideoIds((prev) => {
          const next = new Set(prev);
          if (saved) next.add(id);
          else next.delete(id);
          return next;
        });
        Alert.alert(
          saved ? '✓ Saved' : '✓ Removed',
          saved ? 'Video saved to your Vault.' : 'Video removed from your Vault.'
        );
      } catch {
        Alert.alert('Error', 'Could not update saved videos. Please try again.');
      }
    },
    [category, fiber, result]
  );

  // ── Open YouTube video ─────────────────────────────────────────
  const openYouTube = (videoId: string) => {
    const url = youTubeUrl(videoId);
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open YouTube.');
    });
  };

  // ── Loading view ──────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <DossierLoading variant="studio" />
      </View>
    );
  }

  // ── Result view ───────────────────────────────────────────────
  if (result) {
    const hasGuides = result.guides.length > 0;
    const hasYouTube = result.youtube.length > 0;
    const damageTypes = result.glie.damage_breakdown.damage_types.filter(d => d !== 'none');
    const garmentLabel = `${category.charAt(0).toUpperCase() + category.slice(1)} — ${fiber}`;

    // Filtered guides by difficulty
    const filteredGuides = difficultyFilter
      ? result.guides.filter((g) => g.difficulty.toLowerCase() === difficultyFilter.toLowerCase())
      : result.guides;
    const hasFilteredGuides = filteredGuides.length > 0;

    // Difficulty levels present
    const difficultyLevels = ['beginner', 'intermediate', 'advanced'] as const;
    const availableDifficulties = new Set(
      result.guides.map((g) => g.difficulty.toLowerCase())
    );

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={resetAll} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>REPAIR & REFRESH</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ── Garment Summary + Before/After ──────────────────── */}
          <View style={styles.garmentSummaryCard}>
            <Text style={styles.garmentSummaryTitle}>AI VISION ANALYSIS (QWEN2-VL VLM)</Text>
            <Text style={styles.garmentSummaryName}>{garmentLabel}</Text>
            <Text style={styles.garmentSummaryDesc}>{result.glie.description}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>Model: Gemini 3.1 Flash (Vision AI)</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.forest }}>CS: {(result.glie.condition_score * 100).toFixed(1)}%</Text>
            </View>

            {/* ── Before / After Comparison ───────────────────────── */}
            {imageUri && (
              <View style={styles.beforeAfterWrap}>
                <Text style={styles.beforeAfterLabel}>BEFORE / AFTER PREVIEW</Text>
                <View style={styles.beforeAfterRow}>
                  {/* Before */}
                  <View style={styles.beforeAfterCard}>
                    <Image source={{ uri: imageUri }} style={styles.beforeAfterImage} />
                    <View style={styles.beforeAfterTag}>
                      <Text style={styles.beforeAfterTagText}>BEFORE</Text>
                    </View>
                    <Text style={styles.beforeAfterCaption}>Current state</Text>
                  </View>

                  {/* Arrow */}
                  <View style={styles.beforeAfterArrow}>
                    <Ionicons name="arrow-forward" size={24} color={colors.charcoal} />
                  </View>

                  {/* After — visualised from Gemini description */}
                  <View style={styles.beforeAfterCard}>
                    <View style={styles.afterPreview}>
                      <Ionicons name="sparkles" size={32} color={colors.gold} />
                      <Text style={styles.afterPreviewText}>
                        {result.glie.suggested_repair_technique || 'Repaired & Restored'}
                      </Text>
                      <View style={styles.afterPreviewMeta}>
                        {result.glie.repair_feasibility && (
                          <Text style={styles.afterPreviewMetaText} numberOfLines={3}>
                            {result.glie.repair_feasibility}
                          </Text>
                        )}
                        {result.glie.sustainability_score > 0 && (
                          <Text style={styles.afterPreviewImpact}>
                            ♻️ {result.glie.carbon_saved_kg.toFixed(1)} kg CO₂ saved
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={[styles.beforeAfterTag, { backgroundColor: colors.forest }]}>
                      <Text style={styles.beforeAfterTagText}>AFTER</Text>
                    </View>
                    <Text style={styles.beforeAfterCaption}>AI-predicted outcome</Text>
                  </View>
                </View>
              </View>
            )}

            {damageTypes.length > 0 && (
              <View style={styles.damageTags}>
                {damageTypes.map((dt, i) => (
                  <View key={i} style={styles.damageTag}>
                    <Text style={styles.damageTagText}>{dt}</Text>
                  </View>
                ))}
              </View>
            )}
            {result.glie.repair_feasibility && (
              <Text style={styles.garmentFeasibility}>
                {result.glie.repair_feasibility}
              </Text>
            )}
          </View>

          {/* ── Difficulty Filter ────────────────────────────────── */}
          {hasGuides && (
            <View style={styles.filterBar}>
              <Text style={styles.filterLabel}>FILTER:</Text>
              <TouchableOpacity
                style={[styles.filterChip, difficultyFilter === null && styles.filterChipActive]}
                onPress={() => setDifficultyFilter(null)}
              >
                <Text style={[styles.filterChipText, difficultyFilter === null && styles.filterChipTextActive]}>
                  ALL
                </Text>
              </TouchableOpacity>
              {difficultyLevels.map((level) => {
                if (!availableDifficulties.has(level)) return null;
                return (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.filterChip,
                      difficultyFilter === level && styles.filterChipActive,
                      { borderColor: difficultyColor(level) },
                    ]}
                    onPress={() =>
                      setDifficultyFilter((prev) => (prev === level ? null : level))
                    }
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        difficultyFilter === level && styles.filterChipTextActive,
                        { color: difficultyFilter === level ? colors.cream : difficultyColor(level) },
                      ]}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {difficultyFilter && (
                <TouchableOpacity
                  style={styles.filterClear}
                  onPress={() => setDifficultyFilter(null)}
                >
                  <Ionicons name="close-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── T5 Repair Guides ────────────────────────────────── */}
          {hasGuides && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="book-outline" size={18} color={colors.charcoal} />
                <Text style={styles.sectionTitle}>REPAIR GUIDES</Text>
                {difficultyFilter && (
                  <Text style={styles.sectionFilterNote}>
                    ({filteredGuides.length} of {result.guides.length})
                  </Text>
                )}
              </View>
              <Text style={styles.sectionSubtitle}>
                Step-by-step guides matched to your garment
              </Text>
              {hasFilteredGuides ? (
                filteredGuides.map((guide, idx) => {
                  const guideSaveId = `guide-${guide.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`;
                  const isGuideSaved = savedGuideIds.has(guideSaveId);
                  return (
                    <View key={idx} style={styles.guideCard}>
                      {/* Save Button */}
                      <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={() => handleToggleSaveGuide(guide)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={isGuideSaved ? 'bookmark' : 'bookmark-outline'}
                          size={18}
                          color={isGuideSaved ? colors.gold : colors.textMuted}
                        />
                      </TouchableOpacity>

                      <View style={styles.guideHeader}>
                        <View style={[styles.guideTypeBadge, {
                          backgroundColor: guide.doc_type === 'repair' ? '#1E3B2F' :
                            guide.doc_type === 'upcycle' ? '#C95F12' : '#4A2E1A'
                        }]}>
                          <Text style={styles.guideTypeText}>
                            {guide.doc_type.toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.guideMeta}>
                          <View style={[styles.guideDiffBadge, { borderColor: difficultyColor(guide.difficulty) }]}>
                            <Text style={[styles.guideDiffText, { color: difficultyColor(guide.difficulty) }]}>
                              {guide.difficulty}
                            </Text>
                          </View>
                          <Text style={styles.guideTime}>⏱ {guide.time_minutes} min</Text>
                        </View>
                      </View>
                      <Text style={styles.guideTitle}>{guide.title}</Text>
                      <Text style={styles.guideTechnique}>{guide.technique_style}</Text>

                      {/* Steps */}
                      {guide.steps.length > 0 && (
                        <View style={styles.guideSteps}>
                          {guide.steps.map((step, si) => (
                            <View key={si} style={styles.guideStep}>
                              <View style={styles.guideStepNum}>
                                <Text style={styles.guideStepNumText}>{si + 1}</Text>
                              </View>
                              <Text style={styles.guideStepText}>{step}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Tools */}
                      {guide.tools_required.length > 0 && (
                        <View style={styles.guideTools}>
                          <Text style={styles.guideToolsLabel}>Tools needed:</Text>
                          <View style={styles.guideToolsRow}>
                            {guide.tools_required.slice(0, 6).map((tool, ti) => (
                              <View key={ti} style={styles.guideToolChip}>
                                <Text style={styles.guideToolChipText}>{tool}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              ) : (
                <View style={styles.noFilterResults}>
                  <Text style={styles.noFilterResultsText}>
                    No {difficultyFilter} guides found for this garment.
                  </Text>
                  <TouchableOpacity onPress={() => setDifficultyFilter(null)}>
                    <Text style={styles.noFilterResultsAction}>Clear filter</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── YouTube Tutorials ────────────────────────────────── */}
          {hasYouTube && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                <Text style={styles.sectionTitle}>VIDEO TUTORIALS</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                YouTube results for: {result.youtube_query}
              </Text>
              {result.youtube.map((video, idx) => {
                const videoSaveId = `yt-${video.videoId}`;
                const isVideoSaved = savedVideoIds.has(videoSaveId);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.videoCard}
                    onPress={() => openYouTube(video.videoId)}
                    activeOpacity={0.85}
                  >
                    {/* Save Button */}
                    <TouchableOpacity
                      style={styles.saveBtnVideo}
                      onPress={() => handleToggleSaveYouTube(video)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={isVideoSaved ? 'bookmark' : 'bookmark-outline'}
                        size={16}
                        color={isVideoSaved ? colors.gold : colors.cream}
                      />
                    </TouchableOpacity>

                    <View style={styles.videoThumbWrap}>
                      {video.thumbnail ? (
                        <Image source={{ uri: video.thumbnail }} style={styles.videoThumb} />
                      ) : (
                        <View style={styles.videoThumbPlaceholder}>
                          <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.playOverlay}>
                        <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.9)" />
                      </View>
                    </View>
                    <View style={styles.videoInfo}>
                      <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
                      <Text style={styles.videoChannel}>{video.channelTitle}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── No results fallback ──────────────────────────────── */}
          {!hasGuides && !hasYouTube && (
            <View style={styles.emptyCard}>
              <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Matching Guides Found</Text>
              <Text style={styles.emptyText}>
                We couldn't find specific repair guides or videos for this combination. Try uploading a clearer photo or describing the damage in detail.
              </Text>
            </View>
          )}

          {/* ── Professional Upcycling CTA ──────────────────────────── */}
          {result.glie.routing_decision !== 'RECYCLE' && (
            <TouchableOpacity
              style={styles.proUpcycleBtn}
              onPress={() => {
                router.push({
                  pathname: '/(tabs)/studio/upcycle-request',
                  params: {
                    garmentTitle: `${category} — ${fiber}`,
                    damageInfoJson: JSON.stringify({
                      condition_score: result.glie.condition_score,
                      damage_types: result.glie.damage_breakdown.damage_types,
                      repair_feasibility: result.glie.repair_feasibility,
                    }),
                    guidesJson: JSON.stringify(result.guides),
                    youtubeJson: JSON.stringify(result.youtube),
                  },
                });
              }}
            >
              <View style={styles.proUpcycleIconWrap}>
                <Ionicons name="leaf-outline" size={22} color={colors.cream} />
              </View>
              <View style={styles.proUpcycleContent}>
                <Text style={styles.proUpcycleTitle}>PROFESSIONAL UPCYCLING</Text>
                <Text style={styles.proUpcycleDesc}>
                  Have our artisans transform this piece. Send your repair assessment to the Kaphor team.
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.charcoal} />
            </TouchableOpacity>
          )}

          {/* ── Try Another ──────────────────────────────────────── */}
          <TouchableOpacity style={styles.tryAgainBtn} onPress={resetAll}>
            <Text style={styles.tryAgainText}>ASSESS ANOTHER GARMENT</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Input view ────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/circular')} 
          style={styles.headerBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>REPAIR & REFRESH</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={styles.formHero}>
          <Ionicons name="construct-outline" size={40} color={colors.charcoal} />
          <Text style={styles.formHeroTitle}>Repair & Refresh</Text>
          <Text style={styles.formHeroSub}>Upload a photo and our AI will find repair guides, step-by-step tutorials, and YouTube videos to help you fix or upcycle your garment.</Text>
        </View>

        {/* Upload */}
        <TouchableOpacity style={styles.uploadArea} onPress={() => pickImage(false)} activeOpacity={0.8}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.uploadPreview} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="camera-outline" size={36} color={colors.charcoal} />
              <Text style={styles.uploadText}>Tap to upload a photo</Text>
              <Text style={styles.uploadSubtext}>Show the damage clearly</Text>
            </View>
          )}
        </TouchableOpacity>

        {imageUri && (
          <View style={styles.uploadActions}>
            <TouchableOpacity onPress={() => pickImage(false)} style={styles.uploadActionBtn}>
              <Ionicons name="images-outline" size={16} color={colors.charcoal} />
              <Text style={styles.uploadActionText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => pickImage(true)} style={styles.uploadActionBtn}>
              <Ionicons name="camera" size={16} color={colors.charcoal} />
              <Text style={styles.uploadActionText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setImageUri(null); setImageBase64(null); }} style={styles.uploadActionBtn}>
              <Ionicons name="close-outline" size={16} color={colors.red} />
              <Text style={[styles.uploadActionText, { color: colors.red }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Category Picker */}
        <Text style={styles.inputLabel}>GARMENT TYPE (OPTIONAL — AI AUTO-DETECTED)</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => { setShowCategoryPicker(!showCategoryPicker); setShowFiberPicker(false); }}>
          <Text style={category ? styles.pickerText : styles.pickerPlaceholder}>
            {category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Auto-detect from photo (or select)'}
          </Text>
          <Ionicons name={showCategoryPicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.charcoal} />
        </TouchableOpacity>
        {showCategoryPicker && (
          <View style={styles.pickerGrid}>
            {GARMENT_CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat} style={[styles.pickerOption, category === cat && styles.pickerOptionActive]}
                onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}>
                <Text style={[styles.pickerOptionText, category === cat && styles.pickerOptionTextActive]} numberOfLines={1}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Fiber Picker */}
        <Text style={styles.inputLabel}>FABRIC TYPE (OPTIONAL — AI AUTO-DETECTED)</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => { setShowFiberPicker(!showFiberPicker); setShowCategoryPicker(false); }}>
          <Text style={fiber ? styles.pickerText : styles.pickerPlaceholder}>
            {fiber || 'Auto-detect from photo (or select)'}
          </Text>
          <Ionicons name={showFiberPicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.charcoal} />
        </TouchableOpacity>
        {showFiberPicker && (
          <View style={styles.pickerGrid}>
            {FIBER_TYPES.map((f) => (
              <TouchableOpacity key={f} style={[styles.pickerOption, fiber === f && styles.pickerOptionActive]}
                onPress={() => { setFiber(f); setShowFiberPicker(false); }}>
                <Text style={[styles.pickerOptionText, fiber === f && styles.pickerOptionTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Manual fiber input */}
        <TextInput
          style={styles.textInput}
          placeholder="Or type custom fabric (e.g. Khadi, Pashmina)"
          placeholderTextColor={colors.textMuted}
          value={fiber}
          onChangeText={(v) => { setFiber(v); setShowFiberPicker(false); }}
        />

        {/* Price */}
        <Text style={styles.inputLabel}>ORIGINAL PRICE (₹) — OPTIONAL</Text>
        <TextInput
          style={styles.textInput}
          placeholder="What did you pay?"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
        />

        {/* Damage description */}
        <Text style={styles.inputLabel}>DESCRIBE THE DAMAGE — OPTIONAL</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="e.g. tear on the left sleeve, stain on the front, broken zipper..."
          placeholderTextColor={colors.textMuted}
          value={damageDesc}
          onChangeText={setDamageDesc}
          multiline
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !imageUri && styles.submitBtnDisabled]}
          onPress={handleAssess}
          disabled={loading || !imageUri}
        >
          {loading ? (
            <View style={styles.submitRow}>
              <ActivityIndicator color={colors.cream} size="small" />
              <Text style={styles.submitText}>  ANALYZING...</Text>
            </View>
          ) : (
            <View style={styles.submitRow}>
              <Ionicons name="search-outline" size={18} color={colors.cream} />
              <Text style={styles.submitText}>  FIND REPAIR SOLUTIONS</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.hintText}>
          Our AI will assess the damage, match repair guides, and find video tutorials.
        </Text>
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },

  // ── Header ────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  headerBack: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: colors.charcoal, fontSize: 14, fontFamily: typography.mono, fontWeight: '900', letterSpacing: 2 },

  // ── Scroll ─────────────────────────────────────────────────────
  scrollContent: { padding: 20, paddingBottom: 100 },

  // ── Form Hero ──────────────────────────────────────────────────
  formHero: { alignItems: 'center', marginBottom: 28, gap: 12 },
  formHeroTitle: { fontSize: 28, fontFamily: typography.headings, color: colors.charcoal, letterSpacing: 1 },
  formHeroSub: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 },

  // ── Upload ────────────────────────────────────────────────────
  uploadArea: { width: '100%', height: 200, borderWidth: 2, borderColor: colors.charcoal, borderStyle: 'dashed', backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  uploadPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  uploadPlaceholder: { alignItems: 'center', gap: 8 },
  uploadText: { fontFamily: typography.mono, fontSize: 13, fontWeight: '800', color: colors.charcoal },
  uploadSubtext: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted },
  uploadActions: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 16 },
  uploadActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10 },
  uploadActionText: { fontFamily: typography.mono, fontSize: 10, fontWeight: '800', color: colors.charcoal },

  // ── Inputs ────────────────────────────────────────────────────
  inputLabel: { fontFamily: typography.mono, fontSize: 9, fontWeight: '900', color: colors.charcoal, letterSpacing: 1.5, marginBottom: 8, marginTop: 20 },
  textInput: { borderWidth: 1.5, borderColor: colors.charcoal, padding: 14, fontFamily: typography.body, fontSize: 14, color: colors.charcoal, backgroundColor: colors.white },
  textArea: { minHeight: 80, textAlignVertical: 'top', marginTop: 8 },

  // ── Pickers ───────────────────────────────────────────────────
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: colors.charcoal, padding: 14, backgroundColor: colors.white },
  pickerText: { fontFamily: typography.body, fontSize: 14, color: colors.charcoal },
  pickerPlaceholder: { fontFamily: typography.body, fontSize: 14, color: colors.textMuted },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.charcoal, borderTopWidth: 0 },
  pickerOption: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: colors.charcoal, backgroundColor: colors.cream },
  pickerOptionActive: { backgroundColor: colors.charcoal },
  pickerOptionText: { fontFamily: typography.mono, fontSize: 11, fontWeight: '700', color: colors.charcoal },
  pickerOptionTextActive: { color: colors.cream },

  // ── Submit ────────────────────────────────────────────────────
  submitBtn: { backgroundColor: colors.charcoal, height: 56, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.charcoal, shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4, marginTop: 32 },
  submitBtnDisabled: { opacity: 0.5 },
  submitRow: { flexDirection: 'row', alignItems: 'center' },
  submitText: { color: colors.cream, fontFamily: typography.mono, fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  hintText: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: 16, lineHeight: 16 },

  // ── Result: Garment Summary ──────────────────────────────────
  garmentSummaryCard: {
    backgroundColor: colors.white,
    padding: 24,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginBottom: 24,
  },
  garmentSummaryTitle: { fontFamily: typography.mono, fontSize: 10, fontWeight: '900', color: colors.textMuted, letterSpacing: 1.5, marginBottom: 8 },  
  garmentSummaryName: { fontFamily: typography.headings, fontSize: 32, color: colors.charcoal, lineHeight: 36, marginBottom: 12 },
  garmentSummaryDesc: { fontFamily: typography.body, fontSize: 13, color: colors.charcoal, lineHeight: 20, marginBottom: 12 },
  garmentFeasibility: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, lineHeight: 16, fontStyle: 'italic', marginTop: 8 },

  // ── Result: Damage Tags ───────────────────────────────────────
  damageTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  damageTag: { backgroundColor: colors.cream, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.charcoal },
  damageTagText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '700', color: colors.charcoal },

  // ── Result: Section ───────────────────────────────────────────
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', gap: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: colors.charcoal, paddingBottom: 10, marginBottom: 12 },
  sectionTitle: { fontFamily: typography.mono, fontSize: 12, fontWeight: '900', color: colors.charcoal, letterSpacing: 1.5 },
  sectionSubtitle: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, marginBottom: 16, lineHeight: 16 },

  // ── Result: Guide Card ────────────────────────────────────────
  guideCard: { backgroundColor: colors.white, padding: 20, borderWidth: 2, borderColor: colors.charcoal, shadowColor: colors.charcoal, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3, marginBottom: 16 },
  guideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  guideTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.charcoal },
  guideTypeText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', color: colors.cream, letterSpacing: 1 },
  guideMeta: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  guideDiffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  guideDiffText: { fontFamily: typography.mono, fontSize: 8, fontWeight: '700' },
  guideTime: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted },
  guideTitle: { fontFamily: typography.headings, fontSize: 20, color: colors.charcoal, marginBottom: 6, lineHeight: 24 },
  guideTechnique: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, marginBottom: 16, letterSpacing: 0.5 },
  guideSteps: { gap: 8, marginBottom: 16 },
  guideStep: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  guideStepNum: { width: 22, height: 22, backgroundColor: colors.charcoal, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  guideStepNumText: { fontFamily: typography.mono, fontSize: 10, fontWeight: '800', color: colors.cream },
  guideStepText: { flex: 1, fontFamily: typography.body, fontSize: 13, color: colors.charcoal, lineHeight: 20 },
  guideTools: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  guideToolsLabel: { fontFamily: typography.mono, fontSize: 9, fontWeight: '700', color: colors.textMuted, marginBottom: 8 },
  guideToolsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  guideToolChip: { backgroundColor: colors.cream, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.charcoal },
  guideToolChipText: { fontFamily: typography.mono, fontSize: 8, fontWeight: '600', color: colors.charcoal },

  // ── Result: YouTube Video Card ─────────────────────────────────
  videoCard: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.charcoal, shadowColor: colors.charcoal, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3, marginBottom: 16, overflow: 'hidden' },
  videoThumbWrap: { width: '100%', height: 180, position: 'relative' },
  videoThumb: { width: '100%', height: '100%' },
  videoThumbPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
  videoInfo: { padding: 14 },
  videoTitle: { fontFamily: typography.body, fontSize: 14, fontWeight: '700', color: colors.charcoal, lineHeight: 20, marginBottom: 4 },
  videoChannel: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted },

  // ── Result: Empty State ───────────────────────────────────────
  emptyCard: { alignItems: 'center', padding: 32, borderWidth: 2, borderColor: colors.charcoal, borderStyle: 'dashed', gap: 12, marginBottom: 24 },
  emptyTitle: { fontFamily: typography.mono, fontSize: 12, fontWeight: '800', color: colors.charcoal },
  emptyText: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, textAlign: 'center', lineHeight: 16 },

  // ── Result: Professional Upcycling CTA ───────────────────────
  proUpcycleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 18,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    marginBottom: 20,
    gap: 14,
  },
  proUpcycleIconWrap: {
    width: 44,
    height: 44,
    backgroundColor: colors.forest,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
  },
  proUpcycleContent: { flex: 1 },
  proUpcycleTitle: { fontFamily: typography.mono, fontSize: 11, fontWeight: '900', color: colors.charcoal, letterSpacing: 1, marginBottom: 4 },
  proUpcycleDesc: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, lineHeight: 14 },

  // ── Result: Before / After ────────────────────────────────────
  beforeAfterWrap: { marginTop: 20, marginBottom: 16, padding: 16, backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.charcoal },
  beforeAfterLabel: { fontFamily: typography.mono, fontSize: 8, fontWeight: '900', color: colors.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  beforeAfterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  beforeAfterCard: { flex: 1, alignItems: 'center' },
  beforeAfterImage: { width: '100%', height: 100, borderWidth: 1.5, borderColor: colors.charcoal, resizeMode: 'cover' },
  beforeAfterArrow: { paddingHorizontal: 8, paddingTop: 40 },
  beforeAfterTag: { backgroundColor: colors.red, paddingHorizontal: 6, paddingVertical: 2, marginTop: 6, borderWidth: 1, borderColor: colors.charcoal },
  beforeAfterTagText: { fontFamily: typography.mono, fontSize: 7, fontWeight: '800', color: colors.cream, letterSpacing: 1 },
  beforeAfterCaption: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, marginTop: 4 },
  afterPreview: { width: '100%', height: 100, backgroundColor: '#F5F0E8', borderWidth: 1.5, borderColor: colors.charcoal, justifyContent: 'center', alignItems: 'center', padding: 8, gap: 6 },
  afterPreviewText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '700', color: colors.charcoal, textAlign: 'center', lineHeight: 14 },
  afterPreviewMeta: { alignItems: 'center' },
  afterPreviewMetaText: { fontFamily: typography.mono, fontSize: 7, color: colors.textMuted, textAlign: 'center', lineHeight: 10 },
  afterPreviewImpact: { fontFamily: typography.mono, fontSize: 7, color: colors.forest, marginTop: 4, textAlign: 'center' },

  // ── Result: Save Button (on guide cards) ──────────────────────
  saveBtn: { position: 'absolute', top: 10, right: 10, zIndex: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.charcoal, shadowColor: colors.charcoal, shadowOffset: { width: 1, height: 1 }, shadowOpacity: 0.3, shadowRadius: 0, elevation: 2 },
  saveBtnVideo: { position: 'absolute', top: 8, right: 8, zIndex: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },

  // ── Result: Difficulty Filter Bar ──────────────────────────────
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
  },
  filterLabel: { fontFamily: typography.mono, fontSize: 9, fontWeight: '900', color: colors.textMuted, letterSpacing: 1, marginRight: 4 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  filterChipActive: { backgroundColor: colors.charcoal },
  filterChipText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '700', color: colors.charcoal },
  filterChipTextActive: { color: colors.cream },
  filterClear: { padding: 4 },

  // ── Result: Section filter note ────────────────────────────────
  sectionFilterNote: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, marginLeft: 'auto' },

  // ── Result: No filter results ──────────────────────────────────
  noFilterResults: { alignItems: 'center', padding: 24, gap: 8, borderWidth: 1.5, borderColor: colors.charcoal, borderStyle: 'dashed', backgroundColor: colors.white },
  noFilterResultsText: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  noFilterResultsAction: { fontFamily: typography.mono, fontSize: 10, fontWeight: '700', color: colors.charcoal, textDecorationLine: 'underline' },

  // ── Result: Try Again ─────────────────────────────────────────
  tryAgainBtn: { height: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.charcoal, backgroundColor: colors.cream },
  tryAgainText: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});
