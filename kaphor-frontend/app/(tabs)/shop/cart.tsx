import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cartService } from '../../../src/services/cartService';
import { colors, typography } from '../../../src/theme';
import { useAuth } from '../../../src/context/AuthContext';
import { KaphorImage } from '../../../src/components/KaphorImage';

const { width } = Dimensions.get('window');

export default function CartScreen() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        loadCart();
    }, []);

    const loadCart = async () => {
        try {
            const data = await cartService.getCart();
            setItems(data);
        } catch (e) {
            console.error('Cart load failed', e);
        } finally {
            setLoading(false);
        }
    };

    const removeItem = async (id: string) => {
        try {
            await cartService.removeFromCart(id);
            setItems(prev => prev.filter(item => item.garmentId !== id));
        } catch (e) {
            Alert.alert('Error', 'Failed to remove item');
        }
    };

    const total = items.reduce((sum, item) => sum + (item.garment?.price || 0), 0);

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={colors.red} />
                <Text style={styles.loadingText}>ACCESSING ARCHIVE...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color={colors.charcoal} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>SECURE CART</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {items.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="cart-outline" size={64} color={colors.charcoal} />
                        <Text style={styles.emptyText}>ARCHIVE CART IS EMPTY</Text>
                        <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/(tabs)/shop')}>
                            <Text style={styles.shopBtnText}>BROWSE GARMENTS →</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    items.map((item, index) => (
                        <View key={item.id} style={styles.cartItem}>
                            <KaphorImage 
                                uri={item.garment?.images?.[0]} 
                                style={styles.itemImage} 
                                contentFit="cover"
                            />

                            <View style={styles.itemInfo}>
                                <Text style={styles.brand}>{item.garment?.brand}</Text>
                                <Text style={styles.title}>{item.garment?.title}</Text>
                                <Text style={styles.price}>₹{((item.garment?.price || 0) / 100).toLocaleString()}</Text>
                            </View>
                            <TouchableOpacity onPress={() => removeItem(item.garmentId)} style={styles.removeBtn}>
                                <Ionicons name="trash-sharp" size={20} color={colors.red} />
                            </TouchableOpacity>
                        </View>
                    ))
                )}
            </ScrollView>

            {items.length > 0 && (
                <View style={styles.footer}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>ESTIMATED TOTAL</Text>
                        <Text style={styles.totalValue}>₹{(total / 100).toLocaleString()}</Text>
                    </View>
                    <TouchableOpacity 
                        style={styles.checkoutBtn}
                        onPress={() => Alert.alert('Checkout Alert', 'Proceed to global checkout?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'PROCEED', onPress: () => router.push(`/(tabs)/shop/checkout/${items[0].garmentId}` as any) }
                        ])}
                    >
                        <Text style={styles.checkoutBtnText}>PROCEED TO PURCHASE</Text>
                    </TouchableOpacity>
                    <Text style={styles.secureText}>SECURE CARBON-NEUTRAL DELIVERY</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.cream },
    center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontFamily: typography.mono, fontSize: 12, color: colors.charcoal, letterSpacing: 1, fontWeight: '800' },
    
    header: { 
        paddingTop: 24, paddingHorizontal: 24, flexDirection: 'row', 
        justifyContent: 'space-between', alignItems: 'center', 
        backgroundColor: colors.cream, paddingBottom: 16,
        borderBottomWidth: 2, borderBottomColor: colors.charcoal
    },
    headerTitle: { color: colors.charcoal, fontSize: 16, fontFamily: typography.mono, letterSpacing: 2, fontWeight: '800' },
    
    content: { padding: 24, paddingBottom: 160 },
    
    cartItem: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, 
        padding: 16, marginBottom: 16, borderWidth: 2, borderColor: colors.charcoal,
        shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 
    },
    itemImage: { width: 70, height: 80, borderWidth: 1, borderColor: colors.charcoal },
    imagePlaceholder: { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    itemInfo: { flex: 1, marginLeft: 16 },
    brand: { color: colors.red, fontFamily: typography.mono, fontSize: 10, letterSpacing: 1, fontWeight: '800', textTransform: 'uppercase' },
    title: { color: colors.charcoal, fontSize: 20, fontFamily: typography.headings, marginTop: 4 },
    price: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 14, fontWeight: '800', marginTop: 4 },
    removeBtn: { padding: 8, borderWidth: 1, borderColor: colors.red, backgroundColor: 'rgba(204,17,17,0.05)' },
    
    footer: { 
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 24, paddingBottom: 40, backgroundColor: colors.cream, 
        borderTopWidth: 2, borderTopColor: colors.charcoal 
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 },
    totalLabel: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 12, letterSpacing: 1, fontWeight: '800' },
    totalValue: { color: colors.charcoal, fontSize: 32, fontFamily: typography.headings },
    
    checkoutBtn: { 
        backgroundColor: colors.charcoal, height: 60, justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: colors.charcoal,
        shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4
    },
    checkoutBtnText: { color: colors.cream, fontFamily: typography.mono, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
    secureText: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 10, textAlign: 'center', marginTop: 16, letterSpacing: 2 },
    
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: colors.charcoal, fontFamily: typography.mono, fontSize: 16, marginTop: 24, marginBottom: 24, fontWeight: '800' },
    shopBtn: { borderWidth: 2, borderColor: colors.charcoal, backgroundColor: colors.red, paddingVertical: 14, paddingHorizontal: 24 },
    shopBtnText: { color: colors.white, fontFamily: typography.mono, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});
