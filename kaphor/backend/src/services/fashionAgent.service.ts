import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { getDownloadUrl } from '../lib/s3';
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
  let actionUrl = `/(tabs)/shop/garment/${g.id}`;
  let actionLabel = 'VIEW PIECE';

  if (source === 'CATALOG') {
    if (listingType === 'RENTAL') {
      actionType = 'RENT';
      actionUrl = `/(tabs)/rental/reserve?id=${g.id}`;
      actionLabel = 'RENT LEASE';
    } else if (listingType === 'ACCESSORY_SWAP') {
      actionType = 'SWAP';
      actionUrl = `/(tabs)/swap/${g.id}`;
      actionLabel = 'REQUEST SWAP';
    } else {
      actionType = 'BUY';
      actionUrl = `/(tabs)/shop/garment/${g.id}`;
      actionLabel = 'BUY PIECE';
    }
  } else {
    actionType = 'VIEW';
    actionUrl = `/(tabs)/profile/wardrobe`;
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

// ── Agent Tool 2: Search Catalog ──────────────────────────────────────────────
export async function searchCatalog(params: {
  query?: string;
  category?: string;
  listingType?: 'BUY' | 'RENTAL' | 'ACCESSORY_SWAP';
  maxPrice?: number;
  excludeId?: string;
  take?: number;
}): Promise<{ items: any[]; cards: AgentCard[] }> {
  try {
    const where: any = {
      isActive: true,
      lifecycleState: 'LISTED',
    };

    if (params.excludeId) {
      where.id = { not: params.excludeId };
    }

    if (params.listingType) {
      where.listingType = params.listingType;
    }

    if (params.category) {
      where.category = { contains: params.category, mode: 'insensitive' };
    }

    if (params.maxPrice && params.listingType === 'RENTAL') {
      where.rentalPriceDay = { lte: params.maxPrice };
    } else if (params.maxPrice) {
      where.price = { lte: params.maxPrice };
    }

    if (params.query) {
      const q = params.query.trim().toLowerCase();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { subCategory: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rawGarments = await db.garment.findMany({
      where,
      orderBy: { popularityScore: 'desc' },
      take: params.take || 4,
    });

    const cards = await Promise.all(
      rawGarments.map((g: any) => resolveGarmentCard(g, 'CATALOG'))
    );

    return { items: rawGarments, cards };
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
  occasion: string = 'Sophisticated Evening'
): Promise<AgentOutfitLook | undefined> {
  const allCards = [...wardrobeCards, ...catalogCards];
  if (allCards.length === 0) return undefined;

  // Classify available pieces
  const items: AgentOutfitItem[] = [];

  // Slot 1: Hero piece
  const heroPiece = wardrobeCards[0] || catalogCards[0];
  if (heroPiece) {
    items.push({
      slot: 'TOP',
      garment: heroPiece,
      isFromWardrobe: heroPiece.source === 'WARDROBE',
      stylingNote: heroPiece.source === 'WARDROBE' ? 'Anchor piece from your closet' : 'Statement archival piece to rent/buy',
    });
  }

  // Slot 2: Complementary lower/bottom or outerwear
  const secondary = catalogCards.find(c => c.id !== heroPiece?.id) || wardrobeCards.find(c => c.id !== heroPiece?.id);
  if (secondary) {
    items.push({
      slot: 'BOTTOM',
      garment: secondary,
      isFromWardrobe: secondary.source === 'WARDROBE',
      stylingNote: 'Balanced silhouette pairing',
    });
  }

  // Slot 3: Accessory / Accent
  const accessory = allCards.find(c => c.id !== heroPiece?.id && c.id !== secondary?.id);
  if (accessory) {
    items.push({
      slot: 'ACCESSORY',
      garment: accessory,
      isFromWardrobe: accessory.source === 'WARDROBE',
      stylingNote: 'Curated luxury accent',
    });
  }

  return {
    title: `${occasion} Ensemble`,
    vibe: 'Modern Circular Elegance',
    occasion,
    editorialNote: `We harmonized pieces you already own with authenticated circular pieces from the KaPhor archive to maximize wear value and elevate silhouette proportions.`,
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

  // 1. Determine User Intent & Tool Invocations
  const wantsWardrobe = prompt.includes('wardrobe') || prompt.includes('closet') || prompt.includes('my clothes') || prompt.includes('pair with') || prompt.includes('match') || prompt.includes('have') || prompt.includes('own');
  const wantsRental = prompt.includes('rent') || prompt.includes('lease') || prompt.includes('hire');
  const wantsSwap = prompt.includes('swap') || prompt.includes('trade') || prompt.includes('exchange');
  const wantsOutfit = prompt.includes('outfit') || prompt.includes('look') || prompt.includes('style me') || prompt.includes('wear tonight') || prompt.includes('wedding') || prompt.includes('party') || prompt.includes('brunch') || prompt.includes('cocktail');

  // Tool Invocation 1: Inspect User Wardrobe
  let wardrobeData = { items: [] as any[], cards: [] as AgentCard[] };
  if (wantsWardrobe || wantsOutfit || wantsSwap) {
    wardrobeData = await inspectUserWardrobe(userId);
    if (wardrobeData.cards.length > 0) {
      actionsExecuted.push({
        tool: 'inspect_user_wardrobe',
        description: `Inspected ${wardrobeData.cards.length} garments in your digital closet`,
        count: wardrobeData.cards.length,
      });
    }
  }

  // Tool Invocation 2: Search Circular Catalog
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
    query: message.replace(/(rent|swap|outfit|style|closet|wardrobe|find|show|me)/gi, '').trim() || undefined,
    take: 4,
  });

  if (catalogData.cards.length > 0) {
    actionsExecuted.push({
      tool: 'search_catalog',
      description: `Queried KaPhor archive (${catalogType || 'All listings'}) — found ${catalogData.cards.length} curated pieces`,
      count: catalogData.cards.length,
    });
  }

  // Tool Invocation 3: Evaluate Swap Matches
  if (wantsSwap) {
    const swapData = await evaluateSwapMatches(userId);
    if (swapData.matches.length > 0) {
      actionsExecuted.push({
        tool: 'evaluate_swap_parity',
        description: `Evaluated trade valuations: found ${swapData.matches.length} equitable swap matches (±15% parity)`,
        count: swapData.matches.length,
      });
      cards.push(...swapData.matches);
    }
  }

  // Tool Invocation 4: Synthesize Outfit Lookbook
  if (wantsOutfit || (wantsWardrobe && catalogData.cards.length > 0)) {
    outfitLook = await createOutfitLook(wardrobeData.cards, catalogData.cards, 'Curated Editorial Look');
    if (outfitLook) {
      actionsExecuted.push({
        tool: 'create_outfit_look',
        description: `Synthesized a multi-piece outfit harmonizing closet items with archive pieces`,
      });
    }
  }

  // Add primary recommended cards (avoid duplicates)
  const existingIds = new Set(cards.map(c => c.id));
  for (const c of catalogData.cards) {
    if (!existingIds.has(c.id)) {
      cards.push(c);
      existingIds.add(c.id);
    }
  }
  for (const w of wardrobeData.cards.slice(0, 2)) {
    if (!existingIds.has(w.id)) {
      cards.push(w);
      existingIds.add(w.id);
    }
  }

  // 2. Gemini Stylist Synthesis
  const wardrobeSummary = wardrobeData.cards.map(c => `"${c.title}" (${c.brand}, ${c.category})`).join(', ') || 'No digitized pieces yet';
  const catalogSummary = catalogData.cards.map(c => `"${c.title}" by ${c.brand} [${c.listingType}: ₹${c.rentalPriceDay || c.price}]`).join(', ') || 'Catalog pieces curated';

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { styleAesthetic: true, preferenceProfile: true },
  });
  const profile = (user?.preferenceProfile as any) || {};
  const userAesthetic = user?.styleAesthetic || profile.dominantAesthetic || 'Contemporary Luxury';
  const topCats = Object.keys(profile.topCategories || {}).slice(0, 3).join(', ');
  const topBrands = Object.keys(profile.topBrands || {}).slice(0, 3).join(', ');

  const agentPrompt = `You are the KaPhor Autonomous Fashion Stylist & Circular Fashion Agent.
You do not speak like an automated bot; you sound like an elite, knowledgeable personal stylist and creative director.
The user asked: "${message}".
${visualAnalysisSummary ? `User uploaded photo visual analysis: "${visualAnalysisSummary}".` : ''}
User Style Signature: Aesthetic: ${userAesthetic}${topCats ? `, Preferred Categories: ${topCats}` : ''}${topBrands ? `, Favored Brands: ${topBrands}` : ''}.

Tools you executed:
${actionsExecuted.map(a => `- ${a.description}`).join('\n')}

Items from user's closet: ${wardrobeSummary}
Catalog pieces found: ${catalogSummary}
${outfitLook ? `Outfit look curated: ${outfitLook.title} (${outfitLook.items.length} pieces)` : ''}

Instructions:
1. Provide a sharp, elegant styling narrative (2-4 sentences max), tailored specifically to the user's aesthetic signature.
2. Reference specifically how the user can wear or pair these pieces.
3. Highlight circular benefits (wearing what they own, peer swap, or low-impact rental).
4. Do not list raw markdown bullets of links or IDs, because interactive UI cards will be rendered underneath your response.`;

  let reply = '';
  try {
    reply = await generateWithGroq(agentPrompt);
  } catch (groqErr) {
    logger.warn('Groq agent synthesis failed, falling back to Gemini', { error: groqErr });
    try {
      reply = await generateWithGemini(agentPrompt);
    } catch (err) {
      logger.warn('Gemini agent synthesis fallback', { err });
      if (outfitLook) {
        reply = `I have assembled a balanced ensemble pairing your personal archive with selected pieces from our circular vault. The proportions highlight texture contrast while maintaining high-wear versatility.`;
      } else if (catalogData.cards.length > 0) {
        reply = `Here are authenticated pieces from our circular archive that match your query. Each piece is pre-vetted for condition, authenticity, and sustainable lifecycle value.`;
      } else {
        reply = `To create an elevated silhouette, focus on intentional layering—such as pairing structured tailoring with fluid heritage textiles or artisanal accessories.`;
      }
    }
  }

  // 3. Suggested Follow-ups
  const suggestedFollowUps: string[] = [
    '✨ Style an outfit from my wardrobe',
    '🔍 Find a rental under ₹1,000/day',
    '⚖️ Fair swaps for my accessories',
    '🌿 How sustainable is my closet?',
  ];

  return {
    reply,
    actionsExecuted,
    cards,
    outfitLook,
    suggestedFollowUps,
  };
}
