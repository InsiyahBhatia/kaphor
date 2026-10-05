import { describe, it, expect } from '@jest/globals';
/**
 * Unit tests for GLIE Master Formula — pure math, no dependencies
 */
import {
  computeMaterialScore,
  computeSustainabilityScore,
  computeMarketDemandScore,
  computeGLIE,
  getRouting,
  computeImpact,
  T2Props,
  T4Props,
  T3Stats,
} from './formulas';

describe('computeMaterialScore', () => {
  it('calculates correctly for premium fiber', () => {
    const t2: T2Props = {
      fiber_quality_score: 0.95,
      durability_rating: 0.9,
      reusability_index: 0.85,
      eco_rating: 0.8,
    };
    const ms = computeMaterialScore(t2);
    // 0.40*0.95 + 0.35*0.80 + 0.25*0.85 = 0.38 + 0.28 + 0.2125 = 0.8725
    expect(ms).toBeCloseTo(0.8725, 4);
  });

  it('returns 0 for all-zero inputs', () => {
    const t2: T2Props = {
      fiber_quality_score: 0,
      durability_rating: 0,
      reusability_index: 0,
      eco_rating: 0,
    };
    expect(computeMaterialScore(t2)).toBe(0);
  });

  it('clamps to [0, 1] range', () => {
    const t2: T2Props = {
      fiber_quality_score: 2.0,  // over 1
      durability_rating: 0.5,
      reusability_index: 0.5,
      eco_rating: 0.5,
    };
    const ms = computeMaterialScore(t2);
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThanOrEqual(1);
  });

  it('handles cotton-like fiber (mid-range)', () => {
    const t2: T2Props = {
      fiber_quality_score: 0.65,
      durability_rating: 0.6,
      reusability_index: 0.7,
      eco_rating: 0.55,
    };
    const ms = computeMaterialScore(t2);
    expect(ms).toBeGreaterThan(0.4);
    expect(ms).toBeLessThan(0.8);
  });
});

describe('computeSustainabilityScore', () => {
  it('calculates correctly for high-sustainability fiber', () => {
    const t4: T4Props = {
      carbon_saving_score: 0.9,
      water_saving_score: 0.85,
      max_co2_benchmark: 40,
      max_water_benchmark: 7600,
    };
    const ss = computeSustainabilityScore(t4, 0.8);
    // 0.50*0.9 + 0.30*0.85 + 0.20*0.8 = 0.45 + 0.255 + 0.16 = 0.865
    expect(ss).toBeCloseTo(0.865, 4);
  });

  it('returns minimum for poor eco rating', () => {
    const t4: T4Props = {
      carbon_saving_score: 0.1,
      water_saving_score: 0.1,
      max_co2_benchmark: 40,
      max_water_benchmark: 7600,
    };
    const ss = computeSustainabilityScore(t4, 0.1);
    // 0.50*0.1 + 0.30*0.1 + 0.20*0.1 = 0.05 + 0.03 + 0.02 = 0.10
    expect(ss).toBeCloseTo(0.10, 2);
  });
});

describe('computeMarketDemandScore', () => {
  it('rising trend boosts score', () => {
    const t3: T3Stats = {
      avg_listed_price: 2500,
      median_days_to_sell: 10,
      avg_resale_ratio: 0.65,
      avg_demand_score: 0.8,
      total_listings_matched: 120,
      demand_trend: 'rising',
    };
    const mds = computeMarketDemandScore(t3);
    // 0.8 * 0.65 * 1.2 = 0.624, clamped to [0,1]
    expect(mds).toBeCloseTo(0.624, 4);
  });

  it('declining trend reduces score', () => {
    const t3: T3Stats = {
      avg_listed_price: 1000,
      median_days_to_sell: 45,
      avg_resale_ratio: 0.3,
      avg_demand_score: 0.4,
      total_listings_matched: 5,
      demand_trend: 'declining',
    };
    const mds = computeMarketDemandScore(t3);
    // 0.4 * 0.3 * 0.8 = 0.096
    expect(mds).toBeCloseTo(0.096, 4);
  });

  it('handles moderate trend', () => {
    const t3: T3Stats = {
      avg_listed_price: 1500,
      median_days_to_sell: 20,
      avg_resale_ratio: 0.5,
      avg_demand_score: 0.6,
      total_listings_matched: 50,
      demand_trend: 'moderate',
    };
    const mds = computeMarketDemandScore(t3);
    // 0.6 * 0.5 * 0.9 = 0.27
    expect(mds).toBeCloseTo(0.27, 4);
  });
});

