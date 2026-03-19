import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Pressable,
    TextInput, Alert, ActivityIndicator, Dimensions, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../../theme';

const { width } = Dimensions.get('window');

type TabType = 'Tutorials' | 'Services' | 'Before & After';
const TABS: TabType[] = ['Tutorials', 'Services', 'Before & After'];

const DIFFICULTY_COLORS: Record<string, string> = {
    Beginner: '#4CAF50',
    Intermediate: '#FF9800',
    Advanced: '#F44336'
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const FEATURED = {
    id: 't1',
    title: 'Reconstructing the Classic Silk Blazer',
    thumbnail: 'https://picsum.photos/seed/tut1/600/340',
    duration: '18:42',
    difficulty: 'Intermediate',
    isNewRelease: true
};

const TUTORIALS = [
    { id: 't2', title: 'Dyeing Techniques for Heritage Sarees', thumbnail: 'https://picsum.photos/seed/tut2/300/200', duration: '12:05', difficulty: 'Beginner', isNewRelease: false },
    { id: 't3', title: 'Zardosi Embroidery Restoration', thumbnail: 'https://picsum.photos/seed/tut3/300/200', duration: '24:17', difficulty: 'Advanced', isNewRelease: false },
    { id: 't4', title: 'Upcycling Vintage Lehengas', thumbnail: 'https://picsum.photos/seed/tut4/300/200', duration: '09:33', difficulty: 'Beginner', isNewRelease: true }
];

const TRANSFORMATIONS = [
    { id: 'tr1', before: 'https://picsum.photos/seed/bef1/300/380', after: 'https://picsum.photos/seed/aft1/300/380', desc: '1990s bridal lehenga → contemporary asymmetric silhouette', by: '@oria' },
    { id: 'tr2', before: 'https://picsum.photos/seed/bef2/300/380', after: 'https://picsum.photos/seed/aft2/300/380', desc: 'Faded silk saree → structured corset top + palazzo', by: '@nadiav' },
    { id: 'tr3', before: 'https://picsum.photos/seed/bef3/300/380', after: 'https://picsum.photos/seed/aft3/300/380', desc: 'Worn sherwani → reversible quilted jacket', by: '@chloeX' }
];

// ─── Tab: Tutorials ───────────────────────────────────────────────────────────
const TutorialsTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
        {/* Featured Video */}
        <View style={styles.featuredCard}>
            <Image source={{ uri: FEATURED.thumbnail }} style={styles.featuredImage} />
            <View style={styles.playOverlay}>
                <View style={styles.playBtn}>
                    <Ionicons name="play" size={28} color={colors.bg} />
                </View>
            </View>
            <View style={styles.featuredDurationBadge}>
                <Ionicons name="time-outline" size={10} color={colors.textPrimary} />
                <Text style={styles.featuredDurationText}>{FEATURED.duration}</Text>
            </View>
            {FEATURED.isNewRelease && (
                <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW RELEASE</Text>
                </View>
            )}
        </View>
        <Text style={styles.featuredTitle}>{FEATURED.title}</Text>
        <View style={styles.featuredRow}>
            <View style={[styles.diffBadge, { backgroundColor: DIFFICULTY_COLORS[FEATURED.difficulty] }]}>
                <Text style={styles.diffBadgeText}>{FEATURED.difficulty}</Text>
            </View>
            <Text style={styles.featuredDuration}>{FEATURED.duration}</Text>
        </View>

        {/* Transformations horizontal strip */}
        <Text style={styles.sectionHeader}>TRANSFORMATIONS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
            {TRANSFORMATIONS.map(t => (
                <Pressable key={t.id} style={styles.transCard}>
                    <View style={styles.transImages}>
                        <View style={styles.transHalf}>
                            <Image source={{ uri: t.before }} style={styles.transImage} />
                            <View style={styles.transLabel}><Text style={styles.transLabelText}>BEFORE</Text></View>
                        </View>
                        <View style={styles.transHalf}>
                            <Image source={{ uri: t.after }} style={styles.transImage} />
                            <View style={[styles.transLabel, styles.transLabelAfter]}><Text style={styles.transLabelText}>AFTER</Text></View>
                        </View>
                    </View>
                    <Text style={styles.transDesc} numberOfLines={2}>{t.desc}</Text>
                    <Text style={styles.transBy}>{t.by}</Text>
                </Pressable>
            ))}
        </ScrollView>

        {/* Recommended Grid */}
        <Text style={styles.sectionHeader}>RECOMMENDED TUTORIALS</Text>
        {TUTORIALS.map(tut => (
            <Pressable key={tut.id} style={styles.tutRow}>
                <Image source={{ uri: tut.thumbnail }} style={styles.tutThumb} />
                <View style={styles.tutInfo}>
                    <Text style={styles.tutTitle} numberOfLines={2}>{tut.title}</Text>
                    <View style={styles.tutMeta}>
                        <View style={[styles.diffBadge, { backgroundColor: DIFFICULTY_COLORS[tut.difficulty] }]}>
                            <Text style={styles.diffBadgeText}>{tut.difficulty}</Text>
                        </View>
                        <Text style={styles.tutDuration}>{tut.duration}</Text>
                        {tut.isNewRelease && <View style={styles.newBadgeSmall}><Text style={styles.newBadgeTextSmall}>NEW</Text></View>}
                    </View>
                </View>
                <Ionicons name="play-circle-outline" size={28} color={colors.gold} />
            </Pressable>
        ))}
    </ScrollView>
);

