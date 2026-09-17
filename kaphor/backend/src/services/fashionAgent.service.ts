import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { getDownloadUrl } from '../lib/cloudinary';
import { generateWithGroq } from './groq.service';
import { generateWithGemini } from './gemini.service';

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
  'Dresses': ['dress', 'gown', 'mini dress', 'maxi', 'midi', 'cocktail'],
  'Skirts': ['skirt'],
  'Blazers': ['blazer', 'tuxedo', 'suit jacket'],
  'Jackets': ['jacket', 'bomber', 'coat'],
  'Tops': ['top', 'tops', 'crop top', 'blouse', 'shirt', 't-shirt'],
  'Sets': ['set', 'sets', 'co-ord', 'coord', 'matching set', 'two-piece'],
  'Heels': ['heel', 'heels', 'stiletto', 'pump'],
  'Flats': ['flat', 'flats', 'loafer', 'mule', 'slides', 'juttis', 'shoe', 'shoes', 'footwear', 'sneakers'],
  'Bags': ['bag', 'bags', 'handbag', 'tote', 'crossbody', 'purse', 'clutch'],
  'Jewelry': ['jewelry', 'jewellery', 'necklace', 'earring', 'earrings', 'choker', 'bracelet'],
  'Accessories': ['accessory', 'accessories', 'scarf', 'belt', 'watch', 'sunglasses'],
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
  'digital', 'closet', 'mapped', 'yet', 'pulled', 'rent', 'rental', 'swap', 'buy'
]);

// ── Agent Tool 2: Search Catalog ──────────────────────────────────────────────
export async function searchCatalog(params: {
  query?: string;
  category?: string;
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

    // 1. Detect categories from prompt text
    const detectedCategories: string[] = [];
    if (params.category) {
      detectedCategories.push(params.category);
    }
    for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
      if (keywords.some(kw => promptText.includes(kw))) {
        detectedCategories.push(cat);
      }
    }

    // 2. Extract meaningful search tokens
    const rawTokens = promptText
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w));

    // 3. Tier 1: Query with detected categories and/or tokens
    const tier1OrConditions: any[] = [];
    if (detectedCategories.length > 0) {
      tier1OrConditions.push({
        category: { in: detectedCategories, mode: 'insensitive' },
      });
    }
    for (const token of rawTokens.slice(0, 4)) {
      tier1OrConditions.push(
        { title: { contains: token, mode: 'insensitive' } },
        { brand: { contains: token, mode: 'insensitive' } },
        { category: { contains: token, mode: 'insensitive' } },
        { subCategory: { contains: token, mode: 'insensitive' } }
      );
    }

    if (tier1OrConditions.length > 0) {
      const tier1Items = await db.garment.findMany({
        where: {
          ...baseWhere,
          OR: tier1OrConditions,
        },
        orderBy: { popularityScore: 'desc' },
        take: params.take || 6,
      });
      for (const item of tier1Items) {
        matchedGarmentMap.set(item.id, item);
      }
    }

    // 4. Tier 2: If fewer than 4 items, search by user top categories or top brands
    if (matchedGarmentMap.size < (params.take || 4)) {
      const tier2OrConditions: any[] = [];
      if (params.topCategories && params.topCategories.length > 0) {
        tier2OrConditions.push({
          category: { in: params.topCategories, mode: 'insensitive' },
        });
      }
      if (params.topBrands && params.topBrands.length > 0) {
        tier2OrConditions.push({
          brand: { in: params.topBrands, mode: 'insensitive' },
        });
      }

      if (tier2OrConditions.length > 0) {
        const tier2Items = await db.garment.findMany({
          where: {
            ...baseWhere,
            OR: tier2OrConditions,
            id: { notIn: Array.from(matchedGarmentMap.keys()) },
          },
          orderBy: { popularityScore: 'desc' },
          take: (params.take || 6) - matchedGarmentMap.size,
        });
        for (const item of tier2Items) {
          matchedGarmentMap.set(item.id, item);
        }
      }
    }

    // 5. Tier 3: If still fewer than 4 items, pull top active catalog pieces
    if (matchedGarmentMap.size < 4) {
      const tier3Items = await db.garment.findMany({
        where: {
          ...baseWhere,
          id: { notIn: Array.from(matchedGarmentMap.keys()) },
        },
        orderBy: { popularityScore: 'desc' },
        take: 6 - matchedGarmentMap.size,
      });
      for (const item of tier3Items) {
        matchedGarmentMap.set(item.id, item);
      }
    }

    const rawItems = Array.from(matchedGarmentMap.values());
    // Shuffle items slightly to provide recommendation diversity across queries
    const shuffledItems = [...rawItems].sort(() => Math.random() - 0.5);
    const finalItems = shuffledItems.slice(0, params.take || 6);
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

