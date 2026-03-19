import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { KaphorImage } from '../KaphorImage';
import { colors, typography, spacing, radius } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { Garment } from '../../types';

interface GarmentCardProps {
    item: Garment & { fitScore?: number };
    onPress: () => void;
    onSave?: () => void;
    isSaved?: boolean;
}

export function GarmentCard({ item, onPress, onSave, isSaved }: GarmentCardProps) {
    // Extract primary image or use placeholder
    const imageUrl = item.images && item.images.length > 0 ? item.images[0] : 'https://via.placeholder.com/300x400/1A0C10/F5F0EB?text=No+Image';

    // Format fit score
    const fitPercentage = item.fitScore !== undefined ? Math.round(item.fitScore * 100) : null;
    const formattedPrice = item.price ? `$${item.price.toFixed(2)}` : 'N/A';

    return (
        <Pressable style={styles.container} onPress={onPress}>
            <View style={styles.imageContainer}>
                <KaphorImage
                    uri={imageUrl}
                    style={styles.image}
                    contentFit="cover"
                />

                {/* Fit Score Badge */}
                {fitPercentage !== null && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{fitPercentage}% FIT</Text>
                    </View>
                )}

                {/* Save/Heart Icon */}
                <Pressable style={styles.saveButton} onPress={onSave} hitSlop={10}>
                    <Ionicons
                        name={isSaved ? "heart" : "heart-outline"}
                        size={20}
                        color={isSaved ? colors.crimson : colors.textPrimary}
                    />
                </Pressable>
            </View>

            <View style={styles.detailsContainer}>
                <Text style={styles.brand} numberOfLines={1}>{item.brand}</Text>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.price}>{formattedPrice}</Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        margin: spacing.xs,
        backgroundColor: colors.bg,
        borderRadius: radius.md,
        overflow: 'hidden',
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 3 / 4,
        borderRadius: radius.md,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: colors.bgCard,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    badge: {
        position: 'absolute',
        top: spacing.sm,
        left: spacing.sm,
        backgroundColor: colors.crimson,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.full,
    },
    badgeText: {
        color: colors.textPrimary,
        fontFamily: typography.mono,
        fontSize: 10,
        fontWeight: 'bold',
    },
    saveButton: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        backgroundColor: 'rgba(26, 12, 16, 0.4)',
        borderRadius: radius.full,
        padding: 6,
    },
    detailsContainer: {
        paddingVertical: spacing.sm,
        paddingHorizontal: 2,
    },
    brand: {
        color: colors.textMuted,
        fontFamily: typography.mono,
        fontSize: 10,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    title: {
        color: colors.textPrimary,
        fontFamily: typography.headings,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    price: {
        color: colors.gold,
        fontFamily: typography.mono,
        fontSize: 12,
    },
});
