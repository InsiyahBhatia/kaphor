/**
 * GLIE Orchestrator — wires all components together
 * exports assessGarment() as the main entry point
 */

import { logger } from '../../lib/logger';

import { lookupT2, loadT2 } from './t2-fibers';
import { lookupT4, loadT4 } from './t4-sustainability';
import { queryT3, loadT3 } from './t3-market';
import { queryT5, loadT5 } from './t5-guides';
import { queryT1, loadT1 } from './t1-examples';
import { buildPrompts, estimatePromptTokens } from './prompt-builder';
import { callGeminiVision } from './gemini';
import {
  computeMaterialScore,
  computeSustainabilityScore,
  computeMarketDemandScore,
  computeGLIE,
  getRouting,
  computeImpact,
} from './formulas';
import type { T2Props } from './formulas';
import type { GarmentDetails } from './prompt-builder';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AssessGarmentInput {
  image_base64: string;
  fiber_type: string;
  garment_category: string;
  original_price_inr: number;
  style_tags?: string;
  color_family?: string;
  season?: string;
  // Optional overrides for testing/debugging
  condition_override?: number;
  damage_types?: string[];
}

export interface AssessGarmentResult {
  glie_score: number;
  routing_decision: 'RESELL' | 'UPCYCLE' | 'RECYCLE';
  condition_score: number;
  material_score: number;
  sustainability_score: number;
  market_demand_score: number;
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
}

// ── Initialize all data loaders ──────────────────────────────────────────────

let initialized = false;

export function initGLIE(): void {
  if (initialized) return;
  logger.info('[GLIE] Initializing data loaders...');
  loadT2();
  loadT4();
  loadT3();
  loadT5();
  loadT1();
  initialized = true;
  logger.info('[GLIE] All data loaders initialized');
}

// ── Main assessGarment function ──────────────────────────────────────────────

