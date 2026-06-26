import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { ListingType } from '@prisma/client';

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
     * Calculates and records the environmental impact of a lifecycle event.
     * Formula: Base Savings = Baseline × Reuse Factor
     */
    static async recordImpact(garmentId: string, userId: string) {
        try {
            const garment = await db.garment.findUnique({
                where: { id: garmentId },
                include: { seller: true }
            });

            if (!garment || !garment.materialId) {
                logger.warn(`Skipping impact record: Garment ${garmentId} has no material baseline.`);
                return;
            }

            const material = await db.materialImpact.findUnique({
                where: { id: garment.materialId }
            });

            if (!material) return;

            // Increment reuse count
            const updatedGarment = await db.garment.update({
                where: { id: garmentId },
                data: { reuseCount: { increment: 1 } }
            });

            // If it's the first reuse, we only count subsequent ones for "Total Carbon Saved"?
            // Spec says: Total Impact = Base × (Reuse Count − 1)
            // But individual event savings = Base × Reuse Factor
            
            const co2Saved = material.co2Kg * material.reuseFactor;
            const waterSaved = material.waterL * material.reuseFactor;
            const wasteSaved = material.avgWeightG; // Full weight saved per circulation

            // Update user's impact record
            await db.impactRecord.upsert({
                where: { userId },
                create: {
                    userId,
                    carbonSavedKg: co2Saved,
                    waterSavedL: waterSaved,
                    wasteSavedG: wasteSaved,
                    itemsCirculated: 1
                },
                update: {
                    carbonSavedKg: { increment: co2Saved },
                    waterSavedL: { increment: waterSaved },
                    wasteSavedG: { increment: wasteSaved },
                    itemsCirculated: { increment: 1 }
                }
            });

            logger.info(`Recorded impact for user ${userId}: ${co2Saved}kg CO2, ${waterSaved}L Water`);
        } catch (error) {
            logger.error('Failed to record impact', { error });
        }
    }

    /**
     * Attempts to find the best matching material baseline for a garment.
     */
    static async findMatchingMaterialId(title: string, category: string, fabric?: string | null): Promise<string | null> {
        const allMaterials = await db.materialImpact.findMany();
        
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

export default ImpactService;
