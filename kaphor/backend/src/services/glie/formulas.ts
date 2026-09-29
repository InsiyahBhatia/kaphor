/**
 * GLIE Master Formula — pure math, zero dependencies
 *
 * GLIE = 0.35×CS + 0.25×MS + 0.20×MDS + 0.20×SS
 * Routing: ≥0.63 RESELL | ≥0.565 UPCYCLE | <0.565 RECYCLE
 */

export interface T2Props {
  fiber_quality_score: number;
  durability_rating: number;
  reusability_index: number;
  eco_rating: number;
}

export interface T4Props {
  carbon_saving_score: number;
  water_saving_score: number;
  max_co2_benchmark: number;
  max_water_benchmark: number;
}

export interface T3Stats {
  avg_listed_price: number;
  median_listed_price?: number;
  median_days_to_sell: number;
  avg_resale_ratio: number;
  avg_demand_score: number;
  total_listings_matched: number;
  demand_trend: 'rising' | 'stable' | 'declining' | 'moderate';
}

export interface ImpactResult {
  carbon_saved_kg: number;
  water_saved_litres: number;
  trees_equivalent: number;
}

/**
 * Material Score (MS) — based on fiber properties
 * MS = 0.40*fiber_quality + 0.35*eco_rating + 0.25*reusability_index
 */
export function computeMaterialScore(t2: T2Props): number {
  return clamp(
    0.40 * t2.fiber_quality_score +
    0.35 * t2.eco_rating +
    0.25 * t2.reusability_index,
    0, 1
  );
}

/**
 * Sustainability Score (SS) — based on T4 lookup + eco rating
 * SS = 0.50*carbon_saving_score + 0.30*water_saving_score + 0.20*eco_rating
 */
export function computeSustainabilityScore(t4: T4Props, eco_rating: number): number {
  return clamp(
    0.50 * t4.carbon_saving_score +
    0.30 * t4.water_saving_score +
    0.20 * eco_rating,
    0, 1
  );
}

/**
 * Market Demand Score (MDS) — based on T3 aggregated stats
 * MDS = avg_demand_score × avg_resale_ratio × trendModifier
 * trendModifier: "rising"=1.2, "stable"=1.0, "declining"=0.8, "moderate"=0.9
 */
export function computeMarketDemandScore(t3: T3Stats): number {
  const trendMod: Record<string, number> = {
    rising: 1.2,
    stable: 1.0,
    declining: 0.8,
    moderate: 0.9,
  };
  const modifier = trendMod[t3.demand_trend] ?? 1.0;
  const raw = t3.avg_demand_score * t3.avg_resale_ratio * modifier;
  return clamp(raw, 0, 1);
}

/**
 * GLIE Master Formula
 * GLIE = 0.35×CS + 0.25×MS + 0.20×MDS + 0.20×SS
 */
export function computeGLIE(
  cs: number,
  ms: number,
  mds: number,
  ss: number,
): number {
  return clamp(0.35 * cs + 0.25 * ms + 0.20 * mds + 0.20 * ss, 0, 1);
}

export type RoutingDecision = 'RESELL' | 'UPCYCLE' | 'RECYCLE';

/**
 * Routing from GLIE score & Condition Score
 * - CS >= 0.70 or GLIE >= 0.63 → RESELL (good/excellent condition garments)
 * - CS >= 0.45 or GLIE >= 0.50 → UPCYCLE (minor tears, small holes, upcyclable items)
 * - High-durability materials (Denim, Jeans, Canvas, Wool, Silk) with CS > 0.20 → UPCYCLE
 * - CS < 0.45 and GLIE < 0.50 → RECYCLE (severely degraded/destroyed items)
 */
export function getRouting(
  glie: number,
  cs?: number,
  fiberType?: string,
  garmentCategory?: string,
): RoutingDecision {
  const normFiber = (fiberType || '').trim().toLowerCase();
  const normCat = (garmentCategory || '').trim().toLowerCase();

  // High-value and versatile circular textiles (Denim, Cotton, Silk, Wool, Flannel)
  // and garments (Jeans, Shirts, T-Shirts, Sarees, Socks, Sweaters) that remain
  // prime candidates for creative upcycling before industrial recycling.
  const isUpcyclableItem =
    ['denim', 'cotton', 'canvas', 'corduroy', 'wool', 'cashmere', 'leather', 'suede', 'linen', 'silk', 'jute', 'hemp', 'jersey', 'flannel'].some(
      (f) => normFiber.includes(f)
    ) ||
    ['jeans', 'jacket', 'shirt', 'tshirt', 't-shirt', 'top', 'saree', 'kurti', 'kurta', 'socks', 'sock', 'sweater', 'hoodie', 'lehenga', 'dress', 'skirt', 'blouse'].some(
      (c) => normCat.includes(c)
    );

  if (cs !== undefined) {
    if (cs >= 0.70 || glie >= 0.63) return 'RESELL';
    // Upcycling Safeguard: Wearable garments with usable panels/knits (Jeans, Shirts, T-shirts, Sarees, Socks, Sweaters)
    // should NOT be dumped into industrial shredder recycling unless destroyed or rotted (cs <= 0.40).
    // Calibrated on the GLIE vision corpus: items scored cs=0.35 (heavy staining/degradation)
    // are judged RECYCLE by the vision model, so the rescue cutoff sits at cs > 0.40.
    if (isUpcyclableItem && cs > 0.40) {
      return 'UPCYCLE';
    }
    if (cs >= 0.45 || glie >= 0.565) return 'UPCYCLE';
    return 'RECYCLE';
  }
  if (glie >= 0.63) return 'RESELL';
  if (isUpcyclableItem && glie > 0.25) return 'UPCYCLE';
  if (glie >= 0.565) return 'UPCYCLE';
  return 'RECYCLE';
}

/**
 * Environmental impact calculations
 * carbonSaved = co2 * circulation_multiplier * conditionMultiplier
 * waterSaved = water * circulation_multiplier * conditionMultiplier
 * treesEquivalent = carbonSaved / 22.0
 */
export function computeImpact(
  co2PerGarmentKg: number,
  waterPerGarmentLitres: number,
  circulationMultiplier: number,
  conditionScore: number,
): ImpactResult {
  const conditionMultiplier = 0.5 + conditionScore * 0.5;
  const carbonSaved = co2PerGarmentKg * circulationMultiplier * conditionMultiplier;
  const waterSaved = waterPerGarmentLitres * circulationMultiplier * conditionMultiplier;
  return {
    carbon_saved_kg: round(carbonSaved, 2),
    water_saved_litres: round(waterSaved, 1),
    trees_equivalent: round(carbonSaved / 22.0, 3),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
