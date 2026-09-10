/**
 * Repair & Refresh Service
 * Calls the Kaphor backend POST /api/v1/repair/assess endpoint
 */

import api from './api';

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

export interface T5GuideResult {
  doc_type: string;
  title: string;
  difficulty: string;
  time_minutes: number;
  technique_style: string;
  tools_required: string[];
  steps: string[];
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
  youtube: YouTubeVideo[];
  youtube_query: string;
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

/**
 * Assess a garment for repair/upcycling: runs GLIE + T5 guides + YouTube search
 */
export async function assessRepair(input: RepairInput): Promise<RepairResult> {
  const { data } = await api.post('/repair/assess', input, { timeout: 60000 });
  return data.data;
}

/**
 * Format a YouTube video URL from videoId
 */
export function youTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Get difficulty color
 */
export function difficultyColor(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case 'beginner': return '#1E3B2F';
    case 'intermediate': return '#C95F12';
    case 'advanced': return '#A82222';
    default: return '#666';
  }
}

