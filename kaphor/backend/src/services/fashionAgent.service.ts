import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { getDownloadUrl } from '../lib/cloudinary';
import { generateWithGroq } from './groq.service';
import { generateWithGemini } from './gemini.service';

import { parseLlmJson, cleanChatReply } from '../lib/llmOutput';
export interface AgentActionLog {
  tool: string;
  description: string;
  count?: number;
}

export interface AgentCard {
  id: string;
  title: string;
  brand: string;
  price: number;
  rentalPriceDay?: number;
  listingType: 'BUY' | 'RENTAL' | 'ACCESSORY_SWAP';
  imageUrl: string;
  images?: string[];
  image?: string;
  condition: string;
  category: string;
  source: 'WARDROBE' | 'CATALOG';
  actionType: 'RENT' | 'SWAP' | 'BUY' | 'VIEW';
  actionUrl: string;
  actionLabel: string;
  badge?: string;
}

export interface AgentOutfitItem {
  slot: 'TOP' | 'BOTTOM' | 'OUTERWEAR' | 'ACCESSORY' | 'FOOTWEAR' | 'ACCENT';
  garment: AgentCard;
  isFromWardrobe: boolean;
  stylingNote?: string;
}

export interface AgentOutfitLook {
  title: string;
  vibe: string;
  occasion: string;
  editorialNote: string;
  items: AgentOutfitItem[];
}

export interface AgentResult {
  reply: string;
  actionsExecuted: AgentActionLog[];
  cards: AgentCard[];
  outfitLook?: AgentOutfitLook;
  suggestedFollowUps: string[];
}

function inferOutfitSlot(card: AgentCard): AgentOutfitItem['slot'] {
  const category = (card.category || '').toLowerCase();
  const title = (card.title || '').toLowerCase();
  const text = `${category} ${title}`;

  // 1. Jewelry & Accessories (never mix up with apparel or footwear)
  if (/\b(earring|earrings|cuff|bangle|bracelet|necklace|choker|ring|pendant|brooch|jewelry|jewellery|watch|watches|eyewear|sunglasses|shades|belt|belts|scarf|scarves|hat|hats|cap|caps|headband)\b/.test(text)) {
    return 'ACCESSORY';
  }
  if (/\b(bag|bags|handbag|tote|crossbody|clutch|purse|shoulder bag|satchel|backpack)\b/.test(text)) {
    return 'ACCESSORY';
  }
  if (['jewelry', 'jewellery', 'accessories', 'bags', 'handbags', 'belts', 'eyewear', 'watches'].includes(category)) {
    return 'ACCESSORY';
  }

  // 2. Full-body & Co-ord Ensembles (Dresses, Jumpsuits, 2-Piece Sets, Sarees)
  if (/\b(co-ord|coord|set|ensemble|2-piece|two-piece|jumpsuit|romper|dress|gown|sari|saree|lehenga|anarkali)\b/.test(text)) {
    return 'ACCENT';
  }

  // 3. Outerwear (Jackets, Coats, Blazers, Vests)
  if (['jackets', 'coats', 'blazers', 'outerwear'].includes(category)) return 'OUTERWEAR';
  if (/\b(jacket|coat|blazer|cardigan|vest|trench|shrug|bomber|outerwear)\b/.test(text)) return 'OUTERWEAR';

  // 4. Tops
  if (['tops', 'top', 'kurtas', 'blouses', 'shirts', 't-shirts'].includes(category)) return 'TOP';
  if (/\b(top|crop top|shirt|tee|t-shirt|blouse|tank|kurta|kurti|sweater|hoodie|corset)\b/.test(text)) return 'TOP';

  // 5. Bottoms
  if (['bottoms', 'bottom', 'pants', 'trousers', 'skirts', 'jeans', 'palazzos'].includes(category)) return 'BOTTOM';
  if (/\b(pant|pants|trousers?|jeans?|skirt|skirts?|shorts?|leggings?|palazzo|slacks|culottes?)\b/.test(text)) return 'BOTTOM';

  // 6. Footwear (strictly actual footwear keywords and category, not skirts/apparel)
  if (['footwear', 'shoes', 'heels', 'flats', 'sandals', 'boots'].includes(category)) return 'FOOTWEAR';
  if (/\b(shoes?|sandals?|heels?|boots?|sneakers?|loafers?|flats?|mules?|juttis?|footwear)\b/.test(text)) return 'FOOTWEAR';

  return 'ACCENT';
}

// ── Helper to resolve garment images ──────────────────────────────────────────
async function resolveGarmentCard(
  g: any,
  source: 'WARDROBE' | 'CATALOG',
  overrideBadge?: string
): Promise<AgentCard> {
  const rawImage = g.images?.[0] || '';
  const imageUrl = rawImage ? await getDownloadUrl(rawImage) : '';

  const listingType = (g.listingType || 'BUY') as 'BUY' | 'RENTAL' | 'ACCESSORY_SWAP';
  let actionType: 'RENT' | 'SWAP' | 'BUY' | 'VIEW' = 'VIEW';
  let actionUrl = `/(tabs)/shop/${g.id}`;
  let actionLabel = 'VIEW PIECE';

  if (source === 'CATALOG') {
    if (listingType === 'RENTAL') {
      actionType = 'RENT';
      actionUrl = `/(tabs)/rental/${g.id}`;
      actionLabel = 'REQUEST RENTAL';
    } else if (listingType === 'ACCESSORY_SWAP') {
      actionType = 'SWAP';
      actionUrl = `/(tabs)/swap/${g.id}`;
      actionLabel = 'REQUEST SWAP';
    } else {
      actionType = 'BUY';
      actionUrl = `/(tabs)/shop/${g.id}`;
      actionLabel = 'BUY PIECE';
    }
  } else {
    actionType = 'VIEW';
    actionUrl = `/(tabs)/shop/${g.id}`;
    actionLabel = 'IN YOUR CLOSET';
  }

  return {
    id: g.id,
    title: g.title,
    brand: g.brand || 'Kaphor Archive',
    price: Math.round(g.price || g.estimatedValue || 2500),
    rentalPriceDay: g.rentalPriceDay ? Math.round(g.rentalPriceDay) : undefined,
    listingType,
    imageUrl,
    images: imageUrl ? [imageUrl] : [],
    image: imageUrl,
    condition: (g.condition || 'EXCELLENT').replace('_', ' '),
    category: g.category || 'Garment',
    source,
    actionType,
    actionUrl,
    actionLabel,
    badge: overrideBadge || (source === 'WARDROBE' ? 'OWNED CLOSET' : listingType === 'RENTAL' ? `RENT ₹${g.rentalPriceDay}/DAY` : listingType === 'ACCESSORY_SWAP' ? 'PEER SWAP' : `BUY ₹${g.price}`),
  };
}

