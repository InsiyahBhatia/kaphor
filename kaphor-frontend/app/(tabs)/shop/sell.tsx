import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  MARKET_CONDITIONS, 
  LISTING_TYPES, 
  MARKET_SIZES 
} from '../../../src/constants/market';
import { DropdownPicker } from '../../../src/components/DropdownPicker';
import { safeBack, useBackHandler } from '../../../src/utils/navigation';
import { useGarmentStore } from '../../../src/store/garmentStore';
import { DossierLoading } from '../../../src/components/common/DossierLoading';

export function matchMarketCategory(raw?: string): string {
  if (!raw) return 'Tops';
  const r = raw.trim().toLowerCase();

  const exact = ALL_CATEGORY_ITEMS.find((item) => item.toLowerCase() === r);
  if (exact) return exact;

  // Ethnic
  if (r.includes('saree') || r.includes('sari')) return 'Sarees';
  if (r.includes('lehenga') || r.includes('choli')) return 'Lehengas';
  if (r.includes('anarkali')) return 'Anarkalis';
  if (r.includes('sherwani')) return 'Sherwanis';
  if (r.includes('kurta') || r.includes('kurti')) return 'Kurtas';
  if (r.includes('dupatta') || r.includes('chunni')) return 'Dupattas';
  if (r.includes('kaftan') || r.includes('caftan')) return 'Kaftans';
  if (r.includes('pashmina')) return 'Pashminas';
  if (r.includes('shawl')) return 'Shawls';
  if (r.includes('indo-western') || r.includes('indowestern')) return 'Indo-Western';

  // Apparel
  if (r.includes('gown')) return 'Gowns';
  if (r.includes('dress') || r.includes('frock')) return 'Dresses';
  if (r.includes('skirt')) return 'Skirts';
  if (r.includes('co-ord') || r.includes('coord') || r.includes('set')) return 'Co-ords';
  if (r.includes('jumpsuit') || r.includes('romper')) return 'Jumpsuits';
  if (r.includes('shirt') || r.includes('button')) return 'Shirts';
  if (r.includes('blazer') || r.includes('tuxedo')) return 'Blazers';
  if (r.includes('coat') || r.includes('overcoat')) return 'Coats';
  if (r.includes('jacket') || r.includes('bomber') || r.includes('windbreaker')) return 'Jackets';
  if (r.includes('knitwear') || r.includes('sweater') || r.includes('cardigan') || r.includes('pullover')) return 'Knitwear';
  if (r.includes('jeans') || r.includes('denim')) return 'Denims';
  if (r.includes('pant') || r.includes('trouser') || r.includes('chino') || r.includes('cargo')) return 'Pants';
  if (r.includes('top') || r.includes('t-shirt') || r.includes('tshirt') || r.includes('tee') || r.includes('blouse') || r.includes('hoodie')) return 'Tops';

  // Accessories
  if (r.includes('bag') || r.includes('purse') || r.includes('clutch') || r.includes('tote') || r.includes('backpack')) return 'Bags';
  if (r.includes('jewelry') || r.includes('jewellery') || r.includes('necklace') || r.includes('ring') || r.includes('earring') || r.includes('bracelet') || r.includes('pendant')) return 'Jewelry';
  if (r.includes('watch') || r.includes('timepiece')) return 'Watches';
  if (r.includes('eyewear') || r.includes('sunglass') || r.includes('glasses') || r.includes('shades')) return 'Eyewear';
  if (r.includes('belt')) return 'Belts';
  if (r.includes('hat') || r.includes('cap') || r.includes('beanie')) return 'Hats';
  if (r.includes('scarf') || r.includes('scarves') || r.includes('stole') || r.includes('muffler')) return 'Scarves';
  if (r.includes('wallet') || r.includes('cardholder') || r.includes('card holder')) return 'Wallets';
  if (r.includes('tie') || r.includes('bowtie') || r.includes('necktie')) return 'Ties';
  if (r.includes('hair') || r.includes('scrunchie') || r.includes('headband') || r.includes('clip')) return 'Hair Accessories';

  // Footwear
  if (r.includes('sneaker') || r.includes('trainer')) return 'Sneakers';
  if (r.includes('heel') || r.includes('stiletto') || r.includes('pump')) return 'Heels';
  if (r.includes('boot')) return 'Boots';
  if (r.includes('sandal')) return 'Sandals';
  if (r.includes('flat') || r.includes('loafer') || r.includes('mule')) return 'Flats';
  if (r.includes('jutti') || r.includes('mojari')) return 'Juttis';
  if (r.includes('shoe') || r.includes('oxford') || r.includes('derby') || r.includes('brogue')) return 'Dress Shoes';

  return 'Tops';
}

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
  }>();

  const [step, setStep] = useState(1);

  const handleBackNavigation = () => {
    if (step > 1) {
      setStep((s) => s - 1);
      return true;
    }
    return false;
  };

  useBackHandler('/(tabs)/shop', handleBackNavigation);
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [condition, setCondition] = useState('PRISTINE');
  const [listingType, setListingType] = useState('SALE');
  const [price, setPrice] = useState('');
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
    if (params.prefillListingType) {
      setListingType(params.prefillListingType);
      if (params.prefillListingType === 'ACCESSORY_SWAP' && !isAccessoryCategory(category)) {
        setCategory('Bags');
        setSize('FREE SIZE');
      }
    }
    // Intentionally leave price blank for manual user entry
  }, [params.prefillImage, params.prefillCategory, params.prefillTitle]);

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    if (FREE_SIZE_CATEGORIES.includes(cat) && (!size || size === 'M')) {
      setSize('FREE SIZE');
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

  const handleAiFill = async () => {
    if (images.length === 0) {
      Alert.alert('Image Required', 'Upload at least one photo first.');
      return;
    }
    setAiLoading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(images[0], { encoding: 'base64' });
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
        const matchedCat = matchMarketCategory(res.category || res.subCategory);
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

        // Intelligent listing type & pricing autofill
        const estPrice = res.estimatedPrice ? String(res.estimatedPrice) : '999';
        const dayRate = res.suggestedRentalPriceDay 
          ? String(res.suggestedRentalPriceDay) 
          : String(Math.max(199, Math.round(Number(estPrice) * 0.12)));
        const weekRate = res.suggestedRentalPriceWeek 
          ? String(res.suggestedRentalPriceWeek) 
          : String(Math.round(Number(dayRate) * 5));

        if (listingType === 'ACCESSORY_SWAP') {
          if (isAccessory) {
            setPrice('');
            setRentalDay('');
            setRentalWeek('');
            Alert.alert(
              'AI Magic Fill: Swap Asset',
              `Identified as "${matchedCat}". Your accessory swap listing has been filled! Swap listings require no cash price.`
            );
          } else {
            // Swap is strictly for accessories!
            setListingType('SALE');
            setPrice(estPrice);
            Alert.alert(
              'Category Notice',
              `Identified as "${matchedCat}". Swapping on KaPhor is exclusively for accessories & footwear. We switched this listing to SALE (₹${estPrice}). You can edit details or switch category.`
            );
          }
        } else if (listingType === 'RENTAL') {
          setRentalDay(dayRate);
          setRentalWeek(weekRate);
          Alert.alert(
            'AI Magic Fill: Rental Listing',
            `Identified as "${matchedCat}". Auto-filled suggested rental rate of ₹${dayRate}/day (₹${weekRate}/week) based on archival market valuation.`
          );
        } else {
          // SALE
          setPrice(estPrice);
          if (isAccessory) {
            Alert.alert(
              'AI Magic Fill: Sale Listing',
              `Identified as "${matchedCat}". Auto-filled estimated resale price of ₹${estPrice}. Note: This accessory is also eligible for SWAP if you prefer exchanging!`
            );
          } else {
            Alert.alert(
              'AI Magic Fill: Sale Listing',
              `Identified as "${matchedCat}". Auto-filled details and estimated market price of ₹${estPrice}. Review and adjust anytime before publishing.`
            );
          }
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

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Grant photo access to list garments.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, result.assets[0].uri].slice(0, 5));
    }
  };

  const editImage = async (idx: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled) {
      setImages((prev) => {
        const next = [...prev];
        next[idx] = result.assets[0].uri;
        return next;
      });
    }
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
    const finalPrice = price || '999';

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
      } else if (listingType === 'SALE') {
        formData.append('price', finalPrice);
      }
      // ACCESSORY_SWAP does not require price

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

      Alert.alert('Listed!', 'Your item is now live on KaPhor.', [
        {
          text: listingType === 'ACCESSORY_SWAP' ? 'VIEW SWAP' : 'VIEW SHOP',
          onPress: () => {
            useGarmentStore.getState().fetchFeed();
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
        const msg = apiErrors.map((e: any) => `${e.field || 'Field'}: ${e.message}`).join('\n');
        Alert.alert('Validation Error', msg);
      } else {
        const msg = data?.message || err?.message || 'Failed to list garment. Please try again.';
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
            <Text style={styles.stepTitle}>UPLOAD IMAGES</Text>
            <Text style={styles.stepSubtitle}>Showcase the craftsmanship (up to 5 photos)</Text>

            {renderListingTypeSelector()}

            <View style={styles.imageGrid}>
              {images.map((uri, i) => (
                <View key={i} style={styles.imageThumb}>
                  <Image source={{ uri }} style={styles.thumbImg} />
                  <View style={styles.thumbActions}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => editImage(i)}>
                      <Ionicons name="pencil-sharp" size={14} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(i)}>
                      <Ionicons name="close-sharp" size={14} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {images.length < 5 && (
                <TouchableOpacity style={styles.uploadBox} onPress={pickImages}>
                  <Ionicons name="camera-outline" size={32} color={colors.crimson} />
                  <Text style={styles.uploadText}>ADD</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.mainButton, images.length === 0 && { opacity: 0.5 }]}
              onPress={nextStep}
              disabled={images.length === 0}
            >
              <Text style={styles.mainButtonText}>CONTINUE</Text>
            </TouchableOpacity>

            {images.length > 0 && (
              <TouchableOpacity
                style={[styles.aiButton, aiLoading && { opacity: 0.7 }]}
                onPress={handleAiFill}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={20} color={colors.white} />
                    <Text style={styles.aiButtonText}>AI MAGIC FILL</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>GARMENT DETAILS</Text>

            {/* Listing Type Prominently at Top */}
            {renderListingTypeSelector()}

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

            <TextInput style={styles.input} placeholder="TITLE" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />
            <TextInput style={[styles.input, { height: 80 }]} placeholder="DESCRIPTION" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} multiline />
            <TextInput style={styles.input} placeholder="BRAND" placeholderTextColor={colors.textMuted} value={brand} onChangeText={setBrand} />

            {/* Dynamic Rates / Pricing according to Listing Type */}
            {listingType === 'RENTAL' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="RENTAL PRICE PER DAY (₹)"
                  placeholderTextColor={colors.textMuted}
                  value={rentalDay}
                  onChangeText={setRentalDay}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  placeholder="RENTAL PRICE PER WEEK (₹) (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={rentalWeek}
                  onChangeText={setRentalWeek}
                  keyboardType="numeric"
                />
              </>
            ) : listingType === 'SALE' ? (
              <TextInput
                style={styles.input}
                placeholder="PRICE (₹)"
                placeholderTextColor={colors.textMuted}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
            ) : (
              <View style={styles.swapNoticeBox}>
                <Ionicons name="repeat" size={18} color={colors.crimson} />
                <Text style={styles.swapNoticeText}>
                  SWAP ASSET: Direct peer exchange. No cash price is required for swap listings.
                </Text>
              </View>
            )}

            <DropdownPicker
              label="SIZE"
              options={MARKET_SIZES.map(s => ({ id: s, label: s }))}
              selectedValue={size}
              onSelect={setSize}
              placeholder="SELECT SIZE"
            />
            {size === 'CUSTOM' && (
              <TextInput 
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
              onSelect={setCondition}
              placeholder="SELECT CONDITION"
            />
            
            <View style={styles.conditionDescBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textSecond} />
              <Text style={styles.conditionDescText}>
                {MARKET_CONDITIONS.find(c => c.id === condition)?.desc}
              </Text>
            </View>

            <TextInput style={styles.input} placeholder="FABRIC" placeholderTextColor={colors.textMuted} value={fabric} onChangeText={setFabric} />
            <TextInput style={styles.input} placeholder="COLOR" placeholderTextColor={colors.textMuted} value={color} onChangeText={setColor} />
            <TextInput style={styles.input} placeholder="STYLE" placeholderTextColor={colors.textMuted} value={styleAttr} onChangeText={setStyleAttr} />
            <TextInput style={styles.input} placeholder="SLEEVE" placeholderTextColor={colors.textMuted} value={sleeve} onChangeText={setSleeve} />
            <TextInput style={styles.input} placeholder="SHAPE" placeholderTextColor={colors.textMuted} value={shape} onChangeText={setShape} />
            <TextInput style={styles.input} placeholder="PATTERN" placeholderTextColor={colors.textMuted} value={pattern} onChangeText={setPattern} />
            <TextInput style={styles.input} placeholder="WEIGHT" placeholderTextColor={colors.textMuted} value={weight} onChangeText={setWeight} />

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
              <Text style={styles.summaryLabel}>TITLE: <Text style={styles.summaryValue}>{title}</Text></Text>
              <Text style={styles.summaryLabel}>BRAND: <Text style={styles.summaryValue}>{brand || 'Unknown'}</Text></Text>
              <Text style={styles.summaryLabel}>CATEGORY: <Text style={styles.summaryValue}>{category}</Text></Text>
              <Text style={styles.summaryLabel}>CONDITION: <Text style={styles.summaryValue}>{condition.replace('_', ' ')}</Text></Text>
              <Text style={styles.summaryLabel}>
                {listingType === 'RENTAL' ? 'RENT PER DAY: ' : listingType === 'ACCESSORY_SWAP' ? 'LISTING: ' : 'PRICE: '}
                <Text style={styles.summaryValue}>
                  {listingType === 'RENTAL' ? `₹${rentalDay}` : listingType === 'ACCESSORY_SWAP' ? 'SWAP ASSET (EXCHANGE)' : `₹${price}`}
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
            {/* Payout Account Setup */}
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

            <Text style={styles.policyText}>By listing, you agree to our Circular Economy standards and Luxury Authentication process.</Text>
            <TouchableOpacity style={styles.mainButton} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.mainButtonText}>LIST GARMENT</Text>}
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
        <DossierLoading variant="magic_fill" />
      </Modal>

      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 24) }]}>
        <TouchableOpacity 
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
  scrollContent: { padding: 24, paddingBottom: 100 },
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
    backgroundColor: 'rgba(26,26,26,0.6)', 
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
  uploadText: { color: colors.textMuted, fontSize: 10, marginTop: 4, letterSpacing: 2, fontWeight: '700' },
  input: { height: 56, borderBottomWidth: 1, borderBottomColor: colors.border, color: colors.textPrimary, fontSize: 16, paddingHorizontal: 4 },
  pickerLabel: { color: colors.textMuted, fontSize: 12, letterSpacing: 2, marginTop: 16, fontWeight: '700' },
  chipRow: { flexDirection: 'row', marginBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginRight: 8, backgroundColor: colors.bgCard },
  chipActive: { borderColor: colors.crimson, backgroundColor: 'rgba(155, 27, 48, 0.05)' },
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
    backgroundColor: 'rgba(28,43,74,0.04)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(28,43,74,0.12)',
    gap: 10,
  },
  payoutSectionTitle: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: typography.mono,
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
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  policyText: { color: colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginVertical: 16 },
  conditionDescBox: {
    backgroundColor: 'rgba(26,26,26,0.03)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26,26,26,0.05)',
  },
  conditionDescText: {
    color: colors.textSecond,
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  swapNoticeBox: {
    backgroundColor: 'rgba(168, 34, 34, 0.06)',
    borderRadius: 12,
    padding: 14,
    marginVertical: 6,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 34, 34, 0.2)',
  },
  swapNoticeText: {
    color: colors.charcoal,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
    fontWeight: '600',
    fontFamily: typography.mono,
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
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.charcoal,
  },
  listingTypeBadge: {
    backgroundColor: 'rgba(26,26,26,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listingTypeBadgeSwap: {
    backgroundColor: 'rgba(158, 42, 43, 0.08)',
    borderColor: colors.crimson,
  },
  listingTypeBadgeText: {
    fontFamily: typography.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.charcoal,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentedBtn: {
    flex: 1,
    backgroundColor: '#F5F3ED',
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
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.charcoal,
  },
  segmentedBtnLabelActive: {
    color: colors.white,
  },
  segmentedBtnSub: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  segmentedBtnSubActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  listingTypeDescRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  listingTypeDescText: {
    fontSize: 11,
    color: colors.textSecond,
    fontFamily: typography.body,
    flex: 1,
    lineHeight: 15,
  },
});
