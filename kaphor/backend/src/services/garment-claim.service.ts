/**
 * Garment reservation service — prevents double-selling.
 *
 * When a payment is verified, garments are atomically claimed for the order
 * (RESERVED_SALE + reservedOrderId) inside a single transaction using a
 * conditional update. Only the request whose UPDATE actually matches rows
 * wins; a racing buyer's UPDATE matches zero rows and gets a refund.
 *
 * Ownership transfers to the buyer only at delivery (markOrderDelivered),
 * so a pre-delivery refund can cleanly relist the item.
 */

import db from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Atomically reserve all order items for the given order.
 * Idempotent: garments already reserved by this same order pass trivially.
 * Returns false if any garment is missing, not listed, or claimed by another order.
 */
export async function claimGarmentsForOrder(orderId: string, buyerId: string): Promise<boolean> {
  try {
    await (db as any).$transaction(async (tx: any) => {
      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { garmentId: true },
      });

      if (items.length === 0) {
        throw new Error('ORDER_HAS_NO_ITEMS');
      }

      const garmentIds = items.map((i: any) => i.garmentId);

      const result = await tx.garment.updateMany({
        where: {
          id: { in: garmentIds },
          // Only claim garments that are actively listed, in purchase intent, or already ours.
          OR: [
            { lifecycleState: 'LISTED', isActive: true, reservedOrderId: null },
            { lifecycleState: 'PURCHASE_INTENT', isActive: true, reservedOrderId: null },
            { lifecycleState: 'PURCHASE_INTENT', reservedOrderId: orderId },
            { reservedOrderId: orderId },
          ],
        },
        data: {
          lifecycleState: 'RESERVED_SALE',
          reservedOrderId: orderId,
          isActive: false,
        },
      });

      if (result.count !== garmentIds.length) {
        throw new Error('GARMENT_CLAIM_FAILED');
      }
    });
    return true;
  } catch (err) {
    if (!(err instanceof Error && (err.message === 'GARMENT_CLAIM_FAILED' || err.message === 'ORDER_HAS_NO_ITEMS'))) {
      logger.error('claimGarmentsForOrder failed', { orderId, error: err });
    }
    return false;
  }
}

/**
 * Transfer ownership of all order items to the buyer (called at delivery).
 * Also clears the reservation pointer — the sale is now final.
 */
export async function transferGarmentsToBuyer(orderId: string, buyerId: string): Promise<boolean> {
  try {
    await (db as any).$transaction(async (tx: any) => {
      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { garmentId: true },
      });
      const garmentIds = items.map((i: any) => i.garmentId);

      if (garmentIds.length > 0) {
        await tx.garment.updateMany({
          where: { id: { in: garmentIds } },
          data: {
            lifecycleState: 'OWNERSHIP',
            sellerId: buyerId,
            isActive: false,
            reservedOrderId: null,
          },
        });
      }
    });
    return true;
  } catch (err) {
    logger.error('transferGarmentsToBuyer failed', { orderId, error: err });
    return false;
  }
}

/**
 * Release reservations back to the marketplace (refund / cancellation).
 * Restores LISTED state, the original seller, and reactivates the listing.
 */
export async function releaseGarmentReservations(orderId: string, originalSellerId: string): Promise<void> {
  try {
    const items = await db.orderItem.findMany({
      where: { orderId },
      select: { garmentId: true },
    });
    const garmentIds = items.map((i: any) => i.garmentId);

    if (garmentIds.length > 0) {
      await db.garment.updateMany({
        where: { id: { in: garmentIds } },
        data: {
          lifecycleState: 'LISTED',
          isActive: true,
          sellerId: originalSellerId,
          reservedOrderId: null,
        },
      });
    }
  } catch (err) {
    logger.error('releaseGarmentReservations failed', { orderId, error: err });
  }
}
