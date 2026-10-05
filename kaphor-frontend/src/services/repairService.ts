/**
 * Repair & Refresh Service
 * Calls the Kaphor backend /repair/assess and /repair/lookup endpoints.
 */

import api from './api';
import { colors } from '../theme';

export interface RepairInput {
  image_base64?: string;
  fiber_type: string;
  garment_category: string;
  original_price_inr: number;
  style_tags?: string;
  color_family?: string;
  season?: string;
  damage_description?: string;
}

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
}

export interface T5DetailedStep {
  step?: number;
  instruction: string;
  tip?: string;
}

export interface BlogArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  difficulty: string;
  time_minutes?: number;
}

/** Guide bodies are no longer sent by the server. Kept so saved items still load. */
export interface T5GuideResult {
  doc_type: string;
  title: string;
  difficulty: string;
  time_minutes: number;
  technique_style: string;
  tools_required: string[];
  steps: string[];
  detailed_steps?: T5DetailedStep[];
  pro_tip?: string;
  care_instructions?: string;
  upcycle_alternative?: string;
  source?: string;
  source_id?: string;
  source_url?: string;
}

export interface DamageBreakdown {
  damage_ratio: number;
  wear_zone_ratio: number;
  stain_ratio: number;
  fiber_degradation_score: number;
  damage_types: string[];
}

export interface GLIEAssessment {
  glie_score: number;
  routing_decision: 'RESELL' | 'UPCYCLE' | 'RECYCLE';
  condition_score: number;
  material_score: number;
  sustainability_score: number;
  market_demand_score: number;
  damage_breakdown: DamageBreakdown;
  carbon_saved_kg: number;
  water_saved_litres: number;
  trees_equivalent: number;
  repair_feasibility: string;
  suggested_repair_technique: string;
  suggested_price_inr?: number;
  description: string;
  rag_context: {
    examples_used: number;
    guides_matched: number;
    market_listings_matched: number;
    prompt_tokens_estimated: number;
    gemini_model: string;
  };
}

export interface RepairResult {
  glie: GLIEAssessment;
  guides: T5GuideResult[];
  repair_guides?: T5GuideResult[];
  upcycle_guides?: T5GuideResult[];
  youtube: YouTubeVideo[];
  repair_youtube?: YouTubeVideo[];
  upcycle_youtube?: YouTubeVideo[];
  youtube_query: string;
  repair_youtube_query?: string;
  upcycle_youtube_query?: string;
  youtube_search_url?: string;
  repair_youtube_search_url?: string;
  upcycle_youtube_search_url?: string;
  reading_list: BlogArticle[];
  repair_reading_list?: BlogArticle[];
  upcycle_reading_list?: BlogArticle[];
}

export const GARMENT_CATEGORIES = [
  'top', 'tshirt', 'shirt', 'blouse', 'kurta', 'kurti', 'saree', 'lehenga',
  'dress', 'skirt', 'trousers', 'jeans', 'shorts',
  'jacket', 'blazer', 'coat', 'sweater', 'hoodie', 'sweatshirt',
  'activewear', 'other',
];

export const FIBER_TYPES = [
  'Cotton', 'Silk', 'Wool', 'Polyester', 'Linen', 'Nylon',
  'Rayon', 'Viscose', 'Acrylic', 'Spandex', 'Denim', 'Jute',
  'Hemp', 'Cashmere', 'Velvet', 'Satin', 'Georgette', 'Chiffon',
];

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

// ── In-Memory Assessment Store ──────────────────────────────────────────────
// Keeps the result from the condition check so this screen does not need a
// second photo upload or a second server call.
let _sharedRepairResult: RepairResult | null = null;

export function setSharedRepairAssessment(result: RepairResult | null) {
  _sharedRepairResult = result;
}

export function getSharedRepairAssessment(): RepairResult | null {
  return _sharedRepairResult;
}

export async function assessRepair(input: RepairInput): Promise<RepairResult> {
  try {
    const { data } = await api.post('/repair/assess', input, { timeout: 60000 });
    return data.data;
  } catch (err: any) {
    if (__DEV__) console.warn('[RepairService] assess failed, using quick lookup:', err?.message);
    // Quick lookup (no photo) so a slow upload never blocks the user
    return await lookupRepairFromAssessment({
      garment_category: input.garment_category,
      fiber_type: input.fiber_type,
      damage_description: input.damage_description,
      original_price_inr: input.original_price_inr,
    });
  }
}

/**
 * Quick lookup. No photo upload and no second scan.
 * Uses the category, fabric and damage types we already have.
 */
export async function lookupRepairFromAssessment(input: RepairLookupInput): Promise<RepairResult> {
  const { data } = await api.post('/repair/lookup', input, { timeout: 15000 });
  return data.data;
}

/** Link that opens a YouTube video */
export function youTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Link that opens a YouTube search */
export function youTubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** Color for a difficulty label */
export function difficultyColor(difficulty: string): string {
  switch ((difficulty || '').toLowerCase()) {
    case 'beginner': return colors.forest;
    case 'intermediate': return colors.orange;
    case 'advanced': return colors.red;
    default: return colors.textMuted;
  }
}
