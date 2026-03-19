import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, ScrollView,
    Pressable, ActivityIndicator, RefreshControl, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { KaphorImage } from '../../components/KaphorImage';
import { colors, typography, spacing, radius } from '../../theme';
import { Header } from '../../components/common/Header';

const { width } = Dimensions.get('window');

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_STORIES = [
    { id: 's1', username: '@nadiav', avatar: 'https://picsum.photos/seed/u1/100' },
    { id: 's2', username: '@chloeX', avatar: 'https://picsum.photos/seed/u2/100' },
    { id: 's3', username: '@oria', avatar: 'https://picsum.photos/seed/u3/100' },
    { id: 's4', username: '@anya_m', avatar: 'https://picsum.photos/seed/u4/100' },
    { id: 's5', username: '@izara', avatar: 'https://picsum.photos/seed/u5/100' }
];

const MOCK_POSTS = [
    {
        id: 'p1',
        user: { username: '@nadiav', avatar: 'https://picsum.photos/seed/u1/100', location: 'Paris, FR' },
        images: ['https://picsum.photos/seed/p1/600/750'],
        caption: 'Heritage silk never fades. #KaphorCircular #SustainableStyle',
        garmentName: 'Ivory Silk Dupatta',
        garmentSeries: 'Heritage Series I',
        likeCount: 248,
        commentCount: 32,
        liked: false
    },
    {
        id: 'p2',
        user: { username: '@chloeX', avatar: 'https://picsum.photos/seed/u2/100', location: 'Milan, IT' },
        images: ['https://picsum.photos/seed/p2/600/750'],
        caption: "Gold waistband from Kaphor Lab's upcycle collection. A new chapter. #Upcycled #SlowFashion",
        garmentName: 'Gold Zardosi Belt',
        garmentSeries: 'Artisan Circle',
        likeCount: 184,
        commentCount: 17,
        liked: true
    },
    {
        id: 'p3',
        user: { username: '@oria', avatar: 'https://picsum.photos/seed/u3/100', location: 'London, UK' },
        images: ['https://picsum.photos/seed/p3/600/750'],
        caption: 'Second life, same story. Rented and returned with love. #RentalFashion #Kaphor',
        garmentName: 'Crimson Velvet Lehenga',
        garmentSeries: 'Heritage Rental',
        likeCount: 412,
        commentCount: 54,
        liked: false
    }
];

// ─── Sub Components ───────────────────────────────────────────────────────────
const StoryBubble = ({ item }: { item: typeof MOCK_STORIES[0] }) => (
    <Pressable style={styles.storyItem}>
        <View style={styles.storyRing}>
            <KaphorImage uri={item.avatar} style={styles.storyAvatar} />
        </View>
        <Text style={styles.storyUsername} numberOfLines={1}>{item.username}</Text>
    </Pressable>
);

