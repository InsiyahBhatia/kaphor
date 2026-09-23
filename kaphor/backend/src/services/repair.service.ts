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

// Tokens stripped from the query when extracting ranking keywords, so only the
// discriminative terms (garment / fiber / damage) drive the re-ranking score.
const YOUTUBE_TOPIC_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'for', 'to', 'of', 'in', 'on', 'with', 'old', 'step', 'by', 'from', 'your', 'at', 'as', 'into',
  'how', 'fix', 'mend', 'repair', 'upcycle', 'rework', 'transformation', 'tutorial', 'guide', 'ideas',
  'zero', 'waste', 'textile', 'recycling', 'clothing', 'diy', 'drop', 'off',
]);

const YOUTUBE_ACTION_RE = /(how to|\brepair\b|\bmend\b|\bfix(?:ing|ed)?\b|\bupcycle\b|\brework\b|\btransform(?:ing|ed)?\b|\bdiy\b|\bstain\b|\bholes?\b)/i;

const YOUTUBE_IRRELEVANT_RE = /(official\s*(audio|music|video)|lyrics|music video|\btrailer\b|\bmovie\b|\bgameplay\b|\breaction\b|news live|podcast|full song|full album|clip compilation|\bnft\b|\bpoem\b|funniest|prank)/i;

/**
 * Re-rank YouTube results so the most on-topic tutorials (matching the garment,
 * fiber and/or damage from the query) float to the top and unrelated content
 * (music, trailers, gameplay, reaction videos) is dropped entirely.
 */
export function rankYouTubeResults(
  videos: YouTubeVideo[],
  query: string,
  maxResults: number = 6,
): YouTubeVideo[] {
  const keywords = (query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !YOUTUBE_TOPIC_STOPWORDS.has(t));

  const scored = videos.map((v) => {
    const title = (v.title || '').toLowerCase();
    if (YOUTUBE_IRRELEVANT_RE.test(title)) return { v, score: -1 };
    let score = 0;
    if (YOUTUBE_ACTION_RE.test(title)) score += 3;
    if (/(tutorial|how-to|step[ -]by[ -]step|beginner)/.test(title)) score += 1;
    let matched = 0;
    for (const kw of keywords) {
      if (title.includes(kw)) matched++;
    }
    score += matched * 1.5;
    return { v, score };
  });

  const kept = scored
    .filter((s) => s.score >= 4.5)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.v);
  const fill = scored
    .filter((s) => s.score > 0 && s.score < 4.5)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.v);

  const seen = new Set<string>();
  const dedupe = (list: YouTubeVideo[]) =>
    list.filter((v) => {
      if (!v.videoId || seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    });

  const combined = dedupe([...kept, ...fill]);
  if (combined.length === 0) {
    // Absolute fallback: return YouTube's relevance order, barring junk.
    const leftovers = scored
      .filter((s) => s.score !== -1)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.v);
    return dedupe(leftovers).slice(0, maxResults);
  }
  return combined.slice(0, maxResults);
}

/**
 * Search YouTube for repair/upcycle tutorials based on garment + damage context.
 * Pulls more candidates than needed, re-ranks them against the query keywords and
 * narrows to the most relevant, on-topic tutorials.
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
    const fetchResults = async (categoryFilter?: string) => {
      const url = new URL(YOUTUBE_SEARCH_URL);
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('q', query);
      url.searchParams.set('type', 'video');
      url.searchParams.set('videoEmbeddable', 'true');
      url.searchParams.set('maxResults', String(maxResults * 3));
      url.searchParams.set('relevanceLanguage', 'en');
      url.searchParams.set('regionCode', 'IN');
      url.searchParams.set('safeSearch', 'moderate');
      url.searchParams.set('key', YOUTUBE_API_KEY);
      if (categoryFilter) url.searchParams.set('videoCategoryId', categoryFilter);

      const response = await fetch(url.toString());
      if (!response.ok) {
        logger.warn(`[Repair] YouTube search failed: ${response.status}`);
        return null;
      }
      return (await response.json()) as any;
    };

    // Prefer the "Howto & Style" category for precision; fall back to a general
    // search when that bucket comes back empty.
    let data = await fetchResults('26');
    if (!data || (data?.items || []).length === 0) {
      data = await fetchResults(undefined);
    }

    const items: any[] = data?.items || [];
    if (items.length === 0) return [];

    const videos = items
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

    return rankYouTubeResults(videos, query, maxResults);
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

  const parts: string[] = [];

  if (decision === 'UPCYCLE') {
    // Upcycling: never surface repair/mending videos — search only for creative
    // transformation, keeping garment + fiber context to sharpen the results.
    parts.push('upcycle');
    if (cleanCat !== 'clothing') parts.push(cleanCat);
    if (cleanFiber) parts.push(cleanFiber);
    parts.push('diy rework ideas tutorial');
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  if (decision === 'RECYCLE') {
    parts.push('how to textile recycling');
    if (cleanCat !== 'clothing') parts.push(cleanCat);
    if (cleanFiber) parts.push(cleanFiber);
    parts.push('zero waste guide');
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  // REPAIR (and any other decision): target mending the specific damage.
  parts.push('how to repair fix mend');
  if (cleanFiber) parts.push(cleanFiber);
  if (cleanCat !== 'clothing') parts.push(cleanCat);
  if (damageList.length > 0) parts.push(damageList.join(' '));
  parts.push('tutorial');

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

