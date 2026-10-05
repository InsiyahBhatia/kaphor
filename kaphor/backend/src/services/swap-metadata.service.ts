/**
 * Swap workflow metadata — persisted in Postgres (swaps.metadata JSONB).
 *
 * Replaces the previous data/swap_metadata.json file store which lost data on
 * redeploy/multi-instance deployments and raced under concurrent writes.
 * All operations now go through Prisma against the swap row itself.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import db from '../lib/prisma';

export interface SwapAddressData {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface SwapTrackingData {
  courierPartner: string;
  trackingNumber: string;
  trackingUrl?: string;
  shippedAt: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
}

export interface SwapDisputeData {
  swapId: string;
  openedBy: string;
  reason: string;
  description: string;
  evidencePhotos: string[];
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
  resolvedAt?: string;
  resolution?: string;
}

export interface SwapMetadataRecord {
  swapId: string;
  initiatorAcceptedTerms?: boolean;
  receiverAcceptedTerms?: boolean;
  termsAcceptedAt?: string;

  initiatorAddress?: SwapAddressData;
  receiverAddress?: SwapAddressData;
  addressSharedAt?: string;

  initiatorTracking?: SwapTrackingData;
  receiverTracking?: SwapTrackingData;

  initiatorReceived?: boolean;
  receiverReceived?: boolean;

  conditionPhotos?: {
    offeredPhotos: string[];
    wantedPhotos: string[];
  };

  securityDepositAmount: number; // in Rupees (e.g. 500 = ₹500)
  securityDepositPaidBy?: string;
  securityDepositPaidAt?: string;
  initiatorDepositPaid?: boolean;
  initiatorDepositPaymentId?: string;
  receiverDepositPaid?: boolean;
  receiverDepositPaymentId?: string;
  depositEscrowId?: string;
  depositReleasedAt?: string;
  swapFee: number; // in Rupees (e.g. 250 = ₹250)

  dispute?: SwapDisputeData;
  disputedAt?: string;
  disputeReason?: string;
  disputeResolution?: string;
  cancelledAt?: string;
  reviews?: Record<string, { rating: number; comment?: string; createdAt: string }>;

  subStatus?: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_DEPOSIT = 500;
const DEFAULT_SWAP_FEE = 250;

function defaultRecord(swapId: string): SwapMetadataRecord {
  return {
    swapId,
    initiatorAcceptedTerms: false,
    receiverAcceptedTerms: false,
    securityDepositAmount: DEFAULT_DEPOSIT,
    swapFee: DEFAULT_SWAP_FEE,
    conditionPhotos: { offeredPhotos: [], wantedPhotos: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Rehydrate a legacy record written by the old JSON-file store, if any. */
async function importLegacyRecordIfNeeded(swapId: string): Promise<void> {
  try {
    // Lazy require keeps the service importable in build environments without fs access.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path') as typeof import('path');
    const DATA_FILE = path.join(__dirname, '../../data/swap_metadata.json');
    if (!fs.existsSync(DATA_FILE)) return;

    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const all = JSON.parse(raw);
    const legacy = all[swapId];
    if (!legacy) return;

    // One-time import: backfill fields the DB row may not have yet.
    await db.swap.update({
      where: { id: swapId },
      data: {
        metadata: {
          ...(legacy as any),
          swapId,
          securityDepositAmount: (legacy.securityDepositAmount && legacy.securityDepositAmount >= 1000) ? Math.round(legacy.securityDepositAmount / 100) : (legacy.securityDepositAmount || DEFAULT_DEPOSIT),
          swapFee: (legacy.swapFee && legacy.swapFee >= 1000) ? Math.round(legacy.swapFee / 100) : (legacy.swapFee || DEFAULT_SWAP_FEE),
          updatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    // Remove from the legacy file so this import runs only once.
    delete all[swapId];
    fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch {
    // Best-effort migration; the DB record remains authoritative either way.
  }
}

/** Read a swap's workflow metadata, creating the default record on first access. */
export async function getSwapMetadata(swapId: string, preloadedMetadata?: unknown): Promise<SwapMetadataRecord> {
  // List endpoints already loaded swaps.metadata with the swap row: reuse it instead of one query per swap.
  const swap =
    preloadedMetadata && typeof preloadedMetadata === 'object' && !Array.isArray(preloadedMetadata)
      ? { metadata: preloadedMetadata }
      : await db.swap.findUnique({
          where: { id: swapId },
          select: { metadata: true },
        });

  if (!swap) {
    throw new Error(`Swap not found: ${swapId}`);
  }

  if (swap.metadata && typeof swap.metadata === 'object') {
    const meta = swap.metadata as any;
    if (meta.securityDepositAmount && meta.securityDepositAmount >= 1000) {
      meta.securityDepositAmount = Math.round(meta.securityDepositAmount / 100);
    }
    if (meta.swapFee && meta.swapFee >= 1000) {
      meta.swapFee = Math.round(meta.swapFee / 100);
    }
    return meta as SwapMetadataRecord;
  }

  // First access with no metadata — check legacy file, else seed defaults.
  await importLegacyRecordIfNeeded(swapId);
  const fresh = await db.swap.findUnique({
    where: { id: swapId },
    select: { metadata: true },
  });
  if (fresh?.metadata && typeof fresh.metadata === 'object') {
    const meta = fresh.metadata as any;
    if (meta.securityDepositAmount && meta.securityDepositAmount >= 1000) {
      meta.securityDepositAmount = Math.round(meta.securityDepositAmount / 100);
    }
    if (meta.swapFee && meta.swapFee >= 1000) {
      meta.swapFee = Math.round(meta.swapFee / 100);
    }
    return meta as SwapMetadataRecord;
  }

  const seed = defaultRecord(swapId);
  await db.swap.update({
    where: { id: swapId },
    data: { metadata: seed as unknown as Prisma.InputJsonValue },
  });
  return seed;
}

/**
 * Update a swap's workflow metadata.
 *
 * Uses a row-level lock (SELECT ... FOR UPDATE inside a transaction) so
 * concurrent actions from both parties (signing, shipping, confirming,
 * deposits) cannot clobber each other — the exact race the JSON file had.
 *
 * updater may be a mutator function or a plain partial object, mirroring the
 * previous API so call sites port over 1:1.
 */
export async function updateSwapMetadata(
  swapId: string,
  updater: ((record: SwapMetadataRecord) => void) | Partial<SwapMetadataRecord>
): Promise<SwapMetadataRecord> {
  return (db as unknown as PrismaClient).$transaction(async (tx: any) => {
    // Row-level lock serializes concurrent metadata writers for this swap.
    const rows: Array<{ metadata: unknown }> = await tx.$queryRaw`
      SELECT metadata FROM swaps WHERE id = ${swapId} FOR UPDATE
    `;
    if (!rows || rows.length === 0) {
      throw new Error(`Swap not found: ${swapId}`);
    }

    let record: SwapMetadataRecord;
    const existing = rows[0].metadata;
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      record = existing as unknown as SwapMetadataRecord;
    } else {
      record = defaultRecord(swapId);
    }

    if (typeof updater === 'function') {
      updater(record);
    } else {
      Object.assign(record, updater);
    }
    record.swapId = swapId;
    record.updatedAt = new Date().toISOString();

    await tx.swap.update({
      where: { id: swapId },
      data: { metadata: record as unknown as Prisma.InputJsonValue },
    });
    return record;
  });
}

export { Prisma };
