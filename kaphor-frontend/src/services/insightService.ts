import api from './api';

export interface DailyTrendItem {
  date: string; // YYYY-MM-DD
  views: number;
  saves: number;
  inquiries: number;
}

export interface AdvisorTip {
  category: 'PRICING' | 'MERCHANDISING' | 'CIRCULARITY' | 'ENGAGEMENT';
  headline: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'OPPORTUNITY';
}

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

  // Funnel rates (0-100)
  funnel: {
    viewToSaveRate: number;
    overallConversionRate: number;
  };

  // Market demand
  demandTier: 'HOT ASSET 🔥' | 'STRONG INTEREST ⭐' | 'STEADY MOMENTUM 📈' | 'EARLY DISCOVERY 🌱';
  demandScore: number;

  // 7-day trend
  dailyTrend: DailyTrendItem[];

  // AI tips
  advisorTips: AdvisorTip[];
}

export interface GarmentSummaryInsights {
  views: number;
  saves: number;
  inquiries: number;
}

export const insightService = {
  /**
   * Fetches detailed performance metrics, conversion funnels, trends and AI tips for a seller's listing.
   */
  getGarmentInsights: async (garmentId: string): Promise<GarmentDetailedInsights> => {
    const { data } = await api.get(`/garments/${garmentId}/insights`);
    return data.data;
  },
};
