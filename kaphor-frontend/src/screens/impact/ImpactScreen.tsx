import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { KaphorImage } from '../../components/KaphorImage';
import { colors, typography, spacing, radius } from '../../theme';

const { width } = Dimensions.get('window');

// A minimalist animated number counter
const AnimatedNumber = ({ endValue, duration = 1500 }: { endValue: number, duration?: number }) => {
    const [value, setValue] = useState(0);

    useEffect(() => {
        let startTime: number;
        let animationFrame: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);

            // ease-out cubic
            const easeOut = 1 - Math.pow(1 - percentage, 3);
            setValue(Math.floor(endValue * easeOut));

            if (percentage < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                setValue(endValue);
            }
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [endValue, duration]);

    return <Text style={styles.numberLarge}>{value}</Text>;
};

export function ImpactScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        // Mock fetch /api/v1/impact/me
        setTimeout(() => {
            setData({
                user: {
                    displayName: 'Aria Thorne',
                    avatar: 'https://picsum.photos/seed/aria/200',
                    createdAt: '2023-01-15T00:00:00.000Z'
                },
                tier: 'ELITE',
                progressPercentage: 100,
                nextTierKgRemaining: 0,
                impactRecord: {
                    carbonSavedKg: 165,
                    waterSavedL: 14200,
                    itemsCirculated: 32
                },
                equivalentTrees: 18,
                nextMilestone: "You've reached the pinnacle of sustainable fashion."
            });
            setLoading(false);
        }, 800);
    }, []);

    if (loading || !data) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} onPress={() => router.back()} />
                    <Text style={styles.headerTitle}>KAPHOR IMPACT</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.loader}>
                    <ActivityIndicator color={colors.gold} size="large" />
                </View>
            </SafeAreaView>
        );
    }

    const { user, tier, progressPercentage, impactRecord, equivalentTrees, nextMilestone } = data;
    const joinYear = new Date(user.createdAt).getFullYear();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Ionicons name="arrow-back" size={24} color={colors.textPrimary} onPress={() => router.back()} style={styles.backBtn} />
                <Text style={styles.headerTitle}>KAPHOR IMPACT</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* User Avatar & Tier Segment */}
                <View style={styles.profileSection}>
                    <View style={styles.avatarWrapper}>
                        <KaphorImage uri={user.avatar} style={styles.avatar} />
                        <View style={styles.tierBadge}>
                            <Text style={styles.tierText}>{tier}</Text>
                        </View>
                    </View>
                    <Text style={styles.displayName}>{user.displayName}</Text>
                    <Text style={styles.subtitle}>CIRCULAR VISIONARY · {joinYear}</Text>
                </View>

                {/* Carbon Offset Visualizer */}
                <View style={styles.carbonCard}>
                    <Text style={styles.carbonLabel}>TOTAL CARBON OFFSET</Text>
                    <View style={styles.carbonRow}>
                        <AnimatedNumber endValue={impactRecord.carbonSavedKg} />
                        <Text style={styles.carbonUnit}>kg CO₂</Text>
                    </View>

                    <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
                    </View>

                    {tier !== 'ELITE' && (
                        <Text style={styles.progressText}>{data.nextTierKgRemaining.toFixed(1)}kg to next tier</Text>
                    )}
                </View>

                {/* Circular Stats Twin Cards */}
                <View style={styles.twinCardsRow}>
                    <View style={styles.twinCard}>
                        <Ionicons name="water-outline" size={24} color={colors.success} style={{ marginBottom: 8 }} />
                        <AnimatedNumber endValue={Math.floor(impactRecord.waterSavedL / 1000)} />
                        <Text style={styles.twinCardLabel}>K Liters Water Saved</Text>
                    </View>

                    <View style={styles.twinCard}>
                        <Ionicons name="infinite-outline" size={24} color={colors.gold} style={{ marginBottom: 8 }} />
                        <AnimatedNumber endValue={impactRecord.itemsCirculated} />
                        <Text style={styles.twinCardLabel}>Items Circulated</Text>
                    </View>
                </View>

                {/* Environmental Equivalent */}
                <View style={styles.equivalentCard}>
                    <Ionicons name="leaf" size={32} color={colors.success} style={{ marginBottom: spacing.sm }} />
                    <Text style={styles.eqTitle}>Nature Equivalent</Text>
                    <Text style={styles.eqDesc}>
                        Your cumulative footprint reduction is equivalent to planting <Text style={{ color: colors.gold, fontWeight: 'bold' }}>{equivalentTrees} French Oak trees</Text>.
                    </Text>
                </View>

                {/* Next Milestone */}
                <View style={styles.milestoneCard}>
                    <Ionicons name="flag-outline" size={20} color={colors.textPrimary} />
                    <View style={{ marginLeft: spacing.md, flex: 1 }}>
                        <Text style={styles.milestoneTitle}>Next Milestone</Text>
                        <Text style={styles.milestoneDesc}>{nextMilestone}</Text>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 18, letterSpacing: 2 },
    backBtn: { padding: spacing.xs },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    scrollContent: { paddingBottom: spacing.xxl },

    profileSection: { alignItems: 'center', paddingVertical: spacing.xl },
    avatarWrapper: { position: 'relative', marginBottom: spacing.md },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: colors.gold },
    tierBadge: { position: 'absolute', bottom: -10, alignSelf: 'center', backgroundColor: colors.gold, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full, borderWidth: 2, borderColor: colors.bg },
    tierText: { color: colors.bg, fontFamily: typography.mono, fontSize: 10, fontWeight: 'bold' },
    displayName: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 24, marginBottom: 4 },
    subtitle: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1 },

    carbonCard: { marginHorizontal: spacing.md, backgroundColor: colors.bgCard, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    carbonLabel: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 12, letterSpacing: 1, marginBottom: spacing.md },
    carbonRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.lg },
    numberLarge: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 48, fontWeight: 'bold' },
    carbonUnit: { color: colors.textSecond, fontFamily: typography.body, fontSize: 18, marginLeft: spacing.sm },
    progressContainer: { width: '100%', height: 6, backgroundColor: colors.bgMuted, borderRadius: 3, overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: colors.gold, borderRadius: 3 },
    progressText: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10, marginTop: spacing.sm },

    twinCardsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, marginTop: spacing.md, gap: spacing.md },
    twinCard: { flex: 1, backgroundColor: colors.bgCard, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    twinCardLabel: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 10, textTransform: 'uppercase', marginTop: spacing.sm, textAlign: 'center' },

    equivalentCard: { margin: spacing.md, backgroundColor: colors.bgMuted, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
    eqTitle: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 20, marginBottom: spacing.sm },
    eqDesc: { color: colors.textSecond, fontFamily: typography.body, fontSize: 14, textAlign: 'center', lineHeight: 22 },

    milestoneCard: { marginHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
    milestoneTitle: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 12, textTransform: 'uppercase', marginBottom: 2 },
    milestoneDesc: { color: colors.textSecond, fontFamily: typography.body, fontSize: 12 }
});
