/**
 * Kaphor Payment Service
 *
 * Unified payment gateway wrapper for:
 *   - Buying garments (Razorpay)
 *   - Renting garments (fee + security deposit)
 *   - Seller payouts
 *   - Refunds / escrow release
 *
 * Every amount is in whole **rupees** (₹). Paise (x100) is only used when talking to Razorpay checkout/API.
 */

import api from './api';
import type {
  PaymentOrder,
  RazorpayOrderResponse,
  PaymentVerification,
  EscrowEntry,
  PaymentTransaction,
  SellerPayoutAccount,
  SellerPayout,
  RefundRequest,
  RentalPaymentBreakdown,
  PaymentStatus,
} from '../types/payment';
import { colors } from '../theme';

const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '';

const paymentService = {
  // ─── BUYING ─────────────────────────────────────────────────

  /**
   * Create a Razorpay payment order for a purchase order.
   * Returns both the internal order ID and the Razorpay order ID.
   */
  async createPurchaseOrder(orderId: string): Promise<RazorpayOrderResponse> {
    const { data } = await api.post<{ data: RazorpayOrderResponse }>(
      '/payments/razorpay/create-order-for-order',
      { orderId },
    );
    return data.data;
  },

  /**
   * Verify a Razorpay payment signature after successful payment.
   * On success the backend marks the order as PAID and releases funds to escrow.
   */
  async verifyPayment(payload: PaymentVerification): Promise<void> {
    await api.post('/payments/razorpay/verify', payload);
  },

  /**
   * Get payment details for a specific order.
   */
  async getOrderPayment(orderId: string): Promise<PaymentOrder> {
    const { data } = await api.get<{ data: PaymentOrder }>(`/orders/${orderId}/payment`);
    return data.data;
  },

  // ─── RENTING ─────────────────────────────────────────────────

  /**
   * Create a Razorpay order for a rental (fee + deposit combined).
   * The backend splits the payment into rental fee (non-refundable)
   * and security deposit (held in escrow).
   */
  async createRentalPayment(
    rentalOrderId: string,
    options: { includeInsurance?: boolean } = {},
  ): Promise<RazorpayOrderResponse> {
    const { data } = await api.post<{ data: RazorpayOrderResponse }>(
      '/payments/razorpay/create-rental-order',
      { rentalOrderId, includeInsurance: options.includeInsurance !== false },
    );
    return data.data;
  },

  /**
   * Get the rental payment breakdown (fee, deposit, insurance, etc.).
   */
  async getRentalBreakdown(
    garmentId: string,
    days: number,
  ): Promise<RentalPaymentBreakdown> {
    const { data } = await api.post<{ data: RentalPaymentBreakdown }>(
      '/rentals/calculate',
      { garmentId, days },
    );
    return data.data;
  },

  /**
   * Get the current escrow entry for a rental (security deposit status).
   */
  async getRentalEscrow(rentalId: string): Promise<EscrowEntry> {
    const { data } = await api.get<{ data: EscrowEntry }>(`/rentals/${rentalId}/escrow`);
    return data.data;
  },

  // ─── REFUNDS ─────────────────────────────────────────────────

  /**
   * Request a full or partial refund for an order.
   * Partial refunds require an explicit amount.
   */
  async requestRefund(request: RefundRequest): Promise<PaymentOrder> {
    const { data } = await api.post<{ data: PaymentOrder }>(
      '/payments/refund',
      request,
    );
    return data.data;
  },

  /**
   * Release the security deposit back to the renter after a successful return.
   */
  async releaseDeposit(rentalId: string): Promise<EscrowEntry> {
    const { data } = await api.post<{ data: EscrowEntry }>(
      `/rentals/${rentalId}/release-deposit`,
    );
    return data.data;
  },

  // ─── PAYMENT HISTORY ─────────────────────────────────────────

  /**
   * List all payment transactions for the current user.
   */
  async getPaymentHistory(): Promise<PaymentTransaction[]> {
    const { data } = await api.get<{ data: PaymentTransaction[] }>('/payments/history');
    return data.data;
  },

  /**
   * Get status summary of a payment.
   */
  getStatusMeta(status: PaymentStatus): { label: string; color: string } {
    const map: Record<PaymentStatus, { label: string; color: string }> = {
      PENDING: { label: 'PENDING', color: colors.orange },
      PAID: { label: 'PAID', color: colors.forest },
      HELD_IN_ESCROW: { label: 'HELD', color: colors.ink },
      RELEASED_TO_SELLER: { label: 'PAID OUT', color: colors.forest },
      REFUNDED: { label: 'REFUNDED', color: colors.terracottaDark },
      PARTIALLY_REFUNDED: { label: 'PARTIAL REFUND', color: colors.orange },
      FAILED: { label: 'FAILED', color: colors.rose },
    };
    return map[status] ?? { label: status, color: colors.textMuted };
  },

  // ─── SELLER PAYOUTS ──────────────────────────────────────────

  /**
   * Get the seller's saved payout accounts.
   */
  async getPayoutAccounts(): Promise<SellerPayoutAccount[]> {
    const { data } = await api.get<{ data: SellerPayoutAccount[] }>(
      '/users/me/payout-accounts',
    );
    return data.data;
  },

  /**
   * Save a new payout account (bank or UPI).
   */
  async savePayoutAccount(account: {
    accountHolderName: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    upiId?: string;
    isDefault?: boolean;
  }): Promise<SellerPayoutAccount> {
    const { data } = await api.post<{ data: SellerPayoutAccount }>(
      '/users/me/payout-accounts',
      account,
    );
    return data.data;
  },

  /**
   * Remove a saved payout account.
   */
  async removePayoutAccount(accountId: string): Promise<void> {
    await api.delete(`/users/me/payout-accounts/${accountId}`);
  },

  /**
   * Get payout history for the current seller.
   */
  async getPayoutHistory(): Promise<SellerPayout[]> {
    const { data } = await api.get<{ data: SellerPayout[] }>('/payments/payouts');
    return data.data;
  },

  // ─── HELPERS ─────────────────────────────────────────────────

  /** Format pure Rupees to INR display string */
  formatAmount(rupees: number): string {
    return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
  },

  /** Get the Razorpay key ID (or empty string if not configured) */
  getRazorpayKey(): string {
    return RAZORPAY_KEY_ID;
  },

  /** Check if Razorpay is configured */
  isRazorpayConfigured(): boolean {
    return RAZORPAY_KEY_ID.length > 0;
  },
};

export default paymentService;
