import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../../theme';

const { width } = Dimensions.get('window');

const CONDITIONS = [
    { id: 'PRISTINE', label: 'Pristine', icon: 'sparkles-outline' },
    { id: 'MINOR_WEAR', label: 'Minor Wear', icon: 'shirt-outline' },
    { id: 'UPCYCLE', label: 'Upcycle', icon: 'cut-outline' },
    { id: 'RECYCLE_ONLY', label: 'Recycle Only', icon: 'leaf-outline' }
];

const PARTNERS = ['Renewcell', 'KaPhor Lab', 'EcoCer'];

export function CircularScreen() {
    const router = useRouter();
    const [selectedCondition, setSelectedCondition] = useState<string | null>(null);

    // Mock Data
    const recyclableFiber = 75;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.headerTitle}>GARMENT LIFECYCLE</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Recyclable Fiber Ring Mock */}
                <View style={styles.ringContainer}>
                    <View style={styles.ringOuter}>
                        <View style={styles.ringInner}>
                            <Text style={styles.ringPercentage}>{recyclableFiber}%</Text>
                            <Text style={styles.ringLabel}>Recyclable Fiber</Text>
                        </View>
                    </View>
                    <Text style={styles.subtitle}>Your item retains immense ecological value. Choose its next phase.</Text>
                </View>

                {/* Condition Check Grid */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Condition Check</Text>
                    <Text style={styles.sectionDesc}>Select the current state of your garment to unlock appropriate circular pathways.</Text>

                    <View style={styles.conditionGrid}>
                        {CONDITIONS.map(cond => {
                            const isActive = selectedCondition === cond.id;
                            return (
                                <Pressable
                                    key={cond.id}
                                    style={[styles.conditionCard, isActive && styles.conditionCardActive]}
                                    onPress={() => setSelectedCondition(cond.id)}
                                >
                                    <Ionicons name={cond.icon as any} size={24} color={isActive ? colors.bg : colors.textPrimary} />
                                    <Text style={[styles.conditionText, isActive && styles.conditionTextActive]}>{cond.label}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* White-Glove Pickup */}
                {selectedCondition && (
                    <View style={styles.pickupCard}>
                        <View style={styles.pickupHeader}>
                            <Ionicons name="car-outline" size={20} color={colors.gold} />
                            <Text style={styles.pickupTitle}>White-Glove Pickup</Text>
                            <View style={styles.premiumBadge}>
                                <Text style={styles.premiumText}>PREMIUM</Text>
                            </View>
                        </View>

                        <View style={styles.pickupRow}>
                            <Ionicons name="calendar-outline" size={16} color={colors.textSecond} />
                            <Text style={styles.pickupValue}>Tomorrow, 10:00 AM - 12:00 PM</Text>
                            <Ionicons name="pencil" size={14} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                        </View>

                        <View style={styles.pickupRow}>
                            <Ionicons name="location-outline" size={16} color={colors.textSecond} />
                            <Text style={styles.pickupValue}>123 Heritage Ave, NY</Text>
                            <Ionicons name="pencil" size={14} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                        </View>
                    </View>
                )}

                {/* Verified Circular Partners */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Verified Circular Partners</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.partnersScroll}>
                        {PARTNERS.map(partner => (
                            <View key={partner} style={styles.partnerChip}>
                                <Ionicons name="shield-checkmark" size={12} color={colors.success} style={{ marginRight: 6 }} />
                                <Text style={styles.partnerText}>{partner}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>

            </ScrollView>

            {/* Footer CTA */}
            <View style={styles.footer}>
                <Pressable
                    style={[styles.ctaButton, !selectedCondition && styles.ctaButtonDisabled]}
                    disabled={!selectedCondition}
                    onPress={() => {
                        alert("Collection Scheduled!");
                        router.dismissAll();
                    }}
                >
                    <Text style={styles.ctaText}>Schedule Circular Collection</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    backButton: { padding: spacing.xs },
    headerTitle: { color: colors.gold, fontFamily: typography.headings, fontSize: 18, letterSpacing: 2 },

    scrollContent: { paddingBottom: 120 },

    ringContainer: { alignItems: 'center', paddingVertical: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
    ringOuter: {
        width: 160, height: 160, borderRadius: 80,
        borderWidth: 8, borderColor: colors.gold,
        borderTopColor: colors.bgMuted, // Mocking a 75% progress visual
        alignItems: 'center', justifyContent: 'center',
        transform: [{ rotate: '45deg' }]
    },
    ringInner: { alignItems: 'center', transform: [{ rotate: '-45deg' }] },
    ringPercentage: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 36, fontWeight: 'bold' },
    ringLabel: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 10, textTransform: 'uppercase', marginTop: 4 },
    subtitle: { color: colors.textSecond, fontFamily: typography.body, fontSize: 14, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.xl },

    section: { padding: spacing.md, paddingTop: spacing.lg },
    sectionTitle: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 20 },
    sectionDesc: { color: colors.textMuted, fontFamily: typography.body, fontSize: 12, marginTop: 4, marginBottom: spacing.md },

    conditionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    conditionCard: {
        width: (width - spacing.md * 2 - spacing.sm) / 2,
        backgroundColor: colors.bgCard,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center'
    },
    conditionCardActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
    conditionText: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 12, marginTop: spacing.sm },
    conditionTextActive: { color: colors.bg, fontWeight: 'bold' },

    pickupCard: { margin: spacing.md, backgroundColor: colors.bgMuted, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold },
    pickupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    pickupTitle: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 14, marginLeft: spacing.sm, fontWeight: 'bold' },
    premiumBadge: { backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, marginLeft: 'auto' },
    premiumText: { color: colors.bg, fontFamily: typography.mono, fontSize: 8, fontWeight: 'bold' },
    pickupRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, padding: spacing.md, borderRadius: radius.sm, marginBottom: spacing.sm },
    pickupValue: { color: colors.textPrimary, fontFamily: typography.body, fontSize: 12, marginLeft: spacing.sm },

    partnersScroll: { marginTop: spacing.sm },
    partnerChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
    partnerText: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 12 },

    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    ctaButton: { backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.full, alignItems: 'center' },
    ctaButtonDisabled: { backgroundColor: colors.bgMuted, opacity: 0.5 },
    ctaText: { color: colors.bg, fontFamily: typography.mono, fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
});
