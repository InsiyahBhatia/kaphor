/**
 * Kaphor Payment System Types
 * 
 * Covers: Buying (shop), Selling (payouts), Renting (deposits + fees)
 * Gateway: Razorpay
 */

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'HELD_IN_ESCROW'
  | 'RELEASED_TO_SELLER'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'FAILED';

export type PaymentType = 'PURCHASE' | 'RENTAL_FEE' | 'RENTAL_DEPOSIT' | 'RENTAL_REFUND' | 'SELLER_PAYOUT';

export type EscrowStatus =
  | 'HELD'
  | 'RELEASED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface PaymentOrder {
  id: string;
  orderId: string;
  type: PaymentType;
  amount: number;        // whole rupees
  currency: string;
  status: PaymentStatus;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  createdAt: string;
  paidAt?: string;
  refundedAt?: string;
}

export interface RazorpayOrderResponse {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
}

export interface PaymentVerification {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface EscrowEntry {
  id: string;
  rentalId: string;
  amount: number;
  status: EscrowStatus;
  heldAt: string;
  releasedAt?: string;
}

export interface PaymentTransaction {
  id: string;
  type: PaymentType;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  referenceId: string;
  /** What referenceId points at, so the UI can navigate correctly */
  linkType?: 'order' | 'rental';
  createdAt: string;
}

export interface SellerPayoutAccount {
  id: string;
  accountHolderName: string;
  accountNumber: string;     // last 4 digits only
  ifsc: string;
  bankName: string;
  upiId?: string;
  isDefault: boolean;
}

export interface SellerPayout {
  id: string;
  orderId: string;
  amount: number;
  commission: number;        // Kaphor's cut
  netAmount: number;         // amount - commission
  status: 'PENDING' | 'PROCESSING' | 'HELD_IN_ESCROW' | 'INSPECTION_WINDOW_48H' | 'SETTLED' | 'PAID' | 'FAILED';
  createdAt: string;
  paidAt?: string;
}

export interface RefundRequest {
  orderId: string;
  reason: string;
  amount?: number;  // partial refund if omitted = full
}

export interface RentalPaymentBreakdown {
  rentalDays: number;
  dailyRate: number;
  rentalFee: number;         // dailyRate * rentalDays
  securityDeposit: number;   // refundable deposit
  insuranceFee: number;      // optional coverage
  deliveryFee: number;
  totalAmount: number;       // sum of all above
}
