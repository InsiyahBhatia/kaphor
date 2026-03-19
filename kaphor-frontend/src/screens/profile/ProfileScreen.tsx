import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable,
    Image, Dimensions, FlatList, Switch, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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

// ─── Settings Bottom Sheet ────────────────────────────────────────────────────
const SettingsSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    if (!visible) return null;

    const SettingRow = ({ icon, label, onPress, hasSwitch, value, onValueChange }: any) => (
        <Pressable style={styles.settingsRow} onPress={onPress}>
            <View style={styles.settingsRowLeft}>
                <Ionicons name={icon} size={20} color={colors.textPrimary} />
                <Text style={styles.settingsLabel}>{label}</Text>
            </View>
            {hasSwitch ? (
                <Switch
                    value={value}
                    onValueChange={onValueChange}
                    trackColor={{ false: colors.bgMuted, true: colors.gold }}
                    thumbColor={colors.textPrimary}
                />
            ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            )}
        </Pressable>
    );

    return (
        <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalDismiss} onPress={onClose} />
            <View style={styles.modalContent}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Settings</Text>

                <ScrollView showsVerticalScrollIndicator={false}>
                    <Text style={styles.settingsSection}>PREFERENCES</Text>
                    <SettingRow icon="notifications-outline" label="Notifications" hasSwitch value={true} />
                    <SettingRow icon="lock-closed-outline" label="Privacy Settings" />

                    <Text style={styles.settingsSection}>ACCOUNT</Text>
                    <SettingRow icon="card-outline" label="Linked Payment Methods" />
                    <SettingRow icon="location-outline" label="Shipping Addresses" />
                    <SettingRow icon="shield-checkmark-outline" label="Account Security" />

                    <Text style={styles.settingsSection}>SUPPORT</Text>
                    <SettingRow icon="help-circle-outline" label="Help & Support" />
                    <SettingRow icon="chatbox-outline" label="Feedback" />

                    <Pressable style={styles.logoutBtn} onPress={() => Alert.alert('Log Out', 'Are you sure?', [{ text: 'Cancel' }, { text: 'Log Out', style: 'destructive' }])}>
                        <Ionicons name="log-out-outline" size={20} color={colors.error} />
                        <Text style={styles.logoutText}>Log Out</Text>
                    </Pressable>
                </ScrollView>
            </View>
        </View>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function ProfileScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<ProfileTab>('Listings');
    const [showSettings, setShowSettings] = useState(false);
    const [coverUri, setCoverUri] = useState(MOCK_USER.cover);
    const [avatarUri, setAvatarUri] = useState(MOCK_USER.avatar);

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
                        <View style={styles.coverOverlay}>
                            <Ionicons name="camera" size={20} color="white" />
                        </View>
                    </Pressable>

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
                                <Text style={styles.tierText}>{MOCK_USER.tier}</Text>
                            </View>
                        </View>

                        <Text style={styles.displayName}>{MOCK_USER.displayName}</Text>
                        <Text style={styles.usernameText}>{MOCK_USER.username}</Text>
                        <Text style={styles.subtitle}>{MOCK_USER.styleAesthetic} • {MOCK_USER.joinDate}</Text>
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
                    <Pressable style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
                        <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
                    </Pressable>
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

            <SettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} />
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
    settingsBtn: { width: 48, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },

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

    // Modal
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 1000 },
    modalDismiss: { flex: 1 },
    modalContent: { backgroundColor: colors.bgCard, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, minHeight: '80%', padding: spacing.lg },
    modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg },
    modalTitle: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 24, marginBottom: spacing.lg },

    settingsSection: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10, letterSpacing: 2, marginBottom: spacing.sm, marginTop: spacing.md },
    settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    settingsRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    settingsLabel: { color: colors.textPrimary, fontFamily: typography.body, fontSize: 14 },

    logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl, marginTop: spacing.md },
    logoutText: { color: colors.error, fontFamily: typography.mono, fontSize: 14, fontWeight: 'bold' }
});
