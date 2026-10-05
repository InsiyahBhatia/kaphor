import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import api from '../../../src/services/api';
import { colors, typography } from '../../../src/theme';
import {
  MARKET_CATEGORIES,
  ALL_CATEGORY_ITEMS,
  ACCESSORY_CATEGORY_ITEMS,
  isAccessoryCategory,
  matchMarketCategory,
  MARKET_CONDITIONS,
  LISTING_TYPES,
  MARKET_SIZES
} from '../../../src/constants/market';
import { DropdownPicker } from '../../../src/components/DropdownPicker';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { useGarmentStore } from '../../../src/store/garmentStore';
import { promptPhotoSelection } from '../../../src/utils/imagePicker';
import { Spinner, Loader } from '../../../src/components/common/Loader';
import { getErrorMessage } from '../../../src/utils/errors';

export { matchMarketCategory };

export function matchMarketCondition(raw?: string): string {
  if (!raw) return 'PRISTINE';
  const c = raw.toUpperCase().trim();
  if (c === 'PRISTINE' || c === 'MINOR_WEAR' || c === 'UPCYCLE' || c === 'RECYCLE_ONLY') return c;
  if (c.includes('EXCELLENT') || c.includes('NEW') || c.includes('PERFECT') || c.includes('MINT')) return 'PRISTINE';
  if (c.includes('GOOD') || c.includes('GENTLY') || c.includes('FAINT') || c.includes('USED')) return 'MINOR_WEAR';
  if (c.includes('UPCYCLE') || c.includes('REWORK') || c.includes('CUSTOM')) return 'UPCYCLE';
  if (c.includes('FAIR') || c.includes('POOR') || c.includes('RECYCLE')) return 'RECYCLE_ONLY';
  return 'PRISTINE';
}

export interface T3PricingData {
  recommendedPrice: number;
  suggestedOriginalPrice: number;
  suggestedRentalPriceDay?: number;
  suggestedRentalPriceWeek?: number;
  avgResaleRatio?: number;
  medianDaysToSell?: number;
  comparableCount?: number;
  demandTrend?: string;
  marketCategory?: string;
  minPrice?: number;
  maxPrice?: number;
  source?: string;
}