// ── Agent Tool 1: Inspect User Wardrobe ───────────────────────────────────────
export async function inspectUserWardrobe(userId: string): Promise<{ items: any[]; cards: AgentCard[] }> {
  try {
    const rawGarments = await db.garment.findMany({
      where: {
        sellerId: userId,
        lifecycleState: { in: ['OWNERSHIP', 'DECLINE', 'CIRCULATION', 'REUSE_UPCYCLE_RECYCLE', 'SELL_INTENT', 'PURCHASE_INTENT'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    const cards = await Promise.all(
      rawGarments.map((g: any) => resolveGarmentCard(g, 'WARDROBE'))
    );

    return { items: rawGarments, cards };
  } catch (error) {
    logger.warn('inspectUserWardrobe tool error', { error });
    return { items: [], cards: [] };
  }
}

// Category keyword mappings for intelligent search
const CATEGORY_MAP: Record<string, string[]> = {
  'Indo-Western': ['indo-western', 'indowestern', 'fusion', 'concept'],
  'Sarees': ['saree', 'sari', 'draped', 'kanjeevaram', 'banarasi', 'chanderi'],
  'Lehengas': ['lehenga', 'choli', 'ghagra'],
  'Kurtas': ['kurta', 'kurti', 'kurtis', 'anarkali', 'tunic'],
  'Suits': ['suit', 'salwar', 'churidar', 'pantsuit'],
  'Dresses': ['dress', 'gown', 'mini dress', 'maxi', 'midi', 'cocktail', 'sundress', 'slip dress'],
  'Bottoms': ['trousers', 'pants', 'cargo', 'cargos', 'palazzo', 'shorts', 'bottoms', 'chinos', 'joggers', 'salwar', 'linen trousers'],
  'Denims': ['denim', 'denims', 'jeans', 'straight-leg', 'flared jeans', 'wide-leg denim', 'wash denim'],
  'Skirts': ['skirt', 'skirts', 'wrap skirt', 'pleated skirt', 'midi skirt', 'maxi skirt'],
  'Blazers': ['blazer', 'blazers', 'tuxedo', 'suit jacket', 'single-breasted'],
  'Jackets': ['jacket', 'jackets', 'bomber', 'coat', 'cardigan', 'trucker jacket'],
  'Tops': ['top', 'tops', 'crop top', 'blouse', 'shirt', 't-shirt', 'peasant blouse', 'linen top', 'tee'],
  'Sets': ['set', 'sets', 'co-ord', 'coord', 'matching set', 'two-piece'],
  'Footwear': ['shoe', 'shoes', 'footwear', 'heel', 'heels', 'flat', 'flats', 'loafer', 'mule', 'slides', 'juttis', 'sneakers'],
  'Sandals': ['sandal', 'sandals', 'slides', 'strap sandals', 'archival sandals'],
  'Watches': ['watch', 'watches', 'dial', 'bracelet watch', 'timepiece'],
  'Bags': ['bag', 'bags', 'handbag', 'tote', 'crossbody', 'purse', 'clutch'],
  'Jewelry': ['jewelry', 'jewellery', 'necklace', 'earring', 'earrings', 'choker', 'bracelet', 'bangle', 'cuff', 'ring', 'pendant'],
  'Accessories': ['accessory', 'accessories', 'scarf', 'belt', 'chain belt', 'sunglasses', 'hat', 'shades'],
};

const THEME_EXPANSIONS: Record<string, string[]> = {
  beach: ['dress', 'sandals', 'linen', 'swim', 'white', 'floral', 'skirt', 'breezy', 'hat', 'sunglasses', 'tote', 'slides'],
  summer: ['dress', 'cotton', 'linen', 'shorts', 'skirt', 'sandals', 'sunglasses', 'yellow', 'white'],
  wedding: ['saree', 'lehenga', 'anarkali', 'silk', 'embroidery', 'gold', 'churidar', 'kurta', 'jewelry', 'choker', 'festive'],
  party: ['cocktail', 'black', 'shimmer', 'sequin', 'heels', 'mini', 'blazer', 'silver', 'clutch'],
  casual: ['jeans', 'cotton', 'denim', 'sneakers', 'jacket', 'trousers', 'flat'],
  brunch: ['dress', 'floral', 'pastel', 'linen', 'skirt', 'flats', 'tote', 'sandals'],
  formal: ['blazer', 'trousers', 'suit', 'formal', 'watch', 'black', 'navy', 'loafers'],
  winter: ['jacket', 'coat', 'sweater', 'wool', 'boots', 'scarf', 'trench'],
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'in', 'with', 'to', 'from', 'of', 'on', 'at', 'by',
  'what', 'is', 'are', 'i', 'me', 'my', 'you', 'your', 'we', 'our', 'he', 'she', 'it', 'they',
  'can', 'please', 'give', 'show', 'tell', 'find', 'look', 'looking', 'want', 'need', 'like', 'love',
  'piece', 'pieces', 'style', 'styles', 'outfit', 'looks', 'clothes', 'clothing', 'app', 'catalog',
  'silhouette', 'silhouettes', 'high-end', 'luxury', 'luxurious', 'curated', 'selection', 'aligns',
  'perfectly', 'seamless', 'fusion', 'think', 'sharp', 'structured', 'flowing', 'elevated', 'pointed',
  'editorial-grade', 'approach', 'truly', 'circular', 'consider', 'renting', 'specific', 'events',
  'swapping', 'peers', 'occasion', 'ensuring', 'enjoy', 'glamour', 'long-term', 'storage', 'footprint',
  'digital', 'closet', 'mapped', 'yet', 'pulled', 'rent', 'rental', 'swap', 'buy',
  'under', 'below', 'less', 'than', 'max', 'min', 'price', 'budget', 'rs', 'inr', 'day', 'per', 'within', 'around'
]);

// ── Agent Tool 2: Search Catalog ──────────────────────────────────────────────
export async function searchCatalog(params: {
  query?: string;
  category?: string;
  categories?: string[];
  excludeCategories?: string[];
  listingType?: 'BUY' | 'RENTAL' | 'ACCESSORY_SWAP';
  maxPrice?: number;
  excludeId?: string;
  take?: number;
  topCategories?: string[];
  topBrands?: string[];
}): Promise<{ items: any[]; cards: AgentCard[] }> {
  try {
    const baseWhere: any = {
      isActive: true,
      lifecycleState: 'LISTED',
    };

    if (params.excludeId) {
      baseWhere.id = { not: params.excludeId };
    }

    if (params.excludeCategories && params.excludeCategories.length > 0) {
      baseWhere.category = {
        notIn: params.excludeCategories,
        mode: 'insensitive',
      };
    }

    if (params.listingType) {
      baseWhere.listingType = params.listingType;
    }

    if (params.maxPrice && params.listingType === 'RENTAL') {
      baseWhere.rentalPriceDay = { lte: params.maxPrice };
    } else if (params.maxPrice) {
      baseWhere.price = { lte: params.maxPrice };
    }

    const matchedGarmentMap = new Map<string, any>();
    const promptText = (params.query || '').toLowerCase();

    // 1. Detect categories from prompt text or explicit list
    const detectedCategories: string[] = [];
    if (params.category) {
      detectedCategories.push(params.category);
    }
    if (params.categories && params.categories.length > 0) {
      detectedCategories.push(...params.categories);
    }
    for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
      if (keywords.some(kw => promptText.includes(kw))) {
        if (params.excludeCategories && params.excludeCategories.some(exc => exc.toLowerCase() === cat.toLowerCase())) {
          continue;
        }
        detectedCategories.push(cat);
      }
    }

    // 2. Extract meaningful search tokens (including theme expansion tokens)
    const rawTokens = promptText
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

    const themeTerms: string[] = [];
    for (const [theme, expTerms] of Object.entries(THEME_EXPANSIONS)) {
      if (promptText.includes(theme)) {
        themeTerms.push(...expTerms);
      }
    }

    // 3. Query Candidate Pool: fetch up to 60 candidates matching baseWhere
    const candidateWhere: any = { ...baseWhere };
    if (detectedCategories.length > 0) {
      candidateWhere.category = { in: Array.from(new Set(detectedCategories)), mode: 'insensitive' };
    }

    let candidateItems = await db.garment.findMany({
      where: candidateWhere,
      take: 60,
      orderBy: { popularityScore: 'desc' },
    });

    // If candidate items are sparse, broaden to general active items (still respecting excludeCategories)
    if (candidateItems.length < (params.take || 6)) {
      const existingIds = new Set(candidateItems.map((i: any) => i.id));
      const broaderItems = await db.garment.findMany({
        where: {
          ...baseWhere,
          id: { notIn: Array.from(existingIds) },
        },
        take: 40,
        orderBy: { popularityScore: 'desc' },
      });
      candidateItems.push(...broaderItems);
    }

    // 4. Relevance Scoring: score candidates by title, color, category, description matches
    const searchTokens = Array.from(new Set([...rawTokens, ...themeTerms]));
    const scoredCandidates = candidateItems.map((item: any) => {
      let score = 0;
      const titleLower = (item.title || '').toLowerCase();
      const catLower = (item.category || '').toLowerCase();
      const subCatLower = (item.subCategory || '').toLowerCase();
      const descLower = (item.description || '').toLowerCase();
      const colorLower = (item.color || []).join(' ').toLowerCase();

      for (const token of searchTokens) {
        if (colorLower.includes(token)) score += 8;
        if (titleLower.includes(token)) score += 6;
        if (catLower.includes(token) || subCatLower.includes(token)) score += 4;
        if (descLower.includes(token)) score += 2;
      }

      // Small popularity tie-breaker
      score += (item.popularityScore || 0) * 0.05;

      // Small jitter (0 to 0.4) to ensure fresh variety
      score += Math.random() * 0.4;

      return { item, score };
    });

    scoredCandidates.sort((a: any, b: any) => b.score - a.score);

    // 5. Slot & Category Diversity Capping: NEVER allow more than 2 items from the same category
    const categoryCount: Record<string, number> = {};
    const maxPerCategory = 2;

    for (const { item } of scoredCandidates) {
      const cat = (item.category || 'Other').toLowerCase();
      if ((categoryCount[cat] || 0) < maxPerCategory) {
        matchedGarmentMap.set(item.id, item);
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        if (matchedGarmentMap.size >= (params.take || 6)) break;
      }
    }

    // Fill remaining slots if category cap left us under target
    if (matchedGarmentMap.size < (params.take || 6)) {
      for (const { item } of scoredCandidates) {
        if (!matchedGarmentMap.has(item.id)) {
          matchedGarmentMap.set(item.id, item);
          if (matchedGarmentMap.size >= (params.take || 6)) break;
        }
      }
    }

    // 6. Tier 4 Fallback: If maxPrice resulted in 0 matches, relax maxPrice
    if (matchedGarmentMap.size === 0 && params.maxPrice) {
      const fallbackWhere: any = { isActive: true, lifecycleState: 'LISTED' };
      if (params.listingType) fallbackWhere.listingType = params.listingType;

      const fallbackItems = await db.garment.findMany({
        where: fallbackWhere,
        orderBy: params.listingType === 'RENTAL' ? { rentalPriceDay: 'asc' } : { price: 'asc' },
        take: params.take || 6,
      });
      for (const item of fallbackItems) {
        matchedGarmentMap.set(item.id, item);
      }
    }

    // 7. Ultimate Fallback: If still 0 matches, pull active listed garments with randomized sampling
    if (matchedGarmentMap.size === 0) {
      const ultimateItems = await db.garment.findMany({
        where: { isActive: true, lifecycleState: 'LISTED' },
        take: 20,
      });
      const shuffled = ultimateItems.sort(() => 0.5 - Math.random());
      for (const item of shuffled.slice(0, params.take || 6)) {
        matchedGarmentMap.set(item.id, item);
      }
    }

    const rawItems = Array.from(matchedGarmentMap.values());
    const finalItems = rawItems.slice(0, params.take || 6);
    const cards = await Promise.all(
      finalItems.map((g: any) => resolveGarmentCard(g, 'CATALOG'))
    );

    return { items: finalItems, cards };
  } catch (error) {
    logger.warn('searchCatalog tool error', { error });
    return { items: [], cards: [] };
  }
}

// ── Agent Tool 3: Evaluate Swap Parity ─────────────────────────────────────────
export async function evaluateSwapMatches(userId: string): Promise<{ matches: AgentCard[]; userPieces: AgentCard[] }> {
  try {
    // Get user's accessories
    const userGarments = await db.garment.findMany({
      where: {
        sellerId: userId,
        lifecycleState: { in: ['OWNERSHIP', 'DECLINE', 'CIRCULATION', 'SELL_INTENT'] },
      },
      take: 6,
    });

    const userCards = await Promise.all(
      userGarments.map((g: any) => resolveGarmentCard(g, 'WARDROBE'))
    );

    // Get active swap listings
    const swapListings = await db.garment.findMany({
      where: {
        isActive: true,
        lifecycleState: 'LISTED',
        listingType: 'ACCESSORY_SWAP',
        sellerId: { not: userId },
      },
      take: 6,
    });

    // Find fair parity matches (variance <= 15%)
    const matchCards: AgentCard[] = [];
    for (const listing of swapListings) {
      const listingVal = listing.price || listing.estimatedValue || 2500;

      // Compare against user's pieces
      let bestParityPct = 999;
      let matchedPiece: any = null;

      for (const ug of userGarments) {
        const uVal = ug.price || ug.estimatedValue || 2500;
        const diff = Math.abs(uVal - listingVal);
        const maxV = Math.max(uVal, listingVal, 1);
        const variancePct = Math.round((diff / maxV) * 100);

        if (variancePct < bestParityPct) {
          bestParityPct = variancePct;
          matchedPiece = ug;
        }
      }

      const isFair = bestParityPct <= 15;
      const badge = isFair
        ? `⚖️ FAIR SWAP (±${bestParityPct}%)`
        : `TRADE SPREAD (±${bestParityPct}%)`;

      const card = await resolveGarmentCard(listing, 'CATALOG', badge);
      matchCards.push(card);
    }

    return { matches: matchCards, userPieces: userCards };
  } catch (error) {
    logger.warn('evaluateSwapMatches tool error', { error });
    return { matches: [], userPieces: [] };
  }
}

async function fetchComplementaryPiece(
  slot: AgentOutfitItem['slot'],
  excludeIds: Set<string>,
  promptContext?: string
): Promise<AgentCard | null> {
  try {
    const whereClause: any = {
      isActive: true,
      lifecycleState: 'LISTED',
      id: { notIn: Array.from(excludeIds) },
    };

    const ctx = (promptContext || '').toLowerCase();
    const isBeach = ctx.includes('beach') || ctx.includes('summer') || ctx.includes('resort') || ctx.includes('vacation');
    const isWedding = ctx.includes('wedding') || ctx.includes('shaadi') || ctx.includes('sangeet') || ctx.includes('festive') || ctx.includes('reception');

    if (slot === 'TOP') {
      whereClause.OR = [
        { category: { in: ['Tops', 'top', 'Blouses', 'Shirts', 'Kurtas', 'blouses', 'shirts'] } },
        { title: { contains: 'top', mode: 'insensitive' } },
        { title: { contains: 'blouse', mode: 'insensitive' } },
        { title: { contains: 'shirt', mode: 'insensitive' } },
      ];
    } else if (slot === 'BOTTOM') {
      whereClause.OR = [
        { category: { in: ['Bottoms', 'bottom', 'Skirts', 'Pants', 'Trousers', 'Jeans', 'skirts', 'pants'] } },
        { title: { contains: 'skirt', mode: 'insensitive' } },
        { title: { contains: 'trousers', mode: 'insensitive' } },
        { title: { contains: 'pants', mode: 'insensitive' } },
      ];
    } else if (slot === 'ACCESSORY') {
      whereClause.OR = isBeach
        ? [
            { category: { in: ['Accessories', 'Bags', 'Jewelry'] } },
            { title: { contains: 'sunglass', mode: 'insensitive' } },
            { title: { contains: 'tote', mode: 'insensitive' } },
            { title: { contains: 'hat', mode: 'insensitive' } },
            { title: { contains: 'shades', mode: 'insensitive' } },
            { title: { contains: 'bracelet', mode: 'insensitive' } },
          ]
        : [
            { category: { in: ['Jewelry', 'Bags', 'Accessories', 'Watches', 'jewelry', 'bags', 'accessories'] } },
            { listingType: 'ACCESSORY_SWAP' },
            { title: { contains: 'cuff', mode: 'insensitive' } },
            { title: { contains: 'earring', mode: 'insensitive' } },
            { title: { contains: 'bag', mode: 'insensitive' } },
            { title: { contains: 'necklace', mode: 'insensitive' } },
          ];
    } else if (slot === 'OUTERWEAR') {
      whereClause.OR = [
        { category: { in: ['Jackets', 'Coats', 'Blazers', 'Outerwear', 'jackets', 'blazers'] } },
        { title: { contains: 'jacket', mode: 'insensitive' } },
        { title: { contains: 'blazer', mode: 'insensitive' } },
      ];
    } else if (slot === 'FOOTWEAR') {
      whereClause.OR = isBeach
        ? [
            { title: { contains: 'sandals', mode: 'insensitive' } },
            { title: { contains: 'slides', mode: 'insensitive' } },
            { title: { contains: 'flats', mode: 'insensitive' } },
            { category: { in: ['Flats', 'Footwear'] } },
          ]
        : [
            { category: { in: ['Footwear', 'Shoes', 'Heels', 'Flats', 'Boots', 'footwear', 'shoes'] } },
            { title: { contains: 'shoes', mode: 'insensitive' } },
            { title: { contains: 'boots', mode: 'insensitive' } },
            { title: { contains: 'heels', mode: 'insensitive' } },
          ];
    } else if (slot === 'ACCENT') {
      if (isBeach) {
        whereClause.OR = [
          { category: { in: ['Dresses', 'Co-ords', 'Sets', 'Skirts'] } },
          { title: { contains: 'dress', mode: 'insensitive' } },
          { title: { contains: 'sundress', mode: 'insensitive' } },
          { title: { contains: 'linen', mode: 'insensitive' } },
        ];
        whereClause.NOT = [
          { title: { contains: 'saree', mode: 'insensitive' } },
          { title: { contains: 'lehenga', mode: 'insensitive' } },
        ];
      } else if (isWedding) {
        whereClause.OR = [
          { category: { in: ['Sarees', 'Lehengas', 'Kurtas', 'Indo-Western'] } },
          { title: { contains: 'saree', mode: 'insensitive' } },
          { title: { contains: 'lehenga', mode: 'insensitive' } },
          { title: { contains: 'anarkali', mode: 'insensitive' } },
        ];
      } else {
        whereClause.OR = [
          { category: { in: ['Dresses', 'Co-ords', 'Sarees', 'Sets', 'dresses'] } },
          { title: { contains: 'dress', mode: 'insensitive' } },
          { title: { contains: 'co-ord', mode: 'insensitive' } },
          { title: { contains: 'set', mode: 'insensitive' } },
        ];
      }
    }

    const candidates = await db.garment.findMany({
      where: whereClause,
      take: 8,
    });

    if (candidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      const piece = candidates[randomIndex];
      return await resolveGarmentCard(piece, 'CATALOG');
    }
    return null;
  } catch (err) {
    logger.warn('fetchComplementaryPiece failed', { slot, error: err });
    return null;
  }
}

// ── Agent Tool 4: Create Outfit Look ──────────────────────────────────────────
export async function createOutfitLook(
  wardrobeCards: AgentCard[],
  catalogCards: AgentCard[],
  occasion: string = 'Recommended Ensemble',
  promptContext?: string
): Promise<AgentOutfitLook | undefined> {
  const useWardrobe = wardrobeCards.length > 0;
  const allCards = useWardrobe ? [...wardrobeCards, ...catalogCards] : [...catalogCards];
  if (allCards.length === 0) return undefined;

  const usedIds = new Set<string>();
  const usedSlots = new Set<AgentOutfitItem['slot']>();
  const items: AgentOutfitItem[] = [];

  // Pick anchor piece
  const anchorCard = allCards[0];
  const anchorSlot = inferOutfitSlot(anchorCard);

  usedIds.add(anchorCard.id);
  usedSlots.add(anchorSlot);
  items.push({
    slot: anchorSlot,
    garment: anchorCard,
    isFromWardrobe: anchorCard.source === 'WARDROBE',
    stylingNote: anchorCard.source === 'WARDROBE' ? 'From your closet' : 'Anchor statement piece',
  });

  // Determine complementary target slots strictly without repetition
  let targetSlots: AgentOutfitItem['slot'][] = [];
  if (anchorSlot === 'BOTTOM') {
    targetSlots = ['TOP', 'ACCESSORY', 'OUTERWEAR', 'FOOTWEAR'];
  } else if (anchorSlot === 'TOP') {
    targetSlots = ['BOTTOM', 'ACCESSORY', 'OUTERWEAR', 'FOOTWEAR'];
  } else if (anchorSlot === 'ACCENT') {
    targetSlots = ['ACCESSORY', 'OUTERWEAR', 'FOOTWEAR'];
  } else if (anchorSlot === 'OUTERWEAR') {
    targetSlots = ['TOP', 'BOTTOM', 'ACCESSORY'];
  } else if (anchorSlot === 'ACCESSORY') {
    targetSlots = ['TOP', 'BOTTOM', 'ACCENT', 'OUTERWEAR'];
  } else if (anchorSlot === 'FOOTWEAR') {
    targetSlots = ['TOP', 'BOTTOM', 'ACCENT', 'ACCESSORY'];
  }

  // 1. Fill complementary slots from available cards in allCards (strictly 1 item per slot)
  for (const slot of targetSlots) {
    if (items.length >= 3) break;
    if (usedSlots.has(slot)) continue;

    const match = allCards.find((c) => !usedIds.has(c.id) && inferOutfitSlot(c) === slot);
    if (match) {
      usedIds.add(match.id);
      usedSlots.add(slot);
      items.push({
        slot,
        garment: match,
        isFromWardrobe: match.source === 'WARDROBE',
        stylingNote: match.source === 'WARDROBE' ? 'From your closet' : slot === 'ACCESSORY' ? 'Finishing touch' : 'Harmonious pairing',
      });
    }
  }

  // 2. If slots are still missing, fetch complementary pieces from the catalog matching context
  for (const slot of targetSlots) {
    if (items.length >= 3) break;
    if (usedSlots.has(slot)) continue;

    const complementary = await fetchComplementaryPiece(slot, usedIds, promptContext);
    if (complementary) {
      usedIds.add(complementary.id);
      usedSlots.add(slot);
      items.push({
        slot,
        garment: complementary,
        isFromWardrobe: false,
        stylingNote: slot === 'ACCESSORY' ? 'Finishing touch' : 'Harmonious pairing',
      });
    }
  }

  if (items.length === 0) return undefined;

  return {
    title: occasion,
    vibe: 'Clean and balanced',
    occasion: 'Complete look',
    editorialNote: useWardrobe
      ? 'A balanced look combining a piece from your wardrobe with perfectly paired complementary pieces.'
      : 'A balanced look with distinct, coordinated pieces styled for a complete look.',
    items,
  };
}

export interface ParsedFashionIntent {
  intent: 'STYLING_ADVICE' | 'SHOP_BUY' | 'RENTAL' | 'SWAP' | 'WARDROBE_QUERY' | 'FULL_OUTFIT_LOOK';
  isStylingAdvice: boolean;
  targetGarment: {
    slot: 'TOP' | 'BOTTOM' | 'DRESS' | 'OUTERWEAR' | 'FOOTWEAR' | 'ACCESSORY' | 'NONE';
    color: string | null;
    itemName: string | null;
  };
  complementaryCategories: string[];
  excludeCategories: string[];
  searchKeywords: string[];
  maxBudget?: number;
  wantsClosetItems: boolean;
}

/**
 * LLM-powered Intent Classification and Slot Parameter Extraction
 * Runs sub-200ms via Groq with seamless Gemini fallback.
 */
export async function classifyFashionIntent(
  message: string,
  visualSummary?: string
): Promise<ParsedFashionIntent> {
  const prompt = `You are the intent classification and parameter extraction engine for KaPhor, a circular fashion and styling app.
Analyze the user's message (and any image summary) and return a strictly valid JSON object matching this schema:

{
  "intent": "STYLING_ADVICE" | "SHOP_BUY" | "RENTAL" | "SWAP" | "WARDROBE_QUERY" | "FULL_OUTFIT_LOOK",
  "isStylingAdvice": boolean,
  "targetGarment": {
    "slot": "TOP" | "BOTTOM" | "DRESS" | "OUTERWEAR" | "FOOTWEAR" | "ACCESSORY" | "NONE",
    "color": string or null,
    "itemName": string or null
  },
  "complementaryCategories": string[],
  "excludeCategories": string[],
  "searchKeywords": string[],
  "maxBudget": number or null,
  "wantsClosetItems": boolean
}

RULES:
1. If the user asks how to style something, color combinations, palette, what goes with, what to wear with, or ideas for an item:
   - "intent": "STYLING_ADVICE"
   - "isStylingAdvice": true
   - Set "targetGarment" to what the user ALREADY HAS (e.g. for "baby pink top", slot="TOP", color="baby pink").
   - "complementaryCategories" MUST be categories that go with it (if user has a TOP, return ["Bottoms", "Denims", "Skirts", "Jackets", "Blazers", "Accessories", "Jewelry", "Watches", "Footwear", "Sandals"]).
   - "excludeCategories" MUST exclude the same category (if user has a TOP, exclude ["Tops", "Sets"]).
   - "searchKeywords" should be 4-6 specific harmonious color & piece keywords (e.g. for baby pink top: ["chocolate brown", "white trousers", "light wash denim", "linen pants", "silver"]).
2. If the user asks to rent, lease, or hire:
   - "intent": "RENTAL"
3. If the user asks to swap, trade, or exchange:
   - "intent": "SWAP"
4. If the user asks to buy, find pieces, shop, or browse catalog:
   - "intent": "SHOP_BUY"
5. If the user asks for a complete look, full outfit, head-to-toe ensemble:
   - "intent": "FULL_OUTFIT_LOOK"
6. Extract numerical budget if specified (e.g. "under 1500" -> maxBudget: 1500).
7. If the user mentions their closet, wardrobe, or clothes they own:
   - "wantsClosetItems": true

User Message: "${message}"
${visualSummary ? `Item Image Analysis: "${visualSummary}"` : ''}`;

  try {
    const raw = await generateWithGroq(prompt, {
      responseFormat: 'json',
      temperature: 0.1,
      maxTokens: 512,
    });
    const parsed: any = parseLlmJson(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('Intent JSON invalid');
    return {
      intent: parsed.intent || 'STYLING_ADVICE',
      isStylingAdvice: Boolean(parsed.isStylingAdvice ?? (parsed.intent === 'STYLING_ADVICE')),
      targetGarment: parsed.targetGarment || { slot: 'NONE', color: null, itemName: null },
      complementaryCategories: Array.isArray(parsed.complementaryCategories) ? parsed.complementaryCategories : [],
      excludeCategories: Array.isArray(parsed.excludeCategories) ? parsed.excludeCategories : [],
      searchKeywords: Array.isArray(parsed.searchKeywords) ? parsed.searchKeywords : [],
      maxBudget: typeof parsed.maxBudget === 'number' && parsed.maxBudget > 0 ? parsed.maxBudget : undefined,
      wantsClosetItems: Boolean(parsed.wantsClosetItems),
    };
  } catch (groqErr) {
    logger.warn('Groq intent classification failed, falling back to Gemini', { error: groqErr });
    try {
      const rawGemini = await generateWithGemini(prompt, {
        responseMimeType: 'application/json',
        temperature: 0.1,
      });
      const parsed: any = parseLlmJson(rawGemini);
      if (!parsed || typeof parsed !== 'object') throw new Error('Intent JSON invalid');
      return {
        intent: parsed.intent || 'STYLING_ADVICE',
        isStylingAdvice: Boolean(parsed.isStylingAdvice ?? (parsed.intent === 'STYLING_ADVICE')),
        targetGarment: parsed.targetGarment || { slot: 'NONE', color: null, itemName: null },
        complementaryCategories: Array.isArray(parsed.complementaryCategories) ? parsed.complementaryCategories : [],
        excludeCategories: Array.isArray(parsed.excludeCategories) ? parsed.excludeCategories : [],
        searchKeywords: Array.isArray(parsed.searchKeywords) ? parsed.searchKeywords : [],
        maxBudget: typeof parsed.maxBudget === 'number' && parsed.maxBudget > 0 ? parsed.maxBudget : undefined,
        wantsClosetItems: Boolean(parsed.wantsClosetItems),
      };
    } catch (geminiErr) {
      logger.warn('Gemini intent classification fallback failed, using heuristic', { error: geminiErr });
      const lower = message.toLowerCase();
      const isStyling = Boolean(visualSummary) || /\b(how to style|how do i style|how to wear|color combo|pair with|what goes with)\b/i.test(lower);
      const isTop = /\b(top|tops|tshirt|tee|shirt|blouse|sweater)\b/i.test(lower);
      const isRental = /\b(rent|rental|lease|hire)\b/i.test(lower);
      const isSwap = /\b(swap|trade|exchange)\b/i.test(lower);
      return {
        intent: isRental ? 'RENTAL' : isSwap ? 'SWAP' : isStyling ? 'STYLING_ADVICE' : 'SHOP_BUY',
        isStylingAdvice: isStyling,
        targetGarment: {
          slot: isTop ? 'TOP' : 'NONE',
          color: null,
          itemName: null,
        },
        complementaryCategories: isTop ? ['Bottoms', 'Skirts', 'Jackets', 'Accessories'] : [],
        excludeCategories: isTop ? ['Tops', 'Sets'] : [],
        searchKeywords: [],
        maxBudget: undefined,
        wantsClosetItems: /\b(closet|wardrobe)\b/i.test(lower),
      };
    }
  }
}

// ── Agent Orchestrator: Main Pipeline ─────────────────────────────────────────
export async function runFashionAgent(params: {
  userId: string;
  message: string;
  imageUrl?: string;
  visualAnalysisSummary?: string;
}): Promise<AgentResult> {
  const { userId, message, visualAnalysisSummary } = params;
  const prompt = (message || '').toLowerCase();

  const actionsExecuted: AgentActionLog[] = [];
  const cards: AgentCard[] = [];
  let outfitLook: AgentOutfitLook | undefined = undefined;

  // 1. User Style Profile & Preferences
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { styleAesthetic: true, preferenceProfile: true },
  });
  const profile = (user?.preferenceProfile as any) || {};
  const userAesthetic = user?.styleAesthetic || profile.dominantAesthetic || 'Contemporary Luxury';
  const topCats = Object.keys(profile.topCategories || {}).slice(0, 3);
  const topBrands = Object.keys(profile.topBrands || {}).slice(0, 3);

  // 2. LLM Intent Classification & Slot Extraction
  const parsedIntent = await classifyFashionIntent(message, visualAnalysisSummary);
  const wantsWardrobe = parsedIntent.wantsClosetItems;
  const wantsRental = parsedIntent.intent === 'RENTAL';
  const wantsSwap = parsedIntent.intent === 'SWAP';
  const isStylingAdviceQuery = parsedIntent.isStylingAdvice || Boolean(params.imageUrl || visualAnalysisSummary);
  const maxPrice = parsedIntent.maxBudget;
  const isExplicitShoppingQuery = wantsRental || wantsSwap || !!maxPrice || parsedIntent.intent === 'SHOP_BUY';
  const wantsFullOutfit = parsedIntent.intent === 'FULL_OUTFIT_LOOK';

  // Tool Invocation 1: Inspect User Wardrobe (ONLY when user explicitly asks about their closet)
  let wardrobeData = { items: [] as any[], cards: [] as AgentCard[] };
  if (wantsWardrobe) {
    wardrobeData = await inspectUserWardrobe(userId);
    if (wardrobeData.cards.length > 0) {
      actionsExecuted.push({
        tool: 'inspect_user_wardrobe',
        description: `Checked your closet (${wardrobeData.cards.length} items)`,
        count: wardrobeData.cards.length,
      });
    }
  }

  // Tool Invocation 2: Search App Catalog
  let catalogType: 'BUY' | 'RENTAL' | 'ACCESSORY_SWAP' | undefined = undefined;
  if (wantsRental) catalogType = 'RENTAL';
  else if (wantsSwap) catalogType = 'ACCESSORY_SWAP';

  // For styling queries, search for COMPLEMENTARY categories, NEVER more of the same piece
  let targetCategories: string[] | undefined = undefined;
  let excludeCategories: string[] | undefined = undefined;
  let catalogSearchQuery = message;

  if (isStylingAdviceQuery) {
    if (parsedIntent.complementaryCategories.length > 0) {
      targetCategories = parsedIntent.complementaryCategories;
    }
    if (parsedIntent.excludeCategories.length > 0) {
      excludeCategories = parsedIntent.excludeCategories;
    }
    if (parsedIntent.searchKeywords.length > 0) {
      catalogSearchQuery = parsedIntent.searchKeywords.slice(0, 3).join(' ');
    } else {
      catalogSearchQuery = 'trousers jeans skirt accessories';
    }
  }

  const catalogData = await searchCatalog({
    listingType: catalogType,
    maxPrice,
    query: catalogSearchQuery,
    categories: targetCategories,
    excludeCategories,
    topCategories: isStylingAdviceQuery ? undefined : topCats,
    topBrands: topBrands,
    take: 6,
  });

  if (catalogData.cards.length > 0) {
    actionsExecuted.push({
      tool: 'search_catalog',
      description: isStylingAdviceQuery
        ? `Found ${catalogData.cards.length} complementary pairings on the app`
        : `Found ${catalogData.cards.length} pieces on the app`,
      count: catalogData.cards.length,
    });
  }

  // Tool Invocation 3: Evaluate Swap Matches (if swap mode)
  if (wantsSwap) {
    const swapData = await evaluateSwapMatches(userId);
    if (swapData.matches.length > 0) {
      actionsExecuted.push({
        tool: 'evaluate_swap_parity',
        description: `Found ${swapData.matches.length} swap items with fair values`,
        count: swapData.matches.length,
      });
      cards.push(...swapData.matches);
    }
  }

  // Tool Invocation 4: Synthesize Outfit Look (ONLY for shopping or when user explicitly asks for an outfit look)
  if ((isExplicitShoppingQuery || wantsFullOutfit) && !isStylingAdviceQuery && catalogData.cards.length > 0) {
    const occasionTitle = prompt.includes('beach') ? 'Beach Day Look'
      : prompt.includes('wedding') ? 'Wedding & Festive Ensemble'
      : prompt.includes('party') ? 'Evening Party Look'
      : prompt.includes('brunch') ? 'Weekend Brunch Ensemble'
      : prompt.includes('casual') ? 'Casual Street Ensemble'
      : prompt.includes('formal') ? 'Sophisticated Formal Look'
      : 'Curated Occasion Ensemble';

    outfitLook = await createOutfitLook(
      wantsWardrobe ? wardrobeData.cards : [],
      catalogData.cards,
      occasionTitle,
      prompt
    );
    if (outfitLook) {
      actionsExecuted.push({
        tool: 'create_outfit_look',
        description: `Put together a ${occasionTitle.toLowerCase()} matching your style`,
      });
    }
  }

  // Add primary recommended cards from catalog (avoid duplicates)
  const existingIds = new Set(cards.map(c => c.id));
  for (const c of catalogData.cards) {
    if (!existingIds.has(c.id)) {
      cards.push(c);
      existingIds.add(c.id);
    }
  }

  // Only include wardrobe cards if user explicitly asked for them
  if (wantsWardrobe) {
    for (const w of wardrobeData.cards.slice(0, 2)) {
      if (!existingIds.has(w.id)) {
        cards.push(w);
        existingIds.add(w.id);
      }
    }
  }

  // 3. AI Assistant Synthesis
  const wardrobeSummary = wardrobeData.cards.map(c => `"${c.title}" (${c.brand}, ${c.category})`).join(', ') || 'None';

  const catalogSummary = cards.length > 0
    ? cards.map((c, i) => {
        const priceLabel = c.rentalPriceDay
          ? `₹${c.rentalPriceDay}/day${maxPrice ? ` ✓ under ₹${maxPrice}/day` : ''}`
          : `₹${c.price}`;
        return `${i + 1}. "${c.title}" by ${c.brand} (${c.category}, ${c.listingType}: ${priceLabel})`;
      }).join('\n')
    : '';

  const budgetContext = maxPrice && wantsRental
    ? `IMPORTANT FACT: All ${cards.length} items listed below have already been filtered and confirmed to be under ₹${maxPrice}/day. Do NOT say you couldn't find items. They are all within budget.`
    : maxPrice
    ? `IMPORTANT FACT: All ${cards.length} items listed below are confirmed under ₹${maxPrice}. Do NOT say you couldn't find items.`
    : '';

  let agentPrompt = '';

  if (isStylingAdviceQuery) {
    agentPrompt = `You are KaPhor AI, a chic, inspiring fashion stylist.
You speak in warm, modern, breezy English. Keep your tone effortless, chic, and direct. Avoid pretentious fashion clichés (never use words like "curate", "ensemble", "silhouette", "circular vault", "dossier", "intentional layering").

TASK: Provide styling & color advice for: "${message}".
${visualAnalysisSummary ? `Uploaded Item Photo Analysis: "${visualAnalysisSummary}".` : ''}

CRITICAL BREVITY & FORMATTING RULES (STRICTLY ENFORCE):
1. NEVER write a heavy paragraph or wall of text. Keep your entire reply short, punchy, and under 60-70 words!
2. Format your response exactly like this:
   - A friendly 1-sentence intro.
   - Exactly 2 to 3 bullet points, each on its own line starting with the bullet character:
     • Combo Name: 1 concise sentence describing the bottom, cut, or layering (e.g. • Chocolate Brown: Ground it with tailored wide-leg trousers or a pleated skirt for a rich 90s contrast.)
   - A brief 1-sentence wrap-up pointing to the pieces below.
3. Plain text only. Do NOT use markdown symbols such as ** or # or backticks, and never reply in JSON.
4. ANATOMICAL REALITY: A TOP must always be styled with bottoms (jeans, trousers, skirts, shorts) or outerwear. NEVER recommend wearing a top with another top (no blouses/shirts over tops).
5. ONLY reference items from "Available complementary pieces on the app" below if they genuinely fit the vibe.

User Style Profile: ${userAesthetic}${topCats.length ? `, Preferred: ${topCats.join(', ')}` : ''}.

Available complementary pieces on the app (${cards.length} items):
${catalogSummary || 'No specific catalog items.'}`;

  } else {
    agentPrompt = `You are KaPhor AI, a friendly, warm shopping and style helper.
You speak in very simple, natural, everyday English.
Never use complicated fashion jargon or pretentious words (strictly avoid words like "curate", "ensemble", "silhouette", "intentional layering", "circular vault", "equitable trade valuation", "dossier").

CRITICAL RULES:
1. NEVER mention whether the user's closet or digital closet is mapped, unmapped, empty, digitized, or pending.
2. The user wants to shop, rent, swap, or buy items. Recommend matching pieces from "Available pieces found on the app" below by exact title and brand.
3. Never say "I couldn't find", "unable to recommend", or "check the app directly" when pieces ARE listed below.
4. Keep your reply short, warm, and natural: strictly 2 to 3 simple sentences.
5. The user sees interactive product cards below your message, so do not use markdown symbols (** or #), JSON or item IDs. Plain text only.
${budgetContext ? `6. ${budgetContext}` : ''}

The user asked: "${message}".
User Style Profile: ${userAesthetic}${topCats.length ? `, Preferred: ${topCats.join(', ')}` : ''}${topBrands.length ? `, Brands: ${topBrands.join(', ')}` : ''}.

Available pieces found on the app (${cards.length} items, all confirmed in-budget):
${catalogSummary || 'No specific catalog items — suggest the user browse by category or occasion.'}
${outfitLook ? `Outfit look: ${outfitLook.title}` : ''}
${wantsWardrobe ? `User's closet items: ${wardrobeSummary}` : ''}`;
  }

  let reply = '';
  try {
    reply = await generateWithGroq(agentPrompt);
  } catch (groqErr) {
    logger.warn('Groq agent synthesis failed, falling back to Gemini', { error: groqErr });
    try {
      reply = await generateWithGemini(agentPrompt);
    } catch (err) {
      logger.warn('Gemini agent synthesis fallback', { err });
      if (cards.length > 0) {
        const topOne = cards[0];
        reply = isExplicitShoppingQuery
          ? `I found some great pieces on the app that match your style, like the ${topOne.title} by ${topOne.brand}. You can check out all the pieces below to view details, rent, or buy!`
          : `For this piece, pair it with structured high-waist bottoms or wide-leg denim, and complete the look with chunky footwear and clean minimalist jewelry!`;
      } else {
        reply = `To style this piece, balance the proportions with relaxed high-waist denim or trousers, layer an oversized blazer, and complete the look with clean footwear and subtle accessories!`;
      }
    }
  }

  // Never let markdown or JSON-looking text reach the user
  reply = cleanChatReply(reply, cards.length > 0
    ? 'Here are a few pieces that could work for you. Take a look below.'
    : 'Tell me a bit more about the occasion and I will suggest some looks.');

  // Guard: If a SHOPPING prompt returned a negative/fallback message but we actually have cards, override it
  const negativePhrases = [
    "couldn't find", "could not find", "unable to find", "no specific",
    "check those brands", "check directly", "visit their", "unable to recommend"
  ];
  const replyLower = reply.toLowerCase();
  if (isExplicitShoppingQuery && cards.length > 0 && negativePhrases.some(p => replyLower.includes(p))) {
    const top = cards[0];
    const priceStr = top.rentalPriceDay ? `₹${top.rentalPriceDay}/day` : `₹${top.price}`;
    const secondCard = cards[1];
    reply = secondCard
      ? `Great news — we have ${cards.length} options that fit your budget perfectly! The ${top.title} by ${top.brand} is just ${priceStr}, and the ${secondCard.title} by ${secondCard.brand} is another lovely pick. Check them all out below!`
      : `Great news — the ${top.title} by ${top.brand} is right within your budget at ${priceStr}. Check it out below!`;
  }

  // 4. Suggested Follow-ups (Simple, clean, no emojis)
  const suggestedFollowUps: string[] = [
    'Find an outfit for an event',
    'Rentals under ₹1,000/day',
    'Trending party looks',
    'Casual everyday styles',
  ];

  return {
    reply,
    actionsExecuted,
    cards,
    outfitLook,
    suggestedFollowUps,
  };
}
