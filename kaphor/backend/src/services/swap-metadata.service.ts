import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

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

  securityDepositAmount: number; // in paise (e.g. 50000 = ₹500)
  securityDepositPaidBy?: string;
  securityDepositPaidAt?: string;
  initiatorDepositPaid?: boolean;
  initiatorDepositPaymentId?: string;
  receiverDepositPaid?: boolean;
  receiverDepositPaymentId?: string;
  depositEscrowId?: string;
  depositReleasedAt?: string;
  swapFee: number; // in paise (e.g. 25000 = ₹250)

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

const DATA_FILE = path.join(__dirname, '../../data/swap_metadata.json');

function loadMetadata(): Record<string, SwapMetadataRecord> {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf-8');
      return {};
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as Record<string, SwapMetadataRecord>;
  } catch (err) {
    logger.error('Failed to read swap metadata file', { error: err });
    return {};
  }
}

function saveMetadata(data: Record<string, SwapMetadataRecord>): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    logger.error('Failed to write swap metadata file', { error: err });
  }
}

export function getSwapMetadata(swapId: string): SwapMetadataRecord {
  const all = loadMetadata();
  if (all[swapId]) {
    return all[swapId];
  }
  const defaultRecord: SwapMetadataRecord = {
    swapId,
    initiatorAcceptedTerms: false,
    receiverAcceptedTerms: false,
    securityDepositAmount: 50000,
    swapFee: 25000,
    conditionPhotos: { offeredPhotos: [], wantedPhotos: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  all[swapId] = defaultRecord;
  saveMetadata(all);
  return defaultRecord;
}

export function updateSwapMetadata(
  swapId: string,
  updater: ((record: SwapMetadataRecord) => void) | Partial<SwapMetadataRecord>
): SwapMetadataRecord {
  const all = loadMetadata();
  const record = all[swapId] || {
    swapId,
    initiatorAcceptedTerms: false,
    receiverAcceptedTerms: false,
    securityDepositAmount: 50000,
    swapFee: 25000,
    conditionPhotos: { offeredPhotos: [], wantedPhotos: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (typeof updater === 'function') {
    updater(record);
  } else {
    Object.assign(record, updater);
  }
  record.updatedAt = new Date().toISOString();
  all[swapId] = record;
  saveMetadata(all);
  return record;
}
