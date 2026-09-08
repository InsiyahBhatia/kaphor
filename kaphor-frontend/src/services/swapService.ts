/**
 * Kaphor Swap Transaction Service
 *
 * Secure peer-to-peer garment exchange with:
 * - Escrow-based security deposits
 * - Agreement terms with digital acceptance
 * - Address sharing (only post-agreement)
 * - Shipping tracking for both parties
 * - Dispute resolution
 */

import api from './api';
import type {
  SwapTransaction,
  SwapStatus,
  SwapAgreementTerms,
  SwapDispute,
  SwapAddress,
  SwapTracking,
  SwapGarmentSnapshot,
} from '../types/swap';

export const swapService = {
  // ─── LISTING / FEED ──────────────────────────────────────────

  /** Get all swappable garments (ACCESSORY_SWAP listing type) */
  async getSwapFeed(params?: { category?: string; limit?: number }) {
    const { data } = await api.get('/swaps/feed', { params });
    return data.data;
  },

  /** Get all swap requests for the current user (incoming + outgoing) */
  async getMySwaps(): Promise<SwapTransaction[]> {
    const { data } = await api.get('/swaps');
    return data.data;
  },

  // ─── REQUEST FLOW ────────────────────────────────────────────

  /**
   * Create a new swap request.
   * Security: Only users with listed garments can initiate.
   */
  async createSwapRequest(payload: {
    garmentOfferedId: string;
    garmentWantedId: string;
    message?: string;
    conditionPhotos?: string[];   // Base64 or URLs of condition evidence
  }): Promise<SwapTransaction> {
    const { data } = await api.post('/swaps', {
      ...payload,
      conditionPhotos: payload.conditionPhotos || [],
    });
    return data.data;
  },

  /** Get details of a single swap transaction */
  async getSwapById(swapId: string): Promise<SwapTransaction> {
    const { data } = await api.get(`/swaps/${swapId}`);
    return data.data;
  },

  // ─── AGREEMENT FLOW ──────────────────────────────────────────

  /**
   * Accept or reject a swap request.
   * ACCEPTED moves to AGREEMENT_PENDING where both parties review terms.
   * REJECTED closes the swap.
   */
  async respondToSwap(
    swapId: string,
    response: 'ACCEPTED' | 'REJECTED',
  ): Promise<SwapTransaction> {
    const { data } = await api.patch(`/swaps/${swapId}`, {
      action: response,
    });
    return data.data;
  },

  /**
   * Sign the swap agreement terms.
   * Both parties must sign before addresses are shared.
   */
  async signAgreement(swapId: string): Promise<SwapTransaction> {
    const { data } = await api.post(`/swaps/${swapId}/sign-agreement`);
    return data.data;
  },

  /** Get the current agreement terms for a swap */
  async getAgreementTerms(swapId: string): Promise<SwapAgreementTerms> {
    const { data } = await api.get(`/swaps/${swapId}/agreement`);
    return data.data;
  },

  // ─── ADDRESS SHARING ─────────────────────────────────────────

  /**
   * Share delivery address with the other party.
   * Only callable after BOTH parties have signed the agreement.
   * Address is encrypted on the backend and only visible to the other party.
   */
  async shareAddress(
    swapId: string,
    address: SwapAddress,
  ): Promise<SwapTransaction> {
    const { data } = await api.post(`/swaps/${swapId}/address`, address);
    return data.data;
  },

  /** Get the other party's shipping address (only available post-agreement) */
  async getShippingAddress(swapId: string): Promise<SwapAddress | null> {
    const { data } = await api.get(`/swaps/${swapId}/shipping-address`);
    return data.data;
  },

  // ─── TRACKING ────────────────────────────────────────────────

  /**
   * Mark item as shipped and provide tracking details.
   * Security: Only accepted after security deposit is confirmed.
   */
  async markShipped(
    swapId: string,
    tracking: SwapTracking,
  ): Promise<SwapTransaction> {
    const { data } = await api.post(`/swaps/${swapId}/ship`, tracking);
    return data.data;
  },

  /**
   * Mark the received item as delivered & confirm condition matches.
   * Once both parties confirm, the swap is completed and deposits released.
   */
  async confirmReceived(
    swapId: string,
    conditionSatisfied: boolean,
  ): Promise<SwapTransaction> {
    const { data } = await api.post(`/swaps/${swapId}/confirm-received`, {
      conditionSatisfied,
    });
    return data.data;
  },

  // ─── SECURITY DEPOSIT ────────────────────────────────────────

  /**
   * Pay the security deposit (via Razorpay).
   * Required before shipping labels are generated.
   * Deposit is refunded when both parties confirm receipt.
   */
  async paySecurityDeposit(swapId: string): Promise<{
    razorpayOrderId: string;
    amount: number;
  }> {
    const { data } = await api.post(`/swaps/${swapId}/pay-deposit`);
    return data.data;
  },

  /** Verify Razorpay signature for swap security deposit */
  async verifySecurityDeposit(
    swapId: string,
    payload: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ): Promise<{ success: boolean; message: string; data: any }> {
    const { data } = await api.post(`/swaps/${swapId}/verify-deposit`, payload);
    return data;
  },

  /** Get security deposit status */
  async getDepositStatus(swapId: string): Promise<{
    amount: number;
    paid: boolean;
    paidBy: string | null;
    releasedAt: string | null;
  }> {
    const { data } = await api.get(`/swaps/${swapId}/deposit`);
    return data.data;
  },

  // ─── DISPUTE ─────────────────────────────────────────────────

  /**
   * Open a dispute on a swap transaction.
   * Triggers admin review and freezes the swap in DISPUTED status.
   */
  async openDispute(
    swapId: string,
    payload: {
      reason: string;
      description: string;
      evidencePhotos?: string[];
    },
  ): Promise<SwapDispute> {
    const { data } = await api.post(`/swaps/${swapId}/dispute`, payload);
    return data.data;
  },

  /** Get dispute details */
  async getDispute(swapId: string): Promise<SwapDispute | null> {
    const { data } = await api.get(`/swaps/${swapId}/dispute`);
    return data.data;
  },

  // ─── ACTIONS ─────────────────────────────────────────────────

  /**
   * Cancel a swap (only possible before both parties have shipped).
   * Deposits are refunded if paid.
   */
  async cancelSwap(swapId: string): Promise<SwapTransaction> {
    const { data } = await api.post(`/swaps/${swapId}/cancel`);
    return data.data;
  },

  // ─── HELPERS ─────────────────────────────────────────────────

  /** Get which actions are available for a given swap and user */
  getAvailableActions(
    swap: SwapTransaction,
    userId: string,
  ): SwapActionItem[] {
    const isInitiator = swap.initiatorId === userId;
    const isReceiver = swap.receiverId === userId;
    const actions: SwapActionItem[] = [];

    if (!isInitiator && !isReceiver) return actions;

    // REQUESTED → owner can accept/reject
    if (swap.status === 'REQUESTED' && isReceiver) {
      actions.push(
        { id: 'accept', label: 'ACCEPT REQUEST', icon: 'checkmark-circle', color: '#1E3B2F', action: 'accept' },
        { id: 'reject', label: 'DECLINE', icon: 'close-circle', color: '#A82222', action: 'reject' },
      );
    }

    // AGREEMENT_PENDING → both parties sign
    if (swap.status === 'AGREEMENT_PENDING') {
      const alreadySigned = isInitiator
        ? swap.initiatorAcceptedTerms
        : swap.receiverAcceptedTerms;
      if (!alreadySigned) {
        actions.push({
          id: 'sign',
          label: 'SIGN AGREEMENT',
          icon: 'document-text',
          color: '#1E1F22',
          action: 'sign',
        });
      }
    }

    // AGREEMENT_SIGNED → share address, then pay deposit
    if (swap.status === 'AGREEMENT_SIGNED') {
      const hasSharedAddress = isInitiator
        ? !!swap.initiatorAddress
        : !!swap.receiverAddress;
      if (!hasSharedAddress) {
        actions.push({
          id: 'share_address',
          label: 'SHARE ADDRESS',
          icon: 'location',
          color: '#1C2B4A',
          action: 'share_address',
        });
      } else {
        // Address shared, now pay security deposit
        actions.push({
          id: 'pay_deposit',
          label: 'PAY SECURITY DEPOSIT (₹500)',
          icon: 'shield-checkmark',
          color: '#C95F12',
          action: 'pay_deposit',
        });
      }
    }

    // ADDRESS_SHARED → pay deposit if not paid, then ship
    if (swap.status === 'ADDRESS_SHARED' || swap.status === 'SHIPPING_PENDING') {
      const alreadyShipped = isInitiator
        ? !!swap.initiatorTracking
        : !!swap.receiverTracking;
      const depositPaid = !!swap.depositEscrowId;

      if (!depositPaid) {
        actions.push({
          id: 'pay_deposit',
          label: 'PAY SECURITY DEPOSIT (₹500)',
          icon: 'shield-checkmark',
          color: '#C95F12',
          action: 'pay_deposit',
        });
      } else if (!alreadyShipped) {
        actions.push({
          id: 'ship',
          label: 'MARK AS SHIPPED',
          icon: 'cube',
          color: '#1C2B4A',
          action: 'ship',
        });
      }
    }

    // SHIPPED/BOTH_SHIPPED → confirm received
    if (
      (swap.status === 'SHIPPED' || swap.status === 'BOTH_SHIPPED' || swap.status === 'IN_TRANSIT') &&
      this.hasReceivedOtherPackage(swap, isInitiator)
    ) {
      actions.push({
        id: 'confirm_received',
        label: 'CONFIRM RECEIVED',
        icon: 'checkmark-done',
        color: '#1E3B2F',
        action: 'confirm_received',
      });
    }

    // DELIVERED (both) → dispute if condition not satisfied
    if (swap.status === 'DELIVERED' || swap.status === 'BOTH_DELIVERED') {
      actions.push({
        id: 'dispute',
        label: 'OPEN DISPUTE',
        icon: 'warning',
        color: '#C95F12',
        action: 'dispute',
      });
      if (!swap.disputedAt) {
        actions.push({
          id: 'confirm_received',
          label: 'CONFIRM & COMPLETE',
          icon: 'checkmark-done',
          color: '#1E3B2F',
          action: 'confirm_received',
        });
      }
    }

    // Any pre-shipping status → cancel
    if (['REQUESTED', 'AGREEMENT_PENDING', 'AGREEMENT_SIGNED', 'ADDRESS_SHARED', 'SHIPPING_PENDING'].includes(swap.status)) {
      actions.push({
        id: 'cancel',
        label: 'CANCEL SWAP',
        icon: 'close',
        color: '#A82222',
        action: 'cancel',
      });
    }

    // DELIVERED (both) → dispute
    if (swap.status === 'DELIVERED' || swap.status === 'BOTH_DELIVERED') {
      actions.push({
        id: 'dispute',
        label: 'OPEN DISPUTE',
        icon: 'warning',
        color: '#C95F12',
        action: 'dispute',
      });
    }

    return actions;
  },

  /** Check if the user's package has been received by the other party */
  hasReceivedOtherPackage(swap: SwapTransaction, isInitiator: boolean): boolean {
    if (isInitiator) {
      return !!swap.receiverTracking?.deliveredAt;
    }
    return !!swap.initiatorTracking?.deliveredAt;
  },

  /** Get the status display info */
  getStatusMeta(status: SwapStatus): { label: string; color: string } {
    const map: Record<SwapStatus, { label: string; color: string }> = {
      REQUESTED: { label: 'Request Sent', color: '#C95F12' },
      AGREEMENT_PENDING: { label: 'Awaiting Agreement', color: '#C95F12' },
      AGREEMENT_SIGNED: { label: 'Agreed', color: '#1E3B2F' },
      ADDRESS_SHARED: { label: 'Address Shared', color: '#1C2B4A' },
      SHIPPING_PENDING: { label: 'Awaiting Shipping', color: '#1C2B4A' },
      SHIPPED: { label: 'Shipped', color: '#1C2B4A' },
      BOTH_SHIPPED: { label: 'Both Shipped', color: '#1C2B4A' },
      IN_TRANSIT: { label: 'In Transit', color: '#1C2B4A' },
      DELIVERED: { label: 'Received', color: '#1E3B2F' },
      BOTH_DELIVERED: { label: 'Both Received', color: '#1E3B2F' },
      COMPLETED: { label: 'Completed', color: '#1E3B2F' },
      DISPUTED: { label: 'Dispute Open', color: '#A82222' },
      CANCELLED: { label: 'Cancelled', color: '#9A8E7E' },
    };
    return map[status] ?? { label: status, color: '#9A8E7E' };
  },

  /** Submit a peer review for a completed swap */
  async submitSwapReview(swapId: string, rating: number, comment?: string): Promise<{ rating: number; comment?: string }> {
    const { data } = await api.post(`/swaps/${swapId}/review`, { rating, comment });
    return data.data;
  },
};

interface SwapActionItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  action: string;
}
