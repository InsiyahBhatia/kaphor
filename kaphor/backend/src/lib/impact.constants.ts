export const IMPACT_CONSTANTS = {
    SALE: {
        CO2_SAVED_KG: 8,
        WATER_SAVED_L: 2700
    },
    RENTAL: {
        CO2_SAVED_KG: 3,
        WATER_SAVED_L: 1000
    },
    UPCYCLE: {
        CO2_SAVED_KG: 12,
        WATER_SAVED_L: 3500
    },
    RECYCLE: {
        CO2_SAVED_KG: 5,
        WATER_SAVED_L: 1500
    },
    TREE_CO2_EQ_KG: 9 // 1 French Oak tree equivalent
};

export const TIERS = [
    { name: 'BRONZE', minKg: 0 },
    { name: 'SILVER', minKg: 10 },
    { name: 'GOLD', minKg: 30 },
    { name: 'PLATINUM', minKg: 80 },
    { name: 'ELITE', minKg: 150 }
];

export function calculateTier(carbonSavedKg: number) {
    let currentTier = TIERS[0];
    let nextTier = TIERS[1];

    for (let i = 0; i < TIERS.length; i++) {
        if (carbonSavedKg >= TIERS[i].minKg) {
            currentTier = TIERS[i];
            nextTier = TIERS[i + 1] || TIERS[i]; // Cap at Elite
        } else {
            break;
        }
    }

    const isMaxTier = currentTier.name === 'ELITE';
    const nextTierKgRemaining = isMaxTier ? 0 : nextTier.minKg - carbonSavedKg;
    const progress = isMaxTier ? 100 : (carbonSavedKg - currentTier.minKg) / (nextTier.minKg - currentTier.minKg) * 100;

    return {
        currentTier: currentTier.name,
        nextTier: isMaxTier ? null : nextTier.name,
        nextTierKgRemaining,
        progress: Math.min(100, Math.max(0, progress))
    };
}
