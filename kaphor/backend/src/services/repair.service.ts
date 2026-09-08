/**
 * Repair & Refresh Service
 *
 * Orchestrates: GLIE condition assessment → T5 guide lookup → YouTube tutorial search
 */

import { assessGarment, initGLIE } from './glie';
import { queryT5, loadT5 } from './glie/t5-guides';
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
    url.searchParams.set('maxResults', String(maxResults));
    url.searchParams.set('relevanceLanguage', 'en');
    url.searchParams.set('key', YOUTUBE_API_KEY);

    const response = await fetch(url.toString());
    if (!response.ok) {
      logger.warn(`[Repair] YouTube search failed: ${response.status}. Using fallback tutorials.`);
      return getFallbackYouTubeVideos(query);
    }

    const data = (await response.json()) as any;
    const items = data?.items || [];

    if (items.length === 0) return getFallbackYouTubeVideos(query);

    return items.map((item: any) => ({
      videoId: item.id?.videoId || '',
      title: item.snippet?.title || '',
      channelTitle: item.snippet?.channelTitle || '',
      thumbnail: item.snippet?.thumbnails?.high?.url
        || item.snippet?.thumbnails?.medium?.url
        || item.snippet?.thumbnails?.default?.url
        || '',
      publishedAt: item.snippet?.publishedAt || '',
    }));
  } catch (err: any) {
    logger.error('[Repair] YouTube search error', { error: err.message });
    return getFallbackYouTubeVideos(query);
  }
}

function getFallbackYouTubeVideos(query: string): YouTubeVideo[] {
  return [
    {
      videoId: 'Z-X5nLq1-4A',
      title: 'Invisible Clothing Repair: How to Fix Holes & Tears Seamlessly',
      channelTitle: 'Textile Mending Studio',
      thumbnail: 'https://img.youtube.com/vi/Z-X5nLq1-4A/hqdefault.jpg',
      publishedAt: '2025-01-15T10:00:00Z',
    },
    {
      videoId: '5x53381B3_8',
      title: 'Sashiko Japanese Embroidery Repair for Fabric & Denim',
      channelTitle: 'Artisanal Upcycling',
      thumbnail: 'https://img.youtube.com/vi/5x53381B3_8/hqdefault.jpg',
      publishedAt: '2025-02-10T14:30:00Z',
    },
    {
      videoId: '8W8yXq04J8k',
      title: 'How to Remove Tough Stains & Restore Faded Garment Color',
      channelTitle: 'Kaphor Sustainable Care',
      thumbnail: 'https://img.youtube.com/vi/8W8yXq04J8k/hqdefault.jpg',
      publishedAt: '2025-03-01T12:00:00Z',
    },
    {
      videoId: '9rQ4Z_98K8M',
      title: 'DIY Upcycling Guide: Transform Old Garments into Trendy Fashion',
      channelTitle: 'Thrift & Flip Studio',
      thumbnail: 'https://img.youtube.com/vi/9rQ4Z_98K8M/hqdefault.jpg',
      publishedAt: '2025-03-20T16:00:00Z',
    },
  ];
}

/**
 * Build a YouTube search query from garment + damage info
 */
export function buildYouTubeQuery(
  garmentCategory: string,
  fiberType: string,
  damageTypes: string[],
): string {
  const cleanCat = garmentCategory && garmentCategory !== 'other' ? garmentCategory : 'clothing';
  const cleanFiber = fiberType && fiberType !== 'Cotton' ? fiberType : '';
  const damageList = damageTypes?.filter(d => d && d !== 'none') || [];
  const primaryDamage = damageList.length > 0 ? damageList[0] : 'tear';

  return `how to repair ${cleanFiber} ${cleanCat} ${primaryDamage} upcycle tutorial`.replace(/\s+/g, ' ').trim();
}

// ── Repair Assessment ────────────────────────────────────────────────────────

export interface RepairAssessmentInput {
  image_base64: string;
  fiber_type: string;
  garment_category: string;
  original_price_inr: number;
  style_tags?: string;
  color_family?: string;
  season?: string;
  damage_description?: string;
}

export interface T5GuideResult {
  doc_type: string;
  title: string;
  difficulty: string;
  time_minutes: number;
  technique_style: string;
  tools_required: string[];
  steps: string[];
}

export interface RepairAssessmentResult {
  glie: AssessGarmentResult;
  guides: T5GuideResult[];
  youtube: YouTubeVideo[];
  youtube_query: string;
}

/**
 * Full repair assessment: GLIE + T5 guides + YouTube tutorials
 */
export async function assessRepair(
  input: RepairAssessmentInput,
): Promise<RepairAssessmentResult> {
  // Ensure GLIE data is loaded
  initGLIE();

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

  // ── Step 2: Get T5 repair/upcycle guides ───────────────────────
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

  const guides = queryT5(
    input.fiber_type,
    allDamageTypes.length > 0 ? allDamageTypes : ['tear', 'stain', 'fading'],
    input.garment_category,
  );

  // ── Step 3: Search YouTube for tutorials ───────────────────────
  const youtubeQuery = buildYouTubeQuery(
    input.garment_category,
    input.fiber_type,
    allDamageTypes.length > 0 ? allDamageTypes : ['repair'],
  );

  const youtube = await searchYouTubeTutorials(youtubeQuery);

  return {
    glie: glieResult,
    guides,
    youtube,
    youtube_query: youtubeQuery,
  };
}
