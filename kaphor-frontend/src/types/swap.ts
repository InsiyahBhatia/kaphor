/**
 * Kaphor Swap Transaction Types
 *
 * Secure peer-to-peer garment swap with:
 * - Escrow-based ownership transfer
 * - Condition verification with photo evidence
 * - Address sharing only after mutual agreement
 * - Shipping tracking for both parties
 * - Security deposit to prevent fraud
 * - Dispute resolution process
 */

export type SwapStatus =
  | 'REQUESTED'           // Initial request sent
  | 'AGREEMENT_PENDING'   // Both parties reviewing terms
  | 'AGREEMENT_SIGNED'    // Both accepted the swap terms
  | 'ADDRESS_SHARED'      // Addresses exchanged after agreement
  | 'SHIPPING_PENDING'    // Awaiting both parties to mark as shipped
  | 'SHIPPED'             // One party shipped
  | 'BOTH_SHIPPED'        // Both parties shipped
  | 'IN_TRANSIT'          // Items in transit
  | 'DELIVERED'           // One party received
  | 'BOTH_DELIVERED'      // Both parties received
  | 'COMPLETED'           // Ownership transferred, deposits released
  | 'DISPUTED'            // Dispute opened
  | 'CANCELLED';          // Cancelled before agreement

export interface SwapTransaction {
  id: string;
  initiatorId: string;
  receiverId: string;
  status: SwapStatus;

  // Garments
  garmentOfferedId: string;      // What initiator gives
  garmentWantedId: string;       // What initiator receives
  garmentOffered?: SwapGarmentSnapshot;
  garmentWanted?: SwapGarmentSnapshot;

  // Agreement
  agreementSignedAt?: string;
  initiatorAcceptedTerms?: boolean;
  receiverAcceptedTerms?: boolean;
  termsAcceptedAt?: string;

  // Address sharing (only visible after agreement)
  initiatorAddress?: SwapAddress;
  receiverAddress?: SwapAddress;
  addressSharedAt?: string;

  // Shipping
  initiatorTracking?: SwapTracking;
  receiverTracking?: SwapTracking;

  // Security deposit (held in escrow)
  securityDepositAmount: number;  // in paise
  securityDepositPaidBy?: string; // userId who paid
  depositEscrowId?: string;
  depositReleasedAt?: string;

  // Platform fee
  swapFee: number;               // in paise, Kaphor's fee

  // Condition verification
  conditionPhotos?: {
    offeredPhotos: string[];      // Photos of offered garment at swap time
    wantedPhotos: string[];       // Photos of wanted garment at swap time
  };

  // Timeline
  createdAt: string;
  agreedAt?: string;
  shippedAt?: string;
  bothShippedAt?: string;
  completedAt?: string;

  // Dispute
  disputedAt?: string;
  disputeReason?: string;
  disputeResolution?: string;

  // Message
  message?: string;

  // Users
  initiator?: { id: string; displayName: string; username: string; avatar: string | null };
  receiver?: { id: string; displayName: string; username: string; avatar: string | null };
}

export interface SwapGarmentSnapshot {
  id: string;
  title: string;
  brand: string;
  images: string[];
  category: string;
  size: string;
  condition: string;
  estimatedValue: number;  // in paise, for fairness check
}

export interface SwapAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface SwapTracking {
  courierPartner: string;
  trackingNumber: string;
  trackingUrl?: string;
  shippedAt: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
}

export interface SwapAgreementTerms {
  swapId: string;
  terms: string[];
  acceptedByInitiator: boolean;
  acceptedByReceiver: boolean;
  signedAt?: string;
}

export interface SwapDispute {
  swapId: string;
  openedBy: string;
  reason: string;
  description: string;
  evidencePhotos: string[];
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
  resolvedAt?: string;
  resolution?: string;
}

export const SWAP_AGREEMENT_TERMS: string[] = [
  'I confirm the garment I am offering matches the photos and description in my listing.',
  'I agree to ship the garment within 3 business days of the agreement being signed.',
  'I understand that a security deposit of ₹500 will be held until both parties confirm receipt.',
  'I will use the provided shipping label with tracking for safe delivery.',
  'I agree that if the garment I receive does not match the listing, I may open a dispute within 48 hours of delivery.',
  'I understand that the swap fee (5% of estimated value) is non-refundable after shipping.',
];

export const SWAP_STATUS_LABELS: Record<SwapStatus, string> = {
  REQUESTED: 'Request Sent',
  AGREEMENT_PENDING: 'Awaiting Agreement',
  AGREEMENT_SIGNED: 'Agreed — Share Address',
  ADDRESS_SHARED: 'Address Shared',
  SHIPPING_PENDING: 'Awaiting Shipping',
  SHIPPED: 'Item Shipped',
  BOTH_SHIPPED: 'Both Shipped',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Item Received',
  BOTH_DELIVERED: 'Both Received',
  COMPLETED: 'Completed',
  DISPUTED: 'Dispute Open',
  CANCELLED: 'Cancelled',
};
