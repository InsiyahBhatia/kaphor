import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable,
    Image, Dimensions, FlatList, Switch, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, radius } from '../../theme';
import { KaphorImage } from '../../components/KaphorImage';

const { width } = Dimensions.get('window');

type ProfileTab = 'Listings' | 'Sold' | 'Purchases' | 'Reviews';

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_USER = {
    displayName: 'Aria Varma',
    username: '@aria_v',
    tier: 'ELITE',
    styleAesthetic: 'LUXURY',
    joinDate: 'Joined March 2024',
    avatar: 'https://picsum.photos/seed/aria/300/300',
    cover: 'https://picsum.photos/seed/kaphorcover/1200/400',
    stats: {
        listings: 24,
        sold: 112,
        following: 842,
        followers: '3.2k'
    }
};

const MOCK_LISTINGS = [
    { id: 'l1', title: 'Vintage Silk Sari', price: '₹14,500', status: 'Listed', image: 'https://picsum.photos/seed/sari1/300/400' },
    { id: 'l2', title: 'Gold Zardosi Clutch', price: '₹8,400', status: 'Interest', image: 'https://picsum.photos/seed/clutch1/300/400' },
    { id: 'l3', title: 'Handwoven Pashmina', price: '₹22,000', status: 'Listed', image: 'https://picsum.photos/seed/pash1/300/400' },
    { id: 'l4', title: 'Embroidered Mojaris', price: '₹3,200', status: 'Decline', image: 'https://picsum.photos/seed/shoes1/300/400' },
];

const TABS: ProfileTab[] = ['Listings', 'Sold', 'Purchases', 'Reviews'];

// ─── Sub Components ───────────────────────────────────────────────────────────

const StatItem = ({ label, value, onPress }: { label: string; value: string | number; onPress?: () => void }) => (
    <Pressable style={styles.statItem} onPress={onPress}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
);

const ListingCard = ({ item }: { item: typeof MOCK_LISTINGS[0] }) => (
    <View style={styles.listingCard}>
        <KaphorImage uri={item.image} style={styles.listingImage} />
        <View style={[styles.statusBadge, item.status === 'Decline' && { backgroundColor: colors.error }]}>
            <Text style={styles.statusBadgeText}>{item.status.toUpperCase()}</Text>
        </View>
        <View style={styles.listingInfo}>
            <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.listingPrice}>{item.price}</Text>
        </View>
    </View>
);