describe('computeGLIE', () => {
  it('returns RESELL threshold for near-perfect scores', () => {
    const glie = computeGLIE(0.85, 0.80, 0.75, 0.80);
    // 0.35*0.85 + 0.25*0.80 + 0.20*0.75 + 0.20*0.80
    // = 0.2975 + 0.20 + 0.15 + 0.16 = 0.8075
    expect(glie).toBeCloseTo(0.8075, 4);
    expect(getRouting(glie)).toBe('RESELL');
  });

  it('returns UPCYCLE for mid-range scores', () => {
    const glie = computeGLIE(0.55, 0.60, 0.50, 0.55);
    // 0.35*0.55 + 0.25*0.60 + 0.20*0.50 + 0.20*0.55
    // = 0.1925 + 0.15 + 0.10 + 0.11 = 0.5525
    expect(glie).toBeCloseTo(0.5525, 4);
    expect(getRouting(glie)).toBe('UPCYCLE');
  });

  it('returns UPCYCLE at exactly 0.565 threshold', () => {
    const glie = computeGLIE(0.60, 0.55, 0.50, 0.60);
    // 0.35*0.60 + 0.25*0.55 + 0.20*0.50 + 0.20*0.60
    // = 0.21 + 0.1375 + 0.10 + 0.12 = 0.5675
    expect(getRouting(glie)).toBe('UPCYCLE');
  });

  it('returns RECYCLE for low scores', () => {
    const glie = computeGLIE(0.25, 0.30, 0.20, 0.25);
    // 0.35*0.25 + 0.25*0.30 + 0.20*0.20 + 0.20*0.25
    // = 0.0875 + 0.075 + 0.04 + 0.05 = 0.2525
    expect(glie).toBeCloseTo(0.2525, 4);
    expect(getRouting(glie)).toBe('RECYCLE');
  });
});

describe('getRouting', () => {
  it('routes to RESELL when GLIE >= 0.63', () => {
    expect(getRouting(0.63)).toBe('RESELL');
    expect(getRouting(0.85)).toBe('RESELL');
    expect(getRouting(1.0)).toBe('RESELL');
  });

  it('routes to UPCYCLE when 0.50 <= GLIE < 0.63', () => {
    expect(getRouting(0.50)).toBe('UPCYCLE');
    expect(getRouting(0.565)).toBe('UPCYCLE');
    expect(getRouting(0.60)).toBe('UPCYCLE');
    expect(getRouting(0.629)).toBe('UPCYCLE');
  });

  it('routes to RECYCLE when GLIE < 0.50', () => {
    expect(getRouting(0.499)).toBe('RECYCLE');
    expect(getRouting(0.3)).toBe('RECYCLE');
    expect(getRouting(0)).toBe('RECYCLE');
  });
});

describe('computeImpact', () => {
  it('calculates impact for pristine garment', () => {
    const impact = computeImpact(5.5, 2700, 1.8, 1.0);
    // conditionMultiplier = 0.5 + 1.0*0.5 = 1.0
    // carbonSaved = 5.5 * 1.8 * 1.0 = 9.9
    // waterSaved = 2700 * 1.8 * 1.0 = 4860
    // treesEquivalent = 9.9 / 22.0 = 0.45
    expect(impact.carbon_saved_kg).toBeCloseTo(9.9, 1);
    expect(impact.water_saved_litres).toBeCloseTo(4860, 0);
    expect(impact.trees_equivalent).toBeCloseTo(0.45, 2);
  });

  it('reduces impact for damaged garment', () => {
    const impact = computeImpact(5.5, 2700, 1.8, 0.3);
    // conditionMultiplier = 0.5 + 0.3*0.5 = 0.65
    // carbonSaved = 5.5 * 1.8 * 0.65 = 6.435
    // waterSaved = 2700 * 1.8 * 0.65 = 3159
    expect(impact.carbon_saved_kg).toBeCloseTo(6.44, 1);
    expect(impact.water_saved_litres).toBeCloseTo(3159, 0);
    expect(impact.trees_equivalent).toBeGreaterThan(0);
  });

  it('handles zero condition score', () => {
    const impact = computeImpact(5.5, 2700, 1.8, 0);
    // conditionMultiplier = 0.5 + 0*0.5 = 0.5
    expect(impact.carbon_saved_kg).toBeCloseTo(4.95, 1);
    expect(impact.water_saved_litres).toBeCloseTo(2430, 0);
  });
});
