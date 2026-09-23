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
  ActivityIndicator,
  Modal,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography } from '../../../src/theme';
import { DossierLoading } from '../../../src/components/common/DossierLoading';
import { CenterCardsLoading } from '../../../src/components/common/CardLoadingScreen';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { circularService, RecyclingCenter, RecyclingCentersResponse } from '../../../src/services/circularService';

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
import { setSharedRepairAssessment } from '../../../src/services/repairService';

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

  // ── Price Confirmation state ──────────────────────────────────
  const [resellPrice, setResellPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');

  // ── Result state ─────────────────────────────────────────────
  const [analyzing, setAnalyzing] = useState(false);
  const [glieStep, setGlieStep] = useState(0);
  const [result, setResult] = useState<GLIEResponse | null>(null);
  const [recyclingData, setRecyclingData] = useState<RecyclingCentersResponse | null>(null);
  const [loadingRecycling, setLoadingRecycling] = useState(false);

  const fetchRecyclingCenters = async () => {
    setLoadingRecycling(true);
    try {
      const data = await circularService.getRecyclingCenters();
      setRecyclingData(data);
    } catch (err) {
      console.warn('Failed loading recycling centers', err);
    } finally {
      setLoadingRecycling(false);
    }
  };

  // ── Image picker ──────────────────────────────────────────────
  const pickImage = async (useCamera = false) => {
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Camera permission needed'); return; }
      const pick = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        base64: true,
        allowsEditing: true,
      });
      if (!pick.canceled && pick.assets[0]) { setImageUri(pick.assets[0].uri); setImageBase64(pick.assets[0].base64 || null); }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Gallery permission needed'); return; }
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        base64: true,
        allowsEditing: true,
      });
      if (!pick.canceled && pick.assets[0]) { setImageUri(pick.assets[0].uri); setImageBase64(pick.assets[0].base64 || null); }
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
      if (glieResult.suggested_price_inr) {
        setResellPrice(String(glieResult.suggested_price_inr));
      }
      const initialCost = price || (glieResult as any)?.original_price_inr;
      if (initialCost) {
        setCostPrice(String(initialCost));
      }
      if (glieResult.routing_decision === 'RECYCLE') {
        fetchRecyclingCenters();
      }
    } catch (e: any) {
      Alert.alert(
        'Assessment Failed',
        e?.message || 'Could not connect to the assessment service. Make sure the backend is running and try again.'
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
    setResellPrice('');
    setCostPrice('');
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

    const finalSellingPrice = resellPrice.trim() || (result?.suggested_price_inr ? String(result.suggested_price_inr) : '');
    const finalCostPrice = costPrice.trim() || price || ((result as any)?.original_price_inr ? String((result as any).original_price_inr) : '');

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
        prefillPrice: finalSellingPrice,
        prefillOriginalPrice: finalCostPrice,
      },
    });
  };

  // ── Result View ───────────────────────────────────────────────
  if (result) {
    const routeInfo = routeDisplayInfo(result.routing_decision);
    const grade = conditionGrade(result.condition_score);

    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={resetAssessment}>
              <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>ASSESSMENT</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.resultContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
            keyboardDismissMode="on-drag"
          >
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
          {result.routing_decision === 'RESELL' && (() => {
            const numCost = parseFloat(costPrice) || 0;
            const numSell = parseFloat(resellPrice) || 0;
            const discountPct = (numCost > numSell && numCost > 0)
              ? Math.round(((numCost - numSell) / numCost) * 100)
              : 0;

            return (
              <View style={styles.actionCard}>
                <Text style={styles.actionCardTitle}>VERIFIED FOR MARKETPLACE RESALE</Text>
                
                {result.suggested_price_inr ? (
                  <View style={{ marginVertical: 8, padding: 12, backgroundColor: 'rgba(15, 92, 70, 0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(15, 92, 70, 0.25)' }}>
                    <Text style={{ fontFamily: typography.mono, fontSize: 14.5, color: colors.emerald, fontWeight: '700', letterSpacing: 0.5 }}>
                      MARKET RECOMMENDED RESALE: ₹{result.suggested_price_inr}
                    </Text>
                    <Text style={{ fontFamily: typography.body, fontSize: 14.5, color: colors.textMuted, marginTop: 4, lineHeight: 16 }}>
                      Derived from comparable resale listings for {category || 'this category'} in {grade.label} condition. You can keep or adjust it below.
                    </Text>
                  </View>
                ) : null}

                {/* Confirm Dual Pricing */}
                <View style={{ marginVertical: 10 }}>
                  <Text style={{ fontFamily: typography.mono, fontSize: 13.5, color: colors.charcoal, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 }}>
                    ORIGINAL RETAIL PRICE / MRP (₹)
                  </Text>
                  <TextInput
                    style={[styles.textInput, { padding: 10, fontSize: 17, marginBottom: 12 }]}
                    value={costPrice}
                    onChangeText={setCostPrice}
                    placeholder="e.g. 2499 (Original purchase price)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />

                  <Text style={{ fontFamily: typography.mono, fontSize: 13.5, color: colors.charcoal, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 }}>
                    CONFIRMED SELLING PRICE (₹)
                  </Text>
                  <TextInput
                    style={[styles.textInput, { padding: 10, fontSize: 17 }]}
                    value={resellPrice}
                    onChangeText={setResellPrice}
                    placeholder="e.g. 899 (Your resale price)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />

                  {discountPct > 0 ? (
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: 'rgba(15, 92, 70, 0.08)', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(15, 92, 70, 0.2)' }}>
                      <Text style={{ fontFamily: typography.mono, fontSize: 14.5, color: colors.emerald, fontWeight: '800' }}>
                        MARKETPLACE PREVIEW: -{discountPct}% OFF MRP
                      </Text>
                      <Text style={{ fontFamily: typography.body, fontSize: 14.5, color: colors.textMuted, marginTop: 2 }}>
                        Listed at ₹{numSell.toLocaleString('en-IN')} with strikethrough MRP ₹{numCost.toLocaleString('en-IN')}. Buyers save ₹{(numCost - numSell).toLocaleString('en-IN')}.
                      </Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[styles.actionBtn, { marginTop: 6 }]}
                  onPress={navigateToSell}
                >
                  <Text style={styles.actionBtnText}>
                    {resellPrice ? `CONFIRM & LIST FOR ₹${resellPrice} →` : 'LIST FOR SALE (1-CLICK) →'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })()}

          {result.routing_decision === 'UPCYCLE' && (
            <View style={styles.actionCard}>
              <View style={styles.segregationBanner}>
                <View style={styles.segregationBadge}>
                  <Ionicons name="sparkles" size={12} color={colors.white} />
                  <Text style={styles.segregationBadgeText}>WEAR / DAMAGE DETECTED · REPAIR OR UPCYCLE</Text>
                </View>
                <Text style={styles.actionCardTitle}>RESTORE OR TRANSFORM</Text>
                <Text style={styles.segregationSub}>
                  {result.description || 'This garment shows localized wear or damage. Choose whether to mend it back to original wearability or creatively transform it into a brand new item.'}
                </Text>
              </View>

              {/* Single CTA: repair & upcycle live on the same page behind a toggle */}
              <View style={[styles.pathCard, { borderColor: '#C95F12' }]}>
                <View style={styles.pathHeader}>
                  <View style={[styles.pathIconBox, { backgroundColor: '#C95F12' }]}>
                    <Ionicons name="cut-outline" size={18} color={colors.cream} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pathTitle, { color: '#C95F12' }]}>REPAIR & UPCYCLE</Text>
                    <Text style={styles.pathSubtitle}>Mend it back to wearable or transform it into something new</Text>
                  </View>
                </View>
                <Text style={styles.pathDescription}>
                  {result.repair_feasibility
                    ? `${result.repair_feasibility} You'll get matching repair guides, video tutorials, and upcycling ideas for this garment.`
                    : 'Get step-by-step repair guides, video tutorials, and upcycling ideas for this garment.'}
                </Text>
                <View style={styles.pathTagsRow}>
                  <View style={styles.pathTag}><Text style={styles.pathTagText}>🧵 Repair Guides</Text></View>
                  <View style={styles.pathTag}><Text style={styles.pathTagText}>🎬 Video Tutorials</Text></View>
                  <View style={styles.pathTag}><Text style={styles.pathTagText}>✂️ Upcycle Ideas</Text></View>
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#C95F12', borderColor: '#C95F12', marginTop: 12 }]}
                  onPress={() => {
                    if ((result as any)?.rawRepairResult) {
                      setSharedRepairAssessment((result as any).rawRepairResult);
                    }
                    router.push({
                      pathname: '/(tabs)/studio/repair-refresh',
                      params: {
                        mode: 'upcycle',
                        useSharedAssessment: 'true',
                        prefillImage: imageUri || '',
                        prefillCategory: category || (result as any)?.garment_category || '',
                        prefillFiber: fiber || (result as any)?.fiber_type || '',
                        prefillPrice: price || '',
                        damageTypes: JSON.stringify(result.damage_breakdown?.damage_types || []),
                        repairFeasibility: result.repair_feasibility || '',
                        conditionScore: String(result.condition_score ?? 0.45),
                      },
                    });
                  }}
                >
                  <Text style={styles.actionBtnText}>EXPLORE REPAIR & UPCYCLE GUIDES →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {result.routing_decision === 'RECYCLE' && (
            <View style={styles.actionCard}>
              <View style={styles.recycleHeader}>
                <View style={styles.recycleHeaderBadge}>
                  <Ionicons name="leaf" size={13} color={colors.white} />
                  <Text style={styles.recycleHeaderBadgeText}>VERIFIED RECYCLING PARTNER DIRECTORY</Text>
                </View>
                <Text style={styles.actionCardTitle}>CERTIFIED TEXTILE RECYCLING HUBS</Text>
              </View>

              <Text style={styles.actionCardTutorial}>
                This garment has reached the end of its wearable lifecycle. Bring your unwearable garments directly to any verified recycling center reception listed below for drop-off processing.
              </Text>

              {/* Location Banner */}
              <View style={styles.locationDetectionBanner}>
                <Ionicons name="location" size={15} color={colors.charcoal} />
                <Text style={styles.locationDetectionText}>
                  Showing verified drop-off centers near{' '}
                  <Text style={styles.locationDetectionBold}>
                    {recyclingData?.userLocation?.city || 'Your Area'}
                  </Text>
                  {recyclingData?.userLocation?.pincode ? ` (${recyclingData.userLocation.pincode})` : ''}
                </Text>
              </View>

              {/* Clean Recycling Centers Database Cards */}
              {loadingRecycling ? (
                <CenterCardsLoading count={3} />
              ) : (
                <View style={styles.centersListContainer}>
                  {(recyclingData?.centers || []).map((center) => (
                    <View key={center.id} style={styles.centerItemCard}>
                      {/* Top row: Name & Zero-Landfill Score */}
                      <View style={styles.centerItemHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.centerItemName}>{center.name}</Text>
                          <Text style={styles.centerItemCity}>
                            {center.city}, {center.state} • {center.distance || 'Regional Partner'}
                          </Text>
                        </View>
                        <View style={styles.centerScorePill}>
                          <Ionicons name="shield-checkmark" size={11} color="#283618" />
                          <Text style={styles.centerScoreText}>{center.zeroLandfillScore}% ZERO-LANDFILL</Text>
                        </View>
                      </View>

                      {/* Description */}
                      {center.description ? (
                        <Text style={styles.centerDescriptionText}>{center.description}</Text>
                      ) : null}

                      {/* Address & Operating Hours */}
                      <View style={styles.centerMetaRow}>
                        <Ionicons name="navigate-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.centerMetaText} numberOfLines={2}>{center.address}</Text>
                      </View>
                      <View style={styles.centerMetaRow}>
                        <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.centerMetaText}>{center.operatingHours}</Text>
                      </View>

                      {/* Helpline Phone */}
                      {center.phone ? (
                        <View style={styles.centerMetaRow}>
                          <Ionicons name="call-outline" size={12} color={colors.forest} />
                          <Text style={[styles.centerMetaText, { color: colors.forest, fontWeight: '800' }]}>
                            {center.phone}
                          </Text>
                        </View>
                      ) : null}

                      {/* Accepted Fibers */}
                      <View style={styles.fiberTagRow}>
                        {center.acceptedFibers.map((fib, idx) => (
                          <View key={idx} style={styles.fiberTagPill}>
                            <Text style={styles.fiberTagText}>{fib}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Certifications */}
                      {center.certifications && center.certifications.length > 0 && (
                        <Text style={styles.certText} numberOfLines={1}>
                          Certs: {center.certifications.join(' • ')}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
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
                <Text style={[styles.summaryValue, { marginTop: 4, fontSize: 17, color: colors.charcoal }]}>
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
    </KeyboardAvoidingView>
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

        <ScrollView
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          keyboardDismissMode="on-drag"
        >
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
    fontSize: 18,
    fontFamily: typography.mono,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // ── Form ────────────────────────────────────────────────────
  formContent: { padding: 20, paddingBottom: 180 },

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
  uploadText: { fontFamily: typography.mono, fontSize: 17, fontWeight: '800', color: colors.charcoal },
  uploadSubtext: { fontFamily: typography.mono, fontSize: 12, color: colors.textMuted },
  uploadActions: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 28 },
  uploadActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10 },
  uploadActionText: { fontFamily: typography.mono, fontSize: 13.5, fontWeight: '800', color: colors.charcoal },

  // Inputs
  inputLabel: {
    fontFamily: typography.mono,
    fontSize: 12,
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
    fontSize: 18,
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
  pickerText: { fontFamily: typography.body, fontSize: 18, color: colors.charcoal },
  pickerPlaceholder: { fontFamily: typography.body, fontSize: 18, color: colors.textMuted },
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
  pickerOptionText: { fontFamily: typography.mono, fontSize: 14.5, fontWeight: '700', color: colors.charcoal },
  pickerOptionTextActive: { color: colors.cream },

  // Chips (flat layout — no nested ScrollViews)
  chipSection: { marginBottom: 8 },
  chipSectionLabel: { fontFamily: typography.mono, fontSize: 12, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.charcoal },
  chipText: { fontFamily: typography.mono, fontSize: 12, fontWeight: '700', color: colors.charcoal },
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
  submitText: { color: colors.cream, fontFamily: typography.mono, fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  hintText: { fontFamily: typography.mono, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 16, lineHeight: 16 },

  // ── Result ──────────────────────────────────────────────────
  resultContent: { padding: 20, paddingBottom: 180 },

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
  heroEmoji: { fontSize: 53, marginBottom: 8 },
  heroTitle: { fontFamily: typography.headings, fontSize: 44, color: colors.cream, letterSpacing: 2, marginBottom: 8 },
  heroSubtitle: { fontFamily: typography.mono, fontSize: 14.5, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 18 },

  // Grade Row
  gradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  gradeBadge: { paddingHorizontal: 20, paddingVertical: 10, borderWidth: 2, borderColor: colors.charcoal },
  gradeText: { fontFamily: typography.mono, fontSize: 18, fontWeight: '900', color: colors.cream, letterSpacing: 1.5 },
  gradeMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gradeMetaLabel: { fontFamily: typography.mono, fontSize: 12, color: colors.textMuted, letterSpacing: 0.5 },
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
  actionCardTitle: { fontFamily: typography.mono, fontSize: 13.5, fontWeight: '900', color: colors.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  actionCardPrice: { fontFamily: typography.headings, fontSize: 46, color: colors.charcoal, marginBottom: 16 },
  actionCardTutorial: { fontFamily: typography.body, fontSize: 18, color: colors.charcoal, lineHeight: 22, marginBottom: 16 },
  actionCardPlaceholder: { fontFamily: typography.mono, fontSize: 14.5, color: colors.textMuted, lineHeight: 18, marginBottom: 16 },
  
  // Segregated Path Cards
  segregationBanner: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE8DD',
  },
  segregationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  segregationBadgeText: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 0.8,
  },
  segregationSub: {
    fontFamily: typography.body,
    fontSize: 15.5,
    color: colors.charcoal,
    lineHeight: 18,
    marginTop: 2,
  },
  pathCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: '#1E3B2F',
    padding: 14,
    borderRadius: 6,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 0,
    elevation: 2,
  },
  pathHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  pathIconBox: {
    width: 36,
    height: 36,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pathTitle: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '900',
    color: '#1E3B2F',
    letterSpacing: 0.8,
  },
  pathSubtitle: {
    fontFamily: typography.mono,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  pathDescription: {
    fontFamily: typography.body,
    fontSize: 15.5,
    color: colors.charcoal,
    lineHeight: 17,
    marginBottom: 10,
  },
  pathTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  pathTag: {
    backgroundColor: '#F5F2EA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#DCD8CC',
    borderRadius: 3,
  },
  pathTagText: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.charcoal,
  },

  tutorialMeta: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tutorialChip: { backgroundColor: colors.cream, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.charcoal },
  tutorialChipText: { fontFamily: typography.mono, fontSize: 11, fontWeight: '700', color: colors.charcoal },
  toolsText: { fontFamily: typography.mono, fontSize: 12, color: colors.textMuted, marginBottom: 16 },
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
  actionBtnText: { color: colors.cream, fontFamily: typography.mono, fontSize: 15.5, fontWeight: '900', letterSpacing: 1.5 },

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
  impactTitle: { fontFamily: typography.mono, fontSize: 13.5, fontWeight: '900', color: colors.textMuted, letterSpacing: 1.5, marginBottom: 16 },
  impactGrid: { flexDirection: 'row', gap: 12 },
  impactStat: { flex: 1, backgroundColor: colors.cream, padding: 12, borderWidth: 1.5, borderColor: colors.charcoal, alignItems: 'center' },
  impactStatValue: { fontFamily: typography.headings, fontSize: 32.5, color: colors.charcoal },
  impactStatUnit: { fontFamily: typography.mono, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  impactStatLabel: { fontFamily: typography.mono, fontSize: 11, fontWeight: '800', color: colors.charcoal, marginTop: 4, letterSpacing: 0.5, textAlign: 'center' },

  // Summary Card
  summaryCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 24,
  },
  summaryTitle: { fontFamily: typography.mono, fontSize: 12, fontWeight: '900', color: colors.textMuted, letterSpacing: 1, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontFamily: typography.mono, fontSize: 14.5, color: colors.textMuted },
  summaryValue: { fontFamily: typography.mono, fontSize: 14.5, fontWeight: '800', color: colors.charcoal },

  // Recycling Centers UI
  recycleHeader: {
    marginBottom: 8,
  },
  recycleHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#283618',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  recycleHeaderBadgeText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.5,
  },
  locationDetectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F3EB',
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
    marginBottom: 14,
  },
  locationDetectionText: {
    fontFamily: typography.mono,
    fontSize: 13,
    color: colors.charcoal,
    flex: 1,
  },
  locationDetectionBold: {
    fontWeight: '900',
    color: colors.charcoal,
  },
  recyclingLoadingBox: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  recyclingLoadingText: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    color: colors.textMuted,
  },
  centersListContainer: {
    gap: 12,
    marginBottom: 16,
  },
  centerItemCard: {
    backgroundColor: '#FDFCFA',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 12,
    borderRadius: 4,
    gap: 6,
  },
  centerItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  centerItemName: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '900',
    color: colors.charcoal,
  },
  centerItemCity: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.forest,
    marginTop: 2,
  },
  centerDescriptionText: {
    fontFamily: typography.body,
    fontSize: 14.5,
    color: colors.charcoal,
    lineHeight: 16,
    marginVertical: 2,
  },
  centerScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(40,54,24,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  centerScoreText: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#283618',
  },
  centerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  centerMetaText: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    color: colors.textMuted,
    flex: 1,
  },
  fiberTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  fiberTagPill: {
    backgroundColor: '#EFECE4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  fiberTagText: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.charcoal,
  },
  certText: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.copper,
    fontWeight: '700',
    marginTop: 2,
  },
  facilityDetailsBox: {
    backgroundColor: '#F7F5EE',
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.12)',
    borderRadius: 3,
    padding: 8,
    marginTop: 4,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailPhoneText: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.forest,
  },
  dropOffInstructions: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.charcoal,
    lineHeight: 11,
  },
  mailInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0F5ED',
    borderWidth: 1.5,
    borderColor: '#4A7C59',
    padding: 12,
    borderRadius: 4,
    marginTop: 4,
  },
  mailInTitle: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '900',
    color: '#283618',
  },
  mailInSub: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.charcoal,
    marginTop: 2,
    lineHeight: 12,
  },

  // Scan Again
  scanAgainBtn: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  scanAgainText: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 15.5, fontWeight: '800', letterSpacing: 1 },

  // Hard Reject Banner (Part 4 PDF)
  hardRejectBanner: {
    backgroundColor: 'rgba(200,30,44,0.1)',
    borderWidth: 2,
    borderColor: colors.red,
    padding: 14,
    borderRadius: 4,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  hardRejectTitle: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '900',
    color: colors.red,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  hardRejectText: {
    fontFamily: typography.body,
    fontSize: 14.5,
    color: colors.charcoal,
    lineHeight: 16,
  },

  // Point-of-Disposal Prep Card (Part 4 PDF)
  prepCard: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    padding: 14,
    borderRadius: 4,
    marginBottom: 16,
  },
  prepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  prepCardTitle: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  prepCardSub: {
    fontFamily: typography.body,
    fontSize: 14.5,
    color: colors.textMuted,
    marginBottom: 10,
    lineHeight: 16,
  },
  prepCheckItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  prepTaskText: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.charcoal,
  },
  prepTaskDone: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  prepTaskDetail: {
    fontFamily: typography.body,
    fontSize: 13.5,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  verifyPrepBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    borderRadius: 3,
  },
  verifyPrepBtnDone: {
    backgroundColor: colors.forest,
  },
  verifyPrepBtnText: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 1,
  },

  // Domestic-Only Toggle (Part 2 PDF)
  toggleRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    borderRadius: 4,
    marginBottom: 14,
  },
  toggleTitle: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '900',
    color: colors.charcoal,
  },
  toggleSub: {
    fontFamily: typography.body,
    fontSize: 13.5,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Transparency Card (Part 1 & 3 PDF)
  transparencyCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.forest,
    padding: 14,
    borderRadius: 4,
    marginBottom: 16,
  },
  transparencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  transparencyTitle: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '900',
    color: colors.forest,
    letterSpacing: 1,
  },
  transparencyText: {
    fontFamily: typography.body,
    fontSize: 15,
    color: colors.charcoal,
    lineHeight: 18,
  },
  informalSectorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF5E8',
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 8,
    borderRadius: 3,
    marginTop: 10,
  },
  informalSectorText: {
    fontFamily: typography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.charcoal,
    flex: 1,
  },

  // Partner Onboarding Callout (Part 3 PDF)
  onboardCalloutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    marginBottom: 16,
  },
  onboardCalloutText: {
    fontFamily: typography.mono,
    fontSize: 13.5,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.cream,
    width: '100%',
    maxHeight: '85%',
    borderWidth: 2,
    borderColor: colors.charcoal,
    padding: 20,
    borderRadius: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontFamily: typography.mono,
    fontSize: 17,
    fontWeight: '900',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  modalSub: {
    fontFamily: typography.body,
    fontSize: 14.5,
    color: colors.textMuted,
    marginBottom: 16,
  },
  modalPpeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 10,
    backgroundColor: colors.white,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.charcoal,
  },
  modalPpeText: {
    fontFamily: typography.mono,
    fontSize: 13,
    color: colors.charcoal,
    flex: 1,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    borderRadius: 3,
  },
  modalSubmitText: {
    fontFamily: typography.mono,
    fontSize: 14.5,
    fontWeight: '900',
    color: colors.cream,
    letterSpacing: 1,
  },
});