export default function SellScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    prefillImage?: string;
    prefillCategory?: string;
    prefillTitle?: string;
    prefillDescription?: string;
    prefillBrand?: string;
    prefillCondition?: string;
    prefillFabric?: string;
    prefillColor?: string;
    prefillStyle?: string;
    prefillListingType?: string;
    listingType?: string;
    mode?: string;
    prefillPrice?: string;
    prefillOriginalPrice?: string;
    prefillRentalDay?: string;
    fresh?: string;
  }>();

  const getParamListingType = () => {
    const raw = params.prefillListingType || params.listingType || (params.mode === 'SWAP' ? 'ACCESSORY_SWAP' : undefined);
    if (raw === 'SWAP' || raw === 'ACCESSORY_SWAP') return 'ACCESSORY_SWAP';
    if (raw === 'RENTAL') return 'RENTAL';
    if (raw === 'SALE') return 'SALE';
    return undefined;
  };

  const [step, setStep] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [condition, setCondition] = useState('PRISTINE');
  const [listingType, setListingType] = useState(() => getParamListingType() || 'SALE');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [rentalDay, setRentalDay] = useState('');
  const [rentalWeek, setRentalWeek] = useState('');
  const [fabric, setFabric] = useState('');
  const [color, setColor] = useState('');
  const [styleAttr, setStyleAttr] = useState('');
  const [sleeve, setSleeve] = useState('');
  const [shape, setShape] = useState('');
  const [pattern, setPattern] = useState('');
  const [weight, setWeight] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [t3Pricing, setT3Pricing] = useState<T3PricingData | null>(null);

  const hasSubmitted = useRef(false);
  const lastFreshRef = useRef<string | undefined>(undefined);

  const resetForm = useCallback(() => {
    setStep(1);
    setImages([]);
    setTitle('');
    setDescription('');
    setBrand('');
    setCategory('');
    setSize('');
    setCondition('PRISTINE');
    const defaultType = getParamListingType() || 'SALE';
    setListingType(defaultType);
    if (defaultType === 'ACCESSORY_SWAP') {
      setCategory('Bags');
      setSize('FREE SIZE');
    }
    setPrice('');
    setOriginalPrice('');
    setRentalDay('');
    setRentalWeek('');
    setFabric('');
    setColor('');
    setStyleAttr('');
    setSleeve('');
    setShape('');
    setPattern('');
    setWeight('');
    setT3Pricing(null);
    setSubmitting(false);
    setAiLoading(false);
  }, [params.prefillListingType, params.listingType, params.mode]);

  const handleBackNavigation = () => {
    if (step > 1) {
      setStep((s) => s - 1);
      return true;
    }
    safeBack('/(tabs)/shop');
    return true;
  };

  useBackHandler('/(tabs)/shop', handleBackNavigation);

  // Reset screen whenever navigated to fresh or when a previous listing was completed
  useFocusEffect(
    useCallback(() => {
      if (hasSubmitted.current) {
        hasSubmitted.current = false;
        resetForm();
      } else if (params.fresh && params.fresh !== lastFreshRef.current && !params.prefillImage) {
        lastFreshRef.current = params.fresh;
        resetForm();
      }
    }, [params.fresh, params.prefillImage, resetForm])
  );

  const FREE_SIZE_CATEGORIES = [
    'Sarees', 'Dupattas', 'Shawls', 'Scarves',
    'Bags', 'Jewelry', 'Watches', 'Eyewear', 'Belts', 'Hats', 'Wallets', 'Ties'
  ];

  // Auto-populate when navigating from Condition Check / Assessment
  useEffect(() => {
    if (params.prefillImage) {
      setImages([params.prefillImage]);
      setStep(2); // Photo already captured, jump straight to details
    }
    if (params.prefillCategory) {
      const matchedCat = matchMarketCategory(params.prefillCategory);
      setCategory(matchedCat);
      if (FREE_SIZE_CATEGORIES.includes(matchedCat) || isAccessoryCategory(matchedCat)) {
        setSize('FREE SIZE');
      }
    }
    if (params.prefillTitle) setTitle(params.prefillTitle);
    if (params.prefillDescription) setDescription(params.prefillDescription);
    if (params.prefillBrand) setBrand(params.prefillBrand);
    if (params.prefillCondition) setCondition(matchMarketCondition(params.prefillCondition));
    if (params.prefillFabric) setFabric(params.prefillFabric);
    if (params.prefillColor) setColor(params.prefillColor);
    if (params.prefillStyle) setStyleAttr(params.prefillStyle);
    const incomingType = getParamListingType();
    if (incomingType) {
      setListingType(incomingType);
      if (incomingType === 'ACCESSORY_SWAP' && !isAccessoryCategory(category)) {
        setCategory((prev) => (isAccessoryCategory(prev) ? prev : 'Bags'));
        setSize('FREE SIZE');
      }
    }
    if (params.prefillPrice) setPrice(params.prefillPrice);
    if (params.prefillOriginalPrice) setOriginalPrice(params.prefillOriginalPrice);
    if (params.prefillRentalDay) setRentalDay(params.prefillRentalDay);
  }, [
    params.prefillImage,
    params.prefillCategory,
    params.prefillTitle,
    params.prefillPrice,
    params.prefillOriginalPrice,
    params.prefillRentalDay,
    params.prefillListingType,
    params.listingType,
    params.mode,
    params.fresh,
  ]);

  const fetchT3Recommendation = useCallback(async (cat: string, cond?: string, br?: string) => {
    if (!cat) return;
    try {
      const mrp = Number(originalPrice);
      const res = await api.get('/ai/price-recommendation', {
        params: { category: cat, condition: cond || condition, brand: br || brand, originalPrice: mrp > 0 ? mrp : undefined }
      });
      if (res.data?.data) {
        setT3Pricing(res.data.data);
      }
    } catch {
      // Non-blocking
    }
  }, [condition, brand, originalPrice]);

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    if (FREE_SIZE_CATEGORIES.includes(cat) && (!size || size === 'M')) {
      setSize('FREE SIZE');
    }
    fetchT3Recommendation(cat, condition, brand);
  };

  const handleConditionChange = (cond: string) => {
    setCondition(cond);
    if (category) {
      fetchT3Recommendation(category, cond, brand);
    }
  };

  const handleListingTypeChange = (type: string) => {
    setListingType(type);
    if (type === 'ACCESSORY_SWAP') {
      if (!isAccessoryCategory(category)) {
        setCategory('Bags');
        setSize('FREE SIZE');
      }
    } else if (type === 'RENTAL') {
      if (!rentalDay && price) {
        const estDay = String(Math.max(199, Math.round(Number(price) * 0.12)));
        setRentalDay(estDay);
        setRentalWeek(String(Math.round(Number(estDay) * 5)));
      }
    } else if (type === 'SALE') {
      if (!price && rentalDay) {
        setPrice(String(Math.round(Number(rentalDay) * 8)));
      }
    }
  };

  const executeAiFill = async (targetUri?: string) => {
    const imgUri = targetUri || (images.length > 0 ? images[0] : null);
    if (!imgUri) {
      await pickAndRunAiFill();
      return;
    }

    setAiLoading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(imgUri, { encoding: 'base64' });
      const { data } = await api.post(
        '/ai/analyze-listing',
        { image: `data:image/jpeg;base64,${base64}`, listingType },
        { timeout: 60000 }
      );
      const res = data.data;

      if (res) {
        setTitle(res.title || '');
        setDescription(res.description || '');
        setBrand(res.brand || '');

        // Map AI predicted category string to exact dropdown item in ALL_CATEGORY_ITEMS
        const matchedCat = matchMarketCategory(res.category, res.subCategory, res.title);
        const isAccessory = isAccessoryCategory(matchedCat);
        setCategory(matchedCat);

        if (FREE_SIZE_CATEGORIES.includes(matchedCat) || isAccessory) {
          setSize('FREE SIZE');
        } else if (res.size && MARKET_SIZES.includes(res.size)) {
          setSize(res.size);
        } else {
          setSize('M');
        }

        setFabric(res.styleAttributes?.fabric || (Array.isArray(res.material) ? res.material.join(', ') : ''));
        setColor(Array.isArray(res.color) ? res.color[0] : (res.color || ''));
        setStyleAttr(res.styleAttributes?.style || '');
        setSleeve(res.styleAttributes?.sleeve || '');
        setShape(res.styleAttributes?.shape || '');
        setPattern(res.styleAttributes?.pattern || '');
        setWeight(res.styleAttributes?.weight || '');
        setCondition(matchMarketCondition(res.condition));

        // Auto-fill T3 market price recommendation and suggested retail MRP
        if (res.t3Pricing) {
          setT3Pricing(res.t3Pricing);
          setPrice(String(res.t3Pricing.recommendedPrice));
          if (res.t3Pricing.suggestedOriginalPrice) {
            setOriginalPrice(String(res.t3Pricing.suggestedOriginalPrice));
          }
          if (res.t3Pricing.suggestedRentalPriceDay) {
            setRentalDay(String(res.t3Pricing.suggestedRentalPriceDay));
          }
          if (res.t3Pricing.suggestedRentalPriceWeek) {
            setRentalWeek(String(res.t3Pricing.suggestedRentalPriceWeek));
          }
        } else {
          if (res.estimatedPrice) setPrice(String(res.estimatedPrice));
          if (res.suggestedOriginalPrice) setOriginalPrice(String(res.suggestedOriginalPrice));
          else if (res.estimatedPrice) setOriginalPrice(String(Math.round(Number(res.estimatedPrice) * 2.2)));
          if (res.suggestedRentalPriceDay) setRentalDay(String(res.suggestedRentalPriceDay));
          if (res.suggestedRentalPriceWeek) setRentalWeek(String(res.suggestedRentalPriceWeek));
        }

        const priceVal = res.t3Pricing?.recommendedPrice || res.estimatedPrice;
        if (listingType === 'ACCESSORY_SWAP') {
          if (isAccessory) {
            Alert.alert(
              'AI Magic Fill + Market Pricing',
              `Identified as "${matchedCat}". All item specs and market valuation (₹${priceVal}) filled from photo.`
            );
          } else {
            Alert.alert(
              'Swap Notice',
              `Identified as "${matchedCat}". Swapping on KaPhor is reserved for accessories & footwear. Please select an accessory category or switch to SALE if you wish to sell this item instead.`
            );
          }
        } else if (listingType === 'RENTAL') {
          Alert.alert(
            'AI Magic Fill + Market Pricing',
            `Identified as "${matchedCat}". All garment specs and rental rate recommendations filled from photo.`
          );
        } else {
          // SALE
          Alert.alert(
            'AI Magic Fill + Market Pricing',
            `Identified as "${matchedCat}". All garment specs and market price recommendation (₹${priceVal}) filled from photo.`
          );
        }

        setStep(2);
      }
    } catch (err) {
      console.error('AI Fill failed', err);
      Alert.alert('AI Notice', 'Unable to auto-detect from photo. You can enter details manually.');
      setStep(2);
    } finally {
      setAiLoading(false);
    }
  };

  const selectPhoto = (callback: (uri: string) => void) => {
    promptPhotoSelection('Add Garment Photo', (res) => {
      callback(res.uri);
    });
  };

  const pickAndRunAiFill = async () => {
    selectPhoto(async (uri) => {
      setImages((prev) => [uri, ...prev.filter(u => u !== uri)].slice(0, 5));
      await executeAiFill(uri);
    });
  };

  const handleAiFill = () => executeAiFill();

  const pickImages = () => {
    selectPhoto((uri) => {
      setImages((prev) => [...prev, uri].slice(0, 5));
    });
  };

  const editImage = (idx: number) => {
    selectPhoto((uri) => {
      setImages((prev) => {
        const next = [...prev];
        next[idx] = uri;
        return next;
      });
    });
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (images.length === 0) {
      Alert.alert('Photos Required', 'Please add at least one photo of the garment.');
      setStep(1);
      return;
    }

    const finalTitle = title.trim() || `${brand || 'Designer'} ${category || 'Garment'}`;
    const finalCategory = category || (FREE_SIZE_CATEGORIES[0] as string);
    const finalDescription = description.trim() || `Garment listing assessed by Kaphor AI Vision engine.`;
    const finalCondition = condition || 'PRISTINE';
    const finalSize = size || (FREE_SIZE_CATEGORIES.includes(finalCategory) ? 'FREE SIZE' : 'M');
    const finalPrice = listingType === 'ACCESSORY_SWAP' ? (price || '0') : (price || '999');

    if (!finalTitle || finalTitle.length < 3) {
      Alert.alert('Title Required', 'Please enter a title of at least 3 characters.');
      setStep(2);
      return;
    }

    if (!finalDescription || finalDescription.length < 3) {
      Alert.alert('Description Required', 'Please provide a short description.');
      setStep(2);
      return;
    }

    if (listingType === 'ACCESSORY_SWAP' && !isAccessoryCategory(finalCategory)) {
      Alert.alert(
        'Accessories Only',
        'Swapping on KaPhor is exclusively for accessories (bags, jewelry, watches, eyewear, belts, hats, scarves, wallets, ties, footwear). Please select an accessory category.'
      );
      setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', finalTitle);
      formData.append('description', finalDescription);
      formData.append('brand', brand || 'Unknown Brand');
      formData.append('category', finalCategory);
      formData.append('size', finalSize);
      formData.append('condition', finalCondition);
      formData.append('listingType', listingType);

      if (listingType === 'RENTAL') {
        formData.append('rentalPriceDay', rentalDay || '199');
        if (rentalWeek) formData.append('rentalPriceWeek', rentalWeek);
      } else if (listingType === 'ACCESSORY_SWAP') {
        if (price && Number(price) > 0) {
          formData.append('price', price);
        }
      } else {
        formData.append('price', finalPrice);
        if (originalPrice && Number(originalPrice) > 0) {
          formData.append('originalPrice', originalPrice);
        }
      }

      formData.append('fabric', fabric);
      formData.append('color', color);
      formData.append('style', styleAttr);
      formData.append('sleeve', sleeve);
      formData.append('shape', shape);
      formData.append('pattern', pattern);
      formData.append('weight', weight);

      images.forEach((uri, i) => {
        formData.append('images', {
          uri,
          type: 'image/jpeg',
          name: `garment_${i}.jpg`,
        } as any);
      });

      await api.post('/garments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 minutes for multi-image uploads
      });

      hasSubmitted.current = true;
      resetForm();

      Alert.alert('Listed!', 'Your item is now live on KaPhor.', [
        {
          text: listingType === 'ACCESSORY_SWAP' ? 'VIEW SWAP' : 'VIEW SHOP',
          onPress: () => {
            useGarmentStore.getState().fetchFeed({ listingType: 'SALE' });
            resetForm();
            if (listingType === 'ACCESSORY_SWAP') {
              router.replace('/(tabs)/swap');
            } else {
              router.replace('/(tabs)/shop');
            }
          },
        },
      ]);
    } catch (err: any) {
      const data = err?.response?.data;
      const apiErrors = data?.errors ?? data?.details;
      if (Array.isArray(apiErrors) && apiErrors.length > 0) {
        const msg = apiErrors.map((e: any) => String(e.message || 'Please check this field')).join('\n');
        Alert.alert('Validation Error', msg);
      } else {
        const msg = getErrorMessage(err, 'Failed to list garment. Please try again.');
        Alert.alert('Error', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const renderListingTypeSelector = () => {
    const types = [
      { id: 'SALE', label: 'SALE', sub: 'Resale', icon: 'pricetag-outline' },
      { id: 'RENTAL', label: 'RENTAL', sub: 'Hire', icon: 'calendar-outline' },
      { id: 'ACCESSORY_SWAP', label: 'SWAP', sub: 'Exchange', icon: 'repeat-outline' },
    ];

    const currentInfo = {
      SALE: 'List for outright purchase. Set your resale price below.',
      RENTAL: 'List for peer rental. Set your daily and weekly rental rates below.',
      ACCESSORY_SWAP: 'Direct peer exchange for accessories & footwear. No cash required.',
    }[listingType] || '';

    return (
      <View style={styles.listingTypeTopContainer}>
        <View style={styles.listingTypeTopHeader}>
          <Text style={styles.listingTypeTopLabel}>LISTING TYPE</Text>
          <View style={[styles.listingTypeBadge, listingType === 'ACCESSORY_SWAP' && styles.listingTypeBadgeSwap]}>
            <Text style={styles.listingTypeBadgeText}>
              {listingType === 'ACCESSORY_SWAP' ? 'ACCESSORIES ONLY' : listingType}
            </Text>
          </View>
        </View>

        <View style={styles.segmentedRow}>
          {types.map((t) => {
            const isActive = listingType === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.segmentedBtn, isActive && styles.segmentedBtnActive]}
                onPress={() => handleListingTypeChange(t.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={t.icon as any}
                  size={16}
                  color={isActive ? colors.white : colors.charcoal}
                />
                <Text style={[styles.segmentedBtnLabel, isActive && styles.segmentedBtnLabelActive]}>
                  {t.label}
                </Text>
                <Text style={[styles.segmentedBtnSub, isActive && styles.segmentedBtnSubActive]}>
                  {t.sub}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.listingTypeDescRow}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textSecond} />
          <Text style={styles.listingTypeDescText}>{currentInfo}</Text>
        </View>
      </View>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>SELECT LISTING TYPE</Text>
            <Text style={styles.stepSubtitle}>Choose your listing type, then let AI auto-fill or enter manually</Text>

            {/* 1. Segmented Listing Type Selector prominently at the top */}
            {renderListingTypeSelector()}

            {/* 2. Photo Upload Box */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>GARMENT PHOTOS</Text>
              <Text style={styles.sectionHeadingSub}>{images.length}/5 ADDED</Text>
            </View>

            <View style={styles.imageGrid}>
              {images.map((uri, i) => (
                <View key={i} style={styles.imageThumb}>
                  <Image source={{ uri }} style={styles.thumbImg} />
                  <View style={styles.thumbActions}>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.editBtn} onPress={() => editImage(i)}>
                      <Ionicons name="pencil-sharp" size={14} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.removeBtn} onPress={() => removeImage(i)}>
                      <Ionicons name="close-sharp" size={14} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {images.length < 5 && (
                <TouchableOpacity style={styles.uploadBox} onPress={pickImages}>
                  <Ionicons name="camera-outline" size={32} color={colors.crimson} />
                  <Text style={styles.uploadText}>ADD PHOTO</Text>
                </TouchableOpacity>
              )}
            </View>


            {/* 3. AI Magic Fill Button (dynamic text and action based on selected listingType) */}
            <TouchableOpacity
              style={[styles.aiButton, aiLoading && { opacity: 0.7 }]}
              onPress={images.length > 0 ? () => executeAiFill(images[0]) : pickAndRunAiFill}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <Spinner color={colors.white} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color={colors.white} />
                  <Text style={styles.aiButtonText}>
                    {listingType === 'RENTAL'
                      ? 'AI MAGIC FILL (RENTAL SPECS)'
                      : listingType === 'ACCESSORY_SWAP'
                        ? 'AI MAGIC FILL (SWAP SPECS)'
                        : 'AI MAGIC FILL (GARMENT SPECS)'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* 4. Continue manually */}
            <TouchableOpacity
              style={[styles.mainButton, images.length === 0 && { opacity: 0.5 }]}
              onPress={nextStep}
              disabled={images.length === 0}
            >
              <Text style={styles.mainButtonText}>MANUAL ENTRY / CONTINUE</Text>
            </TouchableOpacity>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>GARMENT DETAILS</Text>

            {/* Listing Type Prominently at Top */}
            {renderListingTypeSelector()}

            {/* AI Auto-Fill Button on Details Step */}
            <TouchableOpacity
              style={[styles.step2AiButton, aiLoading && { opacity: 0.7 }]}
              onPress={images.length > 0 ? () => executeAiFill(images[0]) : pickAndRunAiFill}
              disabled={aiLoading}
            >
              <Ionicons name="sparkles" size={16} color={colors.white} />
              <Text style={styles.step2AiButtonText}>
                {images.length > 0 ? 'AI AUTO-FILL ALL DETAILS FROM PHOTO' : 'TAKE OR PICK PHOTO & AUTO-FILL WITH AI'}
              </Text>
            </TouchableOpacity>

            {/* Category filtered according to Listing Type */}
            <DropdownPicker
              label="CATEGORY"
              options={
                listingType === 'ACCESSORY_SWAP'
                  ? MARKET_CATEGORIES.filter(g => g.group === 'ACCESSORIES' || g.group === 'FOOTWEAR').flatMap(g => g.items.map(i => ({ id: i, label: i, group: g.group })))
                  : MARKET_CATEGORIES.flatMap(g => g.items.map(i => ({ id: i, label: i, group: g.group })))
              }
              selectedValue={category}
              onSelect={handleCategoryChange}
              isGrouped={true}
              placeholder="SELECT CATEGORY"
            />

            <TextInput accessibilityLabel="TITLE" style={styles.input} placeholder="TITLE" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />
            <TextInput accessibilityLabel="DESCRIPTION" style={[styles.input, { height: 80 }]} placeholder="DESCRIPTION" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} multiline />
            <TextInput accessibilityLabel="BRAND" style={styles.input} placeholder="BRAND" placeholderTextColor={colors.textMuted} value={brand} onChangeText={setBrand} />

            {/* T3 Market Price Recommendation Card */}
            {t3Pricing && (
              <View style={styles.t3RecCard}>
                <View style={styles.t3RecHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="trending-up" size={15} color={colors.emerald} />
                    <Text style={styles.t3RecTitle}>MARKET PRICE VALUATION</Text>
                  </View>
                  {t3Pricing.demandTrend && (
                    <View style={[styles.t3Badge, t3Pricing.demandTrend === 'rising' && styles.t3BadgeRising]}>
                      <Text style={styles.t3BadgeText}>
                        {t3Pricing.demandTrend.toUpperCase()} DEMAND
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.t3RecRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.t3RecPrice}>
                      ₹{t3Pricing.recommendedPrice.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.t3RecSub}>
                      {t3Pricing.minPrice && t3Pricing.maxPrice
                        ? `Fair market range: ₹${t3Pricing.minPrice.toLocaleString('en-IN')} – ₹${t3Pricing.maxPrice.toLocaleString('en-IN')}`
                        : 'Recommended Fair Resale Valuation'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.t3ApplyBtn}
                    onPress={() => {
                      setPrice(String(t3Pricing.recommendedPrice));
                      if (t3Pricing.suggestedOriginalPrice) {
                        setOriginalPrice(String(t3Pricing.suggestedOriginalPrice));
                      }
                      if (t3Pricing.suggestedRentalPriceDay) {
                        setRentalDay(String(t3Pricing.suggestedRentalPriceDay));
                      }
                      if (t3Pricing.suggestedRentalPriceWeek) {
                        setRentalWeek(String(t3Pricing.suggestedRentalPriceWeek));
                      }
                    }}
                  >
                    <Ionicons name="checkmark-sharp" size={13} color={colors.white} />
                    <Text style={styles.t3ApplyText}>APPLY PRICE</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.t3RecDetail}>
                  Derived from {t3Pricing.comparableCount || 500}+ comparable {t3Pricing.marketCategory || 'garment'} resale listings. Turnaround: ~{t3Pricing.medianDaysToSell || 21} days.
                  {t3Pricing.suggestedOriginalPrice ? ` Est. original retail MRP: ₹${t3Pricing.suggestedOriginalPrice.toLocaleString('en-IN')}.` : ''}
                </Text>
              </View>
            )}

            {/* Dynamic Rates / Pricing according to Listing Type */}
            {listingType === 'RENTAL' ? (
              <>
                <TextInput accessibilityLabel="RENTAL PRICE PER DAY (₹)"
                  style={styles.input}
                  placeholder="RENTAL PRICE PER DAY (₹)"
                  placeholderTextColor={colors.textMuted}
                  value={rentalDay}
                  onChangeText={setRentalDay}
                  keyboardType="numeric"
                />
                <TextInput accessibilityLabel="RENTAL PRICE PER WEEK (₹) (optional)"
                  style={styles.input}
                  placeholder="RENTAL PRICE PER WEEK (₹) (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={rentalWeek}
                  onChangeText={setRentalWeek}
                  keyboardType="numeric"
                />
              </>
            ) : listingType === 'SALE' ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontFamily: typography.mono, fontSize: 11.5, color: colors.charcoal, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 }}>
                  SELLING PRICE (₹) *
                </Text>
                <TextInput accessibilityLabel="SELLING PRICE (₹) e.g. 899"
                  style={styles.input}
                  placeholder="SELLING PRICE (₹) e.g. 899"
                  placeholderTextColor={colors.textMuted}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />

                <Text style={{ fontFamily: typography.mono, fontSize: 11.5, color: colors.charcoal, fontWeight: '700', letterSpacing: 0.5, marginTop: 10, marginBottom: 4 }}>
                  ORIGINAL RETAIL PRICE / MRP (₹) (OPTIONAL)
                </Text>
                <TextInput accessibilityLabel="ORIGINAL COST / MRP (₹) e.g. 2499"
                  style={styles.input}
                  placeholder="ORIGINAL COST / MRP (₹) e.g. 2499"
                  placeholderTextColor={colors.textMuted}
                  value={originalPrice}
                  onChangeText={setOriginalPrice}
                  keyboardType="numeric"
                />

                {Number(originalPrice) > Number(price) && Number(price) > 0 ? (
                  <View style={{ marginTop: 8, padding: 10, backgroundColor: colors.emeraldLight, borderRadius: 6, borderWidth: 1, borderColor: colors.emeraldLight, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="pricetag" size={15} color={colors.emerald} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: typography.mono, fontSize: 11.5, color: colors.emerald, fontWeight: '800' }}>
                        FEED PREVIEW: -{Math.round(((Number(originalPrice) - Number(price)) / Number(originalPrice)) * 100)}% OFF MRP
                      </Text>
                      <Text style={{ fontFamily: typography.body, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                        Listing at ₹{Number(price).toLocaleString('en-IN')} with strikethrough MRP ₹{Number(originalPrice).toLocaleString('en-IN')}.
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : (
              <>
                <TextInput accessibilityLabel="ESTIMATED TRADE VALUE (₹) (OPTIONAL)"
                  style={styles.input}
                  placeholder="ESTIMATED TRADE VALUE (₹) (OPTIONAL)"
                  placeholderTextColor={colors.textMuted}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
                <View style={styles.swapNoticeBox}>
                  <Ionicons name="scale-outline" size={16} color={colors.crimson} />
                  <Text style={styles.swapNoticeText}>
                    1:1 PEER SWAP: Cash price is completely optional. Swapping on KaPhor is an exchange of accessories. Any valuation you enter is purely optional to guide fair balance matching.
                  </Text>
                </View>
              </>
            )}

            <DropdownPicker
              label="SIZE"
              options={MARKET_SIZES.map(s => ({ id: s, label: s }))}
              selectedValue={size}
              onSelect={setSize}
              placeholder="SELECT SIZE"
            />
            {size === 'CUSTOM' && (
              <TextInput accessibilityLabel="ENTER CUSTOM SIZE"
                style={styles.input}
                placeholder="ENTER CUSTOM SIZE"
                placeholderTextColor={colors.textMuted}
                value={size}
                onChangeText={setSize}
              />
            )}

            <DropdownPicker
              label="CONDITION"
              options={MARKET_CONDITIONS}
              selectedValue={condition}
              onSelect={handleConditionChange}
              placeholder="SELECT CONDITION"
            />

            <View style={styles.conditionDescBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textSecond} />
              <Text style={styles.conditionDescText}>
                {MARKET_CONDITIONS.find(c => c.id === condition)?.desc}
              </Text>
            </View>

            <TextInput accessibilityLabel="FABRIC" style={styles.input} placeholder="FABRIC" placeholderTextColor={colors.textMuted} value={fabric} onChangeText={setFabric} />
            <TextInput accessibilityLabel="COLOR" style={styles.input} placeholder="COLOR" placeholderTextColor={colors.textMuted} value={color} onChangeText={setColor} />
            <TextInput accessibilityLabel="STYLE" style={styles.input} placeholder="STYLE" placeholderTextColor={colors.textMuted} value={styleAttr} onChangeText={setStyleAttr} />
            <TextInput accessibilityLabel="SLEEVE" style={styles.input} placeholder="SLEEVE" placeholderTextColor={colors.textMuted} value={sleeve} onChangeText={setSleeve} />
            <TextInput accessibilityLabel="SHAPE" style={styles.input} placeholder="SHAPE" placeholderTextColor={colors.textMuted} value={shape} onChangeText={setShape} />
            <TextInput accessibilityLabel="PATTERN" style={styles.input} placeholder="PATTERN" placeholderTextColor={colors.textMuted} value={pattern} onChangeText={setPattern} />
            <TextInput accessibilityLabel="WEIGHT" style={styles.input} placeholder="WEIGHT" placeholderTextColor={colors.textMuted} value={weight} onChangeText={setWeight} />

            <View style={styles.row}>
              <TouchableOpacity style={styles.secondaryButton} onPress={prevStep}>
                <Text style={styles.secondaryButtonText}>BACK</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mainButton, { flex: 2, marginLeft: 12 }]} onPress={nextStep}>
                <Text style={styles.mainButtonText}>CONTINUE</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>REVIEW & LIST</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>
                DESTINATION:{' '}
                <Text style={[styles.summaryValue, listingType === 'ACCESSORY_SWAP' && { color: colors.crimson, fontWeight: '700' }]}>
                  {listingType === 'ACCESSORY_SWAP'
                    ? 'SWAP MARKETPLACE (ACCESSORY EXCHANGE)'
                    : listingType === 'RENTAL'
                      ? 'RENTAL'
                      : 'SHOP MARKETPLACE (BUY & SELL)'}
                </Text>
              </Text>
              <Text style={styles.summaryLabel}>TITLE: <Text style={styles.summaryValue}>{title}</Text></Text>
              <Text style={styles.summaryLabel}>BRAND: <Text style={styles.summaryValue}>{brand || 'Unknown'}</Text></Text>
              <Text style={styles.summaryLabel}>CATEGORY: <Text style={styles.summaryValue}>{category}</Text></Text>
              <Text style={styles.summaryLabel}>CONDITION: <Text style={styles.summaryValue}>{condition.replace('_', ' ')}</Text></Text>
              <Text style={styles.summaryLabel}>
                {listingType === 'RENTAL' ? 'RENT PER DAY: ' : listingType === 'ACCESSORY_SWAP' ? 'ESTIMATED TRADE VALUE: ' : 'PRICE: '}
                <Text style={styles.summaryValue}>
                  {listingType === 'RENTAL' ? `₹${rentalDay}` : listingType === 'ACCESSORY_SWAP' ? (price ? `₹${price}` : '1:1 Trade (No Price Required)') : `₹${price || '999'}`}
                </Text>
              </Text>
              {fabric ? <Text style={styles.summaryLabel}>FABRIC: <Text style={styles.summaryValue}>{fabric}</Text></Text> : null}
              {color ? <Text style={styles.summaryLabel}>COLOR: <Text style={styles.summaryValue}>{color}</Text></Text> : null}
              {styleAttr ? <Text style={styles.summaryLabel}>STYLE: <Text style={styles.summaryValue}>{styleAttr}</Text></Text> : null}
              {sleeve ? <Text style={styles.summaryLabel}>SLEEVE: <Text style={styles.summaryValue}>{sleeve}</Text></Text> : null}
              {shape ? <Text style={styles.summaryLabel}>SHAPE: <Text style={styles.summaryValue}>{shape}</Text></Text> : null}
              {pattern ? <Text style={styles.summaryLabel}>PATTERN: <Text style={styles.summaryValue}>{pattern}</Text></Text> : null}
              {weight ? <Text style={styles.summaryLabel}>WEIGHT: <Text style={styles.summaryValue}>{weight}</Text></Text> : null}
              <Text style={styles.summaryLabel}>PHOTOS: <Text style={styles.summaryValue}>{images.length}</Text></Text>
            </View>

            {/* Payout Account Setup or Swap Destination Notice */}
            {listingType === 'ACCESSORY_SWAP' ? (
              <View style={[styles.payoutSection, { borderColor: colors.crimson }]}>
                <Text style={[styles.payoutSectionTitle, { color: colors.crimson }]}>SWAP DESTINATION CONFIRMED</Text>
                <Text style={styles.payoutSectionDesc}>
                  This item will be published exclusively to the KaPhor Swap feed for peer-to-peer exchange of accessories & footwear.
                </Text>
              </View>
            ) : (
              <View style={styles.payoutSection}>
                <Text style={styles.payoutSectionTitle}>PAYOUT ACCOUNT</Text>
                <Text style={styles.payoutSectionDesc}>
                  When your item sells, funds will be transferred to your linked bank account or UPI.
                </Text>
                <TouchableOpacity
                  style={styles.payoutSetupBtn}
                  onPress={() => router.push('/profile/payout' as any)}
                >
                  <Ionicons name="wallet-outline" size={18} color={colors.charcoal} />
                  <Text style={styles.payoutSetupText}>SET UP PAYOUT</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.policyText}>
              By listing, you warrant lawful ownership and agree to direct peer-to-peer sale terms. Kaphor acts strictly as an electronic intermediary under Sec. 79 of the IT Act, 2000 and is NOT RESPONSIBLE for seller representations, garment authenticity, or peer transactions.
            </Text>
            <TouchableOpacity style={styles.mainButton} onPress={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Spinner color={colors.white} />
              ) : (
                <Text style={styles.mainButtonText}>
                  {listingType === 'ACCESSORY_SWAP'
                    ? 'PUBLISH TO SWAP'
                    : listingType === 'RENTAL'
                      ? 'PUBLISH TO RENTAL'
                      : 'PUBLISH FOR SALE'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={prevStep} style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ color: colors.textMuted, fontWeight: '700', letterSpacing: 1 }}>BACK</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Grand Dossier Loading Screen during AI Magic Fill Analysis */}
      <Modal visible={aiLoading} animationType="fade" transparent={false} statusBarTranslucent>
        <Loader variant="magic_fill" />
      </Modal>

      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Button"
          onPress={handleBackNavigation}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name={step > 1 ? "chevron-back" : "close"} size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SECURE LISTING</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={styles.progressContainer}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={[styles.progressDot, step >= s && styles.activeDot]} />
        ))}
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          keyboardDismissMode="on-drag"
        >
          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontFamily: 'BebasNeue_400Regular', letterSpacing: 2 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 32 },
  progressDot: { width: 30, height: 4, backgroundColor: colors.bgCard, borderRadius: 2 },
  activeDot: { backgroundColor: colors.crimson },
  scrollContent: { padding: 24, paddingBottom: 220 },
  stepContainer: { gap: 16 },
  stepTitle: { fontSize: 32, fontFamily: 'BebasNeue_400Regular', color: colors.textPrimary, marginBottom: 4 },
  stepSubtitle: { fontSize: 16, color: colors.textSecond, lineHeight: 22 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  imageThumb: { width: 100, height: 133, borderRadius: 12, position: 'relative', overflow: 'hidden' }, // 3:4 ratio for thumb
  thumbImg: { width: '100%', height: '100%' },
  thumbActions: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    gap: 4
  },
  editBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center'
  },
  removeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.crimson,
    justifyContent: 'center',
    alignItems: 'center'
  },
  uploadBox: { width: 100, height: 100, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgCard },
  uploadText: { color: colors.textMuted, fontSize: 11, marginTop: 4, letterSpacing: 2, fontWeight: '700' },
  input: { height: 56, borderBottomWidth: 1, borderBottomColor: colors.border, color: colors.textPrimary, fontSize: 16, paddingHorizontal: 4 },
  pickerLabel: { color: colors.textMuted, fontSize: 12, letterSpacing: 2, marginTop: 16, fontWeight: '700' },
  chipRow: { flexDirection: 'row', marginBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginRight: 8, backgroundColor: colors.bgCard },
  chipActive: { borderColor: colors.crimson, backgroundColor: colors.crimsonLight },
  chipText: { color: colors.textSecond, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.crimson, fontWeight: '800' },
  mainButton: {
    backgroundColor: colors.crimson,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mainButtonText: { color: colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  aiButton: {
    backgroundColor: colors.charcoal,
    height: 60,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  aiButtonText: { color: colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  secondaryButton: { flex: 1, height: 60, borderRadius: 16, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgCard },
  secondaryButtonText: { color: colors.textSecond, fontSize: 14, letterSpacing: 2, fontWeight: '700' },
  row: { flexDirection: 'row', marginTop: 12, gap: 12 },
  summaryCard: { padding: 24, backgroundColor: colors.bgCard, borderRadius: 20, gap: 14, borderWidth: 1, borderColor: colors.border },
  summaryLabel: { color: colors.textSecond, fontSize: 12, fontWeight: '600' },
  summaryValue: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  payoutSection: {
    backgroundColor: colors.overlayLight,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.overlayLight,
    gap: 10,
  },
  payoutSectionTitle: {
    color: colors.navy,
    fontSize: 18,
    fontFamily: typography.handBold,
    includeFontPadding: false,
  },
  payoutSectionDesc: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  payoutSetupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.charcoal,
    marginTop: 4,
  },
  payoutSetupText: {
    color: colors.charcoal,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
  },
  policyText: { color: colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginVertical: 16 },
  conditionDescBox: {
    backgroundColor: colors.overlayLight,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.overlayLight,
  },
  conditionDescText: {
    color: colors.textSecond,
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  swapNoticeBox: {
    backgroundColor: colors.crimsonLight,
    borderRadius: 12,
    padding: 14,
    marginVertical: 6,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.crimsonLight,
  },
  swapNoticeText: {
    color: colors.charcoal,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: typography.body,
  },
  listingTypeTopContainer: {
    marginBottom: 20,
    backgroundColor: colors.white,
    padding: 14,
    borderWidth: 2,
    borderColor: colors.charcoal,
    borderRadius: 4,
  },
  listingTypeTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  listingTypeTopLabel: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
  },
  listingTypeBadge: {
    backgroundColor: colors.overlayLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listingTypeBadgeSwap: {
    backgroundColor: colors.crimsonLight,
    borderColor: colors.crimson,
  },
  listingTypeBadgeText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentedBtn: {
    flex: 1,
    backgroundColor: colors.paperLight,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    gap: 3,
  },
  segmentedBtnActive: {
    backgroundColor: colors.charcoal,
    borderColor: colors.charcoal,
  },
  segmentedBtnLabel: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
  },
  segmentedBtnLabelActive: {
    color: colors.white,
  },
  segmentedBtnSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  segmentedBtnSubActive: {
    color: colors.paperGlass,
  },
  listingTypeDescRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.overlayLight,
  },
  listingTypeDescText: {
    fontSize: 11,
    color: colors.textSecond,
    fontFamily: typography.body,
    flex: 1,
    lineHeight: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 4,
    marginBottom: -4,
  },
  sectionHeading: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.charcoal,
  },
  sectionHeadingSub: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.textMuted,
  },
  step2AiButton: {
    backgroundColor: colors.crimson,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 4,
    gap: 8,
    marginBottom: 14,
    elevation: 2,
    shadowColor: colors.crimson,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  step2AiButtonText: {
    color: colors.white,
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
  },
  t3RecCard: {
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.emeraldLight,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  t3RecHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  t3RecTitle: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 18,
    color: colors.emerald,
  },
  t3Badge: {
    backgroundColor: colors.emeraldLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.emeraldLight,
  },
  t3BadgeRising: {
    backgroundColor: colors.emeraldLight,
    borderColor: colors.emerald,
  },
  t3BadgeText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.emerald,
  },
  t3RecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  t3RecPrice: {
    fontFamily: typography.mono,
    fontSize: 22,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.5,
  },
  t3RecSub: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  t3ApplyBtn: {
    backgroundColor: colors.emerald,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  t3ApplyText: {
    fontFamily: typography.handBold,
    includeFontPadding: false,
    fontSize: 17,
    color: colors.white,
  },
  t3RecDetail: {
    fontFamily: typography.body,
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
    marginTop: 4,
  },
});
