import React, { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable,
    TextInput, ActivityIndicator, Alert, Dimensions, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, spacing, radius } from '../../theme';

const { width } = Dimensions.get('window');

const POST_TYPES = ['OUTFIT', 'TUTORIAL', 'TRANSFORMATION', 'CIRCULAR_STORY'] as const;
type PostType = typeof POST_TYPES[number];

const POST_TYPE_LABELS: Record<PostType, string> = {
    OUTFIT: 'Outfit',
    TUTORIAL: 'Tutorial',
    TRANSFORMATION: 'Transformation',
    CIRCULAR_STORY: 'Circular Story'
};

const HASHTAG_SUGGESTIONS = ['#KaphorCircular', '#SlowFashion', '#SustainableStyle', '#Upcycled', '#HeritageWear'];

const MOCK_GARMENTS = [
    { id: 'g1', title: 'Crimson Velvet Lehenga', brand: 'SABYASACHI' },
    { id: 'g2', title: 'Gold Zardosi Belt', brand: 'KAPHOR LAB' },
    { id: 'g3', title: 'Ivory Silk Dupatta', brand: 'MANISH MALHOTRA' }
];

// ─── Step Indicator ──────────────────────────────────────────────────────────
const StepIndicator = ({ currentStep }: { currentStep: number }) => (
    <View style={styles.stepIndicator}>
        {[1, 2, 3].map(step => (
            <React.Fragment key={step}>
                <View style={[styles.stepDot, step <= currentStep && styles.stepDotActive]}>
                    <Text style={[styles.stepDotText, step <= currentStep && styles.stepDotTextActive]}>
                        {step}
                    </Text>
                </View>
                {step < 3 && (
                    <View style={[styles.stepLine, step < currentStep && styles.stepLineActive]} />
                )}
            </React.Fragment>
        ))}
    </View>
);

// ─── Step 1: Media ───────────────────────────────────────────────────────────
const MediaStep = ({
    selected, onAdd, onRemove
}: {
    selected: string[];
    onAdd: (uris: string[]) => void;
    onRemove: (uri: string) => void;
}) => {
    const pickImages = async () => {
        if (selected.length >= 10) {
            Alert.alert('Maximum reached', 'You can select up to 10 photos.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsMultipleSelection: true,
            quality: 0.85,
            selectionLimit: 10 - selected.length
        });

        if (!result.canceled) {
            onAdd(result.assets.map(a => a.uri));
        }
    };

    const takePhoto = async () => {
        const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
        if (!result.canceled) {
            onAdd([result.assets[0].uri]);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.mediaGrid}>
            {/* Add buttons */}
            <Pressable style={styles.mediaPlaceholder} onPress={pickImages}>
                <Ionicons name="images-outline" size={28} color={colors.textSecond} />
                <Text style={styles.mediaPlaceholderText}>Gallery</Text>
            </Pressable>

            <Pressable style={styles.mediaPlaceholder} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={28} color={colors.textSecond} />
                <Text style={styles.mediaPlaceholderText}>Camera</Text>
            </Pressable>

            {/* Selected images */}
            {selected.map((uri, index) => (
                <View key={uri} style={styles.mediaItem}>
                    <Image source={{ uri }} style={styles.mediaThumbnail} />
                    {index === 0 && (
                        <View style={styles.coverBadge}>
                            <Text style={styles.coverBadgeText}>COVER</Text>
                        </View>
                    )}
                    <Pressable style={styles.removeBtn} onPress={() => onRemove(uri)}>
                        <Ionicons name="close-circle" size={22} color={colors.error} />
                    </Pressable>
                </View>
            ))}

            {selected.length === 0 && (
                <View style={styles.emptyHint}>
                    <Text style={styles.emptyHintText}>Select up to 10 photos or videos</Text>
                </View>
            )}
        </ScrollView>
    );
};

