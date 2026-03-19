import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../../src/services/api';

const CATEGORIES = ['Sarees', 'Lehengas', 'Kurta', 'Accessories', 'Bags', 'Jewelry', 'Scarves', 'Outerwear', 'Dresses'];
const CONDITIONS = ['PRISTINE', 'EXCELLENT', 'MINOR_WEAR', 'VISIBLE_WEAR'];
const LISTING_TYPES = ['SALE', 'RENTAL', 'ACCESSORY_SWAP'];

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
  const [submitting, setSubmitting] = useState(false);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Grant photo access to list garments.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 5));
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!title || !category || !price) {
      Alert.alert('Missing Fields', 'Please fill in title, category, and price.');
      return;
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
      formData.append('price', price);

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
        { text: 'VIEW SHOP', onPress: () => router.replace('/(tabs)/shop/index') },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to list garment.';
      Alert.alert('Error', msg);
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
                  <Ionicons name="camera-outline" size={32} color="#C9A84C" />
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
            <TextInput style={styles.input} placeholder="TITLE" placeholderTextColor="#6B5C52" value={title} onChangeText={setTitle} />
            <TextInput style={[styles.input, { height: 80 }]} placeholder="DESCRIPTION" placeholderTextColor="#6B5C52" value={description} onChangeText={setDescription} multiline />
            <TextInput style={styles.input} placeholder="BRAND" placeholderTextColor="#6B5C52" value={brand} onChangeText={setBrand} />
            <TextInput style={styles.input} placeholder="SIZE (e.g. S, M, L, OS)" placeholderTextColor="#6B5C52" value={size} onChangeText={setSize} />
            <TextInput style={styles.input} placeholder="PRICE (₹)" placeholderTextColor="#6B5C52" value={price} onChangeText={setPrice} keyboardType="numeric" />

            <Text style={styles.pickerLabel}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.pickerLabel}>CONDITION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {CONDITIONS.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, condition === c && styles.chipActive]} onPress={() => setCondition(c)}>
                  <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>{c.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.pickerLabel}>LISTING TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {LISTING_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.chip, listingType === t && styles.chipActive]} onPress={() => setListingType(t)}>
                  <Text style={[styles.chipText, listingType === t && styles.chipTextActive]}>{t.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

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
              <Text style={styles.summaryLabel}>PRICE: <Text style={styles.summaryValue}>₹{price}</Text></Text>
              <Text style={styles.summaryLabel}>PHOTOS: <Text style={styles.summaryValue}>{images.length}</Text></Text>
            </View>
            <Text style={styles.policyText}>By listing, you agree to our Circular Economy standards and Luxury Authentication process.</Text>
            <TouchableOpacity style={styles.mainButton} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#1A0C10" /> : <Text style={styles.mainButtonText}>LIST GARMENT</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={prevStep} style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Text style={{ color: '#6B5C52', letterSpacing: 1 }}>BACK</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SECURE LISTING</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={styles.progressContainer}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={[styles.progressDot, step >= s && styles.activeDot]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0C10' },
  header: { paddingTop: 60, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { color: '#C9A84C', fontSize: 16, fontFamily: 'CormorantGaramond_700Bold', letterSpacing: 2 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 32 },
  progressDot: { width: 20, height: 4, backgroundColor: '#3A2C30', borderRadius: 2 },
  activeDot: { backgroundColor: '#C9A84C' },
  scrollContent: { padding: 24, paddingBottom: 100 },
  stepContainer: { gap: 16 },
  stepTitle: { fontSize: 24, fontFamily: 'CormorantGaramond_700Bold', color: '#C9A84C', marginBottom: 4 },
  stepSubtitle: { fontSize: 14, color: '#6B5C52', lineHeight: 20 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  imageThumb: { width: 100, height: 100, borderRadius: 8, position: 'relative' },
  thumbImg: { width: '100%', height: '100%', borderRadius: 8 },
  removeBtn: { position: 'absolute', top: -6, right: -6 },
  uploadBox: { width: 100, height: 100, borderWidth: 1, borderColor: '#3A2C30', borderStyle: 'dashed', borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2A1C20' },
  uploadText: { color: '#6B5C52', fontSize: 10, marginTop: 4, letterSpacing: 2 },
  input: { height: 52, borderBottomWidth: 1, borderBottomColor: '#3A2C30', color: 'white', fontSize: 14, paddingHorizontal: 4 },
  pickerLabel: { color: '#6B5C52', fontSize: 11, letterSpacing: 2, marginTop: 8 },
  chipRow: { flexDirection: 'row', marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#3A2C30', marginRight: 8 },
  chipActive: { borderColor: '#C9A84C', backgroundColor: 'rgba(201,168,76,0.12)' },
  chipText: { color: '#6B5C52', fontSize: 12 },
  chipTextActive: { color: '#C9A84C', fontWeight: '700' },
  mainButton: { backgroundColor: '#C9A84C', height: 56, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  mainButtonText: { color: '#1A0C10', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  secondaryButton: { flex: 1, height: 56, borderRadius: 8, borderWidth: 1, borderColor: '#3A2C30', justifyContent: 'center', alignItems: 'center' },
  secondaryButtonText: { color: '#6B5C52', fontSize: 14, letterSpacing: 2 },
  row: { flexDirection: 'row', marginTop: 12 },
  summaryCard: { padding: 20, backgroundColor: '#2A1C20', borderRadius: 12, gap: 12, borderWidth: 1, borderColor: 'rgba(201,168,76,0.1)' },
  summaryLabel: { color: '#6B5C52', fontSize: 12 },
  summaryValue: { color: 'white', fontSize: 14, fontWeight: '700' },
  policyText: { color: '#6B5C52', fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