// ─── Tab: Services ────────────────────────────────────────────────────────────
const BESPOKE_STEPS = [
    { n: '01', title: 'Submit Consultation', desc: 'Share your garment details and redesign vision' },
    { n: '02', title: 'Designer Review', desc: 'Our artisan team evaluates feasibility and proposes options within 48 hours' },
    { n: '03', title: 'Atelier Handoff', desc: 'Your piece is transformed by master craftspeople' }
];

const ServicesTab = ({ onConsult }: { onConsult: () => void }) => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
        {/* Bespoke Card */}
        <View style={styles.bespokeCard}>
            <Text style={styles.bespokeEyebrow}>EXCLUSIVE SERVICE</Text>
            <Text style={styles.bespokeTitle}>Bespoke Redesign Service</Text>
            <Text style={styles.bespokeDesc}>
                Transform your cherished garments into contemporary masterpieces through our White-Glove Atelier service.
            </Text>
            <Pressable style={styles.consultBtn} onPress={onConsult}>
                <Text style={styles.consultBtnText}>REQUEST CONSULTATION</Text>
            </Pressable>
        </View>

        {/* 3-Step Process */}
        <Text style={styles.sectionHeader}>THE PROCESS</Text>
        {BESPOKE_STEPS.map(step => (
            <View key={step.n} style={styles.stepRow}>
                <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{step.n}</Text>
                </View>
                <View style={styles.stepBody}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
            </View>
        ))}
    </ScrollView>
);

// ─── Tab: Before & After ─────────────────────────────────────────────────────
const BeforeAfterTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
        {TRANSFORMATIONS.map(t => (
            <View key={t.id} style={styles.baCard}>
                <View style={styles.baImages}>
                    <View style={{ flex: 1 }}>
                        <Image source={{ uri: t.before }} style={styles.baImage} />
                        <View style={[styles.baLabel, { backgroundColor: colors.bgMuted }]}>
                            <Text style={styles.baLabelText}>BEFORE</Text>
                        </View>
                    </View>
                    <View style={styles.baDivider} />
                    <View style={{ flex: 1 }}>
                        <Image source={{ uri: t.after }} style={styles.baImage} />
                        <View style={[styles.baLabel, { backgroundColor: colors.gold }]}>
                            <Text style={[styles.baLabelText, { color: colors.bg }]}>AFTER</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.baFooter}>
                    <Text style={styles.baDesc}>{t.desc}</Text>
                    <Text style={styles.baBy}>{t.by}</Text>
                </View>
            </View>
        ))}
    </ScrollView>
);

