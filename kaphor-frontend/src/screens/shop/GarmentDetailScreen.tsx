import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { KaphorImage } from '../../components/KaphorImage';
import { colors, typography, spacing, radius } from '../../theme';
import { Garment } from '../../types';

// Mock types and API helpers (replace with real api integration later)
const { width } = Dimensions.get('window');

export function GarmentDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [garment, setGarment] = useState<(Garment & { fitScore?: number, fitBreakdown?: any, seller?: any, material?: string[], lifecycleState?: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaved, setIsSaved] = useState(false);
    const [viewSent, setViewSent] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        // Mock fetch for garment details
        const fetchGarment = async () => {
            try {
                await new Promise(resolve => setTimeout(resolve, 600)); // Simulate latency
                // Mock data
                setGarment({
                    id: id as string,
                    sellerId: 'user123',
                    brand: 'CHANEL',
                    title: 'Vintage Double Flap Bag',
                    price: 5400,
                    description: 'A timeless classic. This vintage Chanel double flap bag in black lambskin features 24k gold plated hardware. Pristine condition with minimal signs of wear on the corners. Comes with original dustbag and authenticity card.',
                    images: [
                        'https://picsum.photos/seed/img1/600/800',
                        'https://picsum.photos/seed/img2/600/800',
                        'https://picsum.photos/seed/img3/600/800'
                    ],
                    fitScore: 0.98,
                    fitBreakdown: { colorMatch: 'High', sizeMatch: 'Exact', styleMatch: 'Excellent' },
                    condition: 'PRISTINE',
                    material: ['Lambskin Leather', 'Gold Hardware'],
                    lifecycleState: 'LISTED',
                    listingType: 'SALE',
                    seller: { name: 'Vintage Vault', avatar: 'https://picsum.photos/seed/avatar1/100/100', tier: 'ELITE' },
                    category: 'Bags',
                    size: 'OS',
                    color: ['Black', 'Gold'],
                    styleTags: ['Vintage', 'Classic'],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    isActive: true,
                    garmentVector: [],
                    popularityScore: 0,
                    diversityScore: 0,
                    tags: []
                } as any);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchGarment();
    }, [id]);

    const handleScroll = (event: any) => {
        const scrollY = event.nativeEvent.contentOffset.y;
        // Trigger VIEW event once user scrolls past 100px indicating engagement
        if (scrollY > 100 && !viewSent && garment) {
            setViewSent(true);
            trackInteraction('VIEW');
        }
    };

    const trackInteraction = async (type: string) => {
        // Mock API Call: POST /api/v1/interactions
        console.log(`Sending ${type} event for garment ${id}`);
        /* 
        await axios.post('/api/v1/interactions', { 
          garmentId: id, 
          eventType: type 
        });
        */
    };

    const handleSaveToggle = () => {
        setIsSaved(prev => !prev);
        trackInteraction('SAVE');
    };

    const handleBuyNow = () => {
        // Navigate to checkout flow
        console.log("Navigating to checkout for", id);
        // router.push(`/checkout/${id}`);
    };

    if (loading || !garment) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={colors.gold} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView
                ref={scrollViewRef}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* Full-width Image Carousel */}
                <View style={styles.carouselContainer}>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={(e) => {
                            setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / width));
                        }}
                    >
                        {garment.images.map((img, i) => (
                            <KaphorImage
                                key={i}
                                uri={img}
                                style={{ width, height: width * 1.33 }} // 3:4 aspect ratio
                                contentFit="cover"
                            />
                        ))}
                    </ScrollView>

                    {/* Pagination Dots */}
                    <View style={styles.paginationDots}>
                        {garment.images.map((_, i) => (
                            <View
                                key={i}
                                style={[styles.dot, activeImageIndex === i && styles.activeDot]}
                            />
                        ))}
                    </View>

                    {/* Floating Navigation */}
                    <View style={styles.navTop}>
                        <Pressable style={styles.navButton} onPress={() => router.back()}>
                            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                        </Pressable>
                        <Pressable style={styles.navButton}>
                            <Ionicons name="share-outline" size={24} color={colors.textPrimary} />
                        </Pressable>
                    </View>
                </View>

                {/* Details Segment */}
                <View style={styles.content}>
                    <Text style={styles.brand}>{garment.brand}</Text>
                    <Text style={styles.title}>{garment.title}</Text>
                    <Text style={styles.price}>₹{garment.price?.toLocaleString() ?? 0}</Text>

                    {/* Fit Score Badge with Breakdown */}
                    {garment.fitScore !== undefined && (
                        <View style={styles.fitBadgeContainer}>
                            <View style={styles.primaryFitBadge}>
                                <Ionicons name="sparkles" size={16} color={colors.textPrimary} />
                                <Text style={styles.fitBadgeText}>{Math.round(garment.fitScore * 100)}% FIT</Text>
                            </View>
                            <View style={styles.subFitContainer}>
                                <Text style={styles.subFitText}>Color: {garment.fitBreakdown?.colorMatch}</Text>
                                <Text style={styles.subFitText}>Size: {garment.fitBreakdown?.sizeMatch}</Text>
                                <Text style={styles.subFitText}>Style: {garment.fitBreakdown?.styleMatch}</Text>
                            </View>
                        </View>
                    )}

                    {/* Condition and Traits */}
                    <View style={styles.traitsRow}>
                        <View style={styles.conditionBadge}>
                            <Text style={styles.conditionText}>{garment.condition.replace('_', ' ')}</Text>
                        </View>
                        {garment.lifecycleState === 'LISTED' && (
                            <Text style={styles.lifecycleText}>Freshly Curated</Text>
                        )}
                    </View>

                    <View style={styles.separator} />

                    {/* Description */}
                    <Text style={styles.sectionTitle}>DESCRIPTION</Text>
                    <Text style={styles.description}>{garment.description}</Text>

                    {/* Materials */}
                    <View style={styles.materialContainer}>
                        {garment.material?.map((mat: string, i: number) => (
                            <View key={i} style={styles.materialChip}>
                                <Text style={styles.materialText}>{mat}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.separator} />

                    {/* Seller Profile Row */}
                    {garment.seller && (
                        <Pressable style={styles.sellerRow}>
                            <KaphorImage
                                uri={garment.seller.avatar}
                                style={styles.sellerAvatar}
                                contentFit="cover"
                            />
                            <View style={styles.sellerInfo}>
                                <Text style={styles.sellerName}>{garment.seller.name}</Text>
                                <Text style={styles.sellerTier}>{garment.seller.tier} SELLER</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                        </Pressable>
                    )}

                </View>
            </ScrollView>

            {/* Sticky Bottom Footer */}
            <View style={styles.bottomFooter}>
                <Pressable style={styles.saveFooterButton} onPress={handleSaveToggle}>
                    <Ionicons
                        name={isSaved ? "heart" : "heart-outline"}
                        size={28}
                        color={isSaved ? colors.crimson : colors.textPrimary}
                    />
                    <Text style={styles.saveText}>{isSaved ? 'Saved' : 'Save'}</Text>
                </Pressable>
                <Pressable style={styles.buyButton} onPress={handleBuyNow}>
                    <Text style={styles.buyButtonText}>BUY NOW - ₹{garment.price?.toLocaleString() ?? 0}</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    loaderContainer: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
    carouselContainer: { position: 'relative' },
    paginationDots: { position: 'absolute', bottom: spacing.md, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
    activeDot: { backgroundColor: colors.textPrimary, width: 8, height: 8, borderRadius: 4 },
    navTop: { position: 'absolute', top: 50, left: spacing.md, right: spacing.md, flexDirection: 'row', justifyContent: 'space-between' },
    navButton: { backgroundColor: 'rgba(26,12,16,0.6)', padding: 10, borderRadius: 20 },
    content: { padding: spacing.lg },
    brand: { color: colors.gold, fontFamily: typography.mono, fontSize: 12, textTransform: 'uppercase', marginBottom: spacing.xs, letterSpacing: 1 },
    title: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 26, marginBottom: spacing.sm },
    price: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 18, marginBottom: spacing.lg },
    fitBadgeContainer: { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    primaryFitBadge: { backgroundColor: colors.crimson, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, marginRight: spacing.md },
    fitBadgeText: { color: colors.textPrimary, fontFamily: typography.mono, fontWeight: 'bold', fontSize: 14, marginLeft: spacing.xs },
    subFitContainer: { flex: 1 },
    subFitText: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 10, marginBottom: 2 },
    traitsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
    conditionBadge: { backgroundColor: colors.bgMuted, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
    conditionText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 12 },
    lifecycleText: { color: colors.gold, fontFamily: typography.body, fontSize: 12, fontStyle: 'italic' },
    separator: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
    sectionTitle: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 12, letterSpacing: 1, marginBottom: spacing.sm },
    description: { color: colors.textPrimary, fontFamily: typography.body, fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
    materialContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    materialChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
    materialText: { color: colors.textSecond, fontFamily: typography.body, fontSize: 12 },
    sellerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, padding: spacing.md, borderRadius: radius.md },
    sellerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: spacing.md },
    sellerInfo: { flex: 1 },
    sellerName: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 18 },
    sellerTier: { color: colors.gold, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1, marginTop: 2 },
    bottomFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: 40 },
    saveFooterButton: { alignItems: 'center', marginRight: spacing.lg, minWidth: 50 },
    saveText: { color: colors.textPrimary, fontFamily: typography.body, fontSize: 10, marginTop: 4 },
    buyButton: { flex: 1, backgroundColor: colors.gold, paddingVertical: 16, borderRadius: radius.full, alignItems: 'center' },
    buyButtonText: { color: colors.bg, fontFamily: typography.mono, fontSize: 14, fontWeight: 'bold' }
});
