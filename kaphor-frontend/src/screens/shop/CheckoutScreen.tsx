import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStripe, CardField } from '@stripe/stripe-react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { KaphorImage } from '../../components/KaphorImage';
import { colors, typography, spacing, radius } from '../../theme';
import { Garment } from '../../types';
import api from '../../services/api';

export function CheckoutScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { confirmPayment } = useStripe();

    const [garment, setGarment] = useState<Garment | null>(null);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);

    const [address, setAddress] = useState('123 Luxury Lane, NY 10001');
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        const initCheckout = async () => {
            try {
                const [garmentRes, orderRes] = await Promise.all([
                    api.get(`/garments/${id}`),
                    api.post('/orders', { garmentId: id }),
                ]);
                setGarment(garmentRes.data.data ?? garmentRes.data);
                setClientSecret(orderRes.data.data.clientSecret);
                setOrderId(orderRes.data.data.orderId);
                setLoading(false);
            } catch (error: any) {
                const message = error?.response?.data?.message || 'Unable to initialize checkout.';
                Alert.alert('Error', message);
                router.back();
            }
        };

        initCheckout();
    }, [id]);

    const handlePlaceOrder = async () => {
        if (!clientSecret) return;
        setProcessing(true);

        try {
            const { error, paymentIntent } = await confirmPayment(clientSecret, {
                paymentMethodType: 'Card',
            });

            if (error) {
                Alert.alert('Payment Failed', error.message);
                setProcessing(false);
                return;
            }

            if (!paymentIntent) {
                Alert.alert('Payment Error', 'No payment intent returned.');
                setProcessing(false);
                return;
            }

            setIsComplete(true);
            setProcessing(false);

            setTimeout(() => {
                router.replace('/(tabs)');
            }, 3000);

        } catch (error) {
            Alert.alert('Payment Error', 'An unexpected error occurred.');
            setProcessing(false);
        }
    };

    if (loading || !garment) {
        return (
            <SafeAreaView style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={colors.gold} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.headerTitle}>SECURE CHECKOUT</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Order Summary */}
                <Text style={styles.sectionTitle}>ORDER SUMMARY</Text>
                <View style={styles.summaryCard}>
                    <KaphorImage uri={garment.images[0]} style={styles.summaryImage} contentFit="cover" />
                    <View style={styles.summaryDetails}>
                        <Text style={styles.brandText}>{garment.brand}</Text>
                        <Text style={styles.titleText}>{garment.title}</Text>
                        <Text style={styles.conditionText}>{garment.condition}</Text>
                        <Text style={styles.priceText}>₹{garment.price?.toLocaleString()}</Text>
                    </View>
                </View>

                {/* Shipping Details */}
                <Text style={styles.sectionTitle}>SHIPPING ADDRESS</Text>
                <View style={styles.card}>
                    <View style={styles.addressHeader}>
                        <Ionicons name="location-sharp" size={20} color={colors.gold} />
                        <Text style={styles.addressLabel}>Home (Default)</Text>
                        <Pressable style={styles.editButton}>
                            <Text style={styles.editButtonText}>EDIT</Text>
                        </Pressable>
                    </View>
                    <TextInput
                        style={styles.addressInput}
                        value={address}
                        onChangeText={setAddress}
                        multiline
                    />
                </View>

                {/* Payment Information */}
                <Text style={styles.sectionTitle}>PAYMENT METHOD</Text>
                <View style={styles.card}>
                    <CardField
                        postalCodeEnabled={true}
                        style={styles.cardField}
                        cardStyle={{
                            backgroundColor: colors.bgCard,
                            textColor: colors.textPrimary,
                            placeholderColor: '#A0A0A0',
                            borderRadius: 8,
                            fontSize: 16
                        }}
                    />
                    <View style={styles.secureBadge}>
                        <Ionicons name="lock-closed" size={12} color={colors.textSecond} />
                        <Text style={styles.secureText}>Payments are securely processed by Stripe.</Text>
                    </View>
                </View>

                <View style={styles.totalsContainer}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal</Text>
                        <Text style={styles.totalValue}>₹{garment.price?.toLocaleString()}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Shipping</Text>
                        <Text style={styles.totalValue}>₹25</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.totalRow}>
                        <Text style={styles.grandTotalLabel}>Total</Text>
                        <Text style={styles.grandTotalValue}>₹{(Number(garment.price) + 25).toLocaleString()}</Text>
                    </View>
                </View>

            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    style={[styles.placeOrderBtn, processing && styles.placeOrderBtnDisabled]}
                    onPress={handlePlaceOrder}
                    disabled={processing || isComplete}
                >
                    {processing ? (
                        <ActivityIndicator color={colors.bg} />
                    ) : isComplete ? (
                        <Ionicons name="checkmark-circle" size={24} color={colors.bg} />
                    ) : (
                        <Text style={styles.placeOrderText}>PLACE ORDER</Text>
                    )}
                </Pressable>
            </View>

            {isComplete && (
                <ConfettiCannon
                    count={200}
                    origin={{ x: -10, y: 0 }}
                    colors={[colors.gold, colors.crimson, '#fff', colors.bgCard]}
                    fallSpeed={2500}
                    fadeOut={true}
                />
            )}
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
    sectionTitle: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 12, letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },

    summaryCard: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
    summaryImage: { width: 80, height: 100, borderRadius: radius.sm },
    summaryDetails: { flex: 1, marginLeft: spacing.md, justifyContent: 'center' },
    brandText: { color: colors.gold, fontFamily: typography.mono, fontSize: 10, textTransform: 'uppercase', marginBottom: 2 },
    titleText: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 18, marginBottom: 4 },
    conditionText: { color: colors.textSecond, fontFamily: typography.body, fontSize: 12, marginBottom: spacing.xs },
    priceText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 16, fontWeight: 'bold' },

    card: { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    addressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    addressLabel: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 12, marginLeft: spacing.xs, flex: 1 },
    editButton: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.bgMuted, borderRadius: radius.sm },
    editButtonText: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 10 },
    addressInput: { color: colors.textSecond, fontFamily: typography.body, fontSize: 14, lineHeight: 22 },

    cardField: { width: '100%', height: 50, marginVertical: spacing.sm },
    secureBadge: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
    secureText: { color: colors.textSecond, fontFamily: typography.body, fontSize: 10, marginLeft: 4 },

    totalsContainer: { marginTop: spacing.xl },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    totalLabel: { color: colors.textSecond, fontFamily: typography.body, fontSize: 14 },
    totalValue: { color: colors.textPrimary, fontFamily: typography.mono, fontSize: 14 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
    grandTotalLabel: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 18 },
    grandTotalValue: { color: colors.gold, fontFamily: typography.mono, fontSize: 18, fontWeight: 'bold' },

    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.md, paddingBottom: 40, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
    placeOrderBtn: { backgroundColor: colors.crimson, paddingVertical: 18, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
    placeOrderBtnDisabled: { backgroundColor: colors.bgMuted },
    placeOrderText: { color: colors.bg, fontFamily: typography.mono, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }
});
