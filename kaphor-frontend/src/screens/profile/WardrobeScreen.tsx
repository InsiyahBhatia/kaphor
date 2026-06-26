import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../../theme';
import { KaphorImage } from '../../components/KaphorImage';
import { Header } from '../../components/common/Header';
import { userService } from '../../services/userService';
import api from '../../services/api';

const { width } = Dimensions.get('window');

const ListingCard = ({ item, onLogWear, onSellIntent }: { item: any, onLogWear?: () => void, onSellIntent?: () => void }) => (
    <View style={styles.listingCard}>
        <KaphorImage uri={item.image || (item.images && item.images[0]) || 'https://picsum.photos/300/400'} style={styles.listingImage} />
        {item.status && (
            <View style={[styles.statusBadge, item.status === 'Decline' && { backgroundColor: colors.error }]}>
                <Text style={styles.statusBadgeText}>{item.status.toUpperCase()}</Text>
            </View>
        )}
        <View style={styles.listingInfo}>
            <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.listingPrice}>{item.price?.toString().startsWith('₹') ? item.price : `₹${item.price}`}</Text>
        </View>
        {onLogWear && (
            <Pressable style={styles.logWearBtn} onPress={onLogWear}>
                <Text style={styles.logWearBtnText}>I WORE THIS</Text>
            </Pressable>
        )}
        {onSellIntent && (
            <Pressable style={[styles.logWearBtn, { borderColor: colors.charcoal }]} onPress={onSellIntent}>
                <Text style={[styles.logWearBtnText, { color: colors.charcoal }]}>READY TO SELL</Text>
            </Pressable>
        )}
    </View>
);

export function WardrobeScreen() {
    const router = useRouter();
    const [wardrobe, setWardrobe] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadWardrobeData = async () => {
        setLoading(true);
        try {
            const data = await userService.getMyWardrobe();
            setWardrobe(data);
        } catch (error) {
            console.error('Failed to load wardrobe', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWardrobeData();
    }, []);

    const handleLogWear = async (garmentId: string) => {
        try {
            await api.post('/interactions', { garmentId, eventType: 'LOG_WEAR' });
            Alert.alert('Logged!', 'You logged wearing this item. Your digital wardrobe decay has been reset!');
        } catch (err) {
            Alert.alert('Error', 'Could not log wear.');
        }
    };

    const handleSellIntent = async (garmentId: string) => {
        try {
            await api.post('/interactions', { garmentId, eventType: 'SELL_INTENT' });
            Alert.alert('Success', 'Item marked for sale! It has been moved to your Listings as a Draft.');
            loadWardrobeData(); // Refresh list to remove item
        } catch (err) {
            Alert.alert('Error', 'Could not mark item for sale.');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Header 
                title="DIGITAL CLOSET" 
                leftElement={
                    <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
                        <Ionicons name="chevron-back" size={24} color={colors.charcoal} />
                    </Pressable>
                }
            />
            {loading ? (
                <View style={styles.emptyState}>
                    <ActivityIndicator color={colors.red} size="large" />
                </View>
            ) : wardrobe.length > 0 ? (
                <FlatList
                    data={wardrobe}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    contentContainerStyle={styles.gridContainer}
                    columnWrapperStyle={styles.row}
                    renderItem={({ item }) => (
                        <ListingCard 
                            item={item} 
                            onLogWear={() => handleLogWear(item.id)} 
                            onSellIntent={() => handleSellIntent(item.id)} 
                        />
                    )}
                />
            ) : (
                <View style={styles.emptyState}>
                    <Ionicons name="shirt-outline" size={64} color={colors.textMuted} />
                    <Text style={styles.emptyText}>Your digital closet is empty.</Text>
                    <Text style={styles.emptySubtext}>Items you purchase will appear here.</Text>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.cream },
    gridContainer: { padding: spacing.sm, paddingBottom: 100 },
    row: { justifyContent: 'space-between', marginBottom: spacing.sm },
    listingCard: { width: (width - spacing.sm * 3) / 2, backgroundColor: colors.white, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.charcoal },
    listingImage: { width: '100%', aspectRatio: 3/4 },
    statusBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
    statusBadgeText: { color: 'white', fontFamily: typography.mono, fontSize: 8, fontWeight: 'bold' },
    listingInfo: { padding: spacing.sm },
    listingTitle: { color: colors.charcoal, fontFamily: typography.body, fontSize: 13, marginBottom: 2 },
    listingPrice: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 12 },
    logWearBtn: { backgroundColor: colors.white, paddingVertical: 6, margin: spacing.sm, marginTop: 0, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.red, alignItems: 'center' },
    logWearBtnText: { color: colors.red, fontFamily: typography.mono, fontSize: 10, fontWeight: 'bold' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyText: { color: colors.charcoal, fontFamily: typography.headings, fontSize: 18, marginTop: 16, textAlign: 'center' },
    emptySubtext: { color: colors.textMuted, fontFamily: typography.mono, fontSize: 12, marginTop: 8, textAlign: 'center' }
});
