import db from '../lib/prisma';
import { EventType } from '@prisma/client';
import { logger } from '../lib/logger';

export interface GarmentDetailedInsights {
  garmentId: string;
  title: string;
  brand: string;
  thumbnail: string | null;
  price: number | null;
  rentalPriceDay: number | null;
  listingType: string;
  isActive: boolean;
  lifecycleState: string;
  
  // Core metrics
  views: number;
  uniqueViewers: number;
  saves: number;
  inquiries: number;
  intents: {
    purchase: number;
    rental: number;
    swap: number;
    total: number;
  };
  conversions: {
    orders: number;
    rentals: number;
    swaps: number;
    total: number;
  };

  // Funnel rates (in percentages, 0-100)
  funnel: {
    viewToSaveRate: number;
    overallConversionRate: number;
  };

  // Market demand indicator
  demandTier: 'HOT ASSET 🔥' | 'STRONG INTEREST ⭐' | 'STEADY MOMENTUM 📈' | 'EARLY DISCOVERY 🌱';
  demandScore: number; // 0-100

  // 7-day performance trend
  dailyTrend: Array<{
    date: string; // YYYY-MM-DD
    views: number;
    saves: number;
    inquiries: number;
  }>;

  // AI Seller Advisor
  advisorTips: Array<{
    category: 'PRICING' | 'MERCHANDISING' | 'CIRCULARITY' | 'ENGAGEMENT';
    headline: string;
    description: string;
    impact: 'HIGH' | 'MEDIUM' | 'OPPORTUNITY';
  }>;
}

export interface GarmentSummaryInsights {
  views: number;
  saves: number;
  inquiries: number;
}

