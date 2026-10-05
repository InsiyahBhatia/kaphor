import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { cacheWrap } from '../lib/cache';

export class ImpactService {
    static async updateImpactOnTransaction(orderId: string) {
        const order = await db.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });
        if (!order) return;
        for (const item of order.items) {
            await this.recordImpact(item.garmentId, order.buyerId);
        }
    }

    /**
     * Calculates and records the environmental impact of a transaction / purchase.
     * Formula: Base Savings = Baseline × Reuse Factor
     */
    static async recordImpact(garmentId: string, userId: string) {
        try {
            const garment = await db.garment.findUnique({
                where: { id: garmentId },
                include: { seller: true }
            });

            if (!garment) return;

            let material = garment.materialId
                ? await db.materialImpact.findUnique({ where: { id: garment.materialId } })
                : null;

            if (!material) {
                const matchedId = await this.findMatchingMaterialId(garment.title, garment.category, garment.fabric);
                if (matchedId) {
                    material = await db.materialImpact.findUnique({ where: { id: matchedId } });
                    try {
                        await db.garment.update({
                            where: { id: garmentId },
                            data: { materialId: matchedId }
                        });
                    } catch {}
                }
            }

            // Increment reuse count
            await db.garment.update({
                where: { id: garmentId },
                data: { reuseCount: { increment: 1 } }
            });

            const co2Saved = material ? (material.co2Kg * material.reuseFactor) : 2.4; // kg CO2 saved
            const waterSaved = material ? (material.waterL * material.reuseFactor) : 1800; // Liters water saved
            const wasteSaved = material ? material.avgWeightG : 450; // Grams textile waste diverted

            // Update user's impact record
            await db.impactRecord.upsert({
                where: { userId },
                create: {
                    userId,
                    carbonSavedKg: Number(co2Saved.toFixed(2)),
                    waterSavedL: Math.round(waterSaved),
                    wasteSavedG: Math.round(wasteSaved),
                    itemsCirculated: 1
                },
                update: {
                    carbonSavedKg: { increment: Number(co2Saved.toFixed(2)) },
                    waterSavedL: { increment: Math.round(waterSaved) },
                    wasteSavedG: { increment: Math.round(wasteSaved) },
                    itemsCirculated: { increment: 1 }
                }
            });

            logger.info(`Recorded transaction impact for user ${userId}: ${co2Saved}kg CO2, ${waterSaved}L Water, ${wasteSaved}g Waste`);
        } catch (error) {
            logger.error('Failed to record transaction impact', { error });
        }
    }

    /**
     * Calculates and records avoided emissions when a user wears a garment from their Digital Closet.
     * Rewearing existing clothing avoids new fast-fashion manufacturing emissions.
     */
    static async recordWearImpact(garmentId: string, userId: string) {
        try {
            const garment = await db.garment.findUnique({
                where: { id: garmentId },
            });

            if (!garment) return { carbonSavedKg: 0.3, waterSavedL: 120, totalWears: 1 };

            // Material-scaled wear savings
            let perWearCo2 = 0.35; // kg CO2 avoided per wear
            let perWearWater = 120; // L water avoided per wear

            if (garment.fabric) {
                const f = garment.fabric.toLowerCase();
                if (f.includes('silk') || f.includes('pashmina') || f.includes('wool') || f.includes('cashmere')) {
                    perWearCo2 = 0.75;
                    perWearWater = 350;
                } else if (f.includes('khadi') || f.includes('linen') || f.includes('cotton') || f.includes('denim')) {
                    perWearCo2 = 0.45;
                    perWearWater = 180;
                }
            }

            // Increment garment wear/reuse count
            const updatedGarment = await db.garment.update({
                where: { id: garmentId },
                data: { reuseCount: { increment: 1 } }
            });

            // Credit avoided emissions to user's impact record
            const updatedImpact = await db.impactRecord.upsert({
                where: { userId },
                create: {
                    userId,
                    carbonSavedKg: Number(perWearCo2.toFixed(2)),
                    waterSavedL: Math.round(perWearWater),
                    wasteSavedG: 0,
                    itemsCirculated: 0
                },
                update: {
                    carbonSavedKg: { increment: Number(perWearCo2.toFixed(2)) },
                    waterSavedL: { increment: Math.round(perWearWater) },
                }
            });

            logger.info(`Recorded wear impact for user ${userId}: +${perWearCo2}kg CO2, +${perWearWater}L Water`);

            return {
                carbonSavedKg: perWearCo2,
                waterSavedL: perWearWater,
                totalWears: updatedGarment.reuseCount,
                totalUserCarbonSaved: updatedImpact.carbonSavedKg,
            };
        } catch (error) {
            logger.error('Failed to record wear impact', { error });
            return { carbonSavedKg: 0.35, waterSavedL: 120, totalWears: 1 };
        }
    }

    /**
     * Records textile waste diversion when a garment reaches end-of-life and is routed to circular path.
     */
    static async recordCircularEndImpact(garmentId: string, userId: string, destination: 'UPCYCLE' | 'RECYCLE' = 'RECYCLE') {
        try {
            const garment = await db.garment.findUnique({ where: { id: garmentId } });
            const textileWeightG = 450; // Average garment weight diverted in grams

            await db.impactRecord.upsert({
                where: { userId },
                create: {
                    userId,
                    carbonSavedKg: 1.2,
                    waterSavedL: 400,
                    wasteSavedG: textileWeightG,
                    itemsCirculated: 1,
                    itemsUpcycled: destination === 'UPCYCLE' ? 1 : 0,
                    itemsRecycled: destination === 'RECYCLE' ? 1 : 0,
                },
                update: {
                    carbonSavedKg: { increment: 1.2 },
                    waterSavedL: { increment: 400 },
                    wasteSavedG: { increment: textileWeightG },
                    itemsCirculated: { increment: 1 },
                    ...(destination === 'UPCYCLE'
                        ? { itemsUpcycled: { increment: 1 } }
                        : { itemsRecycled: { increment: 1 } }),
                }
            });

            logger.info(`Recorded circular end impact for user ${userId}: +${textileWeightG}g waste diverted to ${destination}`);
        } catch (error) {
            logger.error('Failed to record circular end impact', { error });
        }
    }

    /**
     * Attempts to find the best matching material baseline for a garment.
     */
    static async findMatchingMaterialId(title: string, category: string, fabric?: string | null): Promise<string | null> {
        // The materials table is static reference data: cache it for 10 minutes instead of reading it on every call.
        const allMaterials: any[] = await cacheWrap<any[]>('market:materials', 600_000, () => db.materialImpact.findMany());
        
        const searchStr = `${title} ${fabric || ''} ${category}`.toLowerCase();

        // 1. Try exact matches on traditional Indian textiles first
        const traditional = allMaterials.filter((m: any) => m.category === 'Indian Traditional');
        for (const m of traditional) {
            if (searchStr.includes(m.name.toLowerCase().split(' (')[0])) return m.id;
        }

        // 2. Try matching by material name
        for (const m of allMaterials) {
            const baseName = m.name.toLowerCase().split(' (')[0];
            if (searchStr.includes(baseName)) return m.id;
        }

        // 3. Fallback by category
        if (category.toLowerCase().includes('shirt') || category.toLowerCase().includes('top')) {
            const cottonShirt = allMaterials.find((m: any) => m.name === 'Cotton (Shirt)');
            return cottonShirt ? cottonShirt.id : null;
        }
        if (category.toLowerCase().includes('jeans') || category.toLowerCase().includes('denim')) {
            const cottonJeans = allMaterials.find((m: any) => m.name === 'Cotton (Jeans)');
            return cottonJeans ? cottonJeans.id : null;
        }

        return null;
    }
}

/** Standalone export for controller compatibility */
export const updateImpactOnTransaction = (orderId: string) => ImpactService.updateImpactOnTransaction(orderId);
