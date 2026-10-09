import api from './api';
import { colors } from '../theme';
import { cleanText } from '../utils/formatText';
import { setSharedRepairAssessment, RepairResult } from './repairService';

/**
 * GLIE (Garment Lifecycle Intelligence Engine) Service
 *
 * Calls the /repair/assess backend endpoint and returns the GLIE sub-object.
 * The old /glie/* routes never existed on the Node backend — this rewires
 * condition-check to the working repair pipeline.
 */



export interface GLIERequest {
  garment_id: string;
  /** Local file path or URL to the garment image */
  image_url: string;
  /** Base64-encoded image data (sent when image is local) */
  image_base64?: string;
  garment_category: string;
  fiber_type: string;
  original_price_inr: number;
  style_tags?: string;
  color_family?: string;
  season?: string;
  condition_override?: number;
  damage_type?: string;
  damage_location?: string;
}

export interface GLIEResponse {
  glie_score: number;
  routing_decision: 'RESELL' | 'UPCYCLE' | 'RECYCLE';
  condition_score: number;
  material_score: number;
  market_demand_score: number;
  sustainability_score: number;
  damage_breakdown: {
    damage_ratio: number;
    wear_zone_ratio: number;
    stain_ratio: number;
    fiber_degradation_score: number;
    damage_types: string[];
  };
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
  rawRepairResult?: RepairResult;
}

/** Garment categories recognisable by the GLIE system */
export const GARMENT_CATEGORIES = [
  'top', 'tshirt', 'shirt', 'blouse', 'kurta', 'kurti', 'saree', 'lehenga',
  'dress', 'skirt', 'trousers', 'jeans', 'shorts',
  'jacket', 'blazer', 'coat', 'sweater', 'hoodie', 'sweatshirt',
  'activewear', 'other',
];

export const COLOR_FAMILIES = [
  'neutrals', 'black', 'white', 'blue', 'red', 'green', 'pink',
  'yellow', 'purple', 'brown', 'gray', 'multicolor',
];

export const SEASONS = [
  'all_season', 'summer', 'winter', 'spring', 'fall', 'monsoon',
];

export const STYLE_TAGS = [
  'casual', 'formal', 'party', 'ethnic', 'sport', 'traditional', 'western',
];

/**
 * Sends a garment image + metadata to the GLIE RAGBOT for assessment.
 * Sends the image (base64) with its metadata to the API for assessment.
 * @param onProgress - callback with step index (0=upload, 1=fibre, 2=scan, 3=score, 4=route)
 */
export async function assessGarment(
  req: GLIERequest,
  onProgress?: (step: number) => void,
): Promise<GLIEResponse> {
  // Progress callbacks for the existing loading animation
  onProgress?.(0); // UPLOADING IMAGE
  onProgress?.(1); // ANALYSING FIBRE
  onProgress?.(2); // SCANNING CONDITION

  const payload: Record<string, any> = {
    garment_id: req.garment_id,
    image_base64: req.image_base64,
    garment_category: req.garment_category,
    fiber_type: req.fiber_type,
    original_price_inr: req.original_price_inr,
    style_tags: req.style_tags,
    color_family: req.color_family,
    season: req.season,
  };

  // Step 3: COMPUTING SCORE (sent through the signed-in API client)
  let data: any;
  try {
    const res = await api.post('/repair/assess', payload, { timeout: 60000 });
    data = res.data;
  } catch {
    // Never show raw server text or JSON to the user
    throw new Error('We could not check this item right now. Please try again in a moment.');
  }
  onProgress?.(3);

  // Step 4: DETERMINING ROUTE
  onProgress?.(4);

  const glie = data?.data?.glie;
  if (!glie) {
    throw new Error('We could not read the result for this item. Please try again.');
  }

  // Cache the complete repair & upcycle data in memory so redirecting to
  // repair-refresh is instantaneous — zero photo re-upload, zero AI duplicate calls.
  if (data?.data) {
    setSharedRepairAssessment(data.data as RepairResult);
    (glie as any).rawRepairResult = data.data;
  }

  const cleaned = glie as GLIEResponse;
  cleaned.description = cleanText(cleaned.description, '');
  cleaned.repair_feasibility = cleanText(cleaned.repair_feasibility, '');
  cleaned.suggested_repair_technique = cleanText(cleaned.suggested_repair_technique, '');
  return cleaned;
}

/**
 * Returns a human-readable condition grade based on the condition score.
 * Hides the raw score — shows only the grade.
 */
export function conditionGrade(score: number): { label: string; color: string } {
  if (score >= 0.85) return { label: 'Excellent', color: colors.success };
  if (score >= 0.65) return { label: 'Good', color: colors.orange };
  if (score >= 0.45) return { label: 'Fair', color: colors.terracottaDark };
  return { label: 'Poor', color: colors.error };
}

/**
 * Returns display info for a routing decision.
 * Clean, user-friendly labels — no scores or technical terms.
 */
export function routeDisplayInfo(decision: string): {
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
} {
  switch (decision) {
    case 'RESELL':
      return {
        emoji: '🔄',
        title: 'Resell',
        subtitle: 'This garment has good resale value. List it on the marketplace.',
        color: colors.success,
        bgColor: colors.emeraldLight,
      };
    case 'UPCYCLE':
      return {
        emoji: '♻️',
        title: 'Upcycle & Repair',
        subtitle: 'Give this garment a new life with a creative transformation.',
        color: colors.orange,
        bgColor: colors.goldLight,
      };
    case 'RECYCLE':
      return {
        emoji: '♻️',
        title: 'Recycle',
        subtitle: 'This garment has reached end of life. We\'ll help recycle it responsibly.',
        color: colors.error,
        bgColor: colors.crimsonLight,
      };
    default:
      return {
        emoji: '❓',
        title: 'Unknown',
        subtitle: 'Could not determine the best route for this garment.',
        color: colors.textMuted,
        bgColor: colors.paperLight,
      };
  }
}
