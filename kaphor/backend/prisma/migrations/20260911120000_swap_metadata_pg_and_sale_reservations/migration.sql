-- AlterEnum: new lifecycle state for garments atomically reserved by a paid order
ALTER TYPE "GarmentState" ADD VALUE 'RESERVED_SALE';

-- AlterTable: swap workflow metadata moves from data/swap_metadata.json into the row
ALTER TABLE "swaps" ADD COLUMN     "metadata" JSONB;

-- AlterTable: reservation pointer set at payment-verify time inside the claim transaction
ALTER TABLE "garments" ADD COLUMN     "reservedOrderId" TEXT;

-- CreateIndex
CREATE INDEX "garments_reservedOrderId_idx" ON "garments"("reservedOrderId");
