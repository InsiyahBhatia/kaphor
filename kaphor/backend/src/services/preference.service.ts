import db from '../lib/prisma';
import { EventType, StyleAesthetic } from '@prisma/client';
import { logger } from '../lib/logger';
import { redisDel } from '../lib/redis';
import { AESTHETIC_VECTORS } from '../controllers/ai.controller';

export interface UserPreferenceProfile {
  topCategories: Record<string, number>;
  topBrands: Record<string, number>;
  preferredSizes: string[];
  priceRange: {
    min: number;
    max: number;
    avg: number;
    history: number[];
  };
  circularityAffinity: {
    sale: number;
    rental: number;
    swap: number;
  };
  recentInteractions: Array<{
    garmentId: string;
    title: string;
    category: string;
    brand: string;
    imageUrl?: string;
    eventType: string;
    timestamp: string;
  }>;
  dominantAesthetic: string;
  aestheticConfidence: number;
  totalInteractions: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || !a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function normalizeVector(v: number[]): number[] {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) {
    sumSq += v[i] * v[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return v;
  return v.map((x) => Number((x / norm).toFixed(4)));
}

/** Determines closest StyleAesthetic from user's 20-dim styleVector */
export function classifyAesthetic(vector: number[]): {
  aesthetic: StyleAesthetic;
  confidence: number;
} {
  if (!vector || vector.length !== 20) {
    return { aesthetic: StyleAesthetic.LUXURY, confidence: 0.5 };
  }

  let bestAesthetic: StyleAesthetic = StyleAesthetic.LUXURY;
  let highestScore = -1;

  for (const [aestheticKey, targetVec] of Object.entries(AESTHETIC_VECTORS)) {
    const sim = cosineSimilarity(vector, targetVec);
    if (sim > highestScore) {
      highestScore = sim;
      // Map key to Prisma enum StyleAesthetic (MINIMALIST, VINTAGE, BOLD, ETHNIC, STREETWEAR, LUXURY)
      const mapped =
        aestheticKey === 'CULTURAL' || aestheticKey === 'ARTISANAL'
          ? StyleAesthetic.ETHNIC
          : (StyleAesthetic as any)[aestheticKey] || StyleAesthetic.LUXURY;
      bestAesthetic = mapped;
    }
  }

  return {
    aesthetic: bestAesthetic,
    confidence: Math.max(0.1, Math.min(1.0, Number(highestScore.toFixed(3)))),
  };
}

export const PreferenceService = {
  /**
   * Processes a behavioral event and dynamically adapts the user's
   * style vector and preference profile in real-time.
   */
  async processEvent(
    userId: string,
    eventType: EventType,
    garmentId?: string | null,
    metadata?: any
  ): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          styleVector: true,
          styleAesthetic: true,
          preferenceProfile: true,
        },
      });

      if (!user) return;

      let currentProfile: UserPreferenceProfile = (user.preferenceProfile as any) || {
        topCategories: {},
        topBrands: {},
        preferredSizes: [],
        priceRange: { min: 0, max: 0, avg: 0, history: [] },
        circularityAffinity: { sale: 0, rental: 0, swap: 0 },
        recentInteractions: [],
        dominantAesthetic: user.styleAesthetic || 'LUXURY',
        aestheticConfidence: 0.6,
        totalInteractions: 0,
      };

      currentProfile.totalInteractions = (currentProfile.totalInteractions || 0) + 1;

      // Handle search/filter event metadata
      if (eventType === EventType.SEARCH && metadata?.query) {
        logger.info(`[PreferenceService] Recorded search query: "${metadata.query}" for user ${userId}`);
      }

      if (garmentId) {
        const garment = await db.garment.findUnique({
          where: { id: garmentId },
          select: {
            id: true,
            title: true,
            category: true,
            brand: true,
            size: true,
            price: true,
            listingType: true,
            images: true,
            garmentVector: true,
          },
        });

        if (garment) {
          // 1. Update Category Count
          if (garment.category) {
            const cat = garment.category.toUpperCase();
            currentProfile.topCategories[cat] = (currentProfile.topCategories[cat] || 0) + 1;
          }

          // 2. Update Brand Count
          if (garment.brand) {
            const brand = garment.brand.trim();
            currentProfile.topBrands[brand] = (currentProfile.topBrands[brand] || 0) + 1;
          }

          // 3. Update Size Preference
          if (garment.size && !currentProfile.preferredSizes.includes(garment.size)) {
            currentProfile.preferredSizes.push(garment.size);
            if (currentProfile.preferredSizes.length > 5) {
              currentProfile.preferredSizes.shift();
            }
          }

          // 4. Update Price Range History
          if (typeof garment.price === 'number' && garment.price > 0) {
            const history = currentProfile.priceRange.history || [];
            history.push(garment.price);
            if (history.length > 30) history.shift();
            const min = Math.min(...history);
            const max = Math.max(...history);
            const sum = history.reduce((acc, p) => acc + p, 0);
            const avg = Math.round(sum / history.length);
            currentProfile.priceRange = { min, max, avg, history };
          }

          // 5. Update Circularity Affinity
          if (garment.listingType === 'SALE') {
            currentProfile.circularityAffinity.sale = (currentProfile.circularityAffinity.sale || 0) + 1;
          } else if (garment.listingType === 'RENTAL') {
            currentProfile.circularityAffinity.rental = (currentProfile.circularityAffinity.rental || 0) + 1;
          } else if (garment.listingType === 'ACCESSORY_SWAP') {
            currentProfile.circularityAffinity.swap = (currentProfile.circularityAffinity.swap || 0) + 1;
          }

          // 6. Update Recent Interactions
          const interactionRecord = {
            garmentId: garment.id,
            title: garment.title,
            category: garment.category,
            brand: garment.brand,
            imageUrl: garment.images?.[0] || undefined,
            eventType: String(eventType),
            timestamp: new Date().toISOString(),
          };
          currentProfile.recentInteractions = [
            interactionRecord,
            ...(currentProfile.recentInteractions || []).filter((item) => item.garmentId !== garment.id),
          ].slice(0, 15);

          // 7. Vector Drift: Exponential Moving Average
          const garmentVec = garment.garmentVector;
          if (garmentVec && garmentVec.length === 20) {
            let currentVector = user.styleVector;
            if (!currentVector || currentVector.length !== 20) {
              // Initialize with Luxury baseline
              currentVector = AESTHETIC_VECTORS.LUXURY.slice();
            }

            // Alpha rate based on commitment intensity
            let alpha = 0.03; // default for VIEW
            switch (eventType) {
              case EventType.SAVE:
              case EventType.WISHLIST:
                alpha = 0.09;
                break;
              case EventType.RENTAL_INTENT:
              case EventType.SWAP_INTENT:
              case EventType.PURCHASE_INTENT:
                alpha = 0.22;
                break;
              case EventType.PURCHASE:
              case EventType.RENTAL_CONFIRMED:
              case EventType.SWAP_CONFIRMED:
              case EventType.LOG_WEAR:
                alpha = 0.32;
                break;
            }

            const updatedVec: number[] = [];
            for (let i = 0; i < 20; i++) {
              const uVal = currentVector[i] || 0;
              const gVal = garmentVec[i] || 0;
              updatedVec[i] = (1 - alpha) * uVal + alpha * gVal;
            }

            const normalized = normalizeVector(updatedVec);
            const { aesthetic, confidence } = classifyAesthetic(normalized);

            currentProfile.dominantAesthetic = aesthetic;
            currentProfile.aestheticConfidence = confidence;

            await db.user.update({
              where: { id: userId },
              data: {
                styleVector: normalized,
                styleAesthetic: aesthetic,
                preferenceProfile: currentProfile as any,
              },
            });

            // Invalidate Redis recommendation caches
            await redisDel(`recs:${userId}`);
            await redisDel(`for_you:${userId}`);
            return;
          }
        }
      }

      // Update user preferenceProfile without vector drift if no garmentVector
      await db.user.update({
        where: { id: userId },
        data: {
          preferenceProfile: currentProfile as any,
        },
      });

      await redisDel(`recs:${userId}`);
      await redisDel(`for_you:${userId}`);
    } catch (err: any) {
      logger.error('[PreferenceService] processEvent failed', {
        userId,
        eventType,
        error: err.message,
      });
    }
  },

  /**
   * Retrieves the structured taste profile for the user.
   */
  async getTasteProfile(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        styleVector: true,
        styleAesthetic: true,
        preferenceProfile: true,
      },
    });

    if (!user) return null;

    const profile: UserPreferenceProfile = (user.preferenceProfile as any) || {
      topCategories: {},
      topBrands: {},
      preferredSizes: [],
      priceRange: { min: 0, max: 0, avg: 0, history: [] },
      circularityAffinity: { sale: 0, rental: 0, swap: 0 },
      recentInteractions: [],
      dominantAesthetic: user.styleAesthetic || 'LUXURY',
      aestheticConfidence: 0.6,
      totalInteractions: 0,
    };

    // Sort categories
    const sortedCategories = Object.entries(profile.topCategories || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Sort brands
    const sortedBrands = Object.entries(profile.topBrands || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      userId: user.id,
      displayName: user.displayName,
      dominantAesthetic: user.styleAesthetic || profile.dominantAesthetic || 'LUXURY',
      aestheticConfidence: profile.aestheticConfidence || 0.75,
      styleVector: user.styleVector,
      topCategories: sortedCategories,
      topBrands: sortedBrands,
      preferredSizes: profile.preferredSizes || [],
      priceRange: {
        min: profile.priceRange?.min || 0,
        max: profile.priceRange?.max || 0,
        avg: profile.priceRange?.avg || 0,
      },
      circularityAffinity: profile.circularityAffinity || { sale: 0, rental: 0, swap: 0 },
      recentInteractions: (profile.recentInteractions || []).slice(0, 8),
      totalInteractions: profile.totalInteractions || 0,
    };
  },
};