export class InsightService {
  /**
   * Retrieves comprehensive performance insights for a single garment.
   * Only accessible by the garment's seller or an authorized entity.
   */
  static async getGarmentDetailedInsights(garmentId: string, sellerId: string): Promise<GarmentDetailedInsights | null> {
    const garment = await db.garment.findUnique({
      where: { id: garmentId },
      select: {
        id: true,
        sellerId: true,
        title: true,
        brand: true,
        images: true,
        price: true,
        rentalPriceDay: true,
        listingType: true,
        isActive: true,
        lifecycleState: true,
        viewCount: true,
        createdAt: true,
      }
    });

    if (!garment || garment.sellerId !== sellerId) {
      return null;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Parallel fetch of metric dimensions (consolidated into 5 queries to stay safely within connection pool)
    const [
      allGarmentEvents,
      inquiriesCount,
      completedOrders,
      completedRentals,
      completedSwaps,
    ] = await Promise.all([
      // 1. All behaviour events for this garment in a single query
      db.behaviourEvent.findMany({
        where: { garmentId },
        select: { userId: true, eventType: true, createdAt: true },
      }),
      // 2. Inquiries / Conversations linked to this garment
      db.conversation.count({
        where: { garmentId },
      }),
      // 3. Order items completed/confirmed
      db.orderItem.count({
        where: { garmentId, order: { status: { notIn: ['CANCELLED', 'REFUNDED'] } } },
      }),
      // 4. Rentals reserved/active/returned
      db.rental.count({
        where: { garmentId, status: { not: 'OVERDUE' } },
      }),
      // 5. Swaps accepted or completed
      db.swap.count({
        where: {
          OR: [{ garmentOffered: garmentId }, { garmentWanted: garmentId }],
          status: { in: ['ACCEPTED', 'COMPLETED'] },
        },
      }),
    ]);

    // Segment events in-memory
    const viewEvents = allGarmentEvents.filter((e: { eventType: EventType }) => e.eventType === EventType.VIEW);
    const saveEvents = allGarmentEvents.filter(
      (e: { eventType: EventType }) => e.eventType === EventType.WISHLIST || e.eventType === EventType.SAVE
    );
    const purchaseIntents = allGarmentEvents.filter(
      (e: { eventType: EventType }) => e.eventType === EventType.PURCHASE_INTENT
    ).length;
    const rentalIntents = allGarmentEvents.filter(
      (e: { eventType: any }) => (e.eventType as string) === 'RENTAL_INTENT'
    ).length;
    const swapIntents = allGarmentEvents.filter(
      (e: { eventType: any }) => (e.eventType as string) === 'SWAP_INTENT'
    ).length;
    const recentEvents = allGarmentEvents.filter(
      (e: { createdAt: Date }) => e.createdAt >= sevenDaysAgo
    );

    // Compute views (at least garment.viewCount or tracked events count)
    const trackedViewsCount = viewEvents.length;
    const totalViews = Math.max(garment.viewCount || 0, trackedViewsCount);
    
    // Unique viewers
    const uniqueUserIds = new Set(viewEvents.map((e: { userId: string }) => e.userId));
    const uniqueViewers = Math.max(uniqueUserIds.size, totalViews > 0 ? 1 : 0);

    const totalSaves = saveEvents.length;
    const totalIntents = purchaseIntents + rentalIntents + swapIntents;
    const totalConversions = completedOrders + completedRentals + completedSwaps;

    // Funnel rates
    const safeViews = totalViews > 0 ? totalViews : 1;

    const viewToSaveRate = Math.min(100, Math.round((totalSaves / safeViews) * 100));
    const overallConversionRate = Math.min(100, Math.round((totalConversions / safeViews) * 100));

    // Calculate 7-day trend bucketed by YYYY-MM-DD
    const trendMap: Record<string, { views: number; saves: number; inquiries: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      trendMap[dateStr] = { views: 0, saves: 0, inquiries: 0 };
    }

    recentEvents.forEach((ev: { eventType: EventType; createdAt: Date }) => {
      const dateStr = ev.createdAt.toISOString().split('T')[0];
      if (trendMap[dateStr]) {
        if (ev.eventType === EventType.VIEW) trendMap[dateStr].views++;
        else if (ev.eventType === EventType.WISHLIST || ev.eventType === EventType.SAVE) trendMap[dateStr].saves++;
      }
    });

    const dailyTrend = Object.entries(trendMap).map(([date, stats]) => ({
      date,
      ...stats,
    }));

    // Demand Scoring
    // Score formula based on views, saves, and inquiries
    const rawDemand = (totalViews * 1) + (totalSaves * 5) + (inquiriesCount * 15) + (totalIntents * 20);
    const demandScore = Math.min(100, Math.round((rawDemand / 120) * 100));

    let demandTier: GarmentDetailedInsights['demandTier'] = 'EARLY DISCOVERY 🌱';
    if (demandScore >= 75 || totalViews >= 60) {
      demandTier = 'HOT ASSET 🔥';
    } else if (demandScore >= 45 || totalSaves >= 5) {
      demandTier = 'STRONG INTEREST ⭐';
    } else if (demandScore >= 20 || totalViews >= 15) {
      demandTier = 'STEADY MOMENTUM 📈';
    }

    // AI Advisor Recommendations
    const advisorTips: GarmentDetailedInsights['advisorTips'] = [];

    if (totalViews > 25 && totalSaves > 3 && totalIntents === 0) {
      advisorTips.push({
        category: 'ENGAGEMENT',
        headline: 'High Covet, Hesitant Action',
        description: 'Sholders are saving this piece to their wishlist but not converting to a purchase request. Strengthen measurements, fabric quality, and condition details to close the sale.',
        impact: 'HIGH',
      });
    }

    if (garment.listingType === 'SALE' && (!garment.rentalPriceDay || garment.rentalPriceDay <= 0)) {
      advisorTips.push({
        category: 'CIRCULARITY',
        headline: 'Unlock Occasion Rental Income',
        description: 'Adding a 3-day or weekly rental option increases asset discovery by up to 2.4x while retaining wardrobe ownership.',
        impact: 'MEDIUM',
      });
    }

    if (totalViews < 10) {
      advisorTips.push({
        category: 'MERCHANDISING',
        headline: 'Enhance Discovery Vector',
        description: 'Upload additional studio-lit angles or outfit photos to optimize your garment vector for Kaphor AI curation and similar-item shelves.',
        impact: 'MEDIUM',
      });
    }

    if (inquiriesCount > 0) {
      advisorTips.push({
        category: 'ENGAGEMENT',
        headline: 'Direct Buyer Messages',
        description: `You have received ${inquiriesCount} direct message inquiry regarding this item. Fast responses within 2 hours increase closure rate by 70%.`,
        impact: 'HIGH',
      });
    }

    return {
      garmentId: garment.id,
      title: garment.title,
      brand: garment.brand,
      thumbnail: garment.images?.[0] || null,
      price: garment.price,
      rentalPriceDay: garment.rentalPriceDay,
      listingType: garment.listingType,
      isActive: garment.isActive,
      lifecycleState: garment.lifecycleState,
      views: totalViews,
      uniqueViewers,
      saves: totalSaves,
      inquiries: inquiriesCount,
      intents: {
        purchase: purchaseIntents,
        rental: rentalIntents,
        swap: swapIntents,
        total: totalIntents,
      },
      conversions: {
        orders: completedOrders,
        rentals: completedRentals,
        swaps: completedSwaps,
        total: totalConversions,
      },
      funnel: {
        viewToSaveRate,
        overallConversionRate,
      },
      demandTier,
      demandScore,
      dailyTrend,
      advisorTips,
    };
  }

  /**
   * Batch aggregates summary metrics for multiple garments owned by a seller.
   * Optimized with single queries to eliminate N+1 latency.
   */
  static async getBatchListingsSummary(
    garmentIds: string[]
  ): Promise<Record<string, GarmentSummaryInsights>> {
    const summary: Record<string, GarmentSummaryInsights> = {};
    if (garmentIds.length === 0) return summary;

    garmentIds.forEach((id) => {
      summary[id] = { views: 0, saves: 0, inquiries: 0 };
    });

    try {
      // The three lookups are independent: run them together instead of one after another.
      const [garments, saveGroup, inquiriesGroup] = await Promise.all([
        db.garment.findMany({
          where: { id: { in: garmentIds } },
          select: { id: true, viewCount: true },
        }),
        db.behaviourEvent.groupBy({
          by: ['garmentId'],
          where: {
            garmentId: { in: garmentIds },
            eventType: { in: [EventType.WISHLIST, EventType.SAVE] },
          },
          _count: { _all: true },
        }),
        db.conversation.groupBy({
          by: ['garmentId'],
          where: { garmentId: { in: garmentIds } },
          _count: { _all: true },
        }),
      ]);
      garments.forEach((g: { id: string; viewCount: number }) => {
        if (summary[g.id]) summary[g.id].views = g.viewCount || 0;
      });
      saveGroup.forEach((sg: { garmentId: string | null; _count: { _all: number } }) => {
        if (sg.garmentId && summary[sg.garmentId]) {
          summary[sg.garmentId].saves = sg._count._all;
        }
      });
      inquiriesGroup.forEach((ig: { garmentId: string | null; _count: { _all: number } }) => {
        if (ig.garmentId && summary[ig.garmentId]) {
          summary[ig.garmentId].inquiries = ig._count._all;
        }
      });
    } catch (err) {
      logger.error('Failed to batch aggregate listing insights', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return summary;
  }
}
