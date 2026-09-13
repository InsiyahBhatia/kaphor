import api from './api';

export type InteractionEventType =
  | 'VIEW'
  | 'SAVE'
  | 'WISHLIST'
  | 'ADD_TO_CART'
  | 'SEARCH'
  | 'FILTER_APPLY'
  | 'PURCHASE_INTENT'
  | 'PURCHASE'
  | 'RENTAL_INTENT'
  | 'RENTAL_CONFIRMED'
  | 'SWAP_INTENT'
  | 'SWAP_CONFIRMED'
  | 'LOG_WEAR';

class TelemetryService {
  private viewDebounceTimers: Map<string, any> = new Map();

  /**
   * Tracks a view event with dwell protection (only sends if user views for >= 1.8s)
   */
  trackView(garmentId: string, metadata?: Record<string, any>) {
    if (!garmentId) return;

    // Clear existing timer if any
    if (this.viewDebounceTimers.has(garmentId)) {
      clearTimeout(this.viewDebounceTimers.get(garmentId));
    }

    const timer = setTimeout(() => {
      this.sendEvent({
        garmentId,
        eventType: 'VIEW',
        metadata: { ...metadata, dwellMs: 2000 },
      });
      this.viewDebounceTimers.delete(garmentId);
    }, 1800);

    this.viewDebounceTimers.set(garmentId, timer);
  }

  cancelPendingView(garmentId: string) {
    if (this.viewDebounceTimers.has(garmentId)) {
      clearTimeout(this.viewDebounceTimers.get(garmentId));
      this.viewDebounceTimers.delete(garmentId);
    }
  }

  trackWishlist(garmentId: string, isSaved: boolean = true) {
    this.sendEvent({
      garmentId,
      eventType: isSaved ? 'WISHLIST' : 'VIEW',
    });
  }

  trackAddToCart(garmentId: string) {
    this.sendEvent({
      garmentId,
      eventType: 'ADD_TO_CART',
    });
  }

  trackSearch(query: string, filters?: Record<string, any>) {
    if (!query || !query.trim()) return;
    this.sendEvent({
      eventType: 'SEARCH',
      metadata: { query: query.trim(), filters },
    });
  }

  trackIntent(garmentId: string, type: 'PURCHASE' | 'RENTAL' | 'SWAP') {
    const eventTypeMap: Record<string, InteractionEventType> = {
      PURCHASE: 'PURCHASE_INTENT',
      RENTAL: 'RENTAL_INTENT',
      SWAP: 'SWAP_INTENT',
    };
    this.sendEvent({
      garmentId,
      eventType: eventTypeMap[type] || 'PURCHASE_INTENT',
    });
  }

  trackConversion(garmentId: string, type: 'PURCHASE' | 'RENTAL' | 'SWAP') {
    const eventTypeMap: Record<string, InteractionEventType> = {
      PURCHASE: 'PURCHASE',
      RENTAL: 'RENTAL_CONFIRMED',
      SWAP: 'SWAP_CONFIRMED',
    };
    this.sendEvent({
      garmentId,
      eventType: eventTypeMap[type] || 'PURCHASE',
    });
  }

  private async sendEvent(payload: {
    garmentId?: string;
    eventType: InteractionEventType;
    metadata?: Record<string, any>;
  }) {
    try {
      await api.post('/interactions', payload);
    } catch {
      // Telemetry errors must never crash or block the UI
    }
  }
}

export const telemetryService = new TelemetryService();