const PostCard = ({ post }: { post: typeof MOCK_POSTS[0] }) => {
    const [liked, setLiked] = useState(post.liked);
    const [likeCount, setLikeCount] = useState(post.likeCount);
    const router = useRouter();

    const handleLike = () => {
        setLiked(v => !v);
        setLikeCount(v => liked ? v - 1 : v + 1);
    };

    return (
        <View style={styles.postCard}>
            {/* Post Header */}
            <View style={styles.postHeader}>
                <KaphorImage uri={post.user.avatar} style={styles.postAvatar} />
                <View style={styles.postUserInfo}>
                    <Text style={styles.postUsername}>{post.user.username}</Text>
                    <Text style={styles.postLocation}>{post.user.location}</Text>
                </View>
                <Pressable style={styles.moreBtn}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
                </Pressable>
            </View>

            {/* Post Image with overlaid info */}
            <View style={styles.postImageContainer}>
                <KaphorImage uri={post.images[0]} style={styles.postImage} contentFit="cover" />

                {/* Garment Name Overlay (top left) */}
                <View style={styles.garmentOverlay}>
                    <Text style={styles.garmentName}>{post.garmentName}</Text>
                    <Text style={styles.garmentSeries}>{post.garmentSeries}</Text>
                </View>

                {/* SHOP LOOK button (bottom right) */}
                <Pressable style={styles.shopLookBtn}>
                    <Text style={styles.shopLookText}>SHOP LOOK</Text>
                </Pressable>
            </View>

            {/* Reactions row */}
            <View style={styles.reactionsRow}>
                <Pressable style={styles.reactionBtn} onPress={handleLike}>
                    <Ionicons
                        name={liked ? 'heart' : 'heart-outline'}
                        size={24}
                        color={liked ? colors.error : colors.textPrimary}
                    />
                    <Text style={styles.reactionCount}>{likeCount}</Text>
                </Pressable>

                <Pressable style={styles.reactionBtn}>
                    <Ionicons name="chatbubble-outline" size={22} color={colors.textPrimary} />
                    <Text style={styles.reactionCount}>{post.commentCount}</Text>
                </Pressable>

                <Pressable style={styles.reactionBtn}>
                    <Ionicons name="arrow-redo-outline" size={22} color={colors.textPrimary} />
                </Pressable>
            </View>

            {/* Caption */}
            <View style={styles.captionContainer}>
                <Text style={styles.caption}>
                    {post.caption.split(' ').map((word, i) =>
                        word.startsWith('#')
                            ? <Text key={i} style={styles.hashtag}>{word} </Text>
                            : <Text key={i}>{word} </Text>
                    )}
                </Text>
            </View>
        </View>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function SocialScreen() {
    const [posts, setPosts] = useState(MOCK_POSTS);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setTimeout(() => { setPosts(MOCK_POSTS); setRefreshing(false); }, 1000);
    }, []);

    const onEndReached = () => {
        if (loadingMore) return;
        setLoadingMore(true);
        setTimeout(() => setLoadingMore(false), 1500);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Header showLogo unreadCount={0} />

            <FlatList
                data={posts}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.gold}
                        colors={[colors.gold]}
                    />
                }
                onEndReached={onEndReached}
                onEndReachedThreshold={0.5}
                ListHeaderComponent={
                    <>
                        {/* Stories Row */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.storiesScroll}
                            contentContainerStyle={styles.storiesContent}
                        >
                            {MOCK_STORIES.map(s => <StoryBubble key={s.id} item={s} />)}
                        </ScrollView>
                        <View style={styles.divider} />
                    </>
                }
                renderItem={({ item }) => <PostCard post={item} />}
                ListFooterComponent={
                    loadingMore
                        ? <ActivityIndicator color={colors.gold} style={{ paddingVertical: spacing.xl }} />
                        : null
                }
                ItemSeparatorComponent={() => <View style={styles.postSeparator} />}
            />
        </SafeAreaView>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    storiesScroll: { flexGrow: 0 },
    storiesContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
    storyItem: { alignItems: 'center', marginRight: spacing.md, width: 64 },
    storyRing: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: colors.gold, padding: 2, marginBottom: 6 },
    storyAvatar: { width: '100%', height: '100%', borderRadius: 28 },
    storyUsername: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 10, textAlign: 'center' },

    divider: { height: 1, backgroundColor: colors.border },

    postCard: { backgroundColor: colors.bg },
    postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    postAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: spacing.sm },
    postUserInfo: { flex: 1 },
    postUsername: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 13, fontWeight: 'bold' },
    postLocation: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10, textTransform: 'uppercase' },
    moreBtn: { padding: spacing.xs },

    postImageContainer: { width, height: width * 1.25, position: 'relative' },
    postImage: { width: '100%', height: '100%' },

    garmentOverlay: { position: 'absolute', top: spacing.md, left: spacing.md, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm },
    garmentName: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 11, fontWeight: 'bold' },
    garmentSeries: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 9, textTransform: 'uppercase', marginTop: 2 },

    shopLookBtn: { position: 'absolute', bottom: spacing.md, right: spacing.md, backgroundColor: colors.crimson, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full },
    shopLookText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },

    reactionsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    reactionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.md },
    reactionCount: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 12, marginLeft: 4 },

    captionContainer: { paddingHorizontal: spacing.md, paddingTop: 6, paddingBottom: spacing.md },
    caption: { color: colors.textSecond, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
    hashtag: { color: colors.gold },

    postSeparator: { height: 1, backgroundColor: colors.border },
});
