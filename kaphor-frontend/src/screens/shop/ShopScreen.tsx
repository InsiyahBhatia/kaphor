import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TextInput, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '../../theme';
import { GarmentCard } from '../../components/garment/GarmentCard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Header } from '../../components/common/Header';

// Dummy API call / fetch simulation
// In real app, we'd use useQuery (react-query) or axios inside a Service,
// hooked up to `GET /api/v1/garments/feed`
// Mocking the feed return format
import { Garment } from '../../types';

interface FeedResponse {
    data: (Garment & { fitScore?: number })[];
    pagination: {
        nextCursor: string | null;
    };
}

const numColumns = 2;

export function ShopScreen() {
    const router = useRouter();

    const [garments, setGarments] = useState<(Garment & { fitScore?: number })[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [fetchingMore, setFetchingMore] = useState(false);

    // Search & Filter state
    const [searchQuery, setSearchQuery] = useState('');
    // Assuming a few filter tabs based on requirements
    const filtersList = ["Filters", "Category ▾", "Material ▾", "Size ▾"];

    const width = Dimensions.get('window').width;
    const contentWidth = width - (spacing.md * 2);

    // Mock fetch function simulating api integration
    const fetchFeed = async (cursor: string | null = null, reset = false) => {
        try {
            setLoading(true);
            const response = await api.get('/garments/feed', {
                params: {
                    listingType: 'SALE',
                    after: cursor,
                    q: searchQuery
                }
            });

            const newItems = response.data.data;
            const pagination = response.data.pagination;

            setGarments(prev => reset ? newItems : [...prev, ...newItems]);
            setNextCursor(pagination?.nextCursor || null);
        } catch (error) {
            console.error('Failed to fetch garments', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setFetchingMore(false);
        }
    };

    useEffect(() => {
        fetchFeed(null, true);
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchFeed(null, true);
    }, []);

    const loadMore = () => {
        if (fetchingMore || !nextCursor || loading) return;
        setFetchingMore(true);
        fetchFeed(nextCursor, false);
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <Header title="Shop" unreadCount={2} />
            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search luxury vintage..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer} contentContainerStyle={styles.filtersContent}>
                {filtersList.map((filter, index) => (
                    <Pressable key={index} style={[styles.filterChip, index === 0 && styles.filterChipOutline]}>
                        {index === 0 && <Ionicons name="options-outline" size={14} color={colors.textPrimary} style={{ marginRight: 4 }} />}
                        <Text style={styles.filterText}>{filter}</Text>
                    </Pressable>
                ))}
            </ScrollView>

            {/* Section Header */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>CURATED FOR YOU</Text>
                <Pressable>
                    <Text style={styles.viewAll}>View All</Text>
                </Pressable>
            </View>
        </View>
    );

    const renderFooter = () => {
        if (!fetchingMore) return <View style={{ height: spacing.xl }} />;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.gold} />
            </View>
        );
    };

    const renderSkeleton = () => (
        <View style={styles.skeletonContainer}>
            {renderHeader()}
            <View style={styles.skeletonGrid}>
                {Array.from({ length: 6 }).map((_, i) => (
                    <View key={i} style={[styles.skeletonCard, { width: (width / 2) - spacing.md }]} />
                ))}
            </View>
        </View>
    );

    if (loading && !refreshing && garments.length === 0) {
        return (
            <SafeAreaView style={styles.safeArea}>
                {renderSkeleton()}
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <FlatList
                data={garments}
                keyExtractor={(item) => item.id}
                numColumns={numColumns}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <GarmentCard
                        item={item}
                        onPress={() => router.push(`/garment/${item.id}`)}
                    />
                )}
                ListHeaderComponent={renderHeader}
                ListFooterComponent={renderFooter}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.gold}
                        colors={[colors.crimson]}
                    />
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    listContent: {
        paddingHorizontal: spacing.sm,
    },
    row: {
        justifyContent: 'space-between',
    },
    headerContainer: {
        paddingHorizontal: spacing.sm,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCard,
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        height: 48,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchIcon: {
        marginRight: spacing.sm,
    },
    searchInput: {
        flex: 1,
        color: colors.textPrimary,
        fontFamily: typography.body,
        fontSize: 14,
        height: '100%',
    },
    filtersContainer: {
        marginBottom: spacing.lg,
    },
    filtersContent: {
        gap: spacing.sm,
        paddingRight: spacing.md,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgMuted,
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
    },
    filterChipOutline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterText: {
        color: colors.textPrimary,
        fontFamily: typography.mono,
        fontSize: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    sectionTitle: {
        color: colors.textPrimary,
        fontFamily: typography.mono,
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    viewAll: {
        color: colors.textSecond,
        fontFamily: typography.body,
        fontSize: 12,
        textDecorationLine: 'underline',
    },
    footerLoader: {
        paddingVertical: spacing.lg,
        alignItems: 'center',
    },
    // Skeleton Styles
    skeletonContainer: {
        flex: 1,
    },
    skeletonGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.sm,
        gap: spacing.sm,
    },
    skeletonCard: {
        height: 250,
        backgroundColor: colors.bgCard,
        borderRadius: radius.md,
        marginBottom: spacing.md,
        opacity: 0.5,
    },
});
