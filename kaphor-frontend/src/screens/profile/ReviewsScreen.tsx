import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SolarIcon } from '../../components/common/SolarIcon';
import { userService } from '../../services/userService';
import { colors, typography, spacing, radius, textStyles } from '../../theme';
import { safeBack, useBackHandler } from '../../utils/navigation';
import { KaphorImage } from '../../components/KaphorImage';
import { Loader } from '../../components/common/Loader';

const ReviewCard = React.memo(function ReviewCard({ item }: { item: any }) {
    const reviewer = item.reviewer;
    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <KaphorImage 
                    uri={reviewer?.avatar || ''} 
                    style={styles.avatar} 
                    contentFit="cover"
                />
                <View style={styles.reviewerInfo}>
                    <Text style={styles.reviewerName}>{reviewer?.displayName || 'Anonymous User'}</Text>
                    <Text style={styles.reviewerUsername}>@{reviewer?.username || 'member'}</Text>
                </View>
                <View style={styles.ratingBadge}>
                    <SolarIcon name="star" size={12} color={colors.gold} />
                    <Text style={styles.ratingText}>{item.rating}</Text>
                </View>
            </View>
            {item.comment ? (
                <Text style={styles.commentText}>{item.comment}</Text>
            ) : null}
            <Text style={styles.dateText}>
                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
            </Text>
        </View>
    );
});

export function ReviewsScreen() {
    const router = useRouter();
    const { userId } = useLocalSearchParams<{ userId: string }>();
    useBackHandler('/(tabs)/profile');
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const handleBack = () => {
        try {
            if (router.canGoBack()) {
                router.back();
                return;
            }
        } catch {}
        router.replace('/(tabs)/profile');
    };

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                const idToFetch = userId || 'me';
                let resolvedTargetId = idToFetch;
                let data = [];
                if (idToFetch === 'me') {
                    const me = await userService.getMe();
                    resolvedTargetId = me?.id || '';
                    data = await userService.getUserReviews(resolvedTargetId);
                } else {
                    data = await userService.getUserReviews(idToFetch);
                }

                // Defensive filter: never show reviews authored by the profile subject
                const peerReviewsOnly = (Array.isArray(data) ? data : []).filter(
                    (r: any) => r.reviewer?.id !== resolvedTargetId
                );
                
                setReviews(peerReviewsOnly);
            } catch (err) {
                console.error('Failed to fetch reviews', err);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, [userId]);

    const renderItem = useCallback(({ item }: { item: any }) => <ReviewCard item={item} />, []);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Pressable accessibilityRole="button" accessibilityLabel="Go back" 
                    onPress={handleBack} 
                    style={styles.backBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <SolarIcon name="arrow-back" size={24} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.headerTitle}>COMMUNITY REVIEWS</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <Loader variant="default" layout="reviews" compact />
            ) : reviews.length === 0 ? (
                <View style={styles.center}>
                    <SolarIcon name="star-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyText}>No verified reviews yet.</Text>
                    <Pressable
                        onPress={handleBack}
                        style={{ marginTop: 20, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.charcoal, borderRadius: 6 }}
                    >
                        <Text style={{ color: colors.white, fontFamily: typography.mono, fontSize: 12, letterSpacing: 1 }}>RETURN TO PROFILE</Text>
                    </Pressable>
                </View>
            ) : (
                <FlatList
                    data={reviews}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    initialNumToRender={8}
                    windowSize={7}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: {
      ...textStyles.screenTitle,
      color: colors.textPrimary,
    },
    
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    emptyText: { color: colors.textMuted, fontFamily: typography.body, marginTop: spacing.md, textAlign: 'center' },
    
    listContent: { padding: spacing.md, gap: spacing.md },
    card: { backgroundColor: colors.bgCard, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
    
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgMuted },
    reviewerInfo: { flex: 1, marginLeft: spacing.sm },
    reviewerName: { color: colors.textPrimary, fontFamily: typography.body, fontSize: 14, fontWeight: 'bold' },
    reviewerUsername: { color: colors.textMuted, fontFamily: typography.handwritten, fontSize: 14, includeFontPadding: false },
    
    ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
    ratingText: { color: colors.gold, fontFamily: typography.mono, fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    
    commentText: { color: colors.textPrimary, fontFamily: typography.body, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
    dateText: { color: colors.textMuted, fontFamily: typography.handwritten, fontSize: 13, textAlign: 'right', includeFontPadding: false },
});
