import React, { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography } from '../../../src/theme';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';

import {
  assessGarment,
  GARMENT_CATEGORIES,
  COLOR_FAMILIES,
  SEASONS,
  STYLE_TAGS,
  routeDisplayInfo,
  conditionGrade,
  GLIEResponse,
} from '../../../src/services/glieService';

export default function ConditionCheckScreen() {
  const router = useRouter();
  useBackHandler('/(tabs)/circular');

  // ── Input state ──────────────────────────────────────────────
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [fiber, setFiber] = useState('');
  const [price, setPrice] = useState('');
  const [color, setColor] = useState('');
  const [season, setSeason] = useState('');
  const [style, setStyle] = useState('');

  // ── Result state ─────────────────────────────────────────────
  const [analyzing, setAnalyzing] = useState(false);
  const [glieStep, setGlieStep] = useState(0);
  const [result, setResult] = useState<GLIEResponse | null>(null);

  // ── Image picker ──────────────────────────────────────────────
  const pickImage = async (useCamera = false) => {
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Camera permission needed'); return; }
      const pick = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
      if (!pick.canceled) { setImageUri(pick.assets[0].uri); setImageBase64(pick.assets[0].base64 || null); }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Gallery permission needed'); return; }
      const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
      if (!pick.canceled) { setImageUri(pick.assets[0].uri); setImageBase64(pick.assets[0].base64 || null); }
    }
  };

  // ── Submit assessment ─────────────────────────────────────────
  const submitAssessment = async () => {
    if (!imageUri) {
      Alert.alert('Photo required', 'Please upload a garment photo to begin.');
      return;
    }

    setAnalyzing(true);
    setGlieStep(0); // UPLOADING IMAGE
    try {
      const glieResult = await assessGarment(
        {
          garment_id: `app-${Date.now()}`,
          image_url: imageUri,
          image_base64: imageBase64 || undefined,
          garment_category: category || 'other',
          fiber_type: fiber.trim() || 'Cotton',
          original_price_inr: parseFloat(price) || 0,
          style_tags: style || 'casual',
          color_family: color || 'neutrals',
          season: season || 'all_season',
        },
        (step) => setGlieStep(step), // progress callback
      );
      setResult(glieResult);
    } catch (e: any) {
      Alert.alert(
        'Assessment Failed',
        e?.message || 'Could not connect to the assessment service. Make sure the GLIE server is running on port 8000.'
      );
    } finally {
      setAnalyzing(false);
      setGlieStep(0);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────
  const resetAssessment = () => {
    setResult(null);
    setImageUri(null);
    setImageBase64(null);
    setCategory('');
    setFiber('');
    setPrice('');
    setColor('');
    setSeason('');
    setStyle('');
  };

  const navigateToSell = () => {
    const score = result?.condition_score ?? 0.8;
    let cond = 'PRISTINE';
    if (score < 0.6) cond = 'MINOR_WEAR';
    else if (score < 0.85) cond = 'MINOR_WEAR';
    else cond = 'PRISTINE';

    const catName = category || (result as any)?.garment_category || (result as any)?.category || 'Dresses';
    const displayTitle = (result as any)?.title || `${(fiber || (result as any)?.fiber_type || 'Heritage').toUpperCase()} ${catName.toUpperCase()}`;
    const displayDesc = (result as any)?.description || `Pre-loved ${catName} in ${conditionGrade(score).label} condition. Assessed by Kaphor Circular AI.`;

    router.push({
      pathname: '/(tabs)/shop/sell',
      params: {
        prefillImage: imageUri || '',
        prefillCategory: catName,
        prefillTitle: displayTitle,
        prefillDescription: displayDesc,
        prefillBrand: '',
        prefillCondition: cond,
        prefillFabric: fiber || (result as any)?.fiber_type || '',
        prefillColor: color || (result as any)?.color_family || '',
        prefillStyle: style || '',
        prefillListingType: 'SALE',
      },
    });
  };

  // ── Result View ───────────────────────────────────────────────
  if (result) {
    const routeInfo = routeDisplayInfo(result.routing_decision);
    const grade = conditionGrade(result.condition_score);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetAssessment}>
            <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ASSESSMENT</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          {/* ── Routing Decision Hero ─────────────────────────────── */}
          <View style={[styles.heroCard, { backgroundColor: routeInfo.color }]}>
            <Text style={styles.heroEmoji}>{routeInfo.emoji}</Text>
            <Text style={styles.heroTitle}>{routeInfo.title}</Text>
            <Text style={styles.heroSubtitle}>{routeInfo.subtitle}</Text>
          </View>

          {/* ── Condition Grade ──────────────────────────────────── */}
          <View style={styles.gradeRow}>
            <View style={[styles.gradeBadge, { backgroundColor: grade.color }]}>
              <Text style={styles.gradeText}>{grade.label}</Text>
            </View>
            <View style={styles.gradeMeta}>
              <Text style={styles.gradeMetaLabel}>AI Assessment</Text>
              {imageUri && (
                <Image source={{ uri: imageUri }} style={styles.gradeThumb} />
              )}
            </View>
          </View>

          {/* ── Route-Specific Action Card ────────────────────────── */}
          {result.routing_decision === 'RESELL' && (
            <View style={styles.actionCard}>
              <Text style={styles.actionCardTitle}>Verified for Marketplace Resale</Text>
              <Text style={styles.actionCardPlaceholder}>
                Your garment is in good condition! Photo and details are ready to transfer directly. Set your own price on the next screen.
              </Text>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={navigateToSell}
              >
                <Text style={styles.actionBtnText}>LIST FOR SALE (1-CLICK) →</Text>
              </TouchableOpacity>
            </View>
          )}

          {result.routing_decision === 'UPCYCLE' && (
            <View style={styles.actionCard}>
              <Text style={styles.actionCardTitle}>Repair & Upcycle</Text>
              {result.repair_feasibility || result.description ? (
                <>
                  <Text style={styles.actionCardTutorial}>
                    {result.description || 'Garment assessed by GLIE engine.'}
                  </Text>
                  {result.repair_feasibility && (
                    <Text style={[styles.actionCardTutorial, { marginTop: 8, fontSize: 12, color: colors.textMuted }]}>
                      {result.repair_feasibility}
                    </Text>
                  )}
                  {(result as any).rag_context?.guides_matched > 0 && (
                    <View style={styles.tutorialMeta}>
                      <View style={styles.tutorialChip}>
                        <Text style={styles.tutorialChipText}>📋 {result.suggested_repair_technique || 'Guides available'}</Text>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.actionCardPlaceholder}>
                  Explore our studio for repair and upcycling inspiration.
                </Text>
              )}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push('/(tabs)/studio/repair-refresh')}
              >
                <Text style={styles.actionBtnText}>REPAIR & REFRESH →</Text>
              </TouchableOpacity>
            </View>
          )}

          {result.routing_decision === 'RECYCLE' && (
            <View style={styles.actionCard}>
              <Text style={styles.actionCardTitle}>Recycling Options</Text>
              <Text style={styles.actionCardTutorial}>
                This garment has reached end of life.
              </Text>
              {result.repair_feasibility && (
                <Text style={[styles.actionCardPlaceholder, { marginBottom: 12 }]}>
                  {result.repair_feasibility}
                </Text>
              )}
              <Text style={styles.actionCardPlaceholder}>
                Drop it at a nearby textile collection point or mail it to Kaphor Recycling.
              </Text>
            </View>
          )}

          {/* ── Impact Card ────────────────────────────────────────── */}
          <View style={styles.impactCard}>
            <Text style={styles.impactTitle}>Environmental Impact</Text>
            <View style={styles.impactGrid}>
              <View style={styles.impactStat}>
                <Text style={styles.impactStatValue}>{result.carbon_saved_kg.toFixed(1)}</Text>
                <Text style={styles.impactStatUnit}>kg CO₂</Text>
                <Text style={styles.impactStatLabel}>Carbon Saved</Text>
              </View>
              <View style={styles.impactStat}>
                <Text style={styles.impactStatValue}>{(result.water_saved_litres ?? 0).toFixed(0)}</Text>
                <Text style={styles.impactStatUnit}>L</Text>
                <Text style={styles.impactStatLabel}>Water Saved</Text>
              </View>
              <View style={styles.impactStat}>
                <Text style={styles.impactStatValue}>{result.trees_equivalent.toFixed(1)}</Text>
                <Text style={styles.impactStatUnit}>trees</Text>
                <Text style={styles.impactStatLabel}>Equivalent</Text>
              </View>
            </View>
          </View>

          {/* ── Fine-Tuned Qwen2-VL VLM Breakdown Card ──────────────── */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>AI VISION INTELLIGENCE (QWEN2-VL VLM)</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Backbone Model</Text>
              <Text style={[styles.summaryValue, { color: colors.forest, fontWeight: '700' }]}>
                {(result as any).model || 'Gemini 3.1 Flash (Vision AI)'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Condition Score (CS)</Text>
              <Text style={styles.summaryValue}>{(result.condition_score * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Damage Ratio (DR)</Text>
              <Text style={styles.summaryValue}>{((result.damage_breakdown?.damage_ratio ?? 0) * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Wear Zone Ratio (WR)</Text>
              <Text style={styles.summaryValue}>{((result.damage_breakdown?.wear_zone_ratio ?? 0) * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Stain Ratio (SR)</Text>
              <Text style={styles.summaryValue}>{((result.damage_breakdown?.stain_ratio ?? 0) * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fiber Degradation (FD)</Text>
              <Text style={styles.summaryValue}>{((result.damage_breakdown?.fiber_degradation_score ?? 0) * 100).toFixed(1)}%</Text>
            </View>
            {result.description ? (
              <View style={[styles.summaryRow, { flexDirection: 'column', alignItems: 'flex-start', marginTop: 6 }]}>
                <Text style={styles.summaryLabel}>VLM Description</Text>
                <Text style={[styles.summaryValue, { marginTop: 4, fontSize: 13, color: colors.charcoal }]}>
                  {result.description}
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── Garment Summary ──────────────────────────────────────── */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>ASSESSED GARMENT</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Type</Text>
              <Text style={styles.summaryValue}>{category ? (category.charAt(0).toUpperCase() + category.slice(1)) : 'Auto-detected'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fabric</Text>
              <Text style={styles.summaryValue}>{fiber || 'Auto-detected'}</Text>
            </View>
            {price ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Original Price</Text>
                <Text style={styles.summaryValue}>₹{parseFloat(price).toLocaleString('en-IN')}</Text>
              </View>
            ) : null}
          </View>

          {/* ── Scan Another ─────────────────────────────────────────── */}
          <TouchableOpacity style={styles.scanAgainBtn} onPress={resetAssessment}>
            <Text style={styles.scanAgainText}>ASSESS ANOTHER GARMENT</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Loading View ─────────────────────────────────────────────
  if (analyzing) {
    return (
      <DossierLoading
        variant="glie"
        glieStep={glieStep}
        glieTotalSteps={5}
      />
    );
  }

  // ── Input View ───────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => safeBack('/(tabs)/circular')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>CONDITION CHECK</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Upload Area */}
          <TouchableOpacity
            style={styles.uploadArea}
            onPress={() => pickImage(false)}
            activeOpacity={0.8}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.uploadPreview} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="camera-outline" size={36} color={colors.charcoal} />
                <Text style={styles.uploadText}>Tap to upload a photo</Text>
                <Text style={styles.uploadSubtext}>JPG or PNG recommended</Text>
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
              <TouchableOpacity onPress={() => setImageUri(null)} style={styles.uploadActionBtn}>
                <Ionicons name="close-outline" size={16} color={colors.red} />
                <Text style={[styles.uploadActionText, { color: colors.red }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Category Picker */}
          <Text style={styles.inputLabel}>GARMENT TYPE (OPTIONAL — AI AUTO-DETECTED)</Text>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          >
            <Text style={category ? styles.pickerText : styles.pickerPlaceholder}>
              {category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Auto-detect from photo (or select)'}
            </Text>
            <Ionicons name={showCategoryPicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.charcoal} />
          </TouchableOpacity>
          {showCategoryPicker && (
            <View style={styles.pickerGrid}>
              {GARMENT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.pickerOption, category === cat && styles.pickerOptionActive]}
                  onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}
                >
                  <Text
                    style={[styles.pickerOptionText, category === cat && styles.pickerOptionTextActive]}
                    numberOfLines={1}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Fiber Input */}
          <Text style={styles.inputLabel}>FABRIC TYPE (OPTIONAL — AI AUTO-DETECTED)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Auto-detect from photo (or type e.g. Cotton)"
            placeholderTextColor={colors.textMuted}
            value={fiber}
            onChangeText={setFiber}
          />

          {/* Original Price */}
          <Text style={styles.inputLabel}>ORIGINAL PRICE (₹)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="What did you pay? (optional)"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
          />

          {/* Optional chips: color, season, style — flat layout */}
          <Text style={[styles.inputLabel, { marginTop: 24, color: colors.textMuted }]}>
            ADDITIONAL DETAILS (OPTIONAL)
          </Text>

          <View style={styles.chipSection}>
            <Text style={styles.chipSectionLabel}>Color</Text>
            <View style={styles.chipRow}>
              {COLOR_FAMILIES.map((o) => (
                <TouchableOpacity
                  key={o}
                  style={[styles.chip, color === o && styles.chipActive]}
                  onPress={() => setColor(color === o ? '' : o)}
                >
                  <Text style={[styles.chipText, color === o && styles.chipTextActive]}>
                    {o.charAt(0).toUpperCase() + o.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.chipSection}>
            <Text style={styles.chipSectionLabel}>Season</Text>
            <View style={styles.chipRow}>
              {SEASONS.map((o) => (
                <TouchableOpacity
                  key={o}
                  style={[styles.chip, season === o && styles.chipActive]}
                  onPress={() => setSeason(season === o ? '' : o)}
                >
                  <Text style={[styles.chipText, season === o && styles.chipTextActive]}>
                    {o.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.chipSection}>
            <Text style={styles.chipSectionLabel}>Style</Text>
            <View style={styles.chipRow}>
              {STYLE_TAGS.map((o) => (
                <TouchableOpacity
                  key={o}
                  style={[styles.chip, style === o && styles.chipActive]}
                  onPress={() => setStyle(style === o ? '' : o)}
                >
                  <Text style={[styles.chipText, style === o && styles.chipTextActive]}>
                    {o.charAt(0).toUpperCase() + o.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              !imageUri && styles.submitBtnDisabled,
            ]}
            onPress={submitAssessment}
            disabled={analyzing || !imageUri}
          >
            <Text style={styles.submitText}>ASSESS GARMENT</Text>
          </TouchableOpacity>

          {!imageUri && (
            <Text style={styles.hintText}>
              Upload a photo and select the garment type to begin the AI assessment.
            </Text>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  headerTitle: {
    color: colors.charcoal,
    fontSize: 14,
    fontFamily: typography.mono,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // ── Form ────────────────────────────────────────────────────
  formContent: { padding: 20, paddingBottom: 100 },

  // Upload
  uploadArea: {
    width: '100%',
    height: 200,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderStyle: 'dashed',
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  uploadPlaceholder: { alignItems: 'center', gap: 8 },
  uploadText: { fontFamily: typography.mono, fontSize: 13, fontWeight: '800', color: colors.charcoal },
  uploadSubtext: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted },
  uploadActions: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 28 },
  uploadActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10 },
  uploadActionText: { fontFamily: typography.mono, fontSize: 10, fontWeight: '800', color: colors.charcoal },

  // Inputs
  inputLabel: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 20,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 14,
    fontFamily: typography.body,
    fontSize: 14,
    color: colors.charcoal,
    backgroundColor: colors.white,
  },

  // Pickers
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 14,
    backgroundColor: colors.white,
  },
  pickerText: { fontFamily: typography.body, fontSize: 14, color: colors.charcoal },
  pickerPlaceholder: { fontFamily: typography.body, fontSize: 14, color: colors.textMuted },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderTopWidth: 0,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  pickerOptionActive: { backgroundColor: colors.charcoal },
  pickerOptionText: { fontFamily: typography.mono, fontSize: 11, fontWeight: '700', color: colors.charcoal },
  pickerOptionTextActive: { color: colors.cream },

  // Chips (flat layout — no nested ScrollViews)
  chipSection: { marginBottom: 8 },
  chipSectionLabel: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.charcoal },
  chipText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '700', color: colors.charcoal },
  chipTextActive: { color: colors.cream },

  // Submit
  submitBtn: {
    backgroundColor: colors.charcoal,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginTop: 32,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitRow: { flexDirection: 'row', alignItems: 'center' },
  submitText: { color: colors.cream, fontFamily: typography.mono, fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  hintText: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: 16, lineHeight: 16 },

  // ── Result ──────────────────────────────────────────────────
  resultContent: { padding: 20, paddingBottom: 100 },

  // Hero Card
  heroCard: {
    padding: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginBottom: 20,
  },
  heroEmoji: { fontSize: 48, marginBottom: 8 },
  heroTitle: { fontFamily: typography.headings, fontSize: 40, color: colors.cream, letterSpacing: 2, marginBottom: 8 },
  heroSubtitle: { fontFamily: typography.mono, fontSize: 11, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 18 },

  // Grade Row
  gradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  gradeBadge: { paddingHorizontal: 20, paddingVertical: 10, borderWidth: 2, borderColor: colors.charcoal },
  gradeText: { fontFamily: typography.mono, fontSize: 14, fontWeight: '900', color: colors.cream, letterSpacing: 1.5 },
  gradeMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gradeMetaLabel: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, letterSpacing: 0.5 },
  gradeThumb: { width: 44, height: 44, borderWidth: 1.5, borderColor: colors.charcoal },

  // Action Card
  actionCard: {
    backgroundColor: colors.white,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    marginBottom: 20,
  },
  actionCardTitle: { fontFamily: typography.mono, fontSize: 10, fontWeight: '900', color: colors.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  actionCardPrice: { fontFamily: typography.headings, fontSize: 42, color: colors.charcoal, marginBottom: 16 },
  actionCardTutorial: { fontFamily: typography.body, fontSize: 14, color: colors.charcoal, lineHeight: 22, marginBottom: 16 },
  actionCardPlaceholder: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted, lineHeight: 18, marginBottom: 16 },
  tutorialMeta: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tutorialChip: { backgroundColor: colors.cream, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.charcoal },
  tutorialChipText: { fontFamily: typography.mono, fontSize: 8, fontWeight: '700', color: colors.charcoal },
  toolsText: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, marginBottom: 16 },
  pickupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.forest,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  pickupBadgeText: { fontFamily: typography.mono, fontSize: 9, fontWeight: '800', color: colors.cream },
  actionBtn: {
    backgroundColor: colors.charcoal,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  actionBtnText: { color: colors.cream, fontFamily: typography.mono, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },

  // Impact Card
  impactCard: {
    backgroundColor: colors.white,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.charcoal,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    marginBottom: 20,
  },
  impactTitle: { fontFamily: typography.mono, fontSize: 10, fontWeight: '900', color: colors.textMuted, letterSpacing: 1.5, marginBottom: 16 },
  impactGrid: { flexDirection: 'row', gap: 12 },
  impactStat: { flex: 1, backgroundColor: colors.cream, padding: 12, borderWidth: 1.5, borderColor: colors.charcoal, alignItems: 'center' },
  impactStatValue: { fontFamily: typography.headings, fontSize: 28, color: colors.charcoal },
  impactStatUnit: { fontFamily: typography.mono, fontSize: 9, color: colors.textMuted, marginTop: 2 },
  impactStatLabel: { fontFamily: typography.mono, fontSize: 8, fontWeight: '800', color: colors.charcoal, marginTop: 4, letterSpacing: 0.5, textAlign: 'center' },

  // Summary Card
  summaryCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 24,
  },
  summaryTitle: { fontFamily: typography.mono, fontSize: 9, fontWeight: '900', color: colors.textMuted, letterSpacing: 1, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontFamily: typography.mono, fontSize: 11, color: colors.textMuted },
  summaryValue: { fontFamily: typography.mono, fontSize: 11, fontWeight: '800', color: colors.charcoal },

  // Scan Again
  scanAgainBtn: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  scanAgainText: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});
