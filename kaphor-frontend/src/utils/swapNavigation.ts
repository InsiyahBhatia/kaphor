import { swapService } from '../services/swapService';
import type { SwapTransaction } from '../types/swap';

/**
 * Centrally determines the exact live ongoing moment of a swap transaction
 * and navigates the user directly to the relevant screen:
 *
 * 1. REQUESTED -> Details / proposal negotiation screen
 * 2. AGREEMENT_PENDING -> Digital Agreement contract signing screen (if unsigned) or Shipping
 * 3. AGREEMENT_SIGNED / ADDRESS_SHARED / SHIPPED / DELIVERED -> Shipping & Escrow Tracking screen
 * 4. COMPLETED -> Completed transaction dossier & Mutual Peer Review screen
 */
export async function navigateToLiveSwapStage(
  router: any,
  swapOrId: string | SwapTransaction,
  currentUserId?: string
): Promise<void> {
  try {
    let swap: SwapTransaction;

    if (typeof swapOrId === 'string') {
      swap = await swapService.getSwapById(swapOrId);
    } else {
      swap = swapOrId;
    }

    if (!swap || !swap.id) {
      return;
    }

    const swapId = swap.id;
    const isInitiator = currentUserId ? swap.initiatorId === currentUserId : true;
    const isReceiver = currentUserId ? swap.receiverId === currentUserId : false;

    // 1. Initial proposal awaiting acceptance / counter
    if (swap.status === 'REQUESTED') {
      router.push(`/(tabs)/swap/details?swapId=${swapId}` as any);
      return;
    }

    // 2. Agreement pending: check if current user needs to sign agreement
    if (swap.status === 'AGREEMENT_PENDING') {
      const myAccepted = isInitiator ? swap.initiatorAcceptedTerms : swap.receiverAcceptedTerms;
      if (!myAccepted) {
        router.push(`/(tabs)/swap/agreement?swapId=${swapId}` as any);
        return;
      }
      // If current user already signed, guide to shipping / escrow coordination
      router.push(`/(tabs)/swap/shipping?swapId=${swapId}` as any);
      return;
    }

    // 3. Agreement signed, shipping, transit, or delivered
    if (
      [
        'AGREEMENT_SIGNED',
        'ADDRESS_SHARED',
        'SHIPPING_PENDING',
        'SHIPPED',
        'BOTH_SHIPPED',
        'IN_TRANSIT',
        'DELIVERED',
        'BOTH_DELIVERED',
        'DISPUTED',
      ].includes(swap.status)
    ) {
      router.push(`/(tabs)/swap/shipping?swapId=${swapId}` as any);
      return;
    }

    // 4. Completed: ongoing transaction dossier & peer review
    if (swap.status === 'COMPLETED') {
      router.push(`/(tabs)/swap/shipping?swapId=${swapId}` as any);
      return;
    }

    // Fallback: details view
    router.push(`/(tabs)/swap/details?swapId=${swapId}` as any);
  } catch (error) {
    console.error('navigateToLiveSwapStage error:', error);
    const fallbackId = typeof swapOrId === 'string' ? swapOrId : swapOrId?.id;
    if (fallbackId) {
      router.push(`/(tabs)/swap/details?swapId=${fallbackId}` as any);
    }
  }
}
