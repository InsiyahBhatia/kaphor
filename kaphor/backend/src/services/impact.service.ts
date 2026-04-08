import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { IMPACT_CONSTANTS, calculateTier } from '../lib/impact.constants';

/**
 * Updates the impact records for both buyer and seller when an order is completed/delivered.
 */
export async function updateImpactOnTransaction(orderId: string) {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            garment: true,
          },
        },
      },
    });

    if (!order) {
      logger.error(`Order ${orderId} not found for impact update`);
      return;
    }

    const { buyerId, sellerId, items } = order;

    let totalCo2Saved = 0;
    let totalWaterSaved = 0;
    const itemsCount = items.length;

    for (const item of items) {
      const type = item.garment.listingType;
      let co2 = 0;
      let water = 0;

      if (type === 'SALE') {
        co2 = IMPACT_CONSTANTS.SALE.CO2_SAVED_KG;
        water = IMPACT_CONSTANTS.SALE.WATER_SAVED_L;
      } else if (type === 'RENTAL') {
        co2 = IMPACT_CONSTANTS.RENTAL.CO2_SAVED_KG;
        water = IMPACT_CONSTANTS.RENTAL.WATER_SAVED_L;
      } else if (type === 'ACCESSORY_SWAP') {
        co2 = IMPACT_CONSTANTS.SALE.CO2_SAVED_KG; // Swap is similar to a sale/new life
        water = IMPACT_CONSTANTS.SALE.WATER_SAVED_L;
      }

      totalCo2Saved += co2;
      totalWaterSaved += water;
    }

    // Update Buyer Impact
    await updateIndividualImpact(buyerId, totalCo2Saved, totalWaterSaved, itemsCount);
    
    // Update Seller Impact
    await updateIndividualImpact(sellerId, totalCo2Saved, totalWaterSaved, itemsCount);

    logger.info(`Impact records updated for order ${orderId}`, {
      orderId,
      totalCo2Saved,
      totalWaterSaved,
      itemsCount,
    });
  } catch (error) {
    logger.error('Failed to update impact on transaction', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function updateIndividualImpact(
  userId: string,
  co2Add: number,
  waterAdd: number,
  itemsAdd: number
) {
  const record = await db.impactRecord.upsert({
    where: { userId },
    create: {
      userId,
      carbonSavedKg: co2Add,
      waterSavedL: waterAdd,
      itemsCirculated: itemsAdd,
    },
    update: {
      carbonSavedKg: { increment: co2Add },
      waterSavedL: { increment: waterAdd },
      itemsCirculated: { increment: itemsAdd },
    },
  });

  // Calculate new tier
  const tierInfo = calculateTier(record.carbonSavedKg);
  
  await db.user.update({
    where: { id: userId },
    data: { tier: tierInfo.currentTier as any },
  });
}