// Removed archaic SettingsSheet modal in favor of direct dashboard actions

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function ProfileScreen() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const [activeTab, setActiveTab] = useState<ProfileTab>('Listings');
    const [showSettings, setShowSettings] = useState(false);
    const [coverUri, setCoverUri] = useState('https://picsum.photos/seed/kaphorcover/1200/400');
    const [avatarUri, setAvatarUri] = useState(user?.avatarUrl || 'https://picsum.photos/seed/kaphor/300/300');

    const pickImage = async (type: 'cover' | 'avatar') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: type === 'cover' ? [3, 1] : [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            if (type === 'cover') setCoverUri(result.assets[0].uri);
            else setAvatarUri(result.assets[0].uri);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[3]}>
                {/* 1. Header Area with Cover & Avatar */}
                <View style={styles.headerArea}>
                    <Pressable onPress={() => pickImage('cover')}>
                        <KaphorImage uri={coverUri} style={styles.coverImage} />
                    </Pressable>
                    <View style={styles.topRightActions}>
                        <Pressable style={styles.iconBtn} onPress={() => pickImage('cover')}>
                            <Ionicons name="camera" size={20} color="white" />
                        </Pressable>
                        <Pressable style={styles.iconBtn} onPress={() => router.push('/(tabs)/shop/orders')}>
                            <Ionicons name="chatbubble-ellipses-outline" size={20} color="white" />
                        </Pressable>
                        <Pressable style={styles.iconBtn} onPress={() => Alert.alert('Log Out', 'Are you sure you want to exit?', [{ text: 'Cancel' }, { text: 'Log Out', style: 'destructive', onPress: signOut }])}>
                            <Ionicons name="log-out-outline" size={20} color={colors.error} />
                        </Pressable>
                    </View>

                    <View style={styles.profileInfoArea}>
                        <View style={styles.avatarWrapper}>
                            <Pressable onPress={() => pickImage('avatar')}>
                                <KaphorImage uri={avatarUri} style={styles.avatar} />
                                <View style={styles.avatarEditBadge}>
                                    <Ionicons name="camera" size={12} color="white" />
                                </View>
                            </Pressable>
                            <View style={styles.tierBadge}>
                                <MaterialCommunityIcons name="crown" size={12} color="white" />
                                <Text style={styles.tierText}>{user?.role === 'ADMIN' ? 'ADMIN' : 'ELITE'}</Text>
                            </View>
                        </View>

                        <Text style={styles.displayName}>{user?.displayName || 'User'}</Text>
                        <Text style={styles.usernameText}>{user?.username ? `@${user.username}` : ''}</Text>
                        <Text style={styles.subtitle}>{user?.styleAesthetic || 'EXPLORER'} • MEMBER</Text>
                    </View>
                </View>

                {/* 2. Stats Row */}
                <View style={styles.statsRow}>
                    <StatItem label="Listings" value={MOCK_USER.stats.listings} />
                    <View style={styles.statDivider} />
                    <StatItem label="Sold" value={MOCK_USER.stats.sold} />
                    <View style={styles.statDivider} />
                    <StatItem label="Following" value={MOCK_USER.stats.following} />
                    <View style={styles.statDivider} />
                    <StatItem label="Followers" value={MOCK_USER.stats.followers} />
                </View>

                {/* 3. Action Buttons */}
                <View style={styles.actionRow}>
                    <Pressable style={styles.editBtn}>
                        <Text style={styles.editBtnText}>EDIT PROFILE</Text>
                    </Pressable>
                </View>

                {/* 3. System Ops Dashboard */}
                <View style={styles.opsSection}>
                    <View style={styles.opsGrid}>
                        <Pressable style={styles.opsCard}>
                            <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
                            <Text style={styles.opsCardText}>ALERTS</Text>
                        </Pressable>
                        <Pressable style={styles.opsCard}>
                            <Ionicons name="shirt-outline" size={20} color={colors.textPrimary} />
                            <Text style={styles.opsCardText}>MY LISTINGS</Text>
                        </Pressable>
                        <Pressable style={styles.opsCard}>
                            <Ionicons name="star-outline" size={20} color={colors.textPrimary} />
                            <Text style={styles.opsCardText}>REVIEWS</Text>
                        </Pressable>
                        <Pressable style={styles.opsCard}>
                            <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
                            <Text style={styles.opsCardText}>SETTINGS</Text>
                        </Pressable>
                        {user?.role === 'ADMIN' && (
                            <Pressable style={[styles.opsCard, { backgroundColor: colors.crimson, borderColor: colors.charcoal }]} onPress={() => router.push('/(admin)')}>
                                <Ionicons name="shield-checkmark-outline" size={20} color="white" />
                                <Text style={[styles.opsCardText, { color: 'white' }]}>ADMIN PANEL</Text>
                            </Pressable>
                        )}
                    </View>
                </View>

                {/* 4. Tab Row (Sticky) */}
                <View style={styles.tabRow}>
                    {TABS.map(tab => (
                        <Pressable key={tab} style={styles.tabItem} onPress={() => setActiveTab(tab)}>
                            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                            {activeTab === tab && <View style={styles.tabUnderline} />}
                        </Pressable>
                    ))}
                </View>

                {/* 5. Tab Content (Grid) */}
                <View style={styles.gridContainer}>
                    {activeTab === 'Listings' && (
                        <View style={styles.grid}>
                            {MOCK_LISTINGS.map(item => <ListingCard key={item.id} item={item} />)}
                        </View>
                    )}
                    {activeTab !== 'Listings' && (
                        <View style={styles.emptyState}>
                            <Ionicons name="file-tray-outline" size={48} color={colors.textMuted} />
                            <Text style={styles.emptyText}>No {activeTab.toLowerCase()} yet.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

        </SafeAreaView>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    headerArea: { marginBottom: spacing.md },
    coverImage: { width: '100%', height: 140 },
    coverOverlay: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: radius.full },
    profileInfoArea: { alignItems: 'center', marginTop: -50 },
    avatarWrapper: { position: 'relative', marginBottom: spacing.sm },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: colors.bg },
    avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.gold, padding: 4, borderRadius: radius.full, borderWidth: 2, borderColor: colors.bg },
    tierBadge: { position: 'absolute', top: -5, right: -10, backgroundColor: colors.crimson, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, gap: 4 },
    tierText: { color: 'white', fontFamily: typography.mono, fontSize: 9, fontWeight: 'bold' },

    displayName: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 26, marginBottom: 2 },
    usernameText: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 13, marginBottom: 4 },
    subtitle: { color: colors.textSecond, fontFamily: typography.body, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },

    statsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.lg, justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: colors.border },
    statItem: { alignItems: 'center' },
    statValue: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 16, fontWeight: 'bold' },
    statLabel: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 9, textTransform: 'uppercase', marginTop: 2 },
    statDivider: { width: 1, height: 20, backgroundColor: colors.border, alignSelf: 'center' },

    actionRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
    editBtn: { flex: 1, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
    editBtnText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
    
    topRightActions: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 },
    iconBtn: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: radius.full },

    tabRow: { flexDirection: 'row', backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
    tabText: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 11, textTransform: 'uppercase' },
    tabTextActive: { color: colors.textPrimary, fontWeight: 'bold' },
    tabUnderline: { position: 'absolute', bottom: 0, width: '40%', height: 2, backgroundColor: colors.gold },

    gridContainer: { padding: spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    listingCard: { width: (width - spacing.sm * 3) / 2, backgroundColor: colors.bgCard, borderRadius: radius.md, overflow: 'hidden' },
    listingImage: { width: '100%', aspectRatio: 3/4 },
    statusBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
    statusBadgeText: { color: 'white', fontFamily: typography.mono, fontSize: 8, fontWeight: 'bold' },
    listingInfo: { padding: spacing.sm },
    listingTitle: { color: colors.textPrimary, fontFamily: typography.body, fontSize: 13, marginBottom: 2 },
    listingPrice: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 12 },

    emptyState: { padding: 60, alignItems: 'center' },
    emptyText: { color: colors.textMuted, fontFamily: typography.body, fontSize: 14, marginTop: 12 },

    // Removed Modal and replaced with System Ops Dashboard
    opsSection: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
    opsGrid: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
    opsCard: { flex: 1, backgroundColor: colors.bgCard, padding: spacing.sm, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, height: 75 },
    opsCardText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 8, fontWeight: 'bold', marginTop: 8 },

});


