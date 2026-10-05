import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { cacheGet, cacheSet } from '../lib/cache';
import { getDownloadUrl } from '../lib/cloudinary';
import { getEstimatedGarmentValue } from '../utils/pricing';
import { AESTHETIC_VECTORS } from '../controllers/ai.controller';
import { cosineSimilarity, UserPreferenceProfile } from './preference.service';

export interface RecommendedGarment {
  id: string;
  title: string;
  brand: string;
  category: string;
  subCategory?: string | null;
  size: string;
  price: number;
  rentalPriceDay?: number | null;
  rentalPriceWeek?: number | null;
  condition: string;
  listingType: string;
  images: string[];
  fitScore: number;
  matchReason: string;
  seller: {
    id: string;
    username: string;
    avatar?: string | null;
  };
}

export const RecommendationService = {
  /**
   * 1. Personalized "For You" Feed
   * Blends 20-dim vector cosine similarity, category/brand affinity, and price proximity.
   */
  async getPersonalizedFeed(userId: string, limit: number = 20): Promise<RecommendedGarment[]> {
    const cacheKey = `reco:for_you:${userId}:${limit}`;
    const cached = cacheGet<RecommendedGarment[]>(cacheKey);
    if (cached) return cached;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        styleVector: true,
        styleAesthetic: true,
        preferenceProfile: true,
      },
    });

    const profile: UserPreferenceProfile = (user?.preferenceProfile as any) || {
      topCategories: {},
      topBrands: {},
      preferredSizes: [],
      priceRange: { min: 0, max: 0, avg: 0, history: [] },
      circularityAffinity: { sale: 0, rental: 0, swap: 0 },
      recentInteractions: [],
      dominantAesthetic: user?.styleAesthetic || 'LUXURY',
      aestheticConfidence: 0.6,
      totalInteractions: 0,
    };

    let userVector = user?.styleVector;
    if (!userVector || userVector.length !== 20) {
      const aestheticKey = (user?.styleAesthetic as string) || 'LUXURY';
      userVector = (AESTHETIC_VECTORS as any)[aestheticKey] || AESTHETIC_VECTORS.LUXURY;
    }

    // Fetch candidate active SALE listings only (exclude user's own listings if registered)
    const isRegisteredUser = Boolean(user && user.id);
    let candidates = await db.garment.findMany({
      where: {
        isActive: true,
        lifecycleState: 'LISTED',
        listingType: 'SALE',          // ← Only show buyable items in "For You"
        reservedOrderId: null,
        rentals: {
          none: {
            status: { in: ['RESERVED', 'DISPATCHED', 'ACTIVE'] },
          },
        },
        ...(isRegisteredUser ? { sellerId: { not: userId } } : {}),
      },
      take: 60,                       // ← Wider pool for better scoring diversity
      select: {
        id: true,
        title: true,
        brand: true,
        category: true,
        subCategory: true,
        size: true,
        price: true,
        condition: true,
        listingType: true,
        images: true,
        garmentVector: true,
        seller: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalCatInteractions = Object.values(profile.topCategories || {}).reduce((a, b) => a + b, 0) || 1;
    const totalBrandInteractions = Object.values(profile.topBrands || {}).reduce((a, b) => a + b, 0) || 1;
    const now = new Date();

    const scored = candidates.map((g: any) => {
      // 1. Vector Similarity (0.0 to 1.0)
      const vecSim =
        userVector && g.garmentVector && g.garmentVector.length === 20
          ? Math.max(0, cosineSimilarity(userVector, g.garmentVector))
          : 0.65;

      // 2. Category Affinity
      const catCount = profile.topCategories?.[g.category.toUpperCase()] || 0;
      const catScore = Math.min(1.0, catCount / totalCatInteractions);

      // 3. Brand Affinity
      const brandCount = profile.topBrands?.[g.brand.trim()] || 0;
      const brandScore = Math.min(1.0, brandCount / totalBrandInteractions);

      // 4. Price Proximity (Gaussian decay around user's sweet spot avg)
      let priceScore = 0.5;
      const effectivePrice = g.price && g.price > 0 ? g.price : getEstimatedGarmentValue(g.category, g.brand);
      if (profile.priceRange?.avg > 0) {
        const diff = Math.abs(effectivePrice - profile.priceRange.avg);
        priceScore = Math.max(0.1, 1 - diff / (profile.priceRange.avg * 1.5));
      }

      // 5. Preferred Size Match
      const sizeScore = profile.preferredSizes?.includes(g.size) ? 1.0 : 0.7;

      const cooldownMultiplier = 1.0;

      // Weighted Composite Score
      const composite =
        (vecSim * 0.40 +
        catScore * 0.25 +
        brandScore * 0.15 +
        priceScore * 0.10 +
        sizeScore * 0.10) * cooldownMultiplier;

      const fitScore = Math.round(Math.min(99, Math.max(65, composite * 100)));

      // Generate context-aware match reason
      let matchReason = `Curated for your ${profile.dominantAesthetic || 'signature'} aesthetic`;
      if (catCount > 2) {
        matchReason = `Matches your frequent interest in ${g.category}`;
      } else if (brandCount > 1) {
        matchReason = `From your preferred brand ${g.brand}`;
      } else if (vecSim > 0.85) {
        matchReason = `Harmonious visual & architectural style alignment`;
      }

      return {
        ...g,
        price: effectivePrice,
        fitScore,
        matchReason,
      };
    });

    // Sort descending by fitScore
    scored.sort((a: any, b: any) => b.fitScore - a.fitScore);
    const topResults = scored.slice(0, limit);

    // Resolve images
    const resolved: RecommendedGarment[] = await Promise.all(
      topResults.map(async (g: any) => {
        const resolvedImages = await Promise.all(
          (g.images || []).map((img: string) => getDownloadUrl(img))
        );
        let resolvedAvatar = g.seller.avatar;
        if (resolvedAvatar && !resolvedAvatar.startsWith('http')) {
          resolvedAvatar = await getDownloadUrl(resolvedAvatar);
        }
        return {
          id: g.id,
          title: g.title,
          brand: g.brand,
          category: g.category,
          subCategory: g.subCategory,
          size: g.size,
          price: g.price,
          condition: g.condition,
          listingType: g.listingType,
          images: resolvedImages,
          fitScore: g.fitScore,
          matchReason: g.matchReason,
          seller: {
            id: g.seller.id,
            username: g.seller.username,
            avatar: resolvedAvatar,
          },
        };
      })
    );

    // Short cache (cleared whenever a garment is created/updated/reserved)
    cacheSet(cacheKey, resolved, 120_000);
    return resolved;
  },

  /**
   * 2. Item-to-Item Similarity ("You Might Also Covet")
   * Finds garments visually and categorically similar to a given garment.
   */
  async getSimilarGarments(garmentId: string, limit: number = 8): Promise<RecommendedGarment[]> {
    const cacheKey = `reco:similar:${garmentId}:${limit}`;
    const cached = cacheGet<RecommendedGarment[]>(cacheKey);
    if (cached) return cached;

    const base = await db.garment.findUnique({
      where: { id: garmentId },
      select: {
        id: true,
        category: true,
        brand: true,
        color: true,
        material: true,
        listingType: true,
        garmentVector: true,
      },
    });

    if (!base) return [];

    const candidates = await db.garment.findMany({
      where: {
        id: { not: garmentId },
        isActive: true,
        lifecycleState: 'LISTED',
        // Keep the rail consistent with the page: similar items to a buy page are buyable,
        // similar items to a rental page are rentable. Swap-only listings never appear here.
        ...(base.listingType === 'RENTAL'
          ? { listingType: 'RENTAL' as const }
          : base.listingType === 'SALE'
            ? { listingType: 'SALE' as const }
            : {}),
        reservedOrderId: null,
        rentals: {
          none: {
            status: { in: ['RESERVED', 'DISPATCHED', 'ACTIVE'] },
          },
        },
      },
      take: 60,
      select: {
        id: true,
        title: true,
        brand: true,
        category: true,
        subCategory: true,
        size: true,
        price: true,
        condition: true,
        listingType: true,
        images: true,
        garmentVector: true,
        seller: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    const scored = candidates.map((c: any) => {
      let vecSim = 0.6;
      if (base.garmentVector?.length === 20 && c.garmentVector?.length === 20) {
        vecSim = cosineSimilarity(base.garmentVector, c.garmentVector);
      }
      const categoryMatch = c.category.toUpperCase() === base.category.toUpperCase() ? 0.3 : 0;
      const brandMatch = c.brand.toLowerCase() === base.brand.toLowerCase() ? 0.2 : 0;

      const simScore = Math.round(Math.min(99, Math.max(60, (vecSim * 0.5 + categoryMatch + brandMatch + 0.2) * 100)));
      const effectivePrice = c.price && c.price > 0 ? c.price : getEstimatedGarmentValue(c.category, c.brand);

      return {
        ...c,
        price: effectivePrice,
        fitScore: simScore,
        matchReason: `Similar silhouette & palette to this piece`,
      };
    });

    scored.sort((a: any, b: any) => b.fitScore - a.fitScore);
    const topCandidates = scored.slice(0, limit);

    const resolved: RecommendedGarment[] = await Promise.all(
      topCandidates.map(async (g: any) => {
        const resolvedImages = await Promise.all(
          (g.images || []).map((img: string) => getDownloadUrl(img))
        );
        let resolvedAvatar = g.seller.avatar;
        if (resolvedAvatar && !resolvedAvatar.startsWith('http')) {
          resolvedAvatar = await getDownloadUrl(resolvedAvatar);
        }
        return {
          id: g.id,
          title: g.title,
          brand: g.brand,
          category: g.category,
          subCategory: g.subCategory,
          size: g.size,
          price: g.price,
          condition: g.condition,
          listingType: g.listingType,
          images: resolvedImages,
          fitScore: g.fitScore,
          matchReason: g.matchReason,
          seller: {
            id: g.seller.id,
            username: g.seller.username,
            avatar: resolvedAvatar,
          },
        };
      })
    );

    cacheSet(cacheKey, resolved, 120_000);
    return resolved;
  },

  /**
   * 3. Curated Rental Picks
   * Finds high-value occasion & luxury pieces available for lease matching user taste.
   */
  async getRentalRecommendations(userId: string, limit: number = 10): Promise<RecommendedGarment[]> {
    const cacheKey = `reco:rental:${userId}:${limit}`;
    const cachedRentals = cacheGet<RecommendedGarment[]>(cacheKey);
    if (cachedRentals) return cachedRentals;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { styleVector: true, styleAesthetic: true },
    });

    const userVector = user?.styleVector?.length === 20
      ? user.styleVector
      : AESTHETIC_VECTORS[user?.styleAesthetic || 'LUXURY'] || AESTHETIC_VECTORS.LUXURY;

    const isRegisteredUser = Boolean(user && user.id);
    let rentals = await db.garment.findMany({
      where: {
        listingType: 'RENTAL',
        isActive: true,
        lifecycleState: 'LISTED',
        reservedOrderId: null,
        rentals: {
          none: {
            status: { in: ['RESERVED', 'DISPATCHED', 'ACTIVE'] },
          },
        },
        ...(isRegisteredUser ? { sellerId: { not: userId } } : {}),
      },
      take: 30,
      select: {
        id: true,
        title: true,
        brand: true,
        category: true,
        subCategory: true,
        size: true,
        price: true,
        rentalPriceDay: true,
        rentalPriceWeek: true,
        condition: true,
        listingType: true,
        images: true,
        garmentVector: true,
        seller: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    if (rentals.length === 0) {
      rentals = await db.garment.findMany({
        where: {
          listingType: 'RENTAL',
          isActive: true,
          lifecycleState: 'LISTED',
          reservedOrderId: null,
          rentals: {
            none: {
              status: { in: ['RESERVED', 'DISPATCHED', 'ACTIVE'] },
            },
          },
        },
        take: 60,
        select: {
          id: true,
          title: true,
          brand: true,
          category: true,
          subCategory: true,
          size: true,
          price: true,
          rentalPriceDay: true,
          rentalPriceWeek: true,
          condition: true,
          listingType: true,
          images: true,
          garmentVector: true,
          seller: {
            select: { id: true, username: true, avatar: true },
          },
        },
      });
    }

    const now = new Date();
    const scored = rentals.map((r: any) => {
      const vecSim =
        userVector && r.garmentVector && r.garmentVector.length === 20
          ? Math.max(0, cosineSimilarity(userVector, r.garmentVector))
          : 0.65;
      const dayRate = r.rentalPriceDay || (r.price ? r.price * 0.08 : 300);
      const score = vecSim * 0.7 + (1 / Math.log10(dayRate + 10)) * 0.3;
      const fitScore = Math.round(Math.min(99, Math.max(68, score * 100)));
      const effectivePrice = r.price && r.price > 0 ? r.price : getEstimatedGarmentValue(r.category, r.brand);
      const effectiveRentalDay = r.rentalPriceDay && r.rentalPriceDay > 0
        ? r.rentalPriceDay
        : Math.round(effectivePrice * 0.04);
      const effectiveRentalWeek = r.rentalPriceWeek && r.rentalPriceWeek > 0
        ? r.rentalPriceWeek
        : Math.round(effectiveRentalDay * 5.5);

      return {
        ...r,
        price: effectivePrice,
        rentalPriceDay: effectiveRentalDay,
        rentalPriceWeek: effectiveRentalWeek,
        fitScore,
        matchReason: `High-value occasion piece for your style`,
      };
    });

    scored.sort((a: any, b: any) => b.fitScore - a.fitScore);
    const topRentals = scored.slice(0, limit);

    const rentalResult: RecommendedGarment[] = await Promise.all(
      topRentals.map(async (g: any) => {
        const resolvedImages = await Promise.all((g.images || []).map((img: string) => getDownloadUrl(img)));
        let resolvedAvatar = g.seller.avatar;
        if (resolvedAvatar && !resolvedAvatar.startsWith('http')) {
          resolvedAvatar = await getDownloadUrl(resolvedAvatar);
        }
        return {
          id: g.id,
          title: g.title,
          brand: g.brand,
          category: g.category,
          subCategory: g.subCategory,
          size: g.size,
          price: g.price,
          rentalPriceDay: g.rentalPriceDay,
          rentalPriceWeek: g.rentalPriceWeek,
          condition: g.condition,
          listingType: g.listingType,
          images: resolvedImages,
          fitScore: g.fitScore,
          matchReason: g.matchReason,
          seller: { id: g.seller.id, username: g.seller.username, avatar: resolvedAvatar },
        };
      })
    );
    cacheSet(cacheKey, rentalResult, 60_000);
    return rentalResult;
  },

  /**
   * 4. Smart Fair Swap Recommendations
   * Matches user's closet accessories with marketplace accessory swaps where
   * price variance <= 15%.
   */
  async getFairSwapRecommendations(userId: string, limit: number = 8) {
    const cacheKey = `reco:swap:${userId}:${limit}`;
    const cachedSwaps = cacheGet<any[]>(cacheKey);
    if (cachedSwaps) return cachedSwaps;

    // 1. Get user's active/closet accessory pieces; 2. marketplace accessory swaps (independent queries, run together)
    const [myAccessories, marketplaceSwaps] = await Promise.all([db.garment.findMany({
      where: {
        sellerId: userId,
        category: { in: ['ACCESSORIES', 'Accessories', 'Bags', 'Jewelry', 'Watches'] },
      },
      select: {
        id: true,
        title: true,
        brand: true,
        category: true,
        price: true,
        images: true,
        garmentVector: true,
      },
      take: 100,
    }), db.garment.findMany({
      where: {
        sellerId: { not: userId },
        listingType: 'ACCESSORY_SWAP',
        isActive: true,
        lifecycleState: 'LISTED',
      },
      take: 50,
      select: {
        id: true,
        title: true,
        brand: true,
        category: true,
        price: true,
        images: true,
        condition: true,
        garmentVector: true,
        seller: {
          select: { id: true, username: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })]);

    const matches: any[] = [];

    for (const partnerItem of marketplaceSwaps) {
      const partnerPrice = partnerItem.price && partnerItem.price > 0
        ? partnerItem.price
        : getEstimatedGarmentValue(partnerItem.category, partnerItem.brand);

      if (myAccessories.length > 0) {
        for (const myItem of myAccessories) {
          const myPrice = myItem.price && myItem.price > 0
            ? myItem.price
            : getEstimatedGarmentValue(myItem.category, myItem.brand);

          const maxP = Math.max(myPrice, partnerPrice);
          const diff = Math.abs(myPrice - partnerPrice);
          const variance = maxP > 0 ? (diff / maxP) * 100 : 0;

          if (variance <= 20) {
            let vecSim = 0.75;
            if (myItem.garmentVector?.length === 20 && partnerItem.garmentVector?.length === 20) {
              vecSim = cosineSimilarity(myItem.garmentVector, partnerItem.garmentVector);
            }
            matches.push({
              myGarment: {
                id: myItem.id,
                title: myItem.title,
                price: myPrice,
                images: myItem.images,
              },
              recommendedSwap: {
                id: partnerItem.id,
                title: partnerItem.title,
                brand: partnerItem.brand,
                category: partnerItem.category,
                price: partnerPrice,
                condition: partnerItem.condition,
                images: partnerItem.images,
                seller: partnerItem.seller,
              },
              variancePercent: Math.round(variance),
              fitScore: Math.round(vecSim * 100),
              isFairSwap: variance <= 15,
            });
          }
        }
      } else {
        // Fallback: If user has no accessory in closet yet, recommend trending accessory swaps
        matches.push({
          myGarment: null,
          recommendedSwap: {
            id: partnerItem.id,
            title: partnerItem.title,
            brand: partnerItem.brand,
            category: partnerItem.category,
            price: partnerPrice,
            condition: partnerItem.condition,
            images: partnerItem.images,
            seller: partnerItem.seller,
          },
          variancePercent: 0,
          fitScore: 88,
          isFairSwap: true,
        });
      }
    }

    matches.sort((a, b) => b.fitScore - a.fitScore);
    const topMatches = matches.slice(0, limit);

    // Resolve images
    const swapResult = await Promise.all(
      topMatches.map(async (m) => {
        const partnerImages = await Promise.all(
          (m.recommendedSwap.images || []).map((img: string) => getDownloadUrl(img))
        );
        let myImages = m.myGarment?.images || [];
        if (myImages.length > 0) {
          myImages = await Promise.all(myImages.map((img: string) => getDownloadUrl(img)));
        }
        return {
          ...m,
          myGarment: m.myGarment ? { ...m.myGarment, images: myImages } : null,
          recommendedSwap: {
            ...m.recommendedSwap,
            images: partnerImages,
          },
        };
      })
    );
    cacheSet(cacheKey, swapResult, 60_000);
    return swapResult;
  },
};