// ── Agent Tool 4: Create Outfit Look ──────────────────────────────────────────
export async function createOutfitLook(
  wardrobeCards: AgentCard[],
  catalogCards: AgentCard[],
  occasion: string = 'Recommended Ensemble'
): Promise<AgentOutfitLook | undefined> {
  const useWardrobe = wardrobeCards.length > 0;
  const allCards = useWardrobe ? [...wardrobeCards, ...catalogCards] : [...catalogCards];
  if (allCards.length === 0) return undefined;

  const slotOrder: AgentOutfitItem['slot'][] = ['ACCENT', 'TOP', 'BOTTOM', 'OUTERWEAR', 'FOOTWEAR', 'ACCESSORY'];
  const usedIds = new Set<string>();
  const items: AgentOutfitItem[] = [];

  for (const slot of slotOrder) {
    const garment = allCards.find((card) => !usedIds.has(card.id) && inferOutfitSlot(card) === slot);
    if (!garment) continue;
    usedIds.add(garment.id);
    items.push({
      slot,
      garment,
      isFromWardrobe: garment.source === 'WARDROBE',
      stylingNote: garment.source === 'WARDROBE' ? 'From your closet' : slot === 'ACCESSORY' ? 'Finishing touch' : 'Category match',
    });
    if (items.length >= 3) break;
  }

  for (const garment of allCards) {
    if (items.length >= 3) break;
    if (usedIds.has(garment.id)) continue;
    usedIds.add(garment.id);
    items.push({
      slot: inferOutfitSlot(garment),
      garment,
      isFromWardrobe: garment.source === 'WARDROBE',
      stylingNote: garment.source === 'WARDROBE' ? 'From your closet' : 'Recommended piece',
    });
  }

  return {
    title: occasion,
    vibe: 'Refined & Stylish',
    occasion: 'Event & Evening',
    editorialNote: useWardrobe
      ? 'Here is an outfit combining pieces from your closet with curated pieces from the app.'
      : 'Here is an outfit put together with pieces from the app that match your style.',
    items,
  };
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

  // 2. Determine User Intent: only inspect wardrobe if explicitly requested
  const wantsWardrobe = /\b(my closet|my wardrobe|in my closet|in my wardrobe|from my closet|clothes i own|what i own|pair with my|match my)\b/i.test(prompt);
  const wantsRental = /\b(rent|rental|lease|hire|day rate)\b/i.test(prompt);
  const wantsSwap = /\b(swap|trade|exchange)\b/i.test(prompt);
  const wantsOutfit = /\b(outfit|look|style me|what to wear|wear tonight|wedding|party|brunch|cocktail|dinner|date night|event|sets|silhouette)\b/i.test(prompt);

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

  // Extract budget or price hint if present
  let maxPrice: number | undefined = undefined;
  const priceMatch = prompt.match(/(?:under|below|less than|max)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i);
  if (priceMatch && priceMatch[1]) {
    maxPrice = parseInt(priceMatch[1], 10);
  }

  const catalogData = await searchCatalog({
    listingType: catalogType,
    maxPrice,
    query: message,
    topCategories: topCats,
    topBrands: topBrands,
    take: 6,
  });

  if (catalogData.cards.length > 0) {
    actionsExecuted.push({
      tool: 'search_catalog',
      description: `Found ${catalogData.cards.length} pieces on the app`,
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

  // Tool Invocation 4: Synthesize Outfit Look (if outfit requested or general styling inquiry)
  if (catalogData.cards.length > 0) {
    outfitLook = await createOutfitLook(wantsWardrobe ? wardrobeData.cards : [], catalogData.cards, 'Recommended Ensemble');
    if (outfitLook) {
      actionsExecuted.push({
        tool: 'create_outfit_look',
        description: 'Put together an outfit matching your style',
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
  const catalogSummary = cards.map((c, i) => `${i + 1}. "${c.title}" by ${c.brand} (Category: ${c.category}, ${c.listingType}: ₹${c.rentalPriceDay ? `${c.rentalPriceDay}/day` : c.price})`).join('\n') || 'App pieces found';

  const agentPrompt = `You are KaPhor AI, a friendly, warm shopping and style helper.
You speak in very simple, natural, everyday English.
Never use complicated fashion jargon or pretentious words (strictly avoid words like "curate", "ensemble", "silhouette", "intentional layering", "circular vault", "equitable trade valuation", "proportions", "textiles", "dossier").

CRITICAL RULES:
1. NEVER mention whether the user's closet or digital closet is mapped, unmapped, empty, digitized, or pending digitization. NEVER say "Since your digital closet isn't mapped..." or "Since your closet digitization is pending..." or anything similar!
2. You MUST recommend ONLY the actual pieces from "Available pieces found on the app" below. DO NOT invent designers, brands (like Torani, Payal Khandwala, Sabyasachi, etc.) or pieces that are not listed in the "Available pieces found on the app" list. Reference 1 or 2 specific pieces from that list by exact title and brand and explain why they match what was asked for.
3. Keep your reply short, warm, and natural: strictly 2 to 3 simple sentences.
4. The user sees the full interactive product cards with photos, prices, and direct buttons right below your message, so do not include markdown bullet lists, links, or item IDs.

The user asked: "${message}".
${visualAnalysisSummary ? `User uploaded photo: "${visualAnalysisSummary}".` : ''}
User Style Profile: ${userAesthetic}${topCats.length ? `, Preferred: ${topCats.join(', ')}` : ''}${topBrands.length ? `, Brands: ${topBrands.join(', ')}` : ''}.

Available pieces found on the app:
${catalogSummary}
${outfitLook ? `Outfit look: ${outfitLook.title}` : ''}
${wantsWardrobe ? `User's closet items: ${wardrobeSummary}` : ''}`;

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
        reply = `I found some great pieces on the app that match your style, like the ${topOne.title} by ${topOne.brand}. You can check out all the pieces below to view details, rent, or buy!`;
      } else {
        reply = `I can help you find pieces on the app to rent, buy, or swap. What style, color, or event are you dressing up for?`;
      }
    }
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
