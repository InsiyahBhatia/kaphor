import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import api from '../../../src/services/api';
import { colors, typography } from '../../../src/theme';
import { 
  MARKET_CATEGORIES, 
  ALL_CATEGORY_ITEMS,
  MARKET_CONDITIONS, 
  LISTING_TYPES, 
  MARKET_SIZES 
} from '../../../src/constants/market';
import { DropdownPicker } from '../../../src/components/DropdownPicker';
import { safeBack } from '../../../src/utils/navigation';

export default function SellScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
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

  const handleAiFill = async () => {
    if (images.length === 0) {
      Alert.alert('Image Required', 'Upload at least one photo first.');
      return;
    }
    setAiLoading(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(images[0], { encoding: 'base64' });
      const { data } = await api.post('/ai/analyze-listing', { image: `data:image/jpeg;base64,${base64}` });
      const res = data.data;

      if (res) {
        setTitle(res.title || '');
        setDescription(res.description || '');
        setBrand(res.brand || '');

        // Map AI predicted category string to exact dropdown item in ALL_CATEGORY_ITEMS
        const rawCat = (res.category || '').toLowerCase();
        let matchedCat = ALL_CATEGORY_ITEMS.find((item) => item.toLowerCase() === rawCat);
        if (!matchedCat) {
          if (rawCat.includes('saree')) matchedCat = 'Sarees';
          else if (rawCat.includes('lehenga')) matchedCat = 'Lehengas';
          else if (rawCat.includes('anarkali')) matchedCat = 'Anarkalis';
          else if (rawCat.includes('kurta') || rawCat.includes('kurti')) matchedCat = 'Kurtas';
          else if (rawCat.includes('jacket')) matchedCat = 'Jackets';
          else if (rawCat.includes('blazer')) matchedCat = 'Blazers';
          else if (rawCat.includes('dress')) matchedCat = 'Dresses';
          else if (rawCat.includes('top') || rawCat.includes('tshirt')) matchedCat = 'Tops';
          else if (rawCat.includes('jeans') || rawCat.includes('denim')) matchedCat = 'Denims';
          else if (rawCat.includes('pant') || rawCat.includes('trouser')) matchedCat = 'Bottoms';
          else matchedCat = 'Tops';
        }
        setCategory(matchedCat);

        setPrice(String(res.estimatedPrice || ''));
        setFabric(res.styleAttributes?.fabric || '');
        setColor(res.color?.[0] || '');
        setStyleAttr(res.styleAttributes?.style || '');
        setSleeve(res.styleAttributes?.sleeve || '');
        setShape(res.styleAttributes?.shape || '');
        setPattern(res.styleAttributes?.pattern || '');
        setWeight(res.styleAttributes?.weight || '');
        setCondition(res.condition || 'PRISTINE');
        
        Alert.alert('AI Success', 'Garment details have been auto-filled from your photo.');
        setStep(2);
      }
    } catch (err) {
      console.error('AI Fill failed', err);
      Alert.alert('AI Error', 'Failed to analyze image. Please fill details manually.');
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
      aspect: [3, 4],
      quality: 0.8,
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
      aspect: [3, 4],
      quality: 0.8,
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
    // Soft fallback defaults generated by AI vision models when user leaves fields blank
    const finalTitle = title.trim() || `${brand || 'Designer'} ${category || 'Garment'}`;
    const finalCategory = category || 'other';
    const finalDescription = description.trim() || `Garment listing assessed by Kaphor AI Vision engine.`;
    const finalCondition = condition || 'GOOD';
    const finalSize = size || 'M';
    const finalPrice = price || '999';

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
      } else {
        formData.append('price', finalPrice);
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
      });

      Alert.alert('Listed!', 'Your garment is now live on Kaphor.', [
        { text: 'VIEW SHOP', onPress: () => router.replace('/(tabs)/shop') },
      ]);
    } catch (err: any) {
      const data = err?.response?.data;
      // Backend returns field errors as `errors` (legacy) or `details` (zod validate())
      const apiErrors = data?.errors ?? data?.details;
      if (Array.isArray(apiErrors) && apiErrors.length > 0) {
        const msg = apiErrors.map((e: any) => `${e.field}: ${e.message}`).join('\n');
        Alert.alert('Validation Error', msg);
      } else {
        const msg = data?.message || 'Failed to list garment.';
        Alert.alert('Error', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>UPLOAD IMAGES</Text>
            <Text style={styles.stepSubtitle}>Showcase the craftsmanship (up to 5 photos)</Text>
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
            <TextInput style={styles.input} placeholder="TITLE" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />
            <TextInput style={[styles.input, { height: 80 }]} placeholder="DESCRIPTION" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} multiline />
            <TextInput style={styles.input} placeholder="BRAND" placeholderTextColor={colors.textMuted} value={brand} onChangeText={setBrand} />
            <DropdownPicker
              label="SIZE"
              options={MARKET_SIZES.map(s => ({ id: s, label: s }))}
              selectedValue={size}
              onSelect={setSize}
              placeholder="SELECT SIZE"
            />
            {/* Fallback for custom sizes if needed, but the user wants clean dropdowns */}
            {size === 'CUSTOM' && (
              <TextInput 
                style={styles.input} 
                placeholder="ENTER CUSTOM SIZE" 
                placeholderTextColor={colors.textMuted} 
                value={description} // Reuse a temporary state or just keep it simple
                onChangeText={setSize} 
              />
            )}
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
            ) : (
              <TextInput
                style={styles.input}
                placeholder="PRICE (₹)"
                placeholderTextColor={colors.textMuted}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
            )}

            <TextInput style={styles.input} placeholder="FABRIC" placeholderTextColor={colors.textMuted} value={fabric} onChangeText={setFabric} />
            <TextInput style={styles.input} placeholder="COLOR" placeholderTextColor={colors.textMuted} value={color} onChangeText={setColor} />
            <TextInput style={styles.input} placeholder="STYLE" placeholderTextColor={colors.textMuted} value={styleAttr} onChangeText={setStyleAttr} />
            <TextInput style={styles.input} placeholder="SLEEVE" placeholderTextColor={colors.textMuted} value={sleeve} onChangeText={setSleeve} />
            <TextInput style={styles.input} placeholder="SHAPE" placeholderTextColor={colors.textMuted} value={shape} onChangeText={setShape} />
            <TextInput style={styles.input} placeholder="PATTERN" placeholderTextColor={colors.textMuted} value={pattern} onChangeText={setPattern} />
            <TextInput style={styles.input} placeholder="WEIGHT" placeholderTextColor={colors.textMuted} value={weight} onChangeText={setWeight} />

            <DropdownPicker
              label="CATEGORY"
              options={MARKET_CATEGORIES.flatMap(g => g.items.map(i => ({ id: i, label: i, group: g.group })))}
              selectedValue={category}
              onSelect={setCategory}
              isGrouped={true}
              placeholder="SELECT CATEGORY"
            />

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

            <DropdownPicker
              label="LISTING TYPE"
              options={LISTING_TYPES}
              selectedValue={listingType}
              onSelect={setListingType}
              placeholder="SELECT LISTING TYPE"
            />

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
                {listingType === 'RENTAL' ? 'RENT PER DAY: ' : 'PRICE: '}
                <Text style={styles.summaryValue}>
                  {listingType === 'RENTAL' ? `₹${rentalDay}` : `₹${price}`}
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
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => safeBack('/(tabs)/shop')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={28} color={colors.textPrimary} />
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
  header: { paddingTop: 24, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
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
});
