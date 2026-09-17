import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cartService } from '../../src/services/cartService';
import { DossierLoading } from '../../src/components/common/DossierLoading';
import { colors, typography } from '../../src/theme';
import { Header } from '../../src/components/common/Header';
import { KaphorImage } from '../../src/components/KaphorImage';
import api, { cachedGet, fetchFresh, invalidateCache } from '../../src/services/api';

const { width } = Dimensions.get('window');

export default function CartScreen() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const router = useRouter();

    const loadCart = async () => {
        try {
            // cachedGet shows stale data instantly, refreshes in background
            const data = await cachedGet('/cart');
            const validItems = Array.isArray(data) ? data.filter(i => i.garment) : [];
            setItems(validItems);
            setSelectedIds(new Set(validItems.map(i => i.garmentId)));
        } catch (e) {
            console.error('Cart load failed', e);
        } finally {
            setLoading(false);
        }
    };

    // useFocusEffect handles mount + every focus — cachedGet returns instantly if data exists
    useFocusEffect(
        React.useCallback(() => {
            loadCart();
        }, [])
    );

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const removeItem = async (id: string) => {
        try {
            await cartService.removeFromCart(id);
            invalidateCache('/cart');
            setItems(prev => prev.filter(item => item.garmentId !== id));
            const next = new Set(selectedIds);
            next.delete(id);
            setSelectedIds(next);
        } catch (e) {
            Alert.alert('Error', 'Failed to remove item');
        }
    };

    const selectedItems = items.filter(i => selectedIds.has(i.garmentId));
    const total = selectedItems.reduce((sum, item) => sum + (item.garment?.price || 0), 0);

    const handleCheckout = async () => {
        if (selectedIds.size === 0) {
            Alert.alert('Selection Required', 'Please select at least one item to purchase.');
            return;
        }
        setLoading(true);
        try {
            const freshCart = await fetchFresh<any[]>('/cart').catch(() => items);
            const availableSelectedIds = new Set(
                (Array.isArray(freshCart) ? freshCart : [])
                    .filter((item) => item.garment && selectedIds.has(item.garmentId))
                    .map((item) => item.garmentId)
            );
            if (availableSelectedIds.size === 0) {
                setItems([]);
                setSelectedIds(new Set());
                Alert.alert('Cart Updated', 'Those items are no longer in your cart. Please add them again before checkout.');
                return;
            }
            const { data } = await api.post('/orders/cart', { garmentIds: Array.from(availableSelectedIds) });
            const orderId = data.data.id || data.data.orderId;
            if (!orderId) {
              Alert.alert('Error', 'Could not create order. Please try again.');
              setLoading(false);
              return;
            }
            // Navigate to delivery address screen first
            router.push(`/(tabs)/shop/checkout/delivery?orderId=${orderId}` as any);
        } catch (e: any) {
            const msg = e.response?.data?.message || e.message || 'Failed to initialize checkout';
            Alert.alert('Checkout Error', msg);
            console.error('Checkout failed', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <DossierLoading variant="cart" compact />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Header title="CART" />
            <ScrollView contentContainerStyle={styles.content}>
                {items.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="cart-outline" size={64} color={colors.charcoal} />
                        <Text style={styles.emptyText}>YOUR CART IS EMPTY</Text>
                        <TouchableOpacity style={styles.shopBtn} onPress={() => router.push('/(tabs)/shop')}>
                            <Text style={styles.shopBtnText}>BROWSE GARMENTS →</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    items.map((item) => {
                        const garment = item.garment;
                        const images = garment.images;
                        const imageUrl = Array.isArray(images) ? images[0] : typeof images === 'string' ? images : null;
                        const isSelected = selectedIds.has(item.garmentId);

                        return (
                            <View key={item.id} style={[styles.cartItem, !isSelected && { opacity: 0.6 }]}>
                                <TouchableOpacity 
                                    style={[styles.checkbox, isSelected && styles.checkboxActive]} 
                                    onPress={() => toggleSelection(item.garmentId)}
                                >
                                    {isSelected && <Ionicons name="checkmark" size={14} color={colors.white} />}
                                </TouchableOpacity>

                                <KaphorImage 
                                    uri={imageUrl} 
                                    style={styles.itemImage} 
                                    contentFit="cover"
                                />
                                <View style={styles.itemInfo}>
                                    <Text style={styles.brand}>{item.garment.brand}</Text>
                                    <Text style={styles.title} numberOfLines={1}>{item.garment.title}</Text>
                                    <Text style={styles.price}>₹{Math.round(item.garment.price || 0).toLocaleString('en-IN')}</Text>
                                </View>
                                <TouchableOpacity onPress={() => removeItem(item.garmentId)} style={styles.removeBtn}>
                                    <Ionicons name="trash-sharp" size={20} color={colors.red} />
                                </TouchableOpacity>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {items.length > 0 && (
                <View style={styles.footer}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>TOTAL</Text>
                        <Text style={styles.totalValue}>₹{Math.round(total).toLocaleString('en-IN')}</Text>
                    </View>
                    <TouchableOpacity 
                        style={styles.checkoutBtn}
                        onPress={handleCheckout}
                    >
                        <Text style={styles.checkoutBtnText}>CHECKOUT</Text>
                    </TouchableOpacity>
                    <Text style={styles.secureText}>CARBON-NEUTRAL DELIVERY</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.cream },
    center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontFamily: typography.mono, fontSize: 12, color: colors.charcoal, letterSpacing: 1, fontWeight: '800' },
    content: { padding: 24, paddingBottom: 160 },
    cartItem: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, 
        padding: 16, marginBottom: 16, borderWidth: 2, borderColor: colors.charcoal,
        shadowColor: colors.charcoal, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 
    },
    itemImage: { width: 70, height: 80, borderWidth: 1, borderColor: colors.charcoal },
    checkbox: { 
        width: 24, height: 24, borderWidth: 2, borderColor: colors.charcoal, 
        marginRight: 12, justifyContent: 'center', alignItems: 'center' 
    },
    checkboxActive: { backgroundColor: colors.charcoal },
    itemInfo: { flex: 1, marginLeft: 4 },
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