// ─── Step 2: Details ─────────────────────────────────────────────────────────
const DetailsStep = ({
    caption, setCaption,
    postType, setPostType,
    taggedGarmentIds, setTaggedGarmentIds,
    location, setLocation
}: any) => {
    const [garmentSearch, setGarmentSearch] = useState('');

    const filtered = MOCK_GARMENTS.filter(g =>
        g.title.toLowerCase().includes(garmentSearch.toLowerCase())
    );

    const toggleGarment = (id: string) => {
        setTaggedGarmentIds((prev: string[]) =>
            prev.includes(id) ? prev.filter((x: string) => x !== id) : [...prev, id]
        );
    };

    return (
        <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Caption */}
            <Text style={styles.fieldLabel}>Caption</Text>
            <TextInput
                style={styles.captionInput}
                multiline
                placeholder="Share your story..."
                placeholderTextColor={colors.textMuted}
                value={caption}
                onChangeText={setCaption}
                maxLength={500}
            />
            <Text style={styles.charCount}>{caption.length}/500</Text>

            {/* Hashtag suggestions */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hashtagRow}>
                {HASHTAG_SUGGESTIONS.map(tag => (
                    <Pressable key={tag} style={styles.hashtagChip} onPress={() => setCaption((c: string) => c + ' ' + tag)}>
                        <Text style={styles.hashtagChipText}>{tag}</Text>
                    </Pressable>
                ))}
            </ScrollView>

            {/* Post Type */}
            <Text style={styles.fieldLabel}>Post Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
                {POST_TYPES.map(type => (
                    <Pressable
                        key={type}
                        style={[styles.typeChip, postType === type && styles.typeChipActive]}
                        onPress={() => setPostType(type)}
                    >
                        <Text style={[styles.typeChipText, postType === type && styles.typeChipTextActive]}>
                            {POST_TYPE_LABELS[type]}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>

            {/* Tag Garments */}
            <Text style={styles.fieldLabel}>Tag Garments</Text>
            <TextInput
                style={styles.searchInput}
                placeholder="Search your listings..."
                placeholderTextColor={colors.textMuted}
                value={garmentSearch}
                onChangeText={setGarmentSearch}
            />
            {filtered.map(g => (
                <Pressable key={g.id} style={styles.garmentRow} onPress={() => toggleGarment(g.id)}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.garmentTitle}>{g.title}</Text>
                        <Text style={styles.garmentBrand}>{g.brand}</Text>
                    </View>
                    <Ionicons
                        name={taggedGarmentIds.includes(g.id) ? 'checkmark-circle' : 'add-circle-outline'}
                        size={22}
                        color={taggedGarmentIds.includes(g.id) ? colors.gold : colors.textMuted}
                    />
                </Pressable>
            ))}

            {/* Location */}
            <Text style={styles.fieldLabel}>Location (optional)</Text>
            <TextInput
                style={styles.searchInput}
                placeholder="Add location..."
                placeholderTextColor={colors.textMuted}
                value={location}
                onChangeText={setLocation}
            />
        </ScrollView>
    );
};

// ─── Step 3: Preview ─────────────────────────────────────────────────────────
const PreviewStep = ({ images, caption, postType, location }: any) => (
    <ScrollView showsVerticalScrollIndicator={false}>
        {/* Mock post card preview */}
        <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
                <View style={styles.previewAvatarPlaceholder} />
                <View>
                    <Text style={styles.previewUsername}>@you</Text>
                    <Text style={styles.previewLocation}>{location || 'Your Location'}</Text>
                </View>
            </View>

            {images.length > 0 ? (
                <Image source={{ uri: images[0] }} style={styles.previewImage} />
            ) : (
                <View style={[styles.previewImage, styles.previewImageEmpty]}>
                    <Ionicons name="image-outline" size={48} color={colors.textMuted} />
                </View>
            )}

            <View style={styles.previewTypeBadge}>
                <Text style={styles.previewTypeBadgeText}>{POST_TYPE_LABELS[postType as PostType]}</Text>
            </View>

            <View style={styles.previewReactions}>
                <Ionicons name="heart-outline" size={22} color={colors.textPrimary} />
                <Ionicons name="chatbubble-outline" size={20} color={colors.textPrimary} style={{ marginLeft: spacing.md }} />
                <Ionicons name="arrow-redo-outline" size={20} color={colors.textPrimary} style={{ marginLeft: spacing.md }} />
            </View>

            <Text style={styles.previewCaption} numberOfLines={3}>
                {caption || 'Your caption will appear here...'}
            </Text>
        </View>
    </ScrollView>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────
export function CreatePostScreen() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [publishing, setPublishing] = useState(false);

    // Step 1
    const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
    // Step 2
    const [caption, setCaption] = useState('');
    const [postType, setPostType] = useState<PostType>('OUTFIT');
    const [taggedGarmentIds, setTaggedGarmentIds] = useState<string[]>([]);
    const [location, setLocation] = useState('');

    const STEP_TITLES = ['Select Media', 'Add Details', 'Preview'];

    const canProceed = () => {
        if (step === 1) return selectedMedia.length > 0;
        return true;
    };

    const handleNext = () => {
        if (step < 3) { setStep(s => s + 1); return; }
        publish();
    };

    const publish = async () => {
        setPublishing(true);
        try {
            // POST to /api/v1/social/posts — using mock here
            await new Promise(resolve => setTimeout(resolve, 1500));
            router.replace('/social');
        } catch {
            Alert.alert('Error', 'Failed to publish your post. Please try again.');
        } finally {
            setPublishing(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => step > 1 ? setStep(s => s - 1) : router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.headerTitle}>{STEP_TITLES[step - 1]}</Text>
                <View style={{ width: 24 }} />
            </View>

            <StepIndicator currentStep={step} />

            {/* Step Content */}
            <View style={styles.content}>
                {step === 1 && (
                    <MediaStep
                        selected={selectedMedia}
                        onAdd={uris => setSelectedMedia(prev => [...prev, ...uris].slice(0, 10))}
                        onRemove={uri => setSelectedMedia(prev => prev.filter(u => u !== uri))}
                    />
                )}
                {step === 2 && (
                    <DetailsStep
                        caption={caption} setCaption={setCaption}
                        postType={postType} setPostType={setPostType}
                        taggedGarmentIds={taggedGarmentIds} setTaggedGarmentIds={setTaggedGarmentIds}
                        location={location} setLocation={setLocation}
                    />
                )}
                {step === 3 && (
                    <PreviewStep
                        images={selectedMedia}
                        caption={caption}
                        postType={postType}
                        location={location}
                    />
                )}
            </View>

            {/* Footer CTA */}
            <View style={styles.footer}>
                <Pressable
                    style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
                    disabled={!canProceed() || publishing}
                    onPress={handleNext}
                >
                    {publishing ? (
                        <ActivityIndicator color={colors.bg} />
                    ) : (
                        <Text style={styles.nextBtnText}>
                            {step === 3 ? 'PUBLISH' : 'NEXT'}
                        </Text>
                    )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const ITEM_SIZE = (width - spacing.md * 2 - spacing.sm * 2) / 3;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 18 },

    stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
    stepDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgCard },
    stepDotActive: { backgroundColor: colors.gold, borderColor: colors.gold },
    stepDotText: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 12 },
    stepDotTextActive: { color: colors.bg },
    stepLine: { width: 40, height: 1, backgroundColor: colors.border },
    stepLineActive: { backgroundColor: colors.gold },

    content: { flex: 1 },

    // Step 1
    mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.sm },
    mediaPlaceholder: { width: ITEM_SIZE, height: ITEM_SIZE, backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
    mediaPlaceholderText: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10, marginTop: 4 },
    mediaItem: { width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: radius.md, overflow: 'hidden', position: 'relative' },
    mediaThumbnail: { width: '100%', height: '100%' },
    coverBadge: { position: 'absolute', top: 4, left: 4, backgroundColor: colors.gold, paddingHorizontal: 5, paddingVertical: 2, borderRadius: radius.sm },
    coverBadgeText: { color: colors.bg, fontFamily: typography.mono, fontSize: 8, fontWeight: 'bold' },
    removeBtn: { position: 'absolute', top: 2, right: 2 },
    emptyHint: { width: '100%', alignItems: 'center', paddingTop: spacing.xl },
    emptyHintText: { color: colors.textMuted, fontFamily: typography.body, fontSize: 13 },

    // Step 2
    detailsContainer: { flex: 1, padding: spacing.md },
    fieldLabel: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md },
    captionInput: { backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, fontFamily: typography.body, fontSize: 14, padding: spacing.md, minHeight: 100, textAlignVertical: 'top' },
    charCount: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10, textAlign: 'right', marginTop: 4 },
    hashtagRow: { flexGrow: 0, marginTop: spacing.sm },
    hashtagChip: { backgroundColor: colors.bgMuted, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.full, marginRight: spacing.sm },
    hashtagChipText: { color: colors.gold, fontFamily: typography.mono, fontSize: 11 },
    typeRow: { flexGrow: 0, marginBottom: spacing.xs },
    typeChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
    typeChipActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
    typeChipText: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 12 },
    typeChipTextActive: { color: colors.bg },
    searchInput: { backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, fontFamily: typography.body, fontSize: 14, padding: spacing.sm, paddingHorizontal: spacing.md },
    garmentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    garmentTitle: { color: colors.textPrimary, fontFamily: typography.body, fontSize: 13 },
    garmentBrand: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10, textTransform: 'uppercase' },

    // Step 3
    previewCard: { margin: spacing.md, backgroundColor: colors.bgCard, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
    previewHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.sm },
    previewAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgMuted },
    previewUsername: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 13, fontWeight: 'bold' },
    previewLocation: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10 },
    previewImage: { width: '100%', aspectRatio: 0.8 },
    previewImageEmpty: { backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
    previewTypeBadge: { position: 'absolute', top: 60, right: spacing.md, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
    previewTypeBadgeText: { color: colors.gold, fontFamily: typography.mono, fontSize: 9, textTransform: 'uppercase' },
    previewReactions: { flexDirection: 'row', padding: spacing.md },
    previewCaption: { color: colors.textSecond, fontFamily: typography.body, fontSize: 13, paddingHorizontal: spacing.md, paddingBottom: spacing.md, lineHeight: 20 },

    // Footer
    footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    nextBtn: { backgroundColor: colors.gold, borderRadius: radius.full, paddingVertical: spacing.md, alignItems: 'center' },
    nextBtnDisabled: { backgroundColor: colors.bgMuted, opacity: 0.5 },
    nextBtnText: { color: colors.bg, fontFamily: typography.mono, fontSize: 14, fontWeight: 'bold', letterSpacing: 2 }
});
