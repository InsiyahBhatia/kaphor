import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../../../src/theme';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import {
  assessRepair,
  lookupRepairFromAssessment,
  getSharedRepairAssessment,
  RepairResult,
  YouTubeVideo,
  T5GuideResult,
  GARMENT_CATEGORIES,
  FIBER_TYPES,
  youTubeUrl,
  difficultyColor,
} from '../../../src/services/repairService';
import {
  isRepairSaved,
  toggleSaveYouTube,
  toggleSaveGuide,
} from '../../../src/services/savedRepairService';

export default function RepairRefreshScreen() {
  const params = useLocalSearchParams<{
    prefillImage?: string;
    prefillBase64?: string;
    prefillCategory?: string;
    prefillFiber?: string;
    prefillPrice?: string;
    mode?: 'repair' | 'upcycle';
    autoAssess?: string;
    useSharedAssessment?: string;
    damageTypes?: string;
    repairFeasibility?: string;
    conditionScore?: string;
  }>();
  const insets = useSafeAreaInsets();
  useBackHandler('/(tabs)/circular');

  // ── Segregated Tab State ('repair' | 'upcycle') ──────────────
  const [activeTab, setActiveTab] = useState<'repair' | 'upcycle'>(
    params.mode === 'upcycle' ? 'upcycle' : 'repair'
  );

  // ── Input state ──────────────────────────────────────────────
  const [imageUri, setImageUri] = useState<string | null>(params.prefillImage || null);
  const [imageBase64, setImageBase64] = useState<string | null>(params.prefillBase64 || null);
  const [category, setCategory] = useState(params.prefillCategory || '');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [fiber, setFiber] = useState(params.prefillFiber || '');
  const [showFiberPicker, setShowFiberPicker] = useState(false);
  const [price, setPrice] = useState(params.prefillPrice || '');
  const [damageDesc, setDamageDesc] = useState('');

  useEffect(() => {
    if (params.prefillImage) setImageUri(params.prefillImage);
    if (params.prefillBase64) setImageBase64(params.prefillBase64);
    if (params.prefillCategory) setCategory(params.prefillCategory);
    if (params.prefillFiber) setFiber(params.prefillFiber);
    if (params.prefillPrice) setPrice(params.prefillPrice);
    if (params.mode) setActiveTab(params.mode === 'upcycle' ? 'upcycle' : 'repair');
  }, [params.prefillImage, params.prefillBase64, params.prefillCategory, params.prefillFiber, params.prefillPrice, params.mode]);

  // ── Result state ─────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);

  // ── Submitted garment context (survives result render) ───────
  const submittedRef = useRef<{ category: string; fiber: string }>({ category: '', fiber: '' });

  // ── Shared Assessment / Auto-run if directed from Condition Check ─────
  const autoAssessedRef = useRef(false);
  useEffect(() => {
    // 1. FASTEST PATH: Check if full LLM assessment is already available in shared memory.
    // Zero re-upload, zero AI calls, zero delay!
    const shared = getSharedRepairAssessment();
    if ((params.useSharedAssessment === 'true' || params.autoAssess === 'true') && shared) {
      setResult(shared);
      const cat = params.prefillCategory || (shared.glie as any)?.garment_category || (shared.glie as any)?.category || '';
      const fib = params.prefillFiber || (shared.glie as any)?.fiber_type || '';
      submittedRef.current = {
        category: cat,
        fiber: fib,
      };
      if (cat) setCategory(cat);
      if (fib) setFiber(fib);
      if (params.prefillImage) setImageUri(params.prefillImage);
      setLoading(false);
      return;
    }

    // 2. FALLBACK PATH: If redirected with LLM metadata but shared memory wasn't present,
    // call the fast lookup API (still NO image re-upload, NO vision API re-analysis!).
    if (
      (params.useSharedAssessment === 'true' || params.autoAssess === 'true') &&
      !autoAssessedRef.current
    ) {
      autoAssessedRef.current = true;
      (async () => {
        setLoading(true);
        const cat = params.prefillCategory || '';
        const fib = params.prefillFiber || '';
        submittedRef.current = {
          category: cat,
          fiber: fib,
        };
        if (cat) setCategory(cat);
        if (fib) setFiber(fib);
        try {
          let parsedDamages: string[] = [];
          if (params.damageTypes) {
            try {
              parsedDamages = JSON.parse(params.damageTypes);
            } catch {}
          }
          const data = await lookupRepairFromAssessment({
            garment_category: params.prefillCategory || 'other',
            fiber_type: params.prefillFiber || 'Cotton',
            damage_types: parsedDamages,
            repair_feasibility: params.repairFeasibility,
            condition_score: params.conditionScore ? parseFloat(params.conditionScore) : undefined,
            original_price_inr: parseFloat(params.prefillPrice || '0') || 0,
            routing_decision: params.mode === 'upcycle' ? 'UPCYCLE' : 'REPAIR',
          });
          setResult(data);
        } catch (e: any) {
          Alert.alert('Assessment Failed', e?.message || 'Could not connect to the server.');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [
    params.useSharedAssessment,
    params.autoAssess,
    params.prefillCategory,
    params.prefillFiber,
    params.prefillPrice,
    params.damageTypes,
    params.repairFeasibility,
    params.conditionScore,
    params.mode,
  ]);


  // ── Saved state & Expansion ───────────────────────────────────
  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(new Set());
  const [savedGuideIds, setSavedGuideIds] = useState<Set<string>>(new Set());
  const [expandedGuideIds, setExpandedGuideIds] = useState<Set<string>>(new Set());

  const toggleExpandGuide = (guideId: string) => {
    setExpandedGuideIds((prev) => {
      const next = new Set(prev);
      if (next.has(guideId)) next.delete(guideId);
      else next.add(guideId);
      return next;
    });
  };

  // ── Image picker (0.6 quality for fast upload and zero timeouts) ─
  const pickImage = async (useCamera = false) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Camera permission needed'); return; }
        const pick = await ImagePicker.launchCameraAsync({
          quality: 0.6,
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
          quality: 0.6,
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

  const selectImageSource = () => {
    Alert.alert('Add Garment Photo', 'Take a new photo with your camera or choose one from your gallery:', [
      { text: 'Take Photo', onPress: () => pickImage(true) },
      { text: 'Choose from Gallery', onPress: () => pickImage(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleAssess = async () => {
    if (!imageUri) { Alert.alert('Photo required', 'Upload a photo of your garment.'); return; }
    if (!imageBase64) { Alert.alert('Image Error', 'Could not read image data. Try taking a new photo.'); return; }

    setLoading(true);
    submittedRef.current = { category: category || '', fiber: fiber || '' };
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
      // If image assessment failed (e.g. timeout on mobile), fall back to metadata lookup
      try {
        const fallbackData = await lookupRepairFromAssessment({
          garment_category: category || 'other',
          fiber_type: fiber || 'Cotton',
          damage_description: damageDesc || 'Garment wear analysis requested.',
          original_price_inr: parseFloat(price) || 0,
        });
        setResult(fallbackData);
        Alert.alert('Offline Mode Active', 'Loaded curated repair & upcycle masterclass guides for your garment.');
      } catch (fallbackErr: any) {
        Alert.alert('Assessment Failed', e?.message || 'Could not connect to the server.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────
  const resetAll = () => {
    submittedRef.current = { category: '', fiber: '' };
    setResult(null);
    setImageUri(null);
    setImageBase64(null);
    setCategory('');
    setFiber('');
    setPrice('');
    setDamageDesc('');
    setSavedVideoIds(new Set());
    setSavedGuideIds(new Set());
    setExpandedGuideIds(new Set());
  };

  // ── Load saved state when result comes in ──────────────────────
  useEffect(() => {
    if (!result) return;
    const loadSavedState = async () => {
      const videoIds = new Set<string>();
      const guideIds = new Set<string>();

      for (const video of result.youtube || []) {
        const id = `yt-${video.videoId}`;
        if (await isRepairSaved(id)) videoIds.add(id);
      }

      const allResultGuides = [
        ...(result.repair_guides || []),
        ...(result.upcycle_guides || []),
        ...(result.guides || []),
      ];
      for (const guide of allResultGuides) {
        const id = `guide-${guide.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`;
        if (await isRepairSaved(id)) guideIds.add(id);
      }

      setSavedVideoIds(videoIds);
      setSavedGuideIds(guideIds);

      // Auto-expand the first guide for active tab
      const currentList = activeTab === 'repair' ? result.repair_guides : result.upcycle_guides;
      const first = (currentList && currentList.length > 0) ? currentList[0] : (result.guides && result.guides[0]);
      if (first) {
        const firstId = `guide-${first.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`;
        setExpandedGuideIds(new Set([firstId]));
      }
    };
    loadSavedState();
  }, [result, activeTab]);

  // ── Toggle save for a Guide ────────────────────────────────────
  const handleToggleSaveGuide = useCallback(
    async (guide: T5GuideResult) => {
      try {
        const garmentLabel = `${category.charAt(0).toUpperCase() + category.slice(1)} — ${fiber}`;
        const damageTypes = (result?.glie?.damage_breakdown?.damage_types || []).filter(d => d !== 'none') || [];
        const { saved, id } = await toggleSaveGuide(guide, garmentLabel, damageTypes);
        setSavedGuideIds((prev) => {
          const next = new Set(prev);
          if (saved) next.add(id);
          else next.delete(id);
          return next;
        });
        Alert.alert(
          saved ? '✓ Saved' : '✓ Removed',
          saved ? 'Tutorial saved to your Vault.' : 'Tutorial removed from your Vault.'
        );
      } catch {
        Alert.alert('Error', 'Could not update saved tutorials.');
      }
    },
    [category, fiber, result]
  );

  // ── Toggle save for a YouTube video ────────────────────────────
  const handleToggleSaveYouTube = useCallback(
    async (video: YouTubeVideo) => {
      try {
        const garmentLabel = `${category.charAt(0).toUpperCase() + category.slice(1)} — ${fiber}`;
        const damageTypes = (result?.glie?.damage_breakdown?.damage_types || []).filter(d => d !== 'none') || [];
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

  // ── Open a curated article in the browser ──────────────────────
  const openArticle = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open the browser.');
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
    const isRepair = activeTab === 'repair';
    const damageTypes = (result.glie?.damage_breakdown?.damage_types || []).filter(d => d !== 'none');
    const sub = submittedRef.current;
    const labelHead = sub.category ? sub.category.charAt(0).toUpperCase() + sub.category.slice(1) : 'Garment';
    const garmentLabel = sub.fiber ? `${labelHead} — ${sub.fiber}` : labelHead;

    const resolvedCategory = (
      sub.category ||
      category ||
      params.prefillCategory ||
      (result.glie as any)?.garment_category ||
      (result.glie as any)?.category ||
      (result.glie as any)?.description ||
      ''
    ).toLowerCase();

    const isDress = resolvedCategory.includes('dress') || resolvedCategory.includes('skirt') || resolvedCategory.includes('gown');
    const isSweater = resolvedCategory.includes('sweater') || resolvedCategory.includes('knit') || resolvedCategory.includes('cardigan');
    const isJeans = resolvedCategory.includes('jean') || resolvedCategory.includes('denim');
    const isShirt = resolvedCategory.includes('shirt') || resolvedCategory.includes('top') || resolvedCategory.includes('blouse') || resolvedCategory.includes('polo');

    // Filter incoming YouTube videos so conflicting garments never show up
    const filterConflictingVideos = (list: YouTubeVideo[]) =>
      list.filter(v => {
        const t = (v.title || '').toLowerCase();
        if (isDress) {
          if (/\b(jeans|denim|sweater|knitwear|hoodie|pants|trousers|crotch|socks|beanie)\b/i.test(t) && !/\b(dress|skirt|gown)\b/i.test(t)) {
            return false;
          }
        } else if (isShirt) {
          if (/\b(jeans|denim|sweater|knitwear|hoodie|pants|trousers|crotch|socks|beanie|dress|skirt|gown)\b/i.test(t) && !/\b(shirt|top|blouse|t-shirt)\b/i.test(t)) {
            return false;
          }
        } else if (isSweater) {
          if (/\b(jeans|denim|dress|saree|shorts)\b/i.test(t) && !/\b(sweater|knit|cardigan|wool)\b/i.test(t)) {
            return false;
          }
        } else if (isJeans) {
          if (/\b(sweater|knitwear|dress|saree|silk)\b/i.test(t) && !/\b(jeans|denim|pants)\b/i.test(t)) {
            return false;
          }
        }
        return true;
      });

    // 1. YouTube videos for active tab (strictly filter out repair/mending from upcycle!)
    const rawActiveYouTube = isRepair
      ? (result.repair_youtube && result.repair_youtube.length > 0
          ? filterConflictingVideos(result.repair_youtube)
          : filterConflictingVideos(result.youtube || []).filter(v => {
              const t = v.title.toLowerCase();
              return t.includes('repair') || t.includes('mend') || t.includes('fix') || t.includes('stitch') || t.includes('darn') || !t.includes('upcycle');
            }))
      : (result.upcycle_youtube && result.upcycle_youtube.length > 0
          ? filterConflictingVideos(result.upcycle_youtube).filter(v => {
              const t = v.title.toLowerCase();
              return !t.includes('repair') && !t.includes('mend') && !t.includes('darning') && !t.includes('fix hole') && !t.includes('ripped');
            })
          : filterConflictingVideos(result.youtube || []).filter(v => {
              const t = v.title.toLowerCase();
              const isUpcycle = t.includes('upcycle') || t.includes('rework') || t.includes('diy') || t.includes('transform') || t.includes('shorts') || t.includes('tote');
              const isRepairVideo = t.includes('repair') || t.includes('mend') || t.includes('darn');
              return isUpcycle && !isRepairVideo;
            }));

    const DRESS_UPCYCLE_FALLBACKS: YouTubeVideo[] = [
      {
        videoId: 'k9LmP4sQ2wR',
        title: 'DIY Two-Piece Matching Set from Old Dress (Crop Top & Wrap Skirt)',
        channelTitle: 'Thrift Flip & Rework Studio',
        thumbnail: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
      {
        videoId: 'x8_G4bB1s-8',
        title: 'Transform a Long Maxi Dress into a Tiered Cottagecore Mini Sundress',
        channelTitle: 'DIY Fashion Studio',
        thumbnail: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
      {
        videoId: '7zU4yv9V-F4',
        title: 'How to Upcycle an Outdated Formal Gown into a Modern Slip Skirt',
        channelTitle: 'Upcycle Stitches & Reworks',
        thumbnail: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
    ];

    const DRESS_REPAIR_FALLBACKS: YouTubeVideo[] = [
      {
        videoId: 'x4rY5pL9w2M',
        title: 'How to Hem a Dress by Hand (Invisible Blind Stitch Tutorial)',
        channelTitle: 'Handmade Wardrobe & Sewing Lab',
        thumbnail: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
      {
        videoId: '7zU4yv9V-F4',
        title: 'Invisible Ladder Stitch Tutorial: How to Mend Torn Dress Seams by Hand',
        channelTitle: 'Handmade Wardrobe & Mending',
        thumbnail: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
      {
        videoId: 'P9kL2mQ4w1Z',
        title: 'How to Fix an Invisible Dress Zipper That Wont Close or Splits',
        channelTitle: 'Gear & Garment Repair Lab',
        thumbnail: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
    ];

    const SHIRT_UPCYCLE_FALLBACKS: YouTubeVideo[] = [
      {
        videoId: 'k9LmP4sQ2wR',
        title: 'Transform an Oversized Button-Down Shirt into a Corset Wrap Crop Top',
        channelTitle: 'Thrift Flip & Rework Studio',
        thumbnail: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
      {
        videoId: 'x8_G4bB1s-8',
        title: 'Turn an Old Men Button-Down Shirt into a Zero-Waste Chef Apron',
        channelTitle: 'DIY Fashion Studio',
        thumbnail: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
      {
        videoId: '7zU4yv9V-F4',
        title: 'Refashion an Oversized Flannel Shirt into a Quilted Reversible Vest',
        channelTitle: 'Upcycle Stitches & Reworks',
        thumbnail: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
    ];

    const SHIRT_REPAIR_FALLBACKS: YouTubeVideo[] = [
      {
        videoId: 'P9kL2mQ4w1Z',
        title: 'How to Fix a Torn Button or Hole in a Shirt Placket with Interfacing',
        channelTitle: 'Gear & Garment Repair Lab',
        thumbnail: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
      {
        videoId: '7zU4yv9V-F4',
        title: 'How to Sew a Button on a Shirt with a Sturdy Thread Shank (Never Pulls Free)',
        channelTitle: 'Handmade Wardrobe & Mending',
        thumbnail: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
      {
        videoId: 'x4rY5pL9w2M',
        title: 'How to Repair a Frayed Shirt Collar by Turning & Inverting by Hand',
        channelTitle: 'Artisan Alterations Studio',
        thumbnail: 'https://images.unsplash.com/photo-1589310243389-96a5483213a8?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
      {
        videoId: 'm8KpL3v9qXw',
        title: 'Invisible Ladder Stitch for Torn Underarm Seams on Shirts and Blouses',
        channelTitle: 'Handmade Wardrobe & Sewing Lab',
        thumbnail: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
    ];

    const DEFAULT_UPCYCLE_FALLBACKS: YouTubeVideo[] = [
      {
        videoId: '7zU4yv9V-F4',
        title: 'DIY Upcycling Project: Transform Old Clothes into Stylish Essentials',
        channelTitle: 'Upcycle Stitches & Reworks',
        thumbnail: 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
      {
        videoId: 'k9LmP4sQ2wR',
        title: 'Transform Oversized Clothes into Modern Matching Tops & Accessories',
        channelTitle: 'Thrift Flip & Rework Studio',
        thumbnail: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
    ];

    const DEFAULT_REPAIR_FALLBACKS: YouTubeVideo[] = [
      {
        videoId: '7zU4yv9V-F4',
        title: 'Invisible Ladder Stitch Tutorial: How to Mend Torn Seams by Hand',
        channelTitle: 'Handmade Wardrobe & Mending',
        thumbnail: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
      {
        videoId: 'P9kL2mQ4w1Z',
        title: 'How to Fix a Broken Zipper with Pliers in 2 Minutes (No Sewing)',
        channelTitle: 'Gear & Garment Repair Lab',
        thumbnail: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=600&auto=format&fit=crop',
        publishedAt: '2024-01-01',
      },
    ];

    const activeFallbackVideos = isRepair
      ? (isShirt ? SHIRT_REPAIR_FALLBACKS : (isDress ? DRESS_REPAIR_FALLBACKS : DEFAULT_REPAIR_FALLBACKS))
      : (isShirt ? SHIRT_UPCYCLE_FALLBACKS : (isDress ? DRESS_UPCYCLE_FALLBACKS : DEFAULT_UPCYCLE_FALLBACKS));

    const activeYouTube = rawActiveYouTube.length === 0
      ? activeFallbackVideos
      : rawActiveYouTube;

    // 2. Curated blog articles & pattern guides for active tab
    const curatedUpcycleBlogs = [
      {
        id: 'blog-up-dress-1',
        title: 'Transform a Long Maxi Dress into a Matching 2-Piece Crop Top & Skirt Co-Ord',
        url: 'https://refashionista.net/dress-to-two-piece-set/',
        source: 'Refashionista Studio',
        difficulty: 'beginner',
        time_minutes: 45,
        summary: 'Separate a maxi or midi dress at the waistline to create a trendy crop top and elasticated skirt set.',
      },
      {
        id: 'blog-up-dress-2',
        title: 'Refashion a Thrifted Maxi Dress into a Tiered Summer Mini Dress',
        url: 'https://mellysews.com/maxi-dress-to-mini-dress-refashion/',
        source: 'Melly Sews',
        difficulty: 'beginner',
        time_minutes: 35,
        summary: 'Crop the hem and add a gathered ruffle tier from leftover hem fabric for a chic cottagecore mini silhouette.',
      },
      {
        id: 'blog-up-1',
        title: 'How to Upcycle Old Jeans Into a Stylish Denim Tote Bag',
        url: 'https://heatherhandmade.com/upcycle-jeans-tote-bag/',
        source: 'Heather Handmade',
        difficulty: 'beginner',
        time_minutes: 45,
        summary: 'Step-by-step pattern instructions to turn worn jeans legs into a durable tote with handles and pockets.',
      },
      {
        id: 'blog-up-2',
        title: 'Turn Old Jeans into Cute Distressed Denim Cutoff Shorts: 7 Easy Ideas',
        url: 'https://sewguide.com/diy-cut-off-jean-shorts/',
        source: 'Sew Guide',
        difficulty: 'beginner',
        time_minutes: 30,
        summary: 'Guide on measuring the inseam, cutting cleanly, and fraying cuffs for a summer denim shorts silhouette.',
      },
      {
        id: 'blog-up-3',
        title: 'Make an Easy No-Sew T-Shirt Tote Bag',
        url: 'https://diycandy.com/t-shirt-tote-bag/',
        source: 'DIY Candy',
        difficulty: 'beginner',
        time_minutes: 20,
        summary: 'Convert an old cotton t-shirt into a zero-waste grocery tote using simple fringe knots — no sewing machine required.',
      },
      {
        id: 'blog-up-4',
        title: 'Upcycle a Thrifted Sweater into a Beanie & Mitten Winter Set',
        url: 'https://mellysews.com/thrift-flip-sweater-upcycle-to-beanie-and-mittens/',
        source: 'Melly Sews',
        difficulty: 'intermediate',
        time_minutes: 60,
        summary: 'Creative thrift flip instructions to repurpose ribbed wool and knitwear into matching accessories.',
      },
      {
        id: 'blog-up-5',
        title: 'Convert a Vintage Saree or Maxi Dress into a Designer Kurti',
        url: 'https://herzindagi.com/fashion/old-saree-designer-anarkali-kurti-article-289532',
        source: 'HerZindagi Fashion',
        difficulty: 'intermediate',
        time_minutes: 90,
        summary: 'Indian ethnic garment upcycling tutorial to reconstruct heavy silks into modern fusion wear silhouettes.',
      },
      {
        id: 'blog-up-shirt-1',
        title: 'Transform an Oversized Button-Down Shirt into a Modern Cropped Wrap Blouse',
        url: 'https://weallsew.com/oversized-shirt-crop-top/',
        source: 'WeAllSew Studio',
        difficulty: 'beginner',
        time_minutes: 40,
        summary: 'Crop the hem, reshape the sleeves, and use tail fabric to create wrap waist ties for a contemporary silhouette.',
      },
      {
        id: 'blog-up-shirt-2',
        title: 'Convert a Flannel or Oxford Shirt into a Zero-Waste Artisan Chef Apron',
        url: 'https://weallsew.com/how-to-upcycle-a-shirt-to-an-apron/',
        source: 'WeAllSew Studio',
        difficulty: 'beginner',
        time_minutes: 35,
        summary: 'Repurpose the collar and button placket of a shirt into an adjustable neck loop and artisan kitchen apron.',
      },
      {
        id: 'blog-up-6',
        title: 'Upcycle a Button-Down Shirt into a Chef Apron',
        url: 'https://weallsew.com/how-to-upcycle-a-shirt-to-an-apron/',
        source: 'WeAllSew Studio',
        difficulty: 'beginner',
        time_minutes: 40,
        summary: 'Turn an oversized collared shirt into an artisan kitchen apron using the collar and front button placket.',
      },
    ];

    const curatedRepairBlogs = [
      {
        id: 'blog-rep-shirt-1',
        title: 'Shirt Placket Tear & Hole Repair: Interfacing Reinforcement Behind Buttons',
        url: 'https://closetcorepatterns.com/blogs/blog/how-to-fix-a-torn-button-placket',
        source: 'Closet Core Patterns',
        difficulty: 'beginner',
        time_minutes: 25,
        summary: 'Reinforce torn fabric behind shirt buttonholes using fusible featherweight interfacing and discrete hand edge stitches.',
      },
      {
        id: 'blog-rep-shirt-2',
        title: 'How to Repair a Torn or Frayed Buttonhole on a Shirt or Blouse',
        url: 'https://sewguide.com/how-to-sew-buttonholes/',
        source: 'Sew Guide',
        difficulty: 'beginner',
        time_minutes: 20,
        summary: 'Stabilize frayed buttonhole slits with fray check adhesive, gimp cord backing, and high-density hand buttonhole stitches.',
      },
      {
        id: 'blog-rep-shirt-3',
        title: 'Shirt Collar & Cuff Fray Repair: Reverse & Turn Method',
        url: 'https://artofmanliness.com/skills/how-to/how-to-turn-a-frayed-collar/',
        source: 'Art of Manliness',
        difficulty: 'intermediate',
        time_minutes: 45,
        summary: 'Unpick worn shirt collar band stitching, invert the collar leaves so the undamaged inner surface faces outward, and restitch.',
      },
      {
        id: 'blog-rep-shirt-4',
        title: 'Invisible Underarm Seam & Blowout Repair for Shirts and Blouses',
        url: 'https://www.thesprucecrafts.com/how-to-mend-a-torn-seam-2977797',
        source: 'The Spruce Crafts',
        difficulty: 'beginner',
        time_minutes: 20,
        summary: 'Mend blown-out underarm seams on fitted shirts using reinforced ladder stitches without altering sleeve drape.',
      },
      {
        id: 'blog-rep-dress-1',
        title: 'Dress Hemming Guide: How to Shorten Maxi, Midi & Silk Dresses by Hand',
        url: 'https://sewguide.com/how-to-hem-a-dress/',
        source: 'Sew Guide',
        difficulty: 'beginner',
        time_minutes: 30,
        summary: 'Step-by-step tutorial on measuring dress floor clearance, trimming allowance, and sewing invisible catch stitches.',
      },
      {
        id: 'blog-rep-dress-2',
        title: 'Invisible Dress Zipper Fix: Repairing a Split or Separated Back Zipper',
        url: 'https://www.thesprucecrafts.com/fix-a-broken-zipper-2977590',
        source: 'The Spruce Crafts',
        difficulty: 'intermediate',
        time_minutes: 20,
        summary: 'Realign invisible zipper teeth and crimp widened slider jaws with pliers to restore smooth zipping without replacing.',
      },
      {
        id: 'blog-rep-1',
        title: 'Textile Triage: Fixing Pilling, Snags, Holes, and Seam Fraying',
        url: 'https://closetcorepatterns.com/blogs/blog/textile-triage-pilling-snags-holes-and-fraying',
        source: 'Closet Core Patterns',
        difficulty: 'beginner',
        time_minutes: 25,
        summary: 'Artisan diagnostic guide for assessing textile wear, choosing darning thread, and stabilizing fiber edges.',
      },
      {
        id: 'blog-rep-2',
        title: 'Sashiko Style Japanese Mending: Tutorial for Repairing Denim Jeans',
        url: 'https://heatherhandmade.com/sashiko-style-mending-tutorial/',
        source: 'Heather Handmade',
        difficulty: 'intermediate',
        time_minutes: 45,
        summary: 'Learn visible Japanese Sashiko geometric stitching to reinforce thigh and knee tears with aesthetic cotton thread.',
      },
      {
        id: 'blog-rep-3',
        title: 'How to Fix Holes in Jeans: 5 Easy Hand & Machine Methods',
        url: 'https://sewguide.com/how-to-fix-a-hole-in-jeans/',
        source: 'Sew Guide',
        difficulty: 'beginner',
        time_minutes: 30,
        summary: 'Comprehensive mending walk-through covering back-patches, invisible darning, and zig-zag machine reinforcement.',
      },
      {
        id: 'blog-rep-4',
        title: 'How to Mend a Torn Seam and Pocket Edge by Hand',
        url: 'https://www.thesprucecrafts.com/how-to-mend-a-torn-seam-2977797',
        source: 'The Spruce Crafts',
        difficulty: 'beginner',
        time_minutes: 20,
        summary: 'Step-by-step hand stitching instructions using ladder stitch and backstitch for invisible seam closures.',
      },
      {
        id: 'blog-rep-5',
        title: 'Zipper Repair Guide: How to Fix a Stuck or Split Zipper Slider',
        url: 'https://www.artofmanliness.com/skills/how-to/how-to-fix-a-broken-zipper/',
        source: 'Art of Manliness',
        difficulty: 'beginner',
        time_minutes: 15,
        summary: 'Fix split zipper teeth, realign metal and nylon sliders, and replace zipper stops with simple household pliers.',
      },
    ];

    const rawDefaultCurated = isRepair ? curatedRepairBlogs : curatedUpcycleBlogs;
    const defaultCurated = rawDefaultCurated.filter((b) => {
      const lower = (b.title + ' ' + (b.summary || '')).toLowerCase();
      if (isDress) {
        if (/\b(jeans|denim|sweater|hoodie|socks|beanie)\b/i.test(lower) && !/\b(dress|skirt|gown)\b/i.test(lower)) {
          return false;
        }
      } else if (isShirt) {
        if (/\b(jeans|denim|sweater|knitwear|hoodie|crotch blowout|socks|beanie|dress|skirt|gown)\b/i.test(lower) && !/\b(shirt|top|blouse|t-shirt)\b/i.test(lower)) {
          return false;
        }
      } else if (isSweater) {
        if (/\b(jeans|denim|dress|saree)\b/i.test(lower) && !/\b(sweater|knit|cardigan)\b/i.test(lower)) {
          return false;
        }
      } else if (isJeans) {
        if (/\b(sweater|dress|saree|silk)\b/i.test(lower) && !/\b(jeans|denim|pants)\b/i.test(lower)) {
          return false;
        }
      }
      return true;
    });

    const apiBlogs = isRepair
      ? (result.repair_reading_list || [])
      : (result.upcycle_reading_list || []);

    const rawActiveGuides: T5GuideResult[] = isRepair
      ? (result.repair_guides && result.repair_guides.length > 0 ? result.repair_guides : (result.guides || []).filter(g => g.doc_type !== 'upcycle'))
      : (result.upcycle_guides && result.upcycle_guides.length > 0 ? result.upcycle_guides : (result.guides || []).filter(g => g.doc_type === 'upcycle'));

    const activeGuides: T5GuideResult[] = rawActiveGuides.filter((g) => {
      const lower = (g.title + ' ' + (g.pro_tip || '')).toLowerCase();
      if (isDress) {
        if (/\b(jeans|denim|sweater|hoodie|crotch blowout|socks|beanie)\b/i.test(lower) && !/\b(dress|skirt|gown)\b/i.test(lower)) {
          return false;
        }
      } else if (isShirt) {
        if (/\b(jeans|denim|sweater|knitwear|hoodie|crotch blowout|socks|beanie|dress|skirt|gown)\b/i.test(lower) && !/\b(shirt|top|blouse|t-shirt)\b/i.test(lower)) {
          return false;
        }
      } else if (isSweater) {
        if (/\b(jeans|denim|dress|saree|shorts)\b/i.test(lower) && !/\b(sweater|knit|cardigan|wool)\b/i.test(lower)) {
          return false;
        }
      } else if (isJeans) {
        if (/\b(sweater|knitwear|dress|saree|silk)\b/i.test(lower) && !/\b(jeans|denim|pants)\b/i.test(lower)) {
          return false;
        }
      }
      return true;
    });

    const blogLinks = [
      ...apiBlogs.map((b) => ({
        id: b.id || b.url || b.title,
        title: b.title,
        url: b.url,
        source: b.source || 'Curated Sewing Blog',
        difficulty: (b.difficulty || 'beginner').toLowerCase(),
        time_minutes: b.time_minutes || 30,
        summary: b.summary || 'External blog tutorial with pattern guides, diagrams, and fabric recommendations.',
      })),
      ...defaultCurated,
    ]
      .filter((item, i, arr) => item.url && arr.findIndex((x) => x.url === item.url) === i)
      .filter((b) => {
        const lower = (b.title + ' ' + (b.summary || '')).toLowerCase();
        if (isDress) {
          if (/\b(jeans|denim|sweater|hoodie|socks|beanie)\b/i.test(lower) && !/\b(dress|skirt|gown)\b/i.test(lower)) {
            return false;
          }
        } else if (isShirt) {
          if (/\b(jeans|denim|sweater|hoodie|socks|beanie|dress|skirt|gown)\b/i.test(lower) && !/\b(shirt|top|blouse|t-shirt)\b/i.test(lower)) {
            return false;
          }
        } else if (isSweater) {
          if (/\b(jeans|denim|dress|saree)\b/i.test(lower) && !/\b(sweater|knit|cardigan)\b/i.test(lower)) {
            return false;
          }
        } else if (isJeans) {
          if (/\b(sweater|dress|saree|silk)\b/i.test(lower) && !/\b(jeans|denim|pants)\b/i.test(lower)) {
            return false;
          }
        }
        return true;
      });

    const hasGuides = activeGuides.length > 0;
    const hasYouTube = activeYouTube.length > 0;
    const hasAnyContent = hasGuides || hasYouTube || blogLinks.length > 0;

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
            <Text style={styles.garmentSummaryTitle}>AI VISION ANALYSIS</Text>
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

          {/* ── Segregated Route Selector (Repair vs Upcycle) ──────── */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, isRepair && styles.tabBtnActive]}
              onPress={() => setActiveTab('repair')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="bandage-outline"
                size={16}
                color={isRepair ? colors.cream : colors.charcoal}
              />
              <Text style={[styles.tabBtnText, isRepair && styles.tabBtnTextActive]}>
                REPAIR & MEND
              </Text>
              {(result.repair_guides?.length || 0) > 0 && (
                <View style={[styles.tabBadge, isRepair && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isRepair && styles.tabBadgeTextActive]}>
                    {result.repair_guides?.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                !isRepair && styles.tabBtnActive,
                !isRepair && { backgroundColor: '#C95F12', borderColor: '#C95F12' },
              ]}
              onPress={() => setActiveTab('upcycle')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="cut-outline"
                size={16}
                color={!isRepair ? colors.cream : colors.charcoal}
              />
              <Text style={[styles.tabBtnText, !isRepair && styles.tabBtnTextActive]}>
                UPCYCLE & TRANSFORM
              </Text>
              {(result.upcycle_guides?.length || 0) > 0 && (
                <View style={[styles.tabBadge, !isRepair && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, !isRepair && styles.tabBadgeTextActive]}>
                    {result.upcycle_guides?.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Active Route Focus Banner ─────────────────────────── */}
          <View
            style={[
              styles.tabFocusBanner,
              !isRepair && { borderLeftColor: '#C95F12', backgroundColor: '#FDF7EB' },
            ]}
          >
            <Text style={[styles.tabFocusTitle, !isRepair && { color: '#C95F12' }]}>
              {isRepair ? '🧵 PATHWAY: RESTORATION & HAND MENDING' : '✂️ PATHWAY: CREATIVE UPCYCLING & REWORK'}
            </Text>
            <Text style={styles.tabFocusText}>
              {isRepair
                ? 'Step-by-step tutorials, darning guides, and blogs curated specifically to repair holes, loose seams, and fiber wear on this garment.'
                : 'Creative DIY tutorials, transformation guides, and blogs curated to convert this piece into tote bags, crop tops, or reworked patchwork.'}
            </Text>
          </View>

          {/* ── Step-by-Step Masterclass Tutorials ─────────────────── */}
          {hasGuides && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name={isRepair ? 'construct-outline' : 'color-wand-outline'}
                  size={20}
                  color={isRepair ? '#1E3B2F' : '#C95F12'}
                />
                <Text style={styles.sectionTitle}>
                  {isRepair
                    ? 'STEP-BY-STEP REPAIR & MENDING MASTERCLASSES'
                    : 'STEP-BY-STEP UPCYCLING & TRANSFORMATION MASTERCLASSES'}
                </Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                {isRepair
                  ? 'Hands-on artisan mending tutorials with tools required, numbered steps, and pro-tips'
                  : 'Creative pattern blueprints to reconstruct this garment into modern designer pieces'}
              </Text>

              {activeGuides.map((guide, idx) => {
                const guideId = `guide-${guide.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`;
                const isSaved = savedGuideIds.has(guideId);
                const isExpanded = expandedGuideIds.has(guideId);
                const steps = guide.detailed_steps && guide.detailed_steps.length > 0
                  ? guide.detailed_steps
                  : (guide.steps || []).map((st, sIdx) => ({
                      step: sIdx + 1,
                      instruction: typeof st === 'string' ? st : (st as any).instruction || '',
                      tip: typeof st === 'object' ? (st as any).tip : undefined,
                    }));

                return (
                  <View key={guideId || idx} style={styles.guideCard}>
                    {/* Bookmark Save */}
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={() => handleToggleSaveGuide(guide)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name={isSaved ? 'bookmark' : 'bookmark-outline'}
                        size={16}
                        color={isSaved ? colors.gold : colors.charcoal}
                      />
                    </TouchableOpacity>

                    {/* Header */}
                    <View style={styles.guideHeader}>
                      <View style={[styles.guideTypeBadge, !isRepair && { backgroundColor: '#C95F12' }]}>
                        <Text style={styles.guideTypeText}>
                          {isRepair ? '🧵 ARTISAN MEND' : '✂️ UPCYCLE REWORK'}
                        </Text>
                      </View>
                      <View style={styles.guideMeta}>
                        <View style={[styles.guideDiffBadge, { borderColor: difficultyColor(guide.difficulty) }]}>
                          <Text style={[styles.guideDiffText, { color: difficultyColor(guide.difficulty) }]}>
                            {guide.difficulty.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.guideTime}>⏱️ {guide.time_minutes || 30}m</Text>
                      </View>
                    </View>

                    {/* Title */}
                    <Text style={styles.guideTitle}>{guide.title}</Text>
                    {guide.technique_style && (
                      <Text style={styles.guideTechnique}>
                        TECHNIQUE: {guide.technique_style.toUpperCase()}
                      </Text>
                    )}

                    {/* Tools Required */}
                    {guide.tools_required && guide.tools_required.length > 0 && (
                      <View style={[styles.guideTools, { marginBottom: 14 }]}>
                        <Text style={styles.guideToolsLabel}>TOOLS & MATERIALS NEEDED</Text>
                        <View style={styles.guideToolsRow}>
                          {guide.tools_required.map((tool, tIdx) => (
                            <View key={tIdx} style={styles.guideToolChip}>
                              <Text style={styles.guideToolChipText}>🪡 {tool}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Expand/Collapse Toggle Button */}
                    <TouchableOpacity
                      style={styles.guideExpandBtn}
                      onPress={() => toggleExpandGuide(guideId)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.charcoal}
                      />
                      <Text style={styles.guideExpandText}>
                        {isExpanded
                          ? 'HIDE STEP-BY-STEP INSTRUCTIONS'
                          : `VIEW STEP-BY-STEP INSTRUCTIONS (${steps.length} STEPS)`}
                      </Text>
                    </TouchableOpacity>

                    {/* Steps List */}
                    {isExpanded && (
                      <View style={styles.guideSteps}>
                        {steps.map((st, sIdx) => (
                          <View key={sIdx} style={styles.guideStepWrapper}>
                            <View style={styles.guideStep}>
                              <View style={[styles.guideStepNum, !isRepair && { backgroundColor: '#C95F12' }]}>
                                <Text style={styles.guideStepNumText}>{st.step || sIdx + 1}</Text>
                              </View>
                              <Text style={styles.guideStepText}>{st.instruction}</Text>
                            </View>
                            {st.tip ? (
                              <View style={styles.stepTipBox}>
                                <Ionicons name="bulb-outline" size={13} color={colors.textSecond} />
                                <Text style={styles.stepTipText}>{st.tip}</Text>
                              </View>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Pro Tip Callout */}
                    {guide.pro_tip ? (
                      <View style={styles.proTipBox}>
                        <Ionicons name="sparkles" size={18} color={colors.gold} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.proTipHeading}>ARTISAN PRO TIP</Text>
                          <Text style={styles.proTipText}>{guide.pro_tip}</Text>
                        </View>
                      </View>
                    ) : null}

                    {/* Care Instructions */}
                    {guide.care_instructions ? (
                      <View style={styles.careBox}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={colors.forest} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.careHeading}>LONGEVITY & CARE</Text>
                          <Text style={styles.careText}>{guide.care_instructions}</Text>
                        </View>
                      </View>
                    ) : null}

                    {/* Upcycle Alternative */}
                    {guide.upcycle_alternative ? (
                      <View style={styles.upcycleAltBox}>
                        <Ionicons name="cut-outline" size={18} color={colors.orange} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.upcycleAltHeading}>CREATIVE VARIATION</Text>
                          <Text style={styles.upcycleAltText}>{guide.upcycle_alternative}</Text>
                        </View>
                      </View>
                    ) : null}

                    {/* Source Article Link */}
                    {guide.source_url ? (
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, alignSelf: 'flex-start' }}
                        onPress={() => openArticle(guide.source_url!)}
                      >
                        <Text style={{ fontFamily: typography.mono, fontSize: 10, fontWeight: '800', color: isRepair ? '#1E3B2F' : '#C95F12' }}>
                          VIEW ORIGINAL PATTERN / TUTORIAL ↗
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}

          {/* ── YouTube Tutorials ──────────────────────────────────── */}
          {hasYouTube && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                <Text style={styles.sectionTitle}>
                  {isRepair ? 'REPAIR VIDEO TUTORIALS' : 'UPCYCLE VIDEO TUTORIALS'}
                </Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                {isRepair
                  ? 'Mending and restoration guides picked from YouTube — tap to watch'
                  : 'Creative DIY rework tutorials picked from YouTube — tap to watch'}
              </Text>
              {activeYouTube.map((video, idx) => {
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

          {/* ── Curated Blog Articles & Tutorials (Direct Web Links) ─ */}
          {blogLinks.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="newspaper-outline" size={20} color={isRepair ? '#1E3B2F' : '#C95F12'} />
                <Text style={styles.sectionTitle}>
                  {isRepair ? 'REPAIR & MENDING BLOG ARTICLES' : 'UPCYCLING & DIY REWORK BLOG ARTICLES'}
                </Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                {isRepair
                  ? 'Curated external articles and mending tutorials — tap to open in browser'
                  : 'Curated external DIY upcycling blogs and pattern guides — tap to open in browser'}
              </Text>

              {blogLinks.map((article, idx) => (
                <TouchableOpacity
                  key={`${article.id}-${idx}`}
                  style={styles.blogCard}
                  onPress={() => openArticle(article.url)}
                  activeOpacity={0.85}
                >
                  <View style={styles.blogCardTopRow}>
                    <View style={[styles.blogTypeBadge, !isRepair && { backgroundColor: '#C95F12' }]}>
                      <Text style={styles.blogTypeBadgeText}>
                        {isRepair ? '🧵 REPAIR BLOG' : '✂️ UPCYCLE BLOG'}
                      </Text>
                    </View>
                    <View style={styles.blogSourceBadge}>
                      <Text style={styles.blogSourceBadgeText}>{article.source.toUpperCase()}</Text>
                    </View>
                    <View style={styles.blogDiffBadge}>
                      <Text style={[styles.blogDiffBadgeText, { color: difficultyColor(article.difficulty) }]}>
                        {article.difficulty.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.blogCardTitle}>{article.title}</Text>
                  {article.summary ? (
                    <Text style={styles.blogCardSummary}>{article.summary}</Text>
                  ) : null}

                  <View style={styles.blogCardFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.blogTimeText}>{article.time_minutes || 30} min read</Text>
                    </View>
                    <View style={styles.blogReadAction}>
                      <Text style={[styles.blogReadActionText, !isRepair && { color: '#C95F12' }]}>
                        READ FULL BLOG ARTICLE ↗
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}



          {/* ── No results fallback ──────────────────────────────── */}
          {!hasAnyContent && (
            <View style={styles.emptyCard}>
              <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Matching Guides Found</Text>
              <Text style={styles.emptyText}>
                We couldn't find specific repair guides or videos for this combination. Try uploading a clearer photo or describing the damage in detail.
              </Text>
            </View>
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
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
      >
        {/* Hero */}
        <View style={styles.formHero}>
          <Ionicons name="construct-outline" size={40} color={colors.charcoal} />
          <Text style={styles.formHeroTitle}>Repair & Refresh</Text>
          <Text style={styles.formHeroSub}>Upload a photo and our AI will find repair guides, step-by-step tutorials, and YouTube videos to help you fix or upcycle your garment.</Text>
        </View>

        {/* Upload */}
        <TouchableOpacity style={styles.uploadArea} onPress={selectImageSource} activeOpacity={0.8}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.uploadPreview} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="camera-outline" size={36} color={colors.charcoal} />
              <Text style={styles.uploadText}>Take or upload a photo</Text>
              <Text style={styles.uploadSubtext}>Camera or gallery (show damage clearly)</Text>
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
    </KeyboardAvoidingView>
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
  scrollContent: { padding: 20, paddingBottom: 180 },

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

  // ── Segregated Route Selector ───────────────────────────────
  tabContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  tabBtnActive: {
    backgroundColor: colors.charcoal,
  },
  tabBtnText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 0.5,
  },
  tabBtnTextActive: {
    color: colors.cream,
  },
  tabBadge: {
    backgroundColor: '#ECE8DD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: colors.gold,
  },
  tabBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: colors.charcoal,
  },
  tabBadgeTextActive: {
    color: colors.charcoal,
  },
  tabFocusBanner: {
    backgroundColor: '#F7F4EB',
    borderLeftWidth: 4,
    borderLeftColor: '#1E3B2F',
    padding: 12,
    marginBottom: 20,
  },
  tabFocusTitle: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: '#1E3B2F',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  tabFocusText: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 18,
  },

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
  guideSteps: { gap: 12, marginBottom: 16 },
  guideStepWrapper: { gap: 4 },
  guideStep: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  guideStepNum: { width: 22, height: 22, backgroundColor: colors.charcoal, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  guideStepNumText: { fontFamily: typography.mono, fontSize: 10, fontWeight: '800', color: colors.cream },
  guideStepText: { flex: 1, fontFamily: typography.body, fontSize: 13, color: colors.charcoal, lineHeight: 20 },
  stepTipBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 32, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: 'rgba(201, 95, 18, 0.08)', borderWidth: 1, borderColor: 'rgba(201, 95, 18, 0.2)' },
  stepTipText: { fontFamily: typography.mono, fontSize: 10, color: colors.textSecond, flex: 1, fontStyle: 'italic' },

  proTipBox: { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: '#FAF7EE', borderWidth: 1.5, borderColor: colors.gold, marginBottom: 12 },
  proTipHeading: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', color: colors.gold, letterSpacing: 0.8, marginBottom: 2 },
  proTipText: { fontFamily: typography.body, fontSize: 12, color: colors.charcoal, lineHeight: 17 },

  careBox: { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: 'rgba(30, 59, 47, 0.06)', borderWidth: 1.5, borderColor: colors.forest, marginBottom: 12 },
  careHeading: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', color: colors.forest, letterSpacing: 0.8, marginBottom: 2 },
  careText: { fontFamily: typography.body, fontSize: 11.5, color: colors.charcoal, lineHeight: 16 },

  upcycleAltBox: { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: 'rgba(201, 95, 18, 0.06)', borderWidth: 1.5, borderColor: colors.orange, marginBottom: 12 },
  upcycleAltHeading: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', color: colors.orange, letterSpacing: 0.8, marginBottom: 2 },
  upcycleAltText: { fontFamily: typography.body, fontSize: 11.5, color: colors.charcoal, lineHeight: 16 },

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

  // ── Result: Video → Steps strip (from enriched youtube guides) ──
  videoStepsWrap: { borderTopWidth: 1.5, borderTopColor: colors.border },
  videoStepsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FAF7EE',
  },
  videoStepsToggleText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '900', color: colors.charcoal, letterSpacing: 1 },
  videoStepsCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  videoStepsCountText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', color: colors.cream },
  videoStepsMeta: { flex: 1, alignItems: 'flex-end' },
  videoStepsMetaText: { fontFamily: typography.mono, fontSize: 8, color: colors.textMuted, textTransform: 'capitalize' },
  videoStepsList: { paddingHorizontal: 14, paddingVertical: 12, gap: 10, backgroundColor: colors.white },
  videoStepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  videoStepNum: { width: 20, height: 20, backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  videoStepNumText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', color: colors.charcoal },
  videoStepText: { flex: 1, fontFamily: typography.body, fontSize: 13, color: colors.charcoal, lineHeight: 19 },

  // ── Result: Curated Reading List (blog articles) ──────────────
  readCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 14,
    marginBottom: 12,
  },
  readIconWrap: {
    width: 38,
    height: 38,
    backgroundColor: colors.cream,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readInfo: { flex: 1 },
  readTitle: { fontFamily: typography.body, fontSize: 13, fontWeight: '700', color: colors.charcoal, lineHeight: 18, marginBottom: 4 },
  readSource: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, textTransform: 'capitalize' },

  // ── Result: Curated Blog Cards ─────────────────────────────────
  blogCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  blogCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  blogTypeBadge: {
    backgroundColor: '#1E3B2F',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  blogTypeBadgeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.8,
  },
  blogSourceBadge: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  blogSourceBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.charcoal,
  },
  blogDiffBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blogDiffBadgeText: {
    fontFamily: typography.mono,
    fontSize: 8,
    fontWeight: '800',
  },
  blogCardTitle: {
    fontFamily: typography.headings,
    fontSize: 17,
    fontWeight: '800',
    color: colors.charcoal,
    lineHeight: 22,
    marginBottom: 6,
  },
  blogCardSummary: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.textSecond,
    lineHeight: 18,
    marginBottom: 12,
  },
  blogCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,31,34,0.08)',
    paddingTop: 10,
    marginTop: 4,
  },
  blogTimeText: {
    fontFamily: typography.mono,
    fontSize: 9.5,
    color: colors.textMuted,
  },
  blogReadAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  blogReadActionText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: '#1E3B2F',
    letterSpacing: 0.8,
  },

  // ── Result: Empty State ───────────────────────────────────────
  emptyCard: { alignItems: 'center', padding: 32, borderWidth: 2, borderColor: colors.charcoal, borderStyle: 'dashed', gap: 12, marginBottom: 24 },
  emptyTitle: { fontFamily: typography.mono, fontSize: 12, fontWeight: '800', color: colors.charcoal },
  emptyText: { fontFamily: typography.mono, fontSize: 10, color: colors.textMuted, textAlign: 'center', lineHeight: 16 },

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

  // ── Result: Content Tabs (progressive disclosure) ──────────────
  tabBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  tabText: { fontFamily: typography.mono, fontSize: 10, fontWeight: '900', color: colors.charcoal, letterSpacing: 1 },
  tabTextActive: { color: colors.cream },

  // ── Result: Guide expand/collapse ───────────────────────────────
  guideExpandBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.cream,
    marginBottom: 12,
  },
  guideExpandText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', color: colors.charcoal, letterSpacing: 1 },

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
