/**
 * Repair & Refresh Service
 *
 * Orchestrates: GLIE condition assessment → T5 guide lookup → YouTube tutorial search
 */

import { assessGarment, initGLIE } from './glie';
import { queryT5, queryBlogReads, loadT5 } from './glie/t5-guides';
import { logger } from '../lib/logger';
import type { AssessGarmentInput, AssessGarmentResult } from './glie';

// ── YouTube Search ───────────────────────────────────────────────────────────

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || '';
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
  duration?: string;
}

/**
 * Search YouTube for repair/upcycle tutorials based on garment + damage context
 */
async function searchYouTubeTutorials(
  query: string,
  maxResults: number = 6,
): Promise<YouTubeVideo[]> {
  if (!YOUTUBE_API_KEY) {
    logger.warn('[Repair] YOUTUBE_API_KEY not configured — skipping YouTube search');
    return [];
  }

  try {
    const url = new URL(YOUTUBE_SEARCH_URL);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'video');
    url.searchParams.set('videoEmbeddable', 'true');
    url.searchParams.set('maxResults', String(maxResults));
    url.searchParams.set('relevanceLanguage', 'en');
    url.searchParams.set('key', YOUTUBE_API_KEY);

    const response = await fetch(url.toString());
    if (!response.ok) {
      logger.warn(`[Repair] YouTube search failed: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as any;
    const items = data?.items || [];

    if (items.length === 0) return [];

    return items
      .map((item: any) => ({
        videoId: item.id?.videoId || '',
        title: item.snippet?.title || '',
        channelTitle: item.snippet?.channelTitle || '',
        thumbnail: item.snippet?.thumbnails?.high?.url
          || item.snippet?.thumbnails?.medium?.url
          || item.snippet?.thumbnails?.default?.url
          || '',
        publishedAt: item.snippet?.publishedAt || '',
      }))
      .filter((v: YouTubeVideo) => v.videoId);
  } catch (err: any) {
    logger.error('[Repair] YouTube search error', { error: err.message });
    return [];
  }
}

/**
 * Build a YouTube search query from garment + damage info + routing decision.
 * Keeps results short-form friendly — no duration filter (Shorts = quick demos).
 */
export function buildYouTubeQuery(
  garmentCategory: string,
  fiberType: string,
  damageTypes: string[],
  decision?: string,
): string {
  const cleanCat = garmentCategory && garmentCategory !== 'other'
    ? garmentCategory.replace(/_/g, ' ')
    : 'clothing';
  const cleanFiber = fiberType && fiberType !== 'Cotton' ? fiberType : '';
  const damageList = (damageTypes?.filter(d => d && d !== 'none') || []).slice(0, 2);

  if (decision === 'UPCYCLE') {
    // For upcycling, do NOT search for damage types (hole, tear, etc.) because that returns mending/repair videos!
    // Search strictly for creative transformation, rework, and DIY ideas.
    return `how to upcycle old ${cleanCat} diy rework ideas transformation tutorial -repair -mending`.trim();
  }

  if (decision === 'RECYCLE') {
    return `how to textile recycling old ${cleanCat} drop off zero waste`.trim();
  }

  // REPAIR: target mending and restoring the specific damage
  const parts = ['how to repair fix mend'];
  if (cleanFiber) parts.push(cleanFiber);
  if (cleanCat !== 'clothing') parts.push(cleanCat);
  if (damageList.length > 0) parts.push(damageList.join(' '));
  parts.push('step by step tutorial');

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// ── Repair Assessment ────────────────────────────────────────────────────────

export interface RepairLookupInput {
  garment_category: string;
  fiber_type: string;
  damage_types?: string[];
  damage_description?: string;
  repair_feasibility?: string;
  condition_score?: number;
  routing_decision?: string;
  original_price_inr?: number;
}

export interface RepairAssessmentInput {
  image_base64?: string;
  fiber_type: string;
  garment_category: string;
  original_price_inr: number;
  style_tags?: string;
  color_family?: string;
  season?: string;
  damage_description?: string;
  damage_types?: string[];
  repair_feasibility?: string;
  condition_score?: number;
}

export interface T5GuideResult {
  doc_type: string;
  title: string;
  difficulty: string;
  time_minutes: number;
  technique_style: string;
  tools_required: string[];
  steps: string[];
  detailed_steps?: { step?: number; instruction: string; tip?: string }[];
  pro_tip?: string;
  care_instructions?: string;
  upcycle_alternative?: string;
  source?: string;
  source_id?: string;
  source_url?: string;
}

export interface RepairAssessmentResult {
  glie: AssessGarmentResult;
  guides: T5GuideResult[];
  repair_guides: T5GuideResult[];
  upcycle_guides: T5GuideResult[];
  youtube: YouTubeVideo[];
  repair_youtube: YouTubeVideo[];
  upcycle_youtube: YouTubeVideo[];
  youtube_query: string;
  repair_youtube_query?: string;
  upcycle_youtube_query?: string;
  /** Curated blog articles users can open in a browser to read full tutorials */
  reading_list: { id: string; title: string; url: string; source: string; difficulty: string }[];
  repair_reading_list: { id: string; title: string; url: string; source: string; difficulty: string }[];
  upcycle_reading_list: { id: string; title: string; url: string; source: string; difficulty: string }[];
}

/**
 * Full repair assessment: GLIE + T5 guides + YouTube tutorials (segregated for Repair vs Upcycling)
 */
export async function assessRepair(
  input: RepairAssessmentInput,
): Promise<RepairAssessmentResult> {
  // Ensure GLIE data is loaded
  initGLIE();

  // Fast-path: If no image is supplied but LLM assessment metadata is provided, reuse directly!
  if (!input.image_base64 || input.image_base64.length < 50) {
    return lookupRepairFromAssessment({
      garment_category: input.garment_category,
      fiber_type: input.fiber_type,
      damage_types: input.damage_types,
      damage_description: input.damage_description,
      repair_feasibility: input.repair_feasibility,
      condition_score: input.condition_score,
      original_price_inr: input.original_price_inr,
    });
  }

  // ── Step 1: Run GLIE condition assessment ──────────────────────
  const glieInput: AssessGarmentInput = {
    image_base64: input.image_base64,
    fiber_type: input.fiber_type,
    garment_category: input.garment_category,
    original_price_inr: input.original_price_inr,
    style_tags: input.style_tags || 'casual',
    color_family: input.color_family || 'neutrals',
    season: input.season || 'all_season',
  };

  const glieResult = await assessGarment(glieInput);

  // ── Step 2: Get T5 repair & upcycle guides (segregated) ─────────
  const damageTypes = glieResult.damage_breakdown.damage_types;
  // Also add damage_description words as potential damage types
  const extraTypes = input.damage_description
    ? input.damage_description
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(w => ['tear', 'hole', 'stain', 'fade', 'rip', 'broken', 'worn',
          'fray', 'snag', 'pilling', 'discolored', 'crack', 'scratch',
          'missing', 'loose', 'damage', 'dirt', 'ink', 'oil', 'paint',
          'burn', 'mold', 'rust', 'stretch'].includes(w))
    : [];

  const allDamageTypes = [...new Set([...damageTypes, ...extraTypes])];
  const queryDamage = allDamageTypes.length > 0 ? allDamageTypes : ['tear', 'stain', 'fading'];

  const repairGuides = queryT5(input.fiber_type, queryDamage, input.garment_category, 'repair');
  const upcycleGuides = queryT5(input.fiber_type, queryDamage, input.garment_category, 'upcycle');
  const allGuides = queryT5(input.fiber_type, queryDamage, input.garment_category);

  // ── Step 2b: Curated reading lists (real articles with URLs) ──
  const mapReadingList = (docs: any[]) =>
    docs.map((g) => ({
      id: g.source_url || g.title,
      title: g.title,
      url: g.source_url || '',
      source: g.source || 'blog',
      difficulty: g.difficulty,
    }));

  const repairReadingList = mapReadingList(
    queryBlogReads(input.fiber_type, queryDamage, input.garment_category, 4, 'repair')
  );
  const upcycleReadingList = mapReadingList(
    queryBlogReads(input.fiber_type, queryDamage, input.garment_category, 4, 'upcycle')
  );
  const allReadingList = mapReadingList(
    queryBlogReads(input.fiber_type, queryDamage, input.garment_category, 4)
  );

  // ── Step 3: Search YouTube for repair & upcycle tutorials (parallel) ──
  const repairQuery = buildYouTubeQuery(
    input.garment_category,
    input.fiber_type,
    allDamageTypes.length > 0 ? allDamageTypes : ['repair'],
    'REPAIR',
  );
  const upcycleQuery = buildYouTubeQuery(
    input.garment_category,
    input.fiber_type,
    allDamageTypes.length > 0 ? allDamageTypes : ['upcycle'],
    'UPCYCLE',
  );

  const [repairVideos, upcycleVideos] = await Promise.all([
    searchYouTubeTutorials(repairQuery, 6),
    searchYouTubeTutorials(upcycleQuery, 6),
  ]);

  return {
    glie: glieResult,
    guides: allGuides,
    repair_guides: repairGuides,
    upcycle_guides: upcycleGuides,
    youtube: repairVideos.length > 0 ? repairVideos : upcycleVideos,
    repair_youtube: repairVideos,
    upcycle_youtube: upcycleVideos,
    youtube_query: repairQuery,
    repair_youtube_query: repairQuery,
    upcycle_youtube_query: upcycleQuery,
    reading_list: allReadingList,
    repair_reading_list: repairReadingList,
    upcycle_reading_list: upcycleReadingList,
  };
}

/**
 * Instant repair/upcycle lookup from previously generated LLM assessment.
 * ZERO re-upload, ZERO Gemini Vision re-analysis, ZERO duplicate cost or wait time.
 */
export async function lookupRepairFromAssessment(
  input: RepairLookupInput,
): Promise<RepairAssessmentResult> {
  initGLIE();

  const damageTypes = input.damage_types || [];
  const extraTypes = input.damage_description
    ? input.damage_description
        .toLowerCase()
        .split(/[\s,]+/)
        .filter((w) =>
          [
            'tear', 'hole', 'stain', 'fade', 'rip', 'broken', 'worn',
            'fray', 'snag', 'pilling', 'discolored', 'crack', 'scratch',
            'missing', 'loose', 'damage', 'dirt', 'ink', 'oil', 'paint',
            'burn', 'mold', 'rust', 'stretch',
          ].includes(w)
        )
    : [];

  const allDamageTypes = [...new Set([...damageTypes, ...extraTypes])];
  const queryDamage = allDamageTypes.length > 0 ? allDamageTypes : ['tear', 'stain', 'fading'];

  const repairGuides = queryT5(input.fiber_type, queryDamage, input.garment_category, 'repair');
  const upcycleGuides = queryT5(input.fiber_type, queryDamage, input.garment_category, 'upcycle');
  const allGuides = queryT5(input.fiber_type, queryDamage, input.garment_category);

  const mapReadingList = (docs: any[]) =>
    docs.map((g) => ({
      id: g.source_url || g.title,
      title: g.title,
      url: g.source_url || '',
      source: g.source || 'blog',
      difficulty: g.difficulty,
    }));

  const repairReadingList = mapReadingList(
    queryBlogReads(input.fiber_type, queryDamage, input.garment_category, 4, 'repair')
  );
  const upcycleReadingList = mapReadingList(
    queryBlogReads(input.fiber_type, queryDamage, input.garment_category, 4, 'upcycle')
  );
  const allReadingList = mapReadingList(
    queryBlogReads(input.fiber_type, queryDamage, input.garment_category, 4)
  );

  const repairQuery = buildYouTubeQuery(
    input.garment_category,
    input.fiber_type,
    allDamageTypes.length > 0 ? allDamageTypes : ['repair'],
    'REPAIR',
  );
  const upcycleQuery = buildYouTubeQuery(
    input.garment_category,
    input.fiber_type,
    allDamageTypes.length > 0 ? allDamageTypes : ['upcycle'],
    'UPCYCLE',
  );

  const [repairVideos, upcycleVideos] = await Promise.all([
    searchYouTubeTutorials(repairQuery, 6),
    searchYouTubeTutorials(upcycleQuery, 6),
  ]);

  const conditionScore = input.condition_score ?? 0.45;
  const feasibility = input.repair_feasibility || 'Repair feasible with standard sewing or mending tools.';

  const synthesizedGlie: any = {
    glie_score: Math.round(conditionScore * 100),
    routing_decision: (input.routing_decision as any) || 'UPCYCLE',
    condition_score: conditionScore,
    material_score: 0.8,
    sustainability_score: 0.75,
    market_demand_score: 0.6,
    damage_breakdown: {
      damage_ratio: 0.2,
      wear_zone_ratio: 0.15,
      stain_ratio: 0.05,
      fiber_degradation_score: 0.2,
      damage_types: allDamageTypes,
    },
    carbon_saved_kg: 8.5,
    water_saved_litres: 2400,
    trees_equivalent: 1,
    repair_feasibility: feasibility,
    suggested_repair_technique: 'Visible mending & upcycling rework',
    suggested_price_inr: input.original_price_inr ? Math.round(input.original_price_inr * 0.4) : undefined,
    description: `Assessed ${input.fiber_type} ${input.garment_category}. ${feasibility}`,
    rag_context: {
      examples_used: 1,
      guides_matched: allGuides.length,
      market_listings_matched: 0,
      prompt_tokens_estimated: 0,
      gemini_model: 'shared-llm-context',
    },
  };

  return {
    glie: synthesizedGlie,
    guides: allGuides,
    repair_guides: repairGuides,
    upcycle_guides: upcycleGuides,
    youtube: repairVideos.length > 0 ? repairVideos : upcycleVideos,
    repair_youtube: repairVideos,
    upcycle_youtube: upcycleVideos,
    youtube_query: repairQuery,
    repair_youtube_query: repairQuery,
    upcycle_youtube_query: upcycleQuery,
    reading_list: allReadingList,
    repair_reading_list: repairReadingList,
    upcycle_reading_list: upcycleReadingList,
  };
}

