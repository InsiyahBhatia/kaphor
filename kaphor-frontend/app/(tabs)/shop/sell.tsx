import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../../src/services/api';
import { colors } from '../../../src/theme';
import { 
  MARKET_CATEGORIES, 
  MARKET_CONDITIONS, 
  LISTING_TYPES, 
  MARKET_SIZES 
} from '../../../src/constants/market';
import { DropdownPicker } from '../../../src/components/DropdownPicker';



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
  const [submitting, setSubmitting] = useState(false);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Grant photo access to list garments.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, result.assets[0].uri].slice(0, 5));
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!title || !category || !description || !condition || !size) {
      Alert.alert('Missing Fields', 'Please fill in title, description, category, condition, and size.');
      return;
    }

    if (listingType === 'RENTAL') {
      if (!rentalDay) {
        Alert.alert('Missing Fields', 'Please fill in rental price per day for rentals.');
        return;
      }
    } else {
      if (!price) {
        Alert.alert('Missing Fields', 'Please fill in price.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('brand', brand || 'Unknown');
      formData.append('category', category);
      formData.append('size', size || 'OS');
      formData.append('condition', condition);
      formData.append('listingType', listingType);
      if (listingType === 'RENTAL') {
        formData.append('rentalPriceDay', rentalDay);
        if (rentalWeek) formData.append('rentalPriceWeek', rentalWeek);
      } else {
        formData.append('price', price);
      }

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
      const apiErrors = err?.response?.data?.errors;
      if (Array.isArray(apiErrors)) {
        const msg = apiErrors.map((e: any) => `${e.field}: ${e.message}`).join('\n');
        Alert.alert('Validation Error', msg);
      } else {
        const msg = err?.response?.data?.message || 'Failed to list garment.';
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
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(i)}>
                    <Ionicons name="close-circle" size={22} color="#9B1B30" />
                  </TouchableOpacity>
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
              <Text style={styles.summaryLabel}>PHOTOS: <Text style={styles.summaryValue}>{images.length}</Text></Text>
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
        <TouchableOpacity onPress={() => router.back()}>
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
  imageThumb: { width: 100, height: 100, borderRadius: 12, position: 'relative' },
  thumbImg: { width: '100%', height: '100%', borderRadius: 12 },
  removeBtn: { position: 'absolute', top: -6, right: -6 },
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
  secondaryButton: { flex: 1, height: 60, borderRadius: 16, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgCard },
  secondaryButtonText: { color: colors.textSecond, fontSize: 14, letterSpacing: 2, fontWeight: '700' },
  row: { flexDirection: 'row', marginTop: 12, gap: 12 },
  summaryCard: { padding: 24, backgroundColor: colors.bgCard, borderRadius: 20, gap: 14, borderWidth: 1, borderColor: colors.border },
  summaryLabel: { color: colors.textSecond, fontSize: 12, fontWeight: '600' },
  summaryValue: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
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
