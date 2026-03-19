import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, spacing, radius } from '../../theme';
import { GarmentCard } from '../../components/garment/GarmentCard';
import { Garment } from '../../types';

const CONDITIONS = ['PRISTINE', 'MINOR_WEAR', 'UPCYCLE', 'RECYCLE_ONLY'];
const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'OS'];
const COLORS = ['Black', 'White', 'Brown', 'Beige', 'Red', 'Blue', 'Green', 'Gold', 'Silver', 'Multi'];
const MATERIALS = ['Cotton', 'Silk', 'Wool', 'Leather', 'Linen', 'Polyester', 'Denim', 'Cashmere'];
const LISTING_TYPES = ['SALE', 'RENTAL', 'SWAP'];

export function SellScreen() {
    const router = useRouter();

    // Form State
    const [step, setStep] = useState(1);
    const [images, setImages] = useState<string[]>([]);
    const [title, setTitle] = useState('');
    const [brand, setBrand] = useState('');
    const [category, setCategory] = useState('');
    const [size, setSize] = useState('M');
    const [condition, setCondition] = useState('PRISTINE');
    const [selectedColors, setSelectedColors] = useState<string[]>([]);
    const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);

    // Pricing State
    const [listingType, setListingType] = useState('SALE');
    const [price, setPrice] = useState('');
    const [rentalDay, setRentalDay] = useState('');
    const [rentalWeek, setRentalWeek] = useState('');
    const [recyclableFiber, setRecyclableFiber] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Handlers
    const pickImage = async () => {
        if (images.length >= 8) {
            Alert.alert('Maximum reached', 'You can only upload up to 8 images.');
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImages(prev => [...prev, result.assets[0].uri]);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const toggleArrayItem = (item: string, array: string[], setArray: React.Dispatch<React.SetStateAction<string[]>>) => {
        if (array.includes(item)) {
            setArray(prev => prev.filter(i => i !== item));
        } else {
            setArray(prev => [...prev, item]);
        }
    };

    // Validation
    const validateStep1 = () => images.length > 0;
    const validateStep2 = () => title.length > 3 && brand.length > 1 && category.length > 1 && selectedColors.length > 0;
    const validateStep3 = () => {
        if (listingType === 'SALE' && (!price || isNaN(Number(price)))) return false;
        if (listingType === 'RENTAL' && (!rentalDay || isNaN(Number(rentalDay)))) return false;
        return true;
    };

    const nextStep = () => {
        if (step === 1 && !validateStep1()) { Alert.alert('Required', 'Please add at least one photo.'); return; }
        if (step === 2 && !validateStep2()) { Alert.alert('Required', 'Please fill out all mandatory detail fields.'); return; }
        if (step === 3 && !validateStep3()) { Alert.alert('Required', 'Please valid pricing information.'); return; }
        setStep(prev => Math.min(prev + 1, 4));
    };

    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    const handlePublish = async () => {
        if (!validateStep3()) return;
        setIsSubmitting(true);

        try {
            // Construct FormData for multipart/form-data POST
            const formData = new FormData();
            formData.append('title', title);
            formData.append('brand', brand);
            formData.append('category', category);
            formData.append('size', size);
            formData.append('condition', condition);
            formData.append('listingType', listingType);

            if (price) formData.append('price', price);
            if (rentalDay) formData.append('rentalPriceDay', rentalDay);
            if (rentalWeek) formData.append('rentalPriceWeek', rentalWeek);

            selectedColors.forEach(c => formData.append('color', c));
            selectedMaterials.forEach(m => formData.append('material', m));

            // Note: In React Native FormData, files look like this object
            images.forEach((uri, i) => {
                formData.append('images', {
                    uri,
                    name: `image_${i}.jpg`,
                    type: 'image/jpeg',
                } as any);
            });

            // Mock API Call
            console.log("Mock POST to /api/v1/garments", formData);
            await new Promise(resolve => setTimeout(resolve, 1500));

            Alert.alert('Success!', 'Garment successfully listed.', [
                { text: 'View Listing', onPress: () => router.push('/(tabs)') }
            ]);
        } catch (error) {
            Alert.alert('Error', 'Failed to publish listing.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Render Steps ──────────────────────────────
    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Add Photos</Text>
            <Text style={styles.stepSubtitle}>Up to 8 high-quality images. Drag to reorder. First image is your cover.</Text>

            <View style={styles.imageGrid}>
                {images.map((uri, index) => (
                    <View key={index} style={styles.imageWrapper}>
                        <Image source={{ uri }} style={styles.thumbnail} />
                        {index === 0 && <View style={styles.coverBadge}><Text style={styles.coverText}>COVER</Text></View>}
                        <Pressable style={styles.removeImageBtn} onPress={() => removeImage(index)}>
                            <Ionicons name="close-circle" size={24} color={colors.textPrimary} />
                        </Pressable>
                    </View>
                ))}
                {images.length < 8 && (
                    <Pressable style={styles.addPhotoBtn} onPress={pickImage}>
                        <Ionicons name="camera-outline" size={32} color={colors.gold} />
                        <Text style={styles.addPhotoText}>Add Photo</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Garment Details</Text>

            <Text style={styles.label}>Title *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Vintage Quilted Jacket" placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Brand *</Text>
            <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="Brand Name" placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Category *</Text>
            <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Category" placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Size *</Text>
            <View style={styles.chipGrid}>
                {SIZES.map(s => (
                    <Pressable key={s} onPress={() => setSize(s)} style={[styles.chip, size === s && styles.chipActive]}>
                        <Text style={[styles.chipText, size === s && styles.chipTextActive]}>{s}</Text>
                    </Pressable>
                ))}
            </View>

            <Text style={styles.label}>Condition *</Text>
            <View style={styles.chipGrid}>
                {CONDITIONS.map(c => (
                    <Pressable key={c} onPress={() => setCondition(c)} style={[styles.chip, condition === c && styles.chipActive]}>
                        <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>{c.replace('_', ' ')}</Text>
                    </Pressable>
                ))}
            </View>

            <Text style={styles.label}>Colors (Select Multiple)</Text>
            <View style={styles.chipGrid}>
                {COLORS.map(c => (
                    <Pressable key={c} onPress={() => toggleArrayItem(c, selectedColors, setSelectedColors)} style={[styles.chip, selectedColors.includes(c) && styles.chipActive]}>
                        <Text style={[styles.chipText, selectedColors.includes(c) && styles.chipTextActive]}>{c}</Text>
                    </Pressable>
                ))}
            </View>

            <Text style={styles.label}>Material (Select Multiple)</Text>
            <View style={styles.chipGrid}>
                {MATERIALS.map(m => (
                    <Pressable key={m} onPress={() => toggleArrayItem(m, selectedMaterials, setSelectedMaterials)} style={[styles.chip, selectedMaterials.includes(m) && styles.chipActive]}>
                        <Text style={[styles.chipText, selectedMaterials.includes(m) && styles.chipTextActive]}>{m}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );

    const renderStep3 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Pricing & Offering</Text>
            <Text style={styles.stepSubtitle}>How do you want to list this item?</Text>

            <View style={styles.segmentContainer}>
                {LISTING_TYPES.map(type => (
                    <Pressable key={type} onPress={() => setListingType(type)} style={[styles.segmentBtn, listingType === type && styles.segmentBtnActive]}>
                        <Text style={[styles.segmentText, listingType === type && styles.segmentTextActive]}>{type}</Text>
                    </Pressable>
                ))}
            </View>

            {listingType === 'SALE' && (
                <>
                    <Text style={styles.label}>Sale Price ($) *</Text>
                    <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textMuted} />
                </>
            )}

            {listingType === 'RENTAL' && (
                <>
                    <Text style={styles.label}>Rental Price Per Day ($) *</Text>
                    <TextInput style={styles.input} value={rentalDay} onChangeText={setRentalDay} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textMuted} />
                    <Text style={styles.label}>Rental Price Per Week ($)</Text>
                    <TextInput style={styles.input} value={rentalWeek} onChangeText={setRentalWeek} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textMuted} />
                </>
            )}

            <Text style={styles.label}>Estimated Recyclable Fiber % (Optional)</Text>
            <TextInput style={styles.input} value={recyclableFiber} onChangeText={setRecyclableFiber} keyboardType="numeric" placeholder="0-100" placeholderTextColor={colors.textMuted} />
        </View>
    );

    const renderStep4 = () => {
        // Create mock garment for preview
        const previewItem: Garment & { fitScore?: number } = {
            id: 'preview',
            title: title || 'Untitled',
            brand: brand || 'Unknown Brand',
            price: Number(price) || 0,
            images: images.length > 0 ? [images[0]] : [],
            condition,
            sellerId: 'me',
            category,
            size,
            color: selectedColors,
            listingType,
            fitScore: 1.0,
        } as any;

        return (
            <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Review & Publish</Text>
                <Text style={styles.stepSubtitle}>This is how your item will appear in the feed.</Text>

                <View style={styles.previewContainer}>
                    <View style={{ width: 180, height: 280 }}>
                        <GarmentCard item={previewItem} onPress={() => { }} />
                    </View>
                </View>

                <Pressable style={styles.publishBtn} onPress={handlePublish} disabled={isSubmitting}>
                    {isSubmitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.publishBtnText}>PUBLISH LISTING</Text>}
                </Pressable>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header Navigation */}
            <View style={styles.header}>
                <Pressable onPress={() => { if (step > 1) prevStep(); else router.back(); }} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </Pressable>
                <View style={styles.progressContainer}>
                    {[1, 2, 3, 4].map(s => (
                        <View key={s} style={[styles.progressDot, step >= s && styles.progressDotActive]} />
                    ))}
                </View>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
            </ScrollView>

            {/* Footer Navigation */}
            {step < 4 && (
                <View style={styles.footer}>
                    <Pressable style={styles.nextBtn} onPress={nextStep}>
                        <Text style={styles.nextBtnText}>CONTINUE</Text>
                    </Pressable>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn: { padding: spacing.xs },
    progressContainer: { flexDirection: 'row', gap: 8 },
    progressDot: { width: 30, height: 4, borderRadius: 2, backgroundColor: colors.bgMuted },
    progressDotActive: { backgroundColor: colors.gold },
    scrollContent: { padding: spacing.md, paddingBottom: 100 },
    stepContainer: { flex: 1 },
    stepTitle: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 32, marginBottom: spacing.xs },
    stepSubtitle: { color: colors.textSecond, fontFamily: typography.body, fontSize: 14, marginBottom: spacing.xl },

    // Step 1 - Photos
    imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    imageWrapper: { width: '30%', aspectRatio: 3 / 4, borderRadius: radius.md, overflow: 'hidden', position: 'relative' },
    thumbnail: { width: '100%', height: '100%' },
    removeImageBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12 },
    coverBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
    coverText: { color: colors.bg, fontSize: 8, fontWeight: 'bold' },
    addPhotoBtn: { width: '30%', aspectRatio: 3 / 4, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.gold, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgCard },
    addPhotoText: { color: colors.gold, fontSize: 12, marginTop: spacing.xs },

    // Step 2 & 3 - Forms
    label: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 12, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
    input: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, fontFamily: typography.body, fontSize: 16 },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 8 },
    chipActive: { backgroundColor: 'rgba(201, 168, 76, 0.2)', borderColor: colors.gold },
    chipText: { color: colors.textSecond, fontFamily: typography.body, fontSize: 14 },
    chipTextActive: { color: colors.gold, fontWeight: 'bold' },

    segmentContainer: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 4, marginBottom: spacing.md },
    segmentBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: radius.sm },
    segmentBtnActive: { backgroundColor: colors.bgMuted },
    segmentText: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 12, fontWeight: 'bold' },
    segmentTextActive: { color: colors.textPrimary },

    // Step 4 - Review
    previewContainer: { alignItems: 'center', marginVertical: spacing.xl },
    publishBtn: { backgroundColor: colors.gold, paddingVertical: 18, borderRadius: radius.full, alignItems: 'center', marginTop: spacing.xl },
    publishBtnText: { color: colors.bg, fontFamily: typography.mono, fontSize: 16, fontWeight: 'bold' },

    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
    nextBtn: { backgroundColor: colors.textPrimary, paddingVertical: 16, borderRadius: radius.full, alignItems: 'center' },
    nextBtnText: { color: colors.bg, fontFamily: typography.mono, fontSize: 16, fontWeight: 'bold' },
});
