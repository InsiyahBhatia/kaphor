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
  Modal,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography } from '../../../src/theme';
import { CenterCardsLoading } from '../../../src/components/common/CardLoadingScreen';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { circularService, RecyclingCenter, RecyclingCentersResponse } from '../../../src/services/circularService';
import { capturePhotoFromCamera, pickPhotoFromGallery, promptPhotoSelection } from '../../../src/utils/imagePicker';

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
import { Spinner, Loader } from '../../../src/components/common/Loader';
import { cleanText, humanizeKey } from '../../../src/utils/formatText';
import { formatRupees } from '../../../src/utils/priceFormatter';

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
    try {
      const res = useCamera
        ? await capturePhotoFromCamera({ quality: 0.85, base64: true })
        : await pickPhotoFromGallery({ quality: 0.85, base64: true });

      if (res && res.uri) {
        setImageUri(res.uri);
        setImageBase64(res.base64 || null);
      }
    } catch (err) {
      console.warn('Image capture error:', err);
      Alert.alert('Upload Error', 'Could not open camera or gallery. Please try again.');
    }
  };

  const selectImageSource = () => {
    promptPhotoSelection('Add Garment Photo', (res) => {
      setImageUri(res.uri);
      setImageBase64(res.base64 || null);
    });
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
        'Could not check this item',
        'We could not check this item right now. Please check your connection and try again.'
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
    const displayDesc = cleanText((result as any)?.description) || `Pre-loved ${catName} in ${conditionGrade(score).label} condition. Checked with the Kaphor app.`;

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
            <Text style={styles.headerTitle}>Assessment</Text>
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
                <Text style={styles.actionCardTitle}>Verified for marketplace resale</Text>
                
                {result.suggested_price_inr ? (
                  <View style={{ marginVertical: 8, padding: 12, backgroundColor: 'rgba(15, 92, 70, 0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(15, 92, 70, 0.25)' }}>
                    <Text style={{ fontFamily: typography.handSemi, fontSize: 16, color: colors.emerald, includeFontPadding: false }}>
                      SUGGESTED SELLING PRICE: {formatRupees(result.suggested_price_inr)}
                    </Text>
                    <Text style={{ fontFamily: typography.body, fontSize: 11, color: colors.textMuted, marginTop: 4, lineHeight: 16 }}>
                      Derived from comparable resale listings for {category || 'this category'} in {grade.label} condition. You can keep or adjust it below.
                    </Text>
                  </View>
                ) : null}

                {/* Confirm Dual Pricing */}
                <View style={{ marginVertical: 10 }}>
                  <Text style={{ fontFamily: typography.handBold, fontSize: 15, color: colors.charcoal, marginBottom: 4, includeFontPadding: false }}>
                    Original retail price / MRP (₹)
                  </Text>
                  <TextInput
                    style={[styles.textInput, { padding: 10, fontSize: 13, marginBottom: 12 }]}
                    value={costPrice}
                    onChangeText={setCostPrice}
                    placeholder="e.g. 2499 (Original purchase price)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />

                  <Text style={{ fontFamily: typography.handBold, fontSize: 15, color: colors.charcoal, marginBottom: 4, includeFontPadding: false }}>
                    Confirmed selling price (₹)
                  </Text>
                  <TextInput
                    style={[styles.textInput, { padding: 10, fontSize: 13 }]}
                    value={resellPrice}
                    onChangeText={setResellPrice}
                    placeholder="e.g. 899 (Your resale price)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />

                  {discountPct > 0 ? (
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: 'rgba(15, 92, 70, 0.08)', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(15, 92, 70, 0.2)' }}>
                      <Text style={{ fontFamily: typography.handBold, fontSize: 16, color: colors.emerald, includeFontPadding: false }}>
                        MARKETPLACE PREVIEW: -{discountPct}% OFF MRP
                      </Text>
                      <Text style={{ fontFamily: typography.body, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
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
                    {resellPrice ? `CONFIRM & LIST FOR ₹${resellPrice} →` : 'List for sale (1-click) →'}
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
                  <Text style={styles.segregationBadgeText}>Wear / damage detected · repair or upcycle</Text>
                </View>
                <Text style={styles.actionCardTitle}>Restore or transform</Text>
                <Text style={styles.segregationSub}>
                  {cleanText(result.description) || 'This garment shows localized wear or damage. Choose whether to mend it back to original wearability or creatively transform it into a brand new item.'}
                </Text>
              </View>

              {/* Single CTA: repair & upcycle live on the same page behind a toggle */}
              <View style={[styles.pathCard, { borderColor: colors.orange }]}>
                <View style={styles.pathHeader}>
                  <View style={[styles.pathIconBox, { backgroundColor: colors.orange }]}>
                    <Ionicons name="cut-outline" size={18} color={colors.cream} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pathTitle, { color: colors.orange }]}>Repair & upcycle</Text>
                    <Text style={styles.pathSubtitle}>Mend it back to wearable or transform it into something new</Text>
                  </View>
                </View>
                <Text style={styles.pathDescription}>
                  {result.repair_feasibility
                    ? `${cleanText(result.repair_feasibility)} You'll get matching repair guides, video tutorials, and upcycling ideas for this garment.`
                    : 'Get step-by-step repair guides, video tutorials, and upcycling ideas for this garment.'}
                </Text>
                <View style={styles.pathTagsRow}>
                  <View style={styles.pathTag}><Text style={styles.pathTagText}>🧵 Repair Guides</Text></View>
                  <View style={styles.pathTag}><Text style={styles.pathTagText}>🎬 Video Tutorials</Text></View>
                  <View style={styles.pathTag}><Text style={styles.pathTagText}>✂️ Upcycle Ideas</Text></View>
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.orange, borderColor: colors.orange, marginTop: 12 }]}
                  onPress={() => {
                    if ((result as any)?.rawRepairResult) {
                      setSharedRepairAssessment((result as any).rawRepairResult);
                    }
                    const descText = (result?.description || '').toLowerCase();
                    let deducedCat = category || (result as any)?.garment_category || '';
                    if (!deducedCat || deducedCat === 'other') {
                      if (/\b(shirt|blouse|polo|button|placket|collar|cuff|button-down)\b/i.test(descText)) {
                        deducedCat = 'shirt';
                      } else if (/\b(dress|gown|skirt)\b/i.test(descText)) {
                        deducedCat = 'dress';
                      } else if (/\b(jeans|denim|pants)\b/i.test(descText)) {
                        deducedCat = 'jeans';
                      } else if (/\b(sweater|cardigan|knitwear|hoodie)\b/i.test(descText)) {
                        deducedCat = 'sweater';
                      }
                    }

                    router.push({
                      pathname: '/(tabs)/studio/repair-refresh',
                      params: {
                        mode: result?.routing_decision === 'UPCYCLE' ? 'upcycle' : 'repair',
                        useSharedAssessment: 'true',
                        prefillImage: imageUri || '',
                        prefillCategory: deducedCat || category || '',
                        prefillFiber: fiber || (result as any)?.fiber_type || '',
                        prefillPrice: price || '',
                        damageDescription: cleanText(result?.description) || '',
                        damageTypes: JSON.stringify(result?.damage_breakdown?.damage_types || []),
                        repairFeasibility: result?.repair_feasibility || '',
                        conditionScore: String(result?.condition_score ?? 0.45),
                      },
                    });
                  }}
                >
                  <Text style={styles.actionBtnText}>Explore repair & upcycle guides →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {result.routing_decision === 'RECYCLE' && (
            <View style={styles.actionCard}>
              <View style={styles.recycleHeader}>
                <View style={styles.recycleHeaderBadge}>
                  <Ionicons name="leaf" size={13} color={colors.white} />
                  <Text style={styles.recycleHeaderBadgeText}>Verified recycling partner directory</Text>
                </View>
                <Text style={styles.actionCardTitle}>Certified textile recycling hubs</Text>
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
                          <Ionicons name="shield-checkmark" size={11} color={colors.forest} />
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

          {/* ── Check result: friendly labelled rows ───────────────── */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Your result</Text>
            {[
              { label: 'Condition', value: grade.label },
              { label: 'Fabric', value: fiber.trim() || humanizeKey(String((result as any).fiber_type || '')) || 'Not sure' },
              {
                label: 'Damage found',
                value: (() => {
                  const types = (result.damage_breakdown?.damage_types || [])
                    .map((d) => humanizeKey(String(d)))
                    .filter((d) => d && d.toLowerCase() !== 'none');
                  return types.length ? types.join(', ') : 'None found';
                })(),
              },
              { label: 'Best next step', value: routeInfo.title },
              {
                label: 'Estimated value',
                value: result.suggested_price_inr ? formatRupees(result.suggested_price_inr) : 'Not available',
              },
            ].map((row) => (
              <View key={row.label} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{row.label}</Text>
                <Text style={styles.summaryValue}>{row.value}</Text>
              </View>
            ))}
            {cleanText(result.description) ? (
              <View style={[styles.summaryRow, { flexDirection: 'column', alignItems: 'flex-start', marginTop: 6 }]}>
                <Text style={styles.summaryLabel}>Notes</Text>
                <Text style={[styles.summaryValue, { marginTop: 4, fontSize: 13, color: colors.charcoal }]}>
                  {cleanText(result.description)}
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── Garment Summary ──────────────────────────────────────── */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Assessed garment</Text>
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
            <Text style={styles.scanAgainText}>Assess another garment</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

  // ── Loading View ─────────────────────────────────────────────
  if (analyzing) {
    return (
      <Loader
        variant="glie"
        step={glieStep}
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
          <Text style={styles.headerTitle}>Condition check</Text>
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
            onPress={selectImageSource}
            activeOpacity={0.8}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.uploadPreview} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="camera-outline" size={36} color={colors.charcoal} />
                <Text style={styles.uploadText}>Take or upload a photo</Text>
                <Text style={styles.uploadSubtext}>Camera or gallery (JPG / PNG)</Text>
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
          <Text style={styles.inputLabel}>Garment type (optional — ai auto-detected)</Text>
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
          <Text style={styles.inputLabel}>Fabric type (optional — ai auto-detected)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Auto-detect from photo (or type e.g. Cotton)"
            placeholderTextColor={colors.textMuted}
            value={fiber}
            onChangeText={setFiber}
          />

          {/* Original Price */}
          <Text style={styles.inputLabel}>Original price (₹)</Text>
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
            Additional details (optional)
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
            <Text style={styles.submitText}>Assess garment</Text>
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
    fontSize: 19,
    fontFamily: typography.handBold, includeFontPadding: false, },

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
  uploadText: { fontFamily: typography.handBold, fontSize: 18, color: colors.charcoal, includeFontPadding: false, },
  uploadSubtext: { fontFamily: typography.handwritten, fontSize: 14, color: colors.textMuted, includeFontPadding: false, },
  uploadActions: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 28 },
  uploadActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10 },
  uploadActionText: { fontFamily: typography.handBold, fontSize: 15, color: colors.charcoal, includeFontPadding: false, },

  // Inputs
  inputLabel: {
    fontFamily: typography.handBold,
    fontSize: 14,
    color: colors.charcoal,
    marginBottom: 8,
    marginTop: 20, includeFontPadding: false, },
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
  pickerOptionText: { fontFamily: typography.handSemi, fontSize: 16, color: colors.charcoal, includeFontPadding: false, },
  pickerOptionTextActive: { color: colors.cream },

  // Chips (flat layout — no nested ScrollViews)
  chipSection: { marginBottom: 8 },
  chipSectionLabel: { fontFamily: typography.handBold, fontSize: 14, color: colors.textMuted, marginBottom: 6, includeFontPadding: false, },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.charcoal,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.charcoal },
  chipText: { fontFamily: typography.handSemi, fontSize: 14, color: colors.charcoal, includeFontPadding: false, },
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
  submitText: { color: colors.cream, fontFamily: typography.bodyBold, fontSize: 14, letterSpacing: 0.2 },
  hintText: { fontFamily: typography.handwritten, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 16, lineHeight: 25, includeFontPadding: false, },

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
  heroEmoji: { fontSize: 48, marginBottom: 8 },
  heroTitle: { fontFamily: typography.headings, fontSize: 40, color: colors.cream, letterSpacing: 2, marginBottom: 8 },
  heroSubtitle: { fontFamily: typography.handwritten, fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 26, includeFontPadding: false, },

  // Grade Row
  gradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  gradeBadge: { paddingHorizontal: 20, paddingVertical: 10, borderWidth: 2, borderColor: colors.charcoal },
  gradeText: { fontFamily: typography.handBold, fontSize: 19, color: colors.cream, includeFontPadding: false, },
  gradeMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gradeMetaLabel: { fontFamily: typography.handwritten, fontSize: 14, color: colors.textMuted, includeFontPadding: false, },
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
  actionCardTitle: { fontFamily: typography.handBold, fontSize: 15, color: colors.textMuted, marginBottom: 12, includeFontPadding: false, },
  actionCardPrice: { fontFamily: typography.headings, fontSize: 42, color: colors.charcoal, marginBottom: 16 },
  actionCardTutorial: { fontFamily: typography.body, fontSize: 14, color: colors.charcoal, lineHeight: 22, marginBottom: 16 },
  actionCardPlaceholder: { fontFamily: typography.handwritten, fontSize: 16, color: colors.textMuted, lineHeight: 26, marginBottom: 16, includeFontPadding: false, },
  
  // Segregated Path Cards
  segregationBanner: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDark,
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
    fontFamily: typography.handBold,
    fontSize: 14,
    color: colors.cream, includeFontPadding: false, },
  segregationSub: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.charcoal,
    lineHeight: 18,
    marginTop: 2,
  },
  pathCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.forest,
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
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.forest, includeFontPadding: false, },
  pathSubtitle: {
    fontFamily: typography.handwritten,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2, includeFontPadding: false, },
  pathDescription: {
    fontFamily: typography.body,
    fontSize: 12,
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
    backgroundColor: colors.paperLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 3,
  },
  pathTagText: {
    fontFamily: typography.handSemi,
    fontSize: 14,
    color: colors.charcoal, includeFontPadding: false, },

  tutorialMeta: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tutorialChip: { backgroundColor: colors.cream, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.charcoal },
  tutorialChipText: { fontFamily: typography.handSemi, fontSize: 13, color: colors.charcoal, includeFontPadding: false, },
  toolsText: { fontFamily: typography.handwritten, fontSize: 14, color: colors.textMuted, marginBottom: 16, includeFontPadding: false, },
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
  actionBtnText: { color: colors.cream, fontFamily: typography.bodyBold, fontSize: 12, letterSpacing: 0.2 },

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
  impactTitle: { fontFamily: typography.handBold, fontSize: 15, color: colors.textMuted, marginBottom: 16, includeFontPadding: false, },
  impactGrid: { flexDirection: 'row', gap: 12 },
  impactStat: { flex: 1, backgroundColor: colors.cream, padding: 12, borderWidth: 1.5, borderColor: colors.charcoal, alignItems: 'center' },
  impactStatValue: { fontFamily: typography.headings, fontSize: 28, color: colors.charcoal },
  impactStatUnit: { fontFamily: typography.bodyMedium, fontSize: 9, color: colors.textMuted, marginTop: 2 },
  impactStatLabel: { fontFamily: typography.handBold, fontSize: 13, color: colors.charcoal, marginTop: 4, textAlign: 'center', includeFontPadding: false, },

  // Summary Card
  summaryCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginBottom: 24,
  },
  summaryTitle: { fontFamily: typography.handBold, fontSize: 14, color: colors.textMuted, marginBottom: 12, includeFontPadding: false, },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontFamily: typography.handwritten, fontSize: 16, color: colors.textMuted, includeFontPadding: false, },
  summaryValue: { fontFamily: typography.bodyBold, fontSize: 11, color: colors.charcoal },

  // Recycling Centers UI
  recycleHeader: {
    marginBottom: 8,
  },
  recycleHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.forest,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  recycleHeaderBadgeText: {
    fontFamily: typography.handBold,
    fontSize: 13,
    color: colors.white, includeFontPadding: false, },
  locationDetectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.paperLight,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(30,31,34,0.15)',
    marginBottom: 14,
  },
  locationDetectionText: {
    fontFamily: typography.handwritten,
    fontSize: 15,
    color: colors.charcoal,
    flex: 1, includeFontPadding: false, },
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
    fontFamily: typography.handwritten,
    fontSize: 15,
    color: colors.textMuted, includeFontPadding: false, },
  centersListContainer: {
    gap: 12,
    marginBottom: 16,
  },
  centerItemCard: {
    backgroundColor: colors.paperLight,
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
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.charcoal, includeFontPadding: false, },
  centerItemCity: {
    fontFamily: typography.handSemi,
    fontSize: 14,
    color: colors.forest,
    marginTop: 2, includeFontPadding: false, },
  centerDescriptionText: {
    fontFamily: typography.body,
    fontSize: 11,
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
    fontFamily: typography.bodyBold,
    fontSize: 8,
    color: colors.forest,
  },
  centerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  centerMetaText: {
    fontFamily: typography.handwritten,
    fontSize: 14,
    color: colors.textMuted,
    flex: 1, includeFontPadding: false, },
  fiberTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  fiberTagPill: {
    backgroundColor: colors.paperDark,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  fiberTagText: {
    fontFamily: typography.handSemi,
    fontSize: 13,
    color: colors.charcoal, includeFontPadding: false, },
  certText: {
    fontFamily: typography.handSemi,
    fontSize: 13,
    color: colors.copper,
    marginTop: 2, includeFontPadding: false, },
  facilityDetailsBox: {
    backgroundColor: colors.paperLight,
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
    fontFamily: typography.bodyBold,
    fontSize: 9,
    color: colors.forest,
  },
  dropOffInstructions: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 18, includeFontPadding: false, },
  mailInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.emeraldLight,
    borderWidth: 1.5,
    borderColor: colors.forest,
    padding: 12,
    borderRadius: 4,
    marginTop: 4,
  },
  mailInTitle: {
    fontFamily: typography.handBold,
    fontSize: 15,
    color: colors.forest, includeFontPadding: false, },
  mailInSub: {
    fontFamily: typography.handwritten,
    fontSize: 13,
    color: colors.charcoal,
    marginTop: 2,
    lineHeight: 20, includeFontPadding: false, },

  // Scan Again
  scanAgainBtn: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.charcoal,
    backgroundColor: colors.cream,
  },
  scanAgainText: { color: colors.charcoal, fontFamily: typography.handBold, fontSize: 17, includeFontPadding: false, },

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
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.red,
    marginBottom: 2, includeFontPadding: false, },
  hardRejectText: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.charcoal,
    lineHeight: 16,
  },

  // Point-of-Disposal Prep Card (Part 4 PDF)
  prepCard: {
    backgroundColor: colors.paperLight,
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
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.charcoal, includeFontPadding: false, },
  prepCardSub: {
    fontFamily: typography.body,
    fontSize: 11,
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
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.charcoal, includeFontPadding: false, },
  prepTaskDone: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  prepTaskDetail: {
    fontFamily: typography.body,
    fontSize: 10.5,
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
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: colors.cream,
    letterSpacing: 0.2,
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
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.charcoal, includeFontPadding: false, },
  toggleSub: {
    fontFamily: typography.body,
    fontSize: 10,
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
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.forest, includeFontPadding: false, },
  transparencyText: {
    fontFamily: typography.body,
    fontSize: 11.5,
    color: colors.charcoal,
    lineHeight: 18,
  },
  informalSectorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.paperLight,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 8,
    borderRadius: 3,
    marginTop: 10,
  },
  informalSectorText: {
    fontFamily: typography.handBold,
    fontSize: 14,
    color: colors.charcoal,
    flex: 1, includeFontPadding: false, },

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
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.charcoal, includeFontPadding: false, },

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
    fontFamily: typography.handBold,
    fontSize: 18,
    color: colors.charcoal, includeFontPadding: false, },
  modalSub: {
    fontFamily: typography.body,
    fontSize: 11,
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
    fontFamily: typography.handSemi,
    fontSize: 15,
    color: colors.charcoal,
    flex: 1, includeFontPadding: false, },
  modalSubmitBtn: {
    backgroundColor: colors.charcoal,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    borderRadius: 3,
  },
  modalSubmitText: {
    fontFamily: typography.handBold,
    fontSize: 16,
    color: colors.cream, includeFontPadding: false, },
});

