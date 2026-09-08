/**
 * Prompt Builder — assembles the RAG-augmented Gemini prompt
 * Combines T2 fiber properties, T4 sustainability, T3 market stats,
 * T5 guides (condensed), T1 calibration examples, and garment details
 */

import type { T2FiberProps } from './t2-fibers';
import type { T4Sustainability } from './t4-sustainability';
import type { T3Stats } from './formulas';
import type { T5GuideCondensed } from './t5-guides';
import type { T1Example } from './t1-examples';

export interface GarmentDetails {
  garment_category: string;
  fiber_type: string;
  original_price_inr: number;
  style_tags: string;
  color_family: string;
  season: string;
}

export interface RAGContext {
  fiberProps: T2FiberProps | null;
  sustainData: T4Sustainability | null;
  marketStats: T3Stats | null;
  guides: T5GuideCondensed[];
  examples: T1Example[];
}

export interface BuiltPrompts {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Build the full RAG-augmented Gemini prompt
 * Returns { systemPrompt, userPrompt } ready to send to Gemini
 */
export function buildPrompts(
  garment: GarmentDetails,
  context: RAGContext,
): BuiltPrompts {
  const { fiberProps, sustainData, marketStats, guides, examples } = context;

  // ── System Prompt ─────────────────────────────────────────────────────────

  const fiberSection = fiberProps
    ? `═══════════════════════════════════════════════════════
RETRIEVED: FIBER PROPERTIES (T2)
═══════════════════════════════════════════════════════
Fiber: ${fiberProps.fiber_name}
Family: ${fiberProps.fiber_family}
Quality: ${fiberProps.fiber_quality_score}/1.0
Durability: ${fiberProps.durability_rating}
Reusability: ${fiberProps.reusability_index}
Eco Rating: ${fiberProps.eco_rating}/1.0
Upcycle Difficulty: ${fiberProps.upcycle_difficulty}
Repair Notes: ${fiberProps.repair_notes}
Washing: ${fiberProps.washability}
Dyeable: ${fiberProps.dyeable} | Stitchable: ${fiberProps.stitchable}`
    : '';

  const sustainSection = sustainData
    ? `═══════════════════════════════════════════════════════
RETRIEVED: SUSTAINABILITY (T4)
═══════════════════════════════════════════════════════
CO₂ per garment: ${sustainData.co2_per_garment_kg} kg
Water per garment: ${sustainData.water_per_garment_litres} L
Circulation multiplier: ${sustainData.circulation_multiplier_base}
Carbon saving score: ${sustainData.carbon_saving_score}
Water saving score: ${sustainData.water_saving_score}
Max CO₂ benchmark: ${sustainData.max_co2_benchmark_kg} kg
Max water benchmark: ${sustainData.max_water_benchmark_l} L`
    : '';

  const marketSection = marketStats
    ? `═══════════════════════════════════════════════════════
RETRIEVED: MARKET DEMAND (T3)
═══════════════════════════════════════════════════════
Avg listed price: ₹${marketStats.avg_listed_price}
Median days to sell: ${marketStats.median_days_to_sell}
Avg resale ratio: ${marketStats.avg_resale_ratio}
Avg demand score: ${marketStats.avg_demand_score}
Listings matched: ${marketStats.total_listings_matched}
Demand trend: ${marketStats.demand_trend}`
    : '';

  const guidesSection = guides.length > 0
    ? `═══════════════════════════════════════════════════════
RETRIEVED: REPAIR/UPCYCLE GUIDES (T5)
═══════════════════════════════════════════════════════
${guides.map((g, i) =>
  `${i + 1}. [${g.doc_type}] ${g.title} — ${g.difficulty}, ${g.time_minutes}min\n   Tools: ${g.tools_required.slice(0, 4).join(', ')}\n   Steps: ${g.steps.slice(0, 2).map(s => `• ${s}`).join('\n          ')}`
).join('\n\n')}`
    : '';

  const examplesSection = examples.length > 0
    ? `═══════════════════════════════════════════════════════
RETRIEVED: CALIBRATION EXAMPLES (T1)
═══════════════════════════════════════════════════════
${examples.slice(0, 5).map(ex =>
  `- ${ex.garment_category}, damage:${ex.damage_ratio}, stain:${ex.stain_ratio}, wear:${ex.wear_zone_ratio}, score:${ex.condition_score}, label:${ex.human_condition_label}, route:${ex.glie_routing}`
).join('\n')}`
    : '';

  const systemPrompt = `═══════════════════════════════════════════════════════
You are GLIE — Garment Lifecycle Intelligence Engine.
═══════════════════════════════════════════════════════

SCORING RUBRIC:
CONDITION SCORE (CS):
  1.00 = Brand new, pristine, tags attached
  0.85 = Like new, minimal signs of use
  0.70 = Good, light wear, no visible structural damage
  0.55 = Fair, minor tear / small hole / light fading / minor stain (IDEAL FOR UPCYCLE)
  0.40 = Poor, multiple moderate tears / heavy wear
  0.25 = Bad, widespread large holes / severe damage
  0.10 = Destroyed, unsalvageable textile scrap

CRITICAL RULES:
- Wrinkles alone → CS ≥ 0.60
- Fading alone → CS ~ 0.55-0.65
- Light stains → CS ~ 0.55-0.65
- Minor tear / isolated small hole / distressing → CS ~ 0.50-0.65 (UPCYCLE ROUTE)
- Multiple large tears / severe structural collapse → CS ≤ 0.40 (RECYCLE ROUTE)

GLIE MASTER FORMULA:
  GLIE = 0.35×CS + 0.25×MS + 0.20×MDS + 0.20×SS

ROUTING:
  GLIE ≥ 0.63 → RESELL
  GLIE ≥ 0.50 or CS ≥ 0.45 → UPCYCLE
  GLIE < 0.50 and CS < 0.45 → RECYCLE
${fiberSection}${sustainSection}${marketSection}${guidesSection}${examplesSection}`;

  // ── User Prompt ───────────────────────────────────────────────────────────

  const userPrompt = `═══════════════════════════════════════════════════════
GARMENT TO ASSESS
═══════════════════════════════════════════════════════
Category: ${garment.garment_category}
Fiber: ${garment.fiber_type}
Price: ₹${garment.original_price_inr}
Style: ${garment.style_tags || 'casual'}
Color: ${garment.color_family || 'neutrals'}
Season: ${garment.season || 'all_season'}

Analyze the attached image carefully and return ONLY valid JSON with:
{
  "condition_score": 0.0 to 1.0,
  "damage_ratio": 0.0 to 1.0,
  "wear_zone_ratio": 0.0 to 1.0,
  "stain_ratio": 0.0 to 1.0,
  "fiber_degradation_score": 0.0 to 1.0,
  "damage_types": ["tear", "stain", "fading", "pilling", "hole", "none"],
  "description": "brief description of garment condition"
}`;

  return { systemPrompt, userPrompt };
}

/**
 * Estimate total prompt token count (approximate: 1 token ≈ 4 chars)
 */
export function estimatePromptTokens(prompts: BuiltPrompts): number {
  const totalChars = prompts.systemPrompt.length + prompts.userPrompt.length;
  return Math.ceil(totalChars / 4);
}
