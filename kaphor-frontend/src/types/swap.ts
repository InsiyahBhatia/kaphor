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
  offeredGarment?: SwapGarmentSnapshot;
  wantedGarment?: SwapGarmentSnapshot;

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

  // Peer reviews
  reviews?: Record<string, { rating: number; comment?: string; reviewerId?: string; reviewerName?: string; createdAt?: string }>;

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
  price?: number;
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

export interface SwapAgreementDisclaimer {
  title: string;
  statutoryReference: string;
  summary: string;
  clauses: Array<{
    heading: string;
    content: string;
  }>;
}

export interface SwapAgreementTerms {
  swapId: string;
  terms: string[];
  disclaimer?: SwapAgreementDisclaimer;
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

export const PLATFORM_LEGAL_DISCLAIMER: SwapAgreementDisclaimer = {
  title: 'INTERMEDIARY SAFE HARBOUR & PLATFORM NON-LIABILITY (INDIAN LAW)',
  statutoryReference: 'Information Technology Act, 2000 (Section 79) • Consumer Protection (E-Commerce) Rules, 2020 • Indian Contract Act, 1872',
  summary: 'Kaphor operates strictly as a peer-to-peer technology facilitator and electronic intermediary under Section 79 of the Information Technology Act, 2000. Kaphor is not a party to any contract, sale, exchange, rental, or purchase between users, and does not manufacture, inspect, warrant, or hold title to any listed goods.',
  clauses: [
    {
      heading: '1. Intermediary Status & Exemption from Liability (IT Act, Sec 79)',
      content: 'Kaphor is an electronic intermediary facilitating communication and exchange between independent users. Under Section 79 of the Information Technology Act, 2000, Kaphor assumes no liability or responsibility for any third-party listings, representations, condition disclosures, or user actions.',
    },
    {
      heading: '2. All Transactions are Direct Bipartite Contracts (Sale, Rent, Swap, Buy)',
      content: 'All swapping, rental, purchase, and selling transactions are direct, private bipartite contracts entered into exclusively between the transacting users under the Indian Contract Act, 1872 and Sale of Goods Act, 1930. Kaphor is not an auctioneer, merchant, lessor, lessee, buyer, or seller, and is NOT RESPONSIBLE for any breach, non-performance, or dispute arising between users.',
    },
    {
      heading: '3. Complete Disclaimer of Warranties & Authenticity ("As Is / Where Is")',
      content: 'All items are offered strictly on an "AS IS, WHERE IS" basis without any express or implied warranties by Kaphor regarding authenticity, brand lineage, market valuation, title, condition, hygienic fitness, or merchantability. Users are required to exercise independent due diligence ("caveat emptor") prior to transacting.',
    },
    {
      heading: '4. Absolute Limitation of Platform Liability & User Indemnity',
      content: 'Kaphor, its founders, directors, affiliates, and agents shall in no event be liable for any direct, indirect, incidental, punitive, or consequential loss, transit loss, courier delays, counterfeit items, personal injury, non-return of rental garments, or financial damages. Users expressly agree to indemnify and hold harmless Kaphor against all third-party claims or proceedings resulting from their listings or transactions.',
    },
    {
      heading: '5. Governing Law & Dispute Jurisdiction',
      content: 'This agreement and all transactions facilitated on Kaphor are governed by and construed in accordance with the substantive laws of the Republic of India. The courts of competent jurisdiction in India shall have exclusive jurisdiction over any legal disputes.',
    },
  ],
};

export const SWAP_AGREEMENT_TERMS: string[] = [
  'Item Authenticity & Condition: I warrant that the item I am offering strictly matches the photos, condition, brand, and description in my listing.',
  'Platform Non-Liability (All Transactions): I acknowledge that Kaphor operates solely as an electronic intermediary under Section 79 of the Information Technology Act, 2000 and is NOT RESPONSIBLE or liable for any transaction in swapping, rental, buying, or selling.',
  'Direct User Contract: I understand that all transactions (swaps, rentals, purchases, and sales) are direct bipartite contracts between users, and Kaphor is not a party, guarantor, or merchant of the goods.',
  'Dispatch & Tracking: I agree to securely package and dispatch the item with valid courier tracking within 3 business days of signing.',
  'Escrow & Security Deposit: I acknowledge that a security deposit of ₹500 is held in automated escrow and released after mutual delivery confirmation.',
  'Dispute Window & Evidence: I agree that any claim regarding damaged or materially different goods must be opened with unboxing evidence within 48 hours of delivery.',
  'Indemnification & Indian Law: I agree to indemnify and hold harmless Kaphor from any claims arising from my listing or transaction, and agree that Indian law and Indian courts govern this agreement.',
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

export interface BarterRingNode {
  userId: string;
  userName: string;
  giveGarmentId: string;
  giveGarmentTitle: string;
  giveGarmentImage: string;
  receiveGarmentId: string;
  receiveGarmentTitle: string;
  receiveGarmentImage: string;
}

export interface BarterRing {
  ringId: string;
  ringType: '2_WAY' | '3_WAY';
  confidenceScore: number;
  participants: BarterRingNode[];
}
