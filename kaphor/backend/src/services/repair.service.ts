/**
 * Repair & Refresh Service
 *
 * Builds short lists of YouTube tutorials and blog posts for repairing or
 * upcycling a garment. Results are filtered by garment category and damage type.
 * Verified fallback links live in ../data/repair-resources.
 */

import { assessGarment, initGLIE } from './glie';
import { logger } from '../lib/logger';
import type { AssessGarmentInput, AssessGarmentResult } from './glie';
import {
  VERIFIED_VIDEOS,
  VERIFIED_BLOGS,
  type ResourceMode,
} from '../data/repair-resources';

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
  garmentCategory?: string,
): YouTubeVideo[] {
  const keywords = (query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !YOUTUBE_TOPIC_STOPWORDS.has(t));

  const cleanCategory = (garmentCategory || '').toLowerCase();

  const scored = videos.map((v) => {
    const title = (v.title || '').toLowerCase();
    if (YOUTUBE_IRRELEVANT_RE.test(title)) return { v, score: -1 };

    // Explicit conflict rejection: if target is a dress, reject jeans, sweaters, and hoodies
    if (cleanCategory === 'dress') {
      if (/\b(jeans|denim|sweater|knitwear|hoodie|pants|trousers|crotch|socks|beanie)\b/i.test(title)) {
        return { v, score: -1 };
      }
    } else if (cleanCategory === 'shirt' || cleanCategory === 'top' || cleanCategory === 'blouse') {
      if (/\b(jeans|denim|sweater|knitwear|hoodie|crotch|socks|beanie|dress|skirt)\b/i.test(title)) {
        return { v, score: -1 };
      }
    } else if (cleanCategory === 'sweater') {
      if (/\b(jeans|denim|dress|saree|shorts)\b/i.test(title)) {
        return { v, score: -1 };
      }
    } else if (cleanCategory === 'jeans') {
      if (/\b(sweater|knitwear|dress|saree|silk)\b/i.test(title)) {
        return { v, score: -1 };
      }
    }

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

// ── Verified resource matching ───────────────────────────────────────────────

export interface BlogArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  difficulty: string;
  time_minutes: number;
}

const MAX_VIDEOS = 5;
const MAX_BLOGS = 5;

/** Map the app's garment categories to the category groups used in the data file. */
export function categoryGroup(category?: string): string {
  const c = (category || '').toLowerCase();
  if (/(shirt|top|blouse|polo|tee)/.test(c)) return 'shirt';
  if (/(dress|gown|frock)/.test(c)) return 'dress';
  if (/(jean|denim|trouser|pant|short)/.test(c)) return 'jeans';
  if (/(sweater|knit|cardigan|hoodie|sweatshirt|jumper)/.test(c)) return 'sweater';
  if (/(saree|sari|lehenga)/.test(c)) return 'saree';
  if (/(kurta|kurti|salwar)/.test(c)) return 'kurta';
  if (/(jacket|blazer|coat)/.test(c)) return 'jacket';
  if (/skirt/.test(c)) return 'skirt';
  if (/(active|legging|sport)/.test(c)) return 'activewear';
  return 'general';
}

const DAMAGE_PATTERNS: [string, RegExp][] = [
  ['hole', /hole/],
  ['tear', /(tear|torn|rip)/],
  ['seam', /seam/],
  ['button', /button/],
  ['zipper', /(zip)/],
  ['stain', /(stain|dirt|ink|oil|paint|mold)/],
  ['hem', /hem/],
  ['snag', /(snag|pull)/],
  ['pilling', /pill/],
  ['fray', /fray/],
  ['collar', /collar/],
  ['cuff', /cuff/],
  ['lining', /lining/],
  ['burn', /burn/],
  ['stretch', /stretch/],
  ['scuff', /(scuff|scratch)/],
];

export function damageTags(damages: string[] = []): string[] {
  const tags = new Set<string>();
  for (const d of damages) {
    const text = (d || '').toLowerCase();
    for (const [tag, re] of DAMAGE_PATTERNS) {
      if (re.test(text)) tags.add(tag);
    }
  }
  return [...tags];
}

function scoreResource(
  item: { mode: ResourceMode; categories: string[]; damages: string[] },
  mode: ResourceMode,
  group: string,
  tags: string[],
): number {
  if (item.mode !== mode) return -1;
  let score = 0;
  if (item.categories.includes(group)) score += 10;
  else if (item.categories.includes('general')) score += 2;
  else return -1;
  if (mode === 'repair') {
    for (const t of tags) if (item.damages.includes(t)) score += 4;
  }
  return score;
}

function pickBest<T extends { mode: ResourceMode; categories: string[]; damages: string[] }>(
  items: T[],
  mode: ResourceMode,
  group: string,
  tags: string[],
  max: number,
): T[] {
  return items
    .map((item) => ({ item, score: scoreResource(item, mode, group, tags) }))
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.item);
}

export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** Verified videos for a mode, garment group and damage tags. */
export function getVerifiedVideos(
  mode: ResourceMode,
  category?: string,
  damages: string[] = [],
  max: number = MAX_VIDEOS,
): YouTubeVideo[] {
  return pickBest(VERIFIED_VIDEOS, mode, categoryGroup(category), damageTags(damages), max).map((v) => ({
    videoId: v.videoId,
    title: v.title,
    channelTitle: v.channelTitle,
    thumbnail: youtubeThumbnail(v.videoId),
    publishedAt: '',
  }));
}

/** Verified blog posts for a mode, garment group and damage tags. */
export function getVerifiedBlogs(
  mode: ResourceMode,
  category?: string,
  damages: string[] = [],
  max: number = MAX_BLOGS,
): BlogArticle[] {
  return pickBest(VERIFIED_BLOGS, mode, categoryGroup(category), damageTags(damages), max).map((b) => ({
    id: b.id,
    title: b.title,
    url: b.url,
    source: b.source,
    difficulty: b.difficulty,
    time_minutes: b.time_minutes,
  }));
}

/** Live YouTube search. Returns an empty list when the API is unavailable. */
async function searchYouTubeTutorials(
  query: string,
  maxResults: number = MAX_VIDEOS,
  garmentCategory?: string,
): Promise<YouTubeVideo[]> {
  if (!YOUTUBE_API_KEY) return [];

  try {
    const fetchResults = async (categoryFilter?: string) => {
      const url = new URL(YOUTUBE_SEARCH_URL);
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('q', query);
      url.searchParams.set('type', 'video');
      url.searchParams.set('videoEmbeddable', 'true');
      url.searchParams.set('maxResults', String(maxResults * 2));
      url.searchParams.set('relevanceLanguage', 'en');
      url.searchParams.set('regionCode', 'IN');
      url.searchParams.set('safeSearch', 'moderate');
      url.searchParams.set('key', YOUTUBE_API_KEY);
      if (categoryFilter) url.searchParams.set('videoCategoryId', categoryFilter);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second cap prevents hanging

      try {
        const response = await fetch(url.toString(), { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
          logger.warn(`[Repair] YouTube search response: ${response.status}`);
          return null;
        }
        return (await response.json()) as any;
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        logger.warn(`[Repair] YouTube search timeout/abort: ${fetchErr.message}`);
        return null;
      }
    };

    let data = await fetchResults('26');
    if (!data || (data?.items || []).length === 0) {
      data = await fetchResults(undefined);
    }

    const items: any[] = data?.items || [];
    if (items.length === 0) {
      return [];
    }

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

    const ranked = rankYouTubeResults(videos, query, maxResults, garmentCategory);
    return ranked;
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

/**
 * Kept for response compatibility. Guide bodies are no longer sent, so the
 * guide lists in the response are always empty.
 */
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
  /** Link to a YouTube search, used when no tutorial matches */
  youtube_search_url: string;
  repair_youtube_search_url: string;
  upcycle_youtube_search_url: string;
  reading_list: BlogArticle[];
  repair_reading_list: BlogArticle[];
  upcycle_reading_list: BlogArticle[];
}

const RECOGNIZED_DAMAGE_KEYWORDS = [
  'tear', 'hole', 'holes', 'stain', 'stains', 'fade', 'fading', 'rip', 'rips', 'broken', 'worn',
  'fray', 'frayed', 'fraying', 'snag', 'snags', 'pilling', 'discolored', 'crack', 'scratch',
  'missing', 'loose', 'damage', 'dirt', 'ink', 'oil', 'paint',
  'burn', 'mold', 'rust', 'stretch', 'button', 'buttons', 'buttonhole', 'placket',
  'collar', 'cuff', 'cuffs', 'seam', 'seams', 'zipper', 'slit', 'strap', 'straps',
  'hem', 'underarm', 'lining',
];

/** When the category is vague, guess it from the damage text. */
function resolveCategory(category: string | undefined, fullText: string): string {
  let resolved = (category || '').toLowerCase();
  if (!resolved || resolved === 'other' || resolved === 'clothing') {
    if (/\b(shirt|blouse|polo|button-down|top|tshirt|t-shirt|button|buttons|buttonhole|placket|collar|cuff)\b/i.test(fullText)) {
      resolved = 'shirt';
    } else if (/\b(dress|gown|frock|skirt)\b/i.test(fullText)) {
      resolved = 'dress';
    } else if (/\b(jeans|denim|pants|trousers)\b/i.test(fullText)) {
      resolved = 'jeans';
    } else if (/\b(sweater|cardigan|knitwear|hoodie)\b/i.test(fullText)) {
      resolved = 'sweater';
    }
  }
  return resolved;
}

function extractDamageTypes(known: string[], fullText: string): string[] {
  const extra = fullText.split(/[\s,.-]+/).filter((w) => RECOGNIZED_DAMAGE_KEYWORDS.includes(w));
  return [...new Set([...known, ...extra])];
}

/** Merge live search results with verified fallbacks, without duplicates. */
function withFallback(live: YouTubeVideo[], fallback: YouTubeVideo[], max: number): YouTubeVideo[] {
  const seen = new Set<string>();
  return [...live, ...fallback]
    .filter((v) => {
      if (!v.videoId || seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    })
    .slice(0, max);
}

/**
 * Build the resource lists (videos + blogs) for both the repair and upcycle tabs.
 */
async function buildResources(args: {
  fiberType: string;
  category: string;
  damageTypes: string[];
}) {
  const { fiberType, category, damageTypes } = args;
  const repairQuery = buildYouTubeQuery(
    category,
    fiberType,
    damageTypes.length > 0 ? damageTypes : ['repair'],
    'REPAIR',
  );
  const upcycleQuery = buildYouTubeQuery(
    category,
    fiberType,
    damageTypes.length > 0 ? damageTypes : ['upcycle'],
    'UPCYCLE',
  );

  const [repairLive, upcycleLive] = await Promise.all([
    searchYouTubeTutorials(repairQuery, MAX_VIDEOS, category),
    searchYouTubeTutorials(upcycleQuery, MAX_VIDEOS, category),
  ]);

  const repairVideos = withFallback(repairLive, getVerifiedVideos('repair', category, damageTypes), MAX_VIDEOS);
  const upcycleVideos = withFallback(upcycleLive, getVerifiedVideos('upcycle', category, damageTypes), MAX_VIDEOS);

  const repairBlogs = getVerifiedBlogs('repair', category, damageTypes);
  const upcycleBlogs = getVerifiedBlogs('upcycle', category, damageTypes);

  return {
    guides: [] as T5GuideResult[],
    repair_guides: [] as T5GuideResult[],
    upcycle_guides: [] as T5GuideResult[],
    youtube: repairVideos.length > 0 ? repairVideos : upcycleVideos,
    repair_youtube: repairVideos,
    upcycle_youtube: upcycleVideos,
    youtube_query: repairQuery,
    repair_youtube_query: repairQuery,
    upcycle_youtube_query: upcycleQuery,
    youtube_search_url: youtubeSearchUrl(repairQuery),
    repair_youtube_search_url: youtubeSearchUrl(repairQuery),
    upcycle_youtube_search_url: youtubeSearchUrl(upcycleQuery),
    reading_list: repairBlogs.length > 0 ? repairBlogs : upcycleBlogs,
    repair_reading_list: repairBlogs,
    upcycle_reading_list: upcycleBlogs,
  };
}

/**
 * Full repair assessment: GLIE condition score plus repair and upcycle resources.
 */
export async function assessRepair(
  input: RepairAssessmentInput,
): Promise<RepairAssessmentResult> {
  initGLIE();

  // No image: reuse the metadata and skip the vision call
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

  const glieInput: AssessGarmentInput = {
    image_base64: input.image_base64,
    fiber_type: input.fiber_type,
    garment_category: input.garment_category,
    original_price_inr: input.original_price_inr,
    style_tags: input.style_tags || 'casual',
    color_family: input.color_family || 'neutrals',
    season: input.season || 'all_season',
  };

  let glieResult: AssessGarmentResult;
  try {
    glieResult = await assessGarment(glieInput);
  } catch (err: any) {
    logger.warn('[Repair] assessGarment failed, using fallback', { error: err?.message });
    glieResult = {
      glie_score: 55,
      routing_decision: 'UPCYCLE',
      condition_score: 0.55,
      material_score: 0.8,
      sustainability_score: 0.75,
      market_demand_score: 0.65,
      damage_breakdown: {
        damage_ratio: 0.15,
        wear_zone_ratio: 0.1,
        stain_ratio: 0.05,
        fiber_degradation_score: 0.15,
        damage_types: input.damage_types || ['wear', 'tear'],
      },
      carbon_saved_kg: 8.5,
      water_saved_litres: 2400,
      trees_equivalent: 1,
      repair_feasibility: 'Can be repaired with basic sewing tools.',
      suggested_repair_technique: 'Visible mending or upcycling',
      suggested_price_inr: input.original_price_inr ? Math.round(input.original_price_inr * 0.45) : undefined,
      description: `${input.fiber_type || 'Cotton'} ${input.garment_category || 'garment'}.`,
      rag_context: {
        examples_used: 1,
        guides_matched: 0,
        market_listings_matched: 0,
        prompt_tokens_estimated: 0,
        gemini_model: 'algorithmic-rag-fallback',
      },
    };
  }

  const fullText = [
    input.damage_description || '',
    input.style_tags || '',
    glieResult.description || '',
    glieResult.suggested_repair_technique || '',
    glieResult.repair_feasibility || '',
  ].join(' ').toLowerCase();

  const resolvedCat = resolveCategory(input.garment_category, fullText);
  (glieResult as any).garment_category = resolvedCat || input.garment_category;
  (glieResult as any).fiber_type = input.fiber_type;

  const allDamageTypes = extractDamageTypes(glieResult.damage_breakdown.damage_types || [], fullText);

  const resources = await buildResources({
    fiberType: input.fiber_type,
    category: resolvedCat,
    damageTypes: allDamageTypes,
  });

  return { glie: glieResult, ...resources };
}

/**
 * Instant lookup from an assessment the app already has.
 * No image upload and no vision call.
 */
export async function lookupRepairFromAssessment(
  input: RepairLookupInput,
): Promise<RepairAssessmentResult> {
  initGLIE();

  const fullText = [
    input.damage_description || '',
    input.repair_feasibility || '',
  ].join(' ').toLowerCase();

  const resolvedCat = resolveCategory(input.garment_category, fullText);
  const allDamageTypes = extractDamageTypes(input.damage_types || [], fullText);

  const resources = await buildResources({
    fiberType: input.fiber_type,
    category: resolvedCat,
    damageTypes: allDamageTypes,
  });

  const conditionScore = input.condition_score ?? 0.45;
  const feasibility = input.repair_feasibility || 'Can be repaired with basic sewing tools.';

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
    suggested_repair_technique: 'Visible mending or upcycling',
    suggested_price_inr: input.original_price_inr ? Math.round(input.original_price_inr * 0.4) : undefined,
    description: `${input.fiber_type} ${resolvedCat || input.garment_category}. ${feasibility}`,
    garment_category: resolvedCat || input.garment_category,
    fiber_type: input.fiber_type,
    rag_context: {
      examples_used: 1,
      guides_matched: 0,
      market_listings_matched: 0,
      prompt_tokens_estimated: 0,
      gemini_model: 'shared-llm-context',
    },
  };

  return { glie: synthesizedGlie, ...resources };
}
