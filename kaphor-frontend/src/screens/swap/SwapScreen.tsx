import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { KaphorImage } from '../../components/KaphorImage';
import { colors, typography, spacing, radius } from '../../theme';
import { Garment } from '../../types';
import { garmentService } from '../../services/garmentService';
import { swapService } from '../../services/swapService';

const { width } = Dimensions.get('window');

// Extended Mock Garment type to include 'mine' flag or handle logic natively
export function SwapScreen() {
    const { wantedId } = useLocalSearchParams<{ wantedId: string }>();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // The garment the user wants to get
    const [wantedGarment, setWantedGarment] = useState<Garment | null>(null);

    // The garments the user owns that are eligible
    const [myEligibleGarments, setMyEligibleGarments] = useState<Garment[]>([]);
    const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchSwapData = async () => {
            try {
                // Fetch the wanted garment from API
                if (wantedId) {
                    const garment = await garmentService.getGarmentById(wantedId);
                    setWantedGarment(garment);
                }
                // Fetch user's own listings as eligible swap items
                try {
                    const myListings = await garmentService.getGarments({ mine: true });
                    setMyEligibleGarments(Array.isArray(myListings) ? myListings : []);
                } catch {
                    setMyEligibleGarments([]);
                }
                setLoading(false);
            } catch (error) {
                console.error(error);
                setLoading(false);
            }
        };

        fetchSwapData();
    }, [wantedId]);

    const handleSendRequest = async () => {
        if (!selectedGarmentId) {
            Alert.alert('Selection Required', 'Please select an item to offer.');
            return;
        }

        setSubmitting(true);
        try {
            await swapService.createSwapRequest({
                garmentId: wantedGarment!.id,
                offeredGarmentId: selectedGarmentId,
            });

            Alert.alert('Request Sent!', 'Your swap proposal has been sent successfully.', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            Alert.alert('Error', 'Failed to send swap request.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !wantedGarment) {
        return (
            <SafeAreaView style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={colors.crimson} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.headerTitle}>PROPOSE SWAP</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Two-Panel Layout */}
                <View style={styles.panelsContainer}>

                    {/* Their Offer */}
                    <View style={styles.panel}>
                        <Text style={styles.panelTitle}>THEIR ITEM</Text>
                        <View style={styles.card}>
                            <KaphorImage uri={wantedGarment.images[0]} style={styles.panelImage} contentFit="cover" />
                            <Text style={styles.brandText} numberOfLines={1}>{wantedGarment.brand}</Text>
                            <Text style={styles.titleText} numberOfLines={2}>{wantedGarment.title}</Text>
                        </View>
                    </View>

                    <View style={styles.exchangeIconContainer}>
                        <Ionicons name="swap-horizontal" size={24} color={colors.crimson} />
                    </View>

                    {/* My Offer */}
                    <View style={styles.panel}>
                        <Text style={styles.panelTitle}>YOUR OFFER</Text>
                        <View style={[styles.card, !selectedGarmentId && styles.cardEmpty]}>
                            {selectedGarmentId ? (
                                <>
                                    {myEligibleGarments.find(g => g.id === selectedGarmentId) && (
                                        <>
                                            <KaphorImage
                                                uri={myEligibleGarments.find(g => g.id === selectedGarmentId)!.images[0]}
                                                style={styles.panelImage}
                                                contentFit="cover"
                                            />
                                            <Text style={styles.brandText} numberOfLines={1}>{myEligibleGarments.find(g => g.id === selectedGarmentId)!.brand}</Text>
                                            <Text style={styles.titleText} numberOfLines={2}>{myEligibleGarments.find(g => g.id === selectedGarmentId)!.title}</Text>
                                        </>
                                    )}
                                </>
                            ) : (
                                <Text style={styles.emptyText}>Select below</Text>
                            )}
                        </View>
                    </View>

                </View>

                {/* My Eligible Garments Picker */}
                <Text style={styles.sectionTitle}>SELECT GARMENT TO OFFER</Text>
                {myEligibleGarments.length === 0 ? (
                    <Text style={styles.noItemsText}>You have no eligible accessories listed for swap.</Text>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                        {myEligibleGarments.map(garment => (
                            <Pressable
                                key={garment.id}
                                style={[styles.pickerItem, selectedGarmentId === garment.id && styles.pickerItemActive]}
                                onPress={() => setSelectedGarmentId(garment.id)}
                            >
                                <KaphorImage uri={garment.images[0]} style={styles.pickerItemImage} contentFit="cover" />
                                {selectedGarmentId === garment.id && (
                                    <View style={styles.checkmarkBadge}>
                                        <Ionicons name="checkmark" size={12} color={colors.white} />
                                    </View>
                                )}
                            </Pressable>
                        ))}
                    </ScrollView>
                )}

                {/* Optional Message */}
                <Text style={styles.sectionTitle}>MESSAGE (OPTIONAL)</Text>
                <TextInput
                    style={styles.messageInput}
                    placeholder="E.g., I'd love to trade my unworn scarf for this belt!"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={4}
                    value={message}
                    onChangeText={setMessage}
                    textAlignVertical="top"
                />

            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    style={[styles.sendBtn, (!selectedGarmentId || submitting) && styles.sendBtnDisabled]}
                    onPress={handleSendRequest}
                    disabled={!selectedGarmentId || submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color={colors.bg} />
                    ) : (
                        <Text style={styles.sendBtnText}>SEND REQUEST</Text>
                    )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    loaderContainer: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    backButton: { padding: spacing.xs },
    headerTitle: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 14, letterSpacing: 1 },

    scrollContent: { padding: spacing.lg, paddingBottom: 100 },

    panelsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
    panel: { width: (width - spacing.lg * 2 - 40) / 2 },
    panelTitle: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1, textAlign: 'center', marginBottom: spacing.sm },

    card: { backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, alignItems: 'center', height: 200 },
    cardEmpty: { borderStyle: 'dashed', justifyContent: 'center', backgroundColor: 'transparent' },
    panelImage: { width: '100%', height: 120, borderRadius: radius.sm, marginBottom: spacing.sm },
    emptyText: { color: colors.textMuted, fontFamily: typography.body, fontSize: 12 },

    brandText: { color: colors.crimson, fontFamily: typography.mono, fontSize: 10, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center', fontWeight: '800' },
    titleText: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 13, textAlign: 'center', fontWeight: '600' },

    exchangeIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },

    sectionTitle: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 12, letterSpacing: 1.5, marginBottom: spacing.sm, marginTop: spacing.lg, fontWeight: '800' },
    noItemsText: { color: colors.textMuted, fontFamily: typography.body, fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 20 },

    pickerScroll: { flexDirection: 'row', marginBottom: spacing.lg },
    pickerItem: { width: 90, height: 110, borderRadius: 12, marginRight: spacing.md, borderWidth: 2, borderColor: colors.border, overflow: 'hidden', position: 'relative' },
    pickerItemActive: { borderColor: colors.crimson },
    pickerItemImage: { width: '100%', height: '100%' },
    checkmarkBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.crimson, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

    messageInput: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, color: colors.textPrimary, fontFamily: typography.body, fontSize: 14, minHeight: 120 },

    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: 40, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
    sendBtn: { 
        backgroundColor: colors.crimson, 
        paddingVertical: 18, 
        borderRadius: radius.lg, 
        alignItems: 'center', 
        justifyContent: 'center',
        shadowColor: colors.crimson,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    sendBtnDisabled: { backgroundColor: colors.bgMuted, shadowOpacity: 0, elevation: 0 },
    sendBtnText: { color: colors.white, fontFamily: typography.mono, fontSize: 16, fontWeight: '900', letterSpacing: 2 }
});
