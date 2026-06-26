import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { userService } from '../../services/userService';
import { KaphorImage } from '../../components/KaphorImage';
import { colors, typography, spacing, radius } from '../../theme';

export function MyListingsScreen() {
    const router = useRouter();
    const [listings, setListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchListings = async () => {
            try {
                const data = await userService.getMyListings();
                setListings(data);
            } catch (err) {
                console.error('Failed to fetch listings', err);
            } finally {
                setLoading(false);
            }
        };
        fetchListings();
    }, []);

    const ListingCard = ({ item }: { item: any }) => (
        <Pressable 
            style={styles.card}
            onPress={() => router.push(`/(tabs)/shop/${item.id}`)}
        >
            <KaphorImage uri={item.images[0]} style={styles.image} />
            <View style={styles.cardBody}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.brand}>{item.brand}</Text>
                <View style={styles.row}>
                    <Text style={styles.price}>
                        {item.listingType === 'RENTAL' 
                            ? `₹${((item.rentalPriceDay || 0) / 100).toLocaleString()}/day` 
                            : `₹${((item.price || 0) / 100).toLocaleString()}`
                        }
                    </Text>
                    <View style={[styles.statusBadge, !item.isActive && styles.inactiveBadge]}>
                        <Text style={styles.statusText}>{item.isActive ? item.lifecycleState : 'INACTIVE'}</Text>
                    </View>
                </View>
            </View>
        </Pressable>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.headerTitle}>My Listings</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.gold} />
                </View>
            ) : listings.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="pricetag-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyText}>You haven't listed any garments yet.</Text>
                </View>
            ) : (
                <FlatList
                    data={listings}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <ListingCard item={item} />}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { color: colors.textPrimary, fontFamily: typography.headings, fontSize: 20 },
    
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    emptyText: { color: colors.textMuted, fontFamily: typography.body, marginTop: spacing.md, textAlign: 'center' },
    
    listContent: { padding: spacing.md, gap: spacing.md },
    card: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
    image: { width: 100, height: 120 },
    cardBody: { flex: 1, padding: spacing.sm, justifyContent: 'space-between' },
    title: { color: colors.textPrimary, fontFamily: typography.body, fontSize: 16, fontWeight: 'bold' },
    brand: { color: colors.textSecond, fontFamily: typography.mono, fontSize: 12, marginTop: 4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
    price: { color: colors.gold, fontFamily: typography.mono, fontSize: 16, fontWeight: 'bold' },
    
    statusBadge: { backgroundColor: colors.gold, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
    inactiveBadge: { backgroundColor: colors.bgMuted },
    statusText: { color: colors.bg, fontFamily: typography.mono, fontSize: 10, fontWeight: 'bold' }
});