export async function assessGarment(input: AssessGarmentInput): Promise<AssessGarmentResult> {
  // Ensure data is loaded (safe to call multiple times)
  initGLIE();

  const garment: GarmentDetails = {
    garment_category: input.garment_category,
    fiber_type: input.fiber_type,
    original_price_inr: input.original_price_inr,
    style_tags: input.style_tags || 'casual',
    color_family: input.color_family || 'neutrals',
    season: input.season || 'all_season',
  };

  // ── Step 1: RAG Retrieval ──────────────────────────────────────────────

  const fiberProps = lookupT2(input.fiber_type);
  const sustainData = lookupT4(input.fiber_type);

  // We need a preliminary condition estimate for T3/T1 queries
  // Use override if provided, otherwise default to 0.5 (will be replaced by Gemini)
  const preliminaryCS = input.condition_override ?? 0.5;
  const marketStats = queryT3(input.garment_category, preliminaryCS);
  const guides = queryT5(input.fiber_type, input.damage_types || ['tear', 'stain', 'fading'], input.garment_category);
  const examples = queryT1(input.fiber_type, input.garment_category, preliminaryCS);

  logger.info(`[GLIE] RAG retrieved: ${examples.length} examples, ${guides.length} guides, ${marketStats?.total_listings_matched || 0} market listings`);

  // ── Step 2: Build RAG Prompt ───────────────────────────────────────────

  const prompts = buildPrompts(garment, {
    fiberProps,
    sustainData,
    marketStats,
    guides,
    examples,
  });

  const promptTokens = estimatePromptTokens(prompts);
  logger.info(`[GLIE] Prompt built: ~${promptTokens} tokens`);

  // ── Step 3: Call Gemini Vision API ─────────────────────────────────────

  const geminiResult = await callGeminiVision(
    prompts.systemPrompt,
    prompts.userPrompt,
    input.image_base64,
  );

  let cs: number;
  let damageBreakdown: AssessGarmentResult['damage_breakdown'];

  if (geminiResult.success && geminiResult.data) {
    cs = geminiResult.data.condition_score;
    damageBreakdown = {
      damage_ratio: geminiResult.data.damage_ratio,
      wear_zone_ratio: geminiResult.data.wear_zone_ratio,
      stain_ratio: geminiResult.data.stain_ratio,
      fiber_degradation_score: geminiResult.data.fiber_degradation_score,
      damage_types: geminiResult.data.damage_types,
    };
  } else {
    // Fallback: use override or default
    cs = input.condition_override ?? 0.5;
    damageBreakdown = {
      damage_ratio: 0,
      wear_zone_ratio: 0,
      stain_ratio: 0,
      fiber_degradation_score: 0,
      damage_types: ['none'],
    };
    logger.warn(`[GLIE] Gemini failed, using fallback condition_score=${cs}`);
  }

  // ── Step 4: Compute Sub-Scores ─────────────────────────────────────────

  const t2Props: T2Props = fiberProps
    ? {
      fiber_quality_score: fiberProps.fiber_quality_score,
      durability_rating: Number(fiberProps.durability_rating) || 0.5,
      reusability_index: fiberProps.reusability_index,
      eco_rating: fiberProps.eco_rating,
    }
    : { fiber_quality_score: 0.5, durability_rating: 0.5, reusability_index: 0.5, eco_rating: 0.5 };

  const ms = computeMaterialScore(t2Props);

  const t4Fallback = {
    carbon_saving_score: 0.5,
    water_saving_score: 0.5,
    max_co2_benchmark: 40,
    max_water_benchmark: 7600,
  };
  const ss = sustainData
    ? computeSustainabilityScore(
      {
        carbon_saving_score: sustainData.carbon_saving_score,
        water_saving_score: sustainData.water_saving_score,
        max_co2_benchmark: sustainData.max_co2_benchmark_kg,
        max_water_benchmark: sustainData.max_water_benchmark_l,
      },
      t2Props.eco_rating,
    )
    : 0.4;

  const mds = marketStats
    ? computeMarketDemandScore(marketStats)
    : 0.4;

  // ── Step 5: Compute GLIE Master Formula ────────────────────────────────

  const glieScore = computeGLIE(cs, ms, mds, ss);
  const routing = getRouting(glieScore, cs);

  // ── Step 6: Impact Calculations ────────────────────────────────────────

  const impact = sustainData
    ? computeImpact(
      sustainData.co2_per_garment_kg,
      sustainData.water_per_garment_litres,
      sustainData.circulation_multiplier_base,
      cs,
    )
    : computeImpact(5.0, 500, 1.8, cs);

  // ── Step 7: Repair Feasibility ─────────────────────────────────────────

  const repairFeasibility = getRepairFeasibility(
    cs,
    damageBreakdown.damage_ratio,
    damageBreakdown.fiber_degradation_score,
  );

  const suggestedRepair = guides.length > 0
    ? guides[0].title
    : 'Professional dry cleaning / gentle wash assessment';

  const suggestedPrice = routing === 'RESELL' && cs > 0
    ? Math.round(input.original_price_inr * cs * 0.6)
    : undefined;

  return {
    glie_score: Math.round(glieScore * 10000) / 10000,
    routing_decision: routing,
    condition_score: Math.round(cs * 10000) / 10000,
    material_score: Math.round(ms * 10000) / 10000,
    sustainability_score: Math.round(ss * 10000) / 10000,
    market_demand_score: Math.round(mds * 10000) / 10000,
    damage_breakdown: damageBreakdown,
    carbon_saved_kg: impact.carbon_saved_kg,
    water_saved_litres: impact.water_saved_litres,
    trees_equivalent: impact.trees_equivalent,
    repair_feasibility: repairFeasibility,
    suggested_repair_technique: suggestedRepair,
    suggested_price_inr: suggestedPrice,
    description: geminiResult.data?.description || 'Garment condition assessed by GLIE engine.',
    rag_context: {
      examples_used: examples.length,
      guides_matched: guides.length,
      market_listings_matched: marketStats?.total_listings_matched || 0,
      prompt_tokens_estimated: promptTokens,
      gemini_model: geminiResult.model,
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getRepairFeasibility(
  cs: number,
  damageRatio: number,
  fiberDegradation: number,
): string {
  if (cs >= 0.85) return 'No repair needed — excellent condition';
  if (cs >= 0.70) return 'Minor repairs possible — simple cleaning or light mending';
  if (cs >= 0.55) return 'Moderate repair feasible — visible wear can be addressed';
  if (cs >= 0.40) return 'Complex repair needed — may require professional restoration';
  if (cs >= 0.25) return 'Major restoration required — evaluate cost vs. value';
  return 'Limited feasibility — severe damage, recycling recommended';
}