// ─── Bespoke Modal ────────────────────────────────────────────────────────────
const BespokeModal = ({ onClose }: { onClose: () => void }) => {
    const [description, setDescription] = useState('');
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        if (!description.trim() || !email.trim()) {
            Alert.alert('Required', 'Please fill in all fields.');
            return;
        }
        setSubmitting(true);
        await new Promise(r => setTimeout(r, 1200));
        setSubmitting(false);
        Alert.alert('Request Submitted', 'Our team will contact you within 48 hours.', [{ text: 'OK', onPress: onClose }]);
    };

    return (
        <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Request Consultation</Text>
                    <Pressable onPress={onClose}>
                        <Ionicons name="close" size={22} color={colors.textPrimary} />
                    </Pressable>
                </View>
                <Text style={styles.fieldLabel}>Describe your vision</Text>
                <TextInput
                    style={styles.textArea}
                    multiline placeholder="Describe the garment and what you'd like us to create..."
                    placeholderTextColor={colors.textMuted}
                    value={description}
                    onChangeText={setDescription}
                />
                <Text style={styles.fieldLabel}>Contact Email</Text>
                <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
                <Pressable style={styles.submitBtn} onPress={submit} disabled={submitting}>
                    {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.submitBtnText}>SUBMIT REQUEST</Text>}
                </Pressable>
            </View>
        </View>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function StudioScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('Tutorials');
    const [showModal, setShowModal] = useState(false);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </Pressable>
                <View>
                    <Text style={styles.headerTitle}>STUDIO</Text>
                    <Text style={styles.headerSubtitle}>Craft · Transform · Elevate</Text>
                </View>
                <View style={{ width: 24 }} />
            </View>

            {/* Tab Row */}
            <View style={styles.tabRow}>
                {TABS.map(tab => (
                    <Pressable key={tab} style={styles.tabItem} onPress={() => setActiveTab(tab)}>
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                        {activeTab === tab && <View style={styles.tabUnderline} />}
                    </Pressable>
                ))}
            </View>

            {/* Tab Content */}
            {activeTab === 'Tutorials' && <TutorialsTab />}
            {activeTab === 'Services' && <ServicesTab onConsult={() => setShowModal(true)} />}
            {activeTab === 'Before & After' && <BeforeAfterTab />}

            {/* Bespoke Consultation Modal */}
            {showModal && <BespokeModal onClose={() => setShowModal(false)} />}
        </SafeAreaView>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const CARD_W = width * 0.72;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 22, letterSpacing: 3, textAlign: 'center' },
    headerSubtitle: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 9, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },

    tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
    tabText: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
    tabTextActive: { color: colors.textPrimary },
    tabUnderline: { position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 2, backgroundColor: colors.gold, borderRadius: 1 },

    tabContent: { padding: spacing.md, paddingBottom: spacing.xxl },

    // Featured
    featuredCard: { borderRadius: radius.md, overflow: 'hidden', position: 'relative', marginBottom: spacing.sm },
    featuredImage: { width: '100%', aspectRatio: 16 / 9 },
    playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
    playBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 2, borderColor: colors.textPrimary, alignItems: 'center', justifyContent: 'center' },
    featuredDurationBadge: { position: 'absolute', bottom: spacing.sm, left: spacing.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm, gap: 4 },
    featuredDurationText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 10 },
    newBadge: { position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: colors.gold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
    newBadgeText: { color: colors.bg, fontFamily: typography.mono, fontSize: 9, fontWeight: 'bold' },
    featuredTitle: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 18, marginBottom: spacing.xs },
    featuredRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
    featuredDuration: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 11 },
    diffBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm },
    diffBadgeText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 9, fontWeight: 'bold' },

    sectionHeader: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.md, marginTop: spacing.md },

    // Transformation strip
    hScroll: { flexGrow: 0, marginBottom: spacing.md },
    transCard: { width: CARD_W, backgroundColor: colors.bgCard, borderRadius: radius.md, overflow: 'hidden', marginRight: spacing.md, borderWidth: 1, borderColor: colors.border },
    transImages: { flexDirection: 'row', height: 180 },
    transHalf: { flex: 1, position: 'relative' },
    transImage: { width: '100%', height: '100%' },
    transLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, alignItems: 'center' },
    transLabelAfter: { backgroundColor: 'rgba(196,160,109,0.7)' },
    transLabelText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 9, fontWeight: 'bold' },
    transDesc: { color: colors.textSecond, fontFamily: typography.body, fontSize: 12, padding: spacing.sm },
    transBy: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },

    // Tutorial rows
    tutRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, overflow: 'hidden' },
    tutThumb: { width: 90, height: 70 },
    tutInfo: { flex: 1, padding: spacing.sm },
    tutTitle: { color: colors.textPrimary, fontFamily: typography.body, fontSize: 13, marginBottom: 4 },
    tutMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    tutDuration: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10 },
    newBadgeSmall: { backgroundColor: colors.gold, paddingHorizontal: 5, paddingVertical: 2, borderRadius: radius.sm },
    newBadgeTextSmall: { color: colors.bg, fontFamily: typography.mono, fontSize: 8, fontWeight: 'bold' },

    // Services tab
    bespokeCard: { backgroundColor: colors.crimson, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg },
    bespokeEyebrow: { color: 'rgba(255,255,255,0.7)', fontFamily: typography.mono, fontSize: 9, letterSpacing: 2, marginBottom: spacing.xs },
    bespokeTitle: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 24, marginBottom: spacing.sm },
    bespokeDesc: { color: 'rgba(255,255,255,0.85)', fontFamily: typography.body, fontSize: 13, lineHeight: 20, marginBottom: spacing.lg },
    consultBtn: { borderWidth: 1.5, borderColor: colors.textPrimary, paddingVertical: spacing.sm, borderRadius: radius.full, alignItems: 'center' },
    consultBtnText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
    stepRow: { flexDirection: 'row', marginBottom: spacing.md },
    stepNum: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, flexShrink: 0 },
    stepNumText: { color: colors.gold, fontFamily: typography.mono, fontSize: 13, fontWeight: 'bold' },
    stepBody: { flex: 1 },
    stepTitle: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
    stepDesc: { color: colors.textSecond, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },

    // Before & After
    baCard: { backgroundColor: colors.bgCard, borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
    baImages: { flexDirection: 'row', height: 220 },
    baImage: { width: '100%', height: '100%' },
    baDivider: { width: 2, backgroundColor: colors.bg },
    baLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 5, alignItems: 'center' },
    baLabelText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 10, fontWeight: 'bold' },
    baFooter: { padding: spacing.md },
    baDesc: { color: colors.textSecond, fontFamily: typography.body, fontSize: 13, marginBottom: 4 },
    baBy: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10 },

    // Modal
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', zIndex: 100 },
    modalCard: { backgroundColor: colors.bgCard, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    modalTitle: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 20 },
    fieldLabel: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: spacing.sm },
    textArea: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, fontFamily: typography.body, fontSize: 14, padding: spacing.md, minHeight: 90, textAlignVertical: 'top' },
    input: { backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, fontFamily: typography.body, fontSize: 14, padding: spacing.md },
    submitBtn: { backgroundColor: colors.gold, borderRadius: radius.full, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
    submitBtnText: { color: colors.bg, fontFamily: typography.mono, fontSize: 13, fontWeight: 'bold', letterSpacing: 2 }
});
