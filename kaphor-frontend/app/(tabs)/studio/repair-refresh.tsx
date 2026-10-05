import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { promptPhotoSelection } from '../../../src/utils/imagePicker';
import { colors, typography, spacing, radius } from '../../../src/theme';
import { Header } from '../../../src/components/common/Header';
import { Loader } from '../../../src/components/common/Loader';
import {
  assessRepair,
  lookupRepairFromAssessment,
  getSharedRepairAssessment,
  RepairResult,
  YouTubeVideo,
  BlogArticle,
  GARMENT_CATEGORIES,
  FIBER_TYPES,
  youTubeUrl,
  youTubeSearchUrl,
  difficultyColor,
} from '../../../src/services/repairService';
import {
  isRepairSaved,
  toggleSaveYouTube,
  toggleSaveBlog,
  youtubeSaveId,
  blogSaveId,
} from '../../../src/services/savedRepairService';

type Mode = 'repair' | 'upcycle';

const MAX_VIDEOS = 5;
const MAX_BLOGS = 5;

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function thumbnailFor(video: YouTubeVideo): string {
  return video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
}

function openLink(url: string, failMessage: string) {
  Linking.openURL(url).catch(() => Alert.alert('Could not open link', failMessage));
}

export default function RepairRefreshScreen() {
  const params = useLocalSearchParams<{
    prefillImage?: string;
    prefillBase64?: string;
    prefillCategory?: string;
    prefillFiber?: string;
    prefillPrice?: string;
    mode?: Mode;
    autoAssess?: string;
    useSharedAssessment?: string;
    damageTypes?: string;
    damageDescription?: string;
    repairFeasibility?: string;
    conditionScore?: string;
  }>();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<Mode>(params.mode === 'upcycle' ? 'upcycle' : 'repair');

  // ── Input state ──────────────────────────────────────────────
  const [imageUri, setImageUri] = useState<string | null>(params.prefillImage || null);
  const [imageBase64, setImageBase64] = useState<string | null>(params.prefillBase64 || null);
  const [category, setCategory] = useState(params.prefillCategory || '');
  const [fiber, setFiber] = useState(params.prefillFiber || '');
  const [note, setNote] = useState('');
  const [openPicker, setOpenPicker] = useState<'category' | 'fiber' | null>(null);

  useEffect(() => {
    if (params.prefillImage) setImageUri(params.prefillImage);
    if (params.prefillBase64) setImageBase64(params.prefillBase64);
    if (params.prefillCategory) setCategory(params.prefillCategory);
    if (params.prefillFiber) setFiber(params.prefillFiber);
    if (params.mode) setActiveTab(params.mode === 'upcycle' ? 'upcycle' : 'repair');
  }, [params.prefillImage, params.prefillBase64, params.prefillCategory, params.prefillFiber, params.mode]);

  // ── Result state ─────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  // Garment details used for the summary line (survives edits to the form)
  const [submitted, setSubmitted] = useState({ category: '', fiber: '' });

  // ── Shared assessment from the condition check screen ────────
  const autoRanRef = useRef(false);
  useEffect(() => {
    const fromCheck = params.useSharedAssessment === 'true' || params.autoAssess === 'true';
    if (!fromCheck) return;

    // Fastest path: result already in memory, no network call
    const shared = getSharedRepairAssessment();
    if (shared) {
      const glie = shared.glie as any;
      const cat = params.prefillCategory || glie?.garment_category || glie?.category || '';
      const fib = params.prefillFiber || glie?.fiber_type || '';
      setSubmitted({ category: cat, fiber: fib });
      if (cat) setCategory(cat);
      if (fib) setFiber(fib);
      setResult(shared);
      setLoading(false);
      return;
    }

    // Otherwise ask the server using the details we already have (no photo upload)
    if (autoRanRef.current) return;
    autoRanRef.current = true;
    (async () => {
      setLoading(true);
      const cat = params.prefillCategory || '';
      const fib = params.prefillFiber || '';
      setSubmitted({ category: cat, fiber: fib });
      if (cat) setCategory(cat);
      if (fib) setFiber(fib);
      try {
        let damageTypes: string[] = [];
        if (params.damageTypes) {
          try {
            damageTypes = JSON.parse(params.damageTypes);
          } catch {
            damageTypes = [];
          }
        }
        const data = await lookupRepairFromAssessment({
          garment_category: cat || 'other',
          fiber_type: fib || 'Cotton',
          damage_types: damageTypes,
          damage_description: params.damageDescription,
          repair_feasibility: params.repairFeasibility,
          condition_score: params.conditionScore ? parseFloat(params.conditionScore) : undefined,
          original_price_inr: parseFloat(params.prefillPrice || '0') || 0,
          routing_decision: params.mode === 'upcycle' ? 'UPCYCLE' : 'REPAIR',
        });
        setResult(data);
      } catch {
        Alert.alert('Something went wrong', 'We could not load tutorials. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [
    params.useSharedAssessment,
    params.autoAssess,
    params.prefillCategory,
    params.prefillFiber,
    params.prefillPrice,
    params.damageTypes,
    params.damageDescription,
    params.repairFeasibility,
    params.conditionScore,
    params.mode,
  ]);

  // ── Photo ────────────────────────────────────────────────────
  const choosePhoto = () => {
    promptPhotoSelection({
      title: 'Add a photo',
      quality: 0.7,
      base64: true,
      onImagePicked: (picked) => {
        setImageUri(picked.uri);
        setImageBase64(picked.base64 || null);
      },
      onError: () => Alert.alert('Photo problem', 'We could not use that photo. Please try another one.'),
    });
  };

  // ── Find tutorials ───────────────────────────────────────────
  const canSubmit = !!imageUri || !!category;

  const handleFind = async () => {
    if (!canSubmit) {
      Alert.alert('Add a photo or pick a garment', 'We need one of these to find tutorials.');
      return;
    }
    setLoading(true);
    setSubmitted({ category, fiber });
    const base = {
      fiber_type: fiber || 'Cotton',
      garment_category: category || 'other',
      damage_description: note.trim() || undefined,
    };
    try {
      const data = imageBase64
        ? await assessRepair({ ...base, image_base64: imageBase64, original_price_inr: parseFloat(params.prefillPrice || '0') || 0 })
        : await lookupRepairFromAssessment(base);
      setResult(data);
    } catch {
      Alert.alert('Something went wrong', 'We could not load tutorials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setResult(null);
    setImageUri(null);
    setImageBase64(null);
    setCategory('');
    setFiber('');
    setNote('');
    setSubmitted({ category: '', fiber: '' });
    setSavedIds(new Set());
  };

  // ── Lists for the active tab ─────────────────────────────────
  const videos: YouTubeVideo[] = useMemo(() => {
    if (!result) return [];
    const list = activeTab === 'repair' ? result.repair_youtube : result.upcycle_youtube;
    return (list || []).slice(0, MAX_VIDEOS);
  }, [result, activeTab]);

  const blogs: BlogArticle[] = useMemo(() => {
    if (!result) return [];
    const list = activeTab === 'repair' ? result.repair_reading_list : result.upcycle_reading_list;
    return (list || []).filter((b) => !!b.url).slice(0, MAX_BLOGS);
  }, [result, activeTab]);

  const searchQuery = useMemo(() => {
    if (!result) return '';
    const q = activeTab === 'repair' ? result.repair_youtube_query : result.upcycle_youtube_query;
    if (q || result.youtube_query) return q || result.youtube_query;
    return `${activeTab === 'repair' ? 'how to repair' : 'upcycle'} ${submitted.fiber} ${submitted.category}`.trim();
  }, [result, activeTab, submitted]);

  const searchUrl = useMemo(() => {
    if (!result) return youTubeSearchUrl('');
    const url = activeTab === 'repair' ? result.repair_youtube_search_url : result.upcycle_youtube_search_url;
    return url || youTubeSearchUrl(searchQuery);
  }, [result, activeTab, searchQuery]);

  // ── Saved state ──────────────────────────────────────────────
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    (async () => {
      const ids = new Set<string>();
      const allVideos = [...(result.repair_youtube || []), ...(result.upcycle_youtube || [])];
      const allBlogs = [...(result.repair_reading_list || []), ...(result.upcycle_reading_list || [])];
      for (const v of allVideos) {
        const id = youtubeSaveId(v);
        if (await isRepairSaved(id)) ids.add(id);
      }
      for (const b of allBlogs) {
        const id = blogSaveId(b);
        if (await isRepairSaved(id)) ids.add(id);
      }
      if (!cancelled) setSavedIds(ids);
    })();
    return () => {
      cancelled = true;
    };
  }, [result]);

  const garmentLabel = [capitalize(submitted.category), submitted.fiber].filter(Boolean).join(' · ');
  const damageTypes = (result?.glie?.damage_breakdown?.damage_types || []).filter((d) => d && d !== 'none');

  const applySaved = (id: string, saved: boolean) =>
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(id);
      else next.delete(id);
      return next;
    });

  const saveVideo = useCallback(
    async (video: YouTubeVideo) => {
      try {
        const { saved, id } = await toggleSaveYouTube(video, garmentLabel, damageTypes);
        applySaved(id, saved);
      } catch {
        Alert.alert('Could not save', 'Please try again.');
      }
    },
    [garmentLabel, damageTypes.join('|')],
  );

  const saveBlog = useCallback(
    async (blog: BlogArticle) => {
      try {
        const { saved, id } = await toggleSaveBlog(blog, activeTab, garmentLabel, damageTypes);
        applySaved(id, saved);
      } catch {
        Alert.alert('Could not save', 'Please try again.');
      }
    },
    [activeTab, garmentLabel, damageTypes.join('|')],
  );

  // ── Render ───────────────────────────────────────────────────
  const summary = (() => {
    const what = [submitted.fiber && submitted.fiber.toLowerCase(), submitted.category && submitted.category.toLowerCase()]
      .filter(Boolean)
      .join(' ');
    const lead = activeTab === 'repair' ? 'Repair ideas' : 'Upcycle ideas';
    return what ? `${lead} for a ${what}` : lead;
  })();

  const renderPicker = (
    label: string,
    value: string,
    key: 'category' | 'fiber',
    options: string[],
    onSelect: (v: string) => void,
  ) => (
    <View style={styles.pickerBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.pickerRow}
        onPress={() => setOpenPicker(openPicker === key ? null : key)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[styles.pickerValue, !value && styles.pickerPlaceholder]}>
          {value ? capitalize(value) : 'Choose one'}
        </Text>
        <Ionicons name={openPicker === key ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {openPicker === key && (
        <View style={styles.chipWrap}>
          {options.map((opt) => {
            const selected = value.toLowerCase() === opt.toLowerCase();
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => {
                  onSelect(opt.toLowerCase() === value.toLowerCase() ? '' : opt);
                  setOpenPicker(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{capitalize(opt)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderInput = () => (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.intro}>Add a photo or pick your garment. We will find tutorials to fix it or give it a new life.</Text>

      <TouchableOpacity style={styles.photoBox} onPress={choosePhoto} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Add a photo">
        {imageUri ? (
          <>
            <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
            <View style={styles.photoChange}>
              <Ionicons name="camera-outline" size={14} color={colors.white} />
              <Text style={styles.photoChangeText}>Change photo</Text>
            </View>
          </>
        ) : (
          <View style={styles.photoEmpty}>
            <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
            <Text style={styles.photoEmptyText}>Add a photo</Text>
          </View>
        )}
      </TouchableOpacity>

      {renderPicker('Garment', category, 'category', GARMENT_CATEGORIES, setCategory)}
      {renderPicker('Fabric', fiber, 'fiber', FIBER_TYPES, setFiber)}

      <View style={styles.pickerBlock}>
        <Text style={styles.fieldLabel}>Note (optional)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="For example: small hole near the pocket"
          placeholderTextColor={colors.textMuted}
          maxLength={200}
          returnKeyType="done"
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
        onPress={handleFind}
        disabled={!canSubmit}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Text style={styles.primaryBtnText}>Find tutorials</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderVideo = (video: YouTubeVideo) => {
    const saved = savedIds.has(youtubeSaveId(video));
    return (
      <TouchableOpacity
        key={video.videoId}
        style={styles.videoCard}
        onPress={() => openLink(youTubeUrl(video.videoId), 'Please open YouTube and try again.')}
        activeOpacity={0.85}
        accessibilityRole="link"
        accessibilityLabel={`Watch ${video.title}`}
      >
        <View style={styles.thumbWrap}>
          <Image source={{ uri: thumbnailFor(video) }} style={styles.thumb} resizeMode="cover" />
          <View style={styles.playOverlay}>
            <Ionicons name="play-circle" size={40} color={colors.white} />
          </View>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => saveVideo(video)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save'}
          >
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? colors.rose : colors.ink} />
          </TouchableOpacity>
        </View>
        <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
        <Text style={styles.videoChannel} numberOfLines={1}>{video.channelTitle}</Text>
      </TouchableOpacity>
    );
  };

  const renderBlog = (blog: BlogArticle) => {
    const saved = savedIds.has(blogSaveId(blog));
    const meta = [blog.time_minutes ? `${blog.time_minutes} min` : '', capitalize(blog.difficulty || '')]
      .filter(Boolean)
      .join(' · ');
    return (
      <TouchableOpacity
        key={blog.id}
        style={styles.blogCard}
        onPress={() => openLink(blog.url, 'Please try again in your browser.')}
        activeOpacity={0.85}
        accessibilityRole="link"
        accessibilityLabel={`Read ${blog.title}`}
      >
        <View style={styles.blogText}>
          <Text style={styles.blogTitle} numberOfLines={2}>{blog.title}</Text>
          <View style={styles.blogMetaRow}>
            <Text style={styles.blogSource} numberOfLines={1}>{blog.source}</Text>
            {!!meta && (
              <View style={[styles.metaChip, { borderColor: difficultyColor(blog.difficulty) }]}>
                <Text style={[styles.metaChipText, { color: difficultyColor(blog.difficulty) }]}>{meta}</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => saveBlog(blog)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save'}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? colors.rose : colors.ink} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const searchButton = (
    <TouchableOpacity
      style={styles.primaryBtn}
      onPress={() => openLink(searchUrl, 'Please open YouTube and search for it.')}
      activeOpacity={0.85}
      accessibilityRole="link"
    >
      <Ionicons name="logo-youtube" size={18} color={colors.white} />
      <Text style={styles.primaryBtnText}>Search on YouTube</Text>
    </TouchableOpacity>
  );

  const renderResult = () => (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.summary}>{summary}</Text>

      <View style={styles.tabs}>
        {(['repair', 'upcycle'] as Mode[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'repair' ? 'Repair' : 'Upcycle'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {videos.length === 0 && blogs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>We could not find tutorials for this one yet.</Text>
          {searchButton}
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Watch</Text>
          {videos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.videoRow}>
              {videos.map(renderVideo)}
            </ScrollView>
          ) : (
            <TouchableOpacity onPress={() => openLink(searchUrl, 'Please open YouTube and search for it.')} accessibilityRole="link">
              <Text style={styles.linkText}>Search on YouTube</Text>
            </TouchableOpacity>
          )}

          {blogs.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Read</Text>
              <View style={styles.blogList}>{blogs.map(renderBlog)}</View>
            </>
          )}
        </>
      )}

      <TouchableOpacity style={styles.startOver} onPress={startOver} accessibilityRole="button">
        <Text style={styles.linkText}>Try another garment</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <View style={styles.screen}>
      <Header title="Repair & Refresh" showBack fallbackPath="/(tabs)/circular" />
      {loading ? (
        <Loader variant="studio" />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {result ? renderResult() : renderInput()}
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md },

  intro: {
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecond,
    marginBottom: spacing.md,
  },

  photoBox: {
    height: 200,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.paperLight,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  photoEmptyText: { fontFamily: typography.bodyMedium, fontSize: 14, color: colors.textMuted },
  photoChange: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  photoChangeText: { fontFamily: typography.bodyMedium, fontSize: 12, color: colors.white },

  pickerBlock: { marginBottom: spacing.md },
  fieldLabel: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textSecond,
    marginBottom: spacing.xs,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.paperLight,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  pickerValue: { fontFamily: typography.bodyMedium, fontSize: 15, color: colors.textPrimary },
  pickerPlaceholder: { color: colors.textMuted },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.paperLight,
  },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: typography.bodyMedium, fontSize: 13, color: colors.textPrimary },
  chipTextSelected: { color: colors.paper },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.paperLight,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: typography.body,
    fontSize: 15,
    color: colors.textPrimary,
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.rose,
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontFamily: typography.bodyBold, fontSize: 15, color: colors.white },

  summary: {
    fontFamily: typography.headings,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11, backgroundColor: colors.paperLight },
  tabActive: { backgroundColor: colors.ink },
  tabText: { fontFamily: typography.bodyBold, fontSize: 14, color: colors.textPrimary },
  tabTextActive: { color: colors.paper },

  sectionTitle: {
    fontFamily: typography.headings,
    fontSize: 17,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  videoRow: { gap: spacing.md, paddingRight: spacing.md },
  videoCard: { width: 240 },
  thumbWrap: {
    width: 240,
    height: 135,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.paperDark,
  },
  thumb: { width: '100%', height: '100%' },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlayLight,
  },
  saveBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.paperGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTitle: {
    fontFamily: typography.bodyBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  videoChannel: { fontFamily: typography.body, fontSize: 12, color: colors.textMuted, marginTop: 2 },

  blogList: { gap: spacing.sm },
  blogCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.paperLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  blogText: { flex: 1 },
  blogTitle: { fontFamily: typography.bodyBold, fontSize: 14, lineHeight: 19, color: colors.textPrimary },
  blogMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  blogSource: { flexShrink: 1, fontFamily: typography.body, fontSize: 12, color: colors.textMuted },
  metaChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  metaChipText: { fontFamily: typography.bodyMedium, fontSize: 11 },

  empty: { alignItems: 'stretch', paddingVertical: spacing.lg, gap: spacing.sm },
  emptyText: {
    fontFamily: typography.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecond,
    textAlign: 'center',
  },

  linkText: { fontFamily: typography.bodyBold, fontSize: 14, color: colors.rose },
  startOver: { alignItems: 'center', marginTop: spacing.lg, paddingVertical: spacing.sm },
});
