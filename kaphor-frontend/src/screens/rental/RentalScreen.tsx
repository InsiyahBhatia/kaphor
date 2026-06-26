import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { KaphorImage } from '../../components/KaphorImage';
import { colors, typography, spacing, radius } from '../../theme';
import { Garment } from '../../types';

import { api } from '../../services/api';

const { width } = Dimensions.get('window');

const CATEGORIES = ['Sarees', 'Lehengas', 'Sherwanis', 'Suits'];
const FILTER_CHIPS = ['Banarasi Silk', 'Chikankari', 'Zardosi', 'Silk', 'Cotton'];

export function RentalScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [garments, setGarments] = useState<Garment[]>([]);

    const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
    const [activeFilter, setActiveFilter] = useState<string | null>(null);

    // Mock Date Selection State
    const [selectedDates, setSelectedDates] = useState('Oct 12 - Oct 15');

    useEffect(() => {
        const fetchRentals = async () => {
            setLoading(true);
            try {
                const response = await api.get('/rentals/available', {
                    params: {
                        category: activeCategory,
                        // Add filters here if backend supports them
                    }
                });
                
                let data = response.data.data;

                // Simple local filtering for chips if needed
                if (activeFilter) {
                    data = data.filter((g: any) => 
                        g.fabric?.toLowerCase().includes(activeFilter.toLowerCase()) ||
                        g.pattern?.toLowerCase().includes(activeFilter.toLowerCase()) ||
                        g.style?.toLowerCase().includes(activeFilter.toLowerCase())
                    );
                }

                setGarments(data);
                setLoading(false);
            } catch (error) {
                console.error('Failed to fetch rentals:', error);
                setLoading(false);
            }
        };

        fetchRentals();
    }, [activeCategory, activeFilter]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>

            <View style={styles.header}>
                <Text style={styles.headerTitle}>THE HERITAGE RENTAL COLLECTION</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Date Picker Mock */}
                <View style={styles.datePickerCard}>
                    <Text style={styles.dateLabel}>Reserve Your Dates</Text>
                    <Pressable style={styles.dateSelector}>
                        <Ionicons name="calendar-outline" size={20} color={colors.textPrimary} />
                        <Text style={styles.dateText}>{selectedDates}</Text>
                        <Ionicons name="pencil" size={16} color={colors.textSecond} />
                    </Pressable>
                    <View style={styles.liveAvailabilityRow}>
                        <View style={styles.dot} />
                        <Text style={styles.liveAvailabilityText}>Live availability mapped</Text>
                    </View>
                </View>

                {/* Categories */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContainer}>
                    {CATEGORIES.map(cat => (
                        <Pressable
                            key={cat}
                            style={[styles.tabButton, activeCategory === cat && styles.tabButtonActive]}
                            onPress={() => setActiveCategory(cat)}
                        >
                            <Text style={[styles.tabText, activeCategory === cat && styles.tabTextActive]}>{cat}</Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {/* Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContainer}>
                    {FILTER_CHIPS.map(chip => (
                        <Pressable
                            key={chip}
                            style={[styles.chip, activeFilter === chip && styles.chipActive]}
                            onPress={() => setActiveFilter(activeFilter === chip ? null : chip)}
                        >
                            <Text style={[styles.chipText, activeFilter === chip && styles.chipTextActive]}>{chip}</Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {/* Product Grid */}
                {loading ? (
                    <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 40 }} />
                ) : (
                    <View style={styles.grid}>
                        {garments.map(garment => (
                            <Pressable
                                key={garment.id}
                                style={styles.gridItem}
                                onPress={() => router.push(`/garment/${garment.id}`)} // Route generic logic adaptable to rentals
                            >
                                <View style={styles.imageContainer}>
                                    <KaphorImage uri={garment.images[0]} style={styles.image} contentFit="cover" />

                                    {/* Badges */}
                                    <View style={styles.badgeContainer}>
                                        {(garment as any).isAvailableNow && (
                                            <View style={styles.badgeAvailable}>
                                                <Text style={styles.badgeText}>AVAILABLE NOW</Text>
                                            </View>
                                        )}
                                        {(garment as any).isLastPiece && (
                                            <View style={styles.badgeLastPiece}>
                                                <Text style={styles.badgeTextDark}>LAST PIECE</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                <View style={styles.detailsContainer}>
                                    <Text style={styles.brandText} numberOfLines={1}>{garment.brand}</Text>
                                    <Text style={styles.titleText} numberOfLines={1}>{garment.title}</Text>

                                    <View style={styles.priceRow}>
                                        <Text style={styles.priceText}>₹{(garment.rentalPriceDay! / 100).toLocaleString()}</Text>
                                        <Text style={styles.priceSuffix}>/ day</Text>
                                        <View style={{ flex: 1 }} />
                                        <View style={styles.rentLabel}>
                                            <Text style={styles.rentLabelText}>RENT</Text>
                                        </View>
                                    </View>
                                </View>
                            </Pressable>
                        ))}

                        {garments.length === 0 && (
                            <Text style={styles.emptyText}>No pieces available for selected dates.</Text>
                        )}
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    header: { padding: spacing.md, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { color: colors.gold, fontFamily: typography.headings, fontSize: 18, letterSpacing: 2, textAlign: 'center' },

    scrollContent: { paddingBottom: 100 },

    datePickerCard: { margin: spacing.md, backgroundColor: colors.bgCard, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    dateLabel: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1, marginBottom: spacing.md },
    dateSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgMuted, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full },
    dateText: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 18, marginHorizontal: spacing.sm },
    liveAvailabilityRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success, marginRight: 6 },
    liveAvailabilityText: { color: colors.success, fontFamily: typography.mono, fontSize: 10, textTransform: 'uppercase' },

    tabsScroll: { flexGrow: 0 },
    tabsContainer: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    tabButton: { paddingBottom: spacing.xs, marginRight: spacing.lg },
    tabButtonActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
    tabText: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
    tabTextActive: { color: colors.textPrimary },

    filtersScroll: { flexGrow: 0, marginTop: spacing.sm, marginBottom: spacing.lg },
    filtersContainer: { paddingHorizontal: spacing.md },
    chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
    chipActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
    chipText: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 10 },
    chipTextActive: { color: colors.bg },

    grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.xs },
    gridItem: { width: '50%', padding: spacing.xs, marginBottom: spacing.md },
    imageContainer: { width: '100%', aspectRatio: 0.7, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.bgCard, position: 'relative' },
    image: { width: '100%', height: '100%' },

    badgeContainer: { position: 'absolute', top: 8, left: 8, right: 8, gap: 4, alignItems: 'flex-start' },
    badgeAvailable: { backgroundColor: colors.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
    badgeLastPiece: { backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
    badgeText: { color: colors.bg, fontFamily: typography.mono, fontSize: 8, fontWeight: 'bold' },
    badgeTextDark: { color: colors.bg, fontFamily: typography.mono, fontSize: 8, fontWeight: 'bold' },

    detailsContainer: { marginTop: spacing.sm },
    brandText: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 10, textTransform: 'uppercase', marginBottom: 2 },
    titleText: { color: colors.textPrimary, fontFamily: typography.body, fontSize: 12, marginBottom: 4 },

    priceRow: { flexDirection: 'row', alignItems: 'center' },
    priceText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 12, fontWeight: 'bold' },
    priceSuffix: { color: colors.textMuted, fontFamily: typography.body, fontSize: 10, marginLeft: 2 },

    rentLabel: { backgroundColor: colors.bgMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
    rentLabelText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 8, letterSpacing: 1 },

    emptyText: { color: colors.textMuted, fontFamily: typography.body, fontSize: 14, textAlign: 'center', width: '100%', marginTop: spacing.xl }
});
