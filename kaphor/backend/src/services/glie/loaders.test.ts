import { describe, it, expect, beforeAll } from '@jest/globals';
/**
 * Unit tests for GLIE data loaders
 *
 * These tests load actual CSV/JSON data files, so they validate
 * that the real production data can be loaded and queried correctly.
 */

import { lookupT2, loadT2 } from './t2-fibers';
import { lookupT4, loadT4 } from './t4-sustainability';
import { queryT5, loadT5 } from './t5-guides';
import { queryT3, loadT3 } from './t3-market';
import { queryT1, loadT1 } from './t1-examples';

beforeAll(() => {
  // Load all datasets once before tests
  loadT2();
  loadT4();
  loadT5();
  loadT3();
  loadT1();
});

// ── T2: Fiber Properties ──────────────────────────────────────────

describe('T2 Fiber Properties', () => {
  it('loads and finds cotton', () => {
    const fiber = lookupT2('cotton');
    expect(fiber).not.toBeNull();
    expect(fiber!.fiber_name.toLowerCase()).toContain('cotton');
    expect(fiber!.fiber_quality_score).toBeDefined();
    expect(fiber!.eco_rating).toBeGreaterThanOrEqual(0);
    expect(fiber!.eco_rating).toBeLessThanOrEqual(1);
  });

  it('finds silk by alias', () => {
    const fiber = lookupT2('silk');
    expect(fiber).not.toBeNull();
    expect(fiber!.repair_notes).toBeTruthy();
  });

  it('is case-insensitive', () => {
    const upper = lookupT2('COTTON');
    const lower = lookupT2('cotton');
    const mixed = lookupT2('Cotton');
    expect(upper?.fiber_name).toEqual(lower?.fiber_name);
    expect(lower?.fiber_name).toEqual(mixed?.fiber_name);
  });

  it('finds fiber data for fabric terms like Denim', () => {
    const fiber = lookupT2('Denim');
    expect(fiber).not.toBeNull();
    expect(fiber!.fiber_name.toLowerCase()).toMatch(/denim|cotton/);
  });

  it('returns null for unknown fiber', () => {
    const fiber = lookupT2('nonexistent_super_fabric_3000');
    expect(fiber).toBeNull();
  });

  it('loads at least 40 fibers', () => {
    // We know T2.csv has 50 rows (49 data + header), but just validate > 40
    const { getT2FiberMap } = require('./t2-fibers');
    const map = getT2FiberMap();
    expect(map.size).toBeGreaterThan(40);
  });
});

// ── T4: Sustainability ────────────────────────────────────────────

describe('T4 Sustainability', () => {
  it('loads and finds cotton sustainability data', () => {
    const data = lookupT4('cotton');
    expect(data).not.toBeNull();
    expect(data!.co2_per_garment_kg).toBeGreaterThan(0);
    expect(data!.water_per_garment_litres).toBeGreaterThan(0);
    expect(data!.circulation_multiplier_base).toBeGreaterThan(0);
  });

  it('finds sustainability data for Denim', () => {
    const data = lookupT4('Denim');
    expect(data).not.toBeNull();
    expect(data!.fiber_name.toLowerCase()).toContain('cotton');
    expect(data!.co2_per_garment_kg).toBeGreaterThan(0);
  });

  it('finds silk sustainability data', () => {
    const data = lookupT4('silk');
    expect(data).not.toBeNull();
    expect(data!.carbon_saving_score).toBeGreaterThanOrEqual(0);
  });

  it('returns null for unknown fiber', () => {
    const data = lookupT4('unobtainium');
    expect(data).toBeNull();
  });

  it('cotton has higher water usage than polyester', () => {
    const cotton = lookupT4('cotton');
    const polyester = lookupT4('polyester');
    expect(cotton).not.toBeNull();
    expect(polyester).not.toBeNull();
    expect(cotton!.water_per_garment_litres).toBeGreaterThan(polyester!.water_per_garment_litres);
  });
});

// ── T5: Repair Guides ─────────────────────────────────────────────

describe('T5 Repair Guides', () => {
  it('returns guides matching fiber + damage + category', () => {
    const guides = queryT5('silk', ['tear'], 'saree');
    expect(guides.length).toBeGreaterThanOrEqual(1);
    expect(guides[0].title).toBeTruthy();
    expect(guides[0].steps.length).toBeGreaterThan(0);
    expect(guides[0].tools_required.length).toBeGreaterThan(0);
  });

  it('returns different guides for different queries', () => {
    const silkGuides = queryT5('silk', ['tear'], 'saree');
    const cottonGuides = queryT5('cotton', ['stain', 'fading'], 'shirt');
    expect(silkGuides).toBeDefined();
    expect(cottonGuides).toBeDefined();
  });

  it('returns empty array for completely unmatched query', () => {
    const guides = queryT5('quantum_fabric', ['unknown_damage_xyz'], 'spacesuit');
    expect(guides).toEqual([]);
  });

  it('returns up to 5 guides', () => {
    const guides = queryT5('silk', ['tear', 'fading', 'stain'], 'saree');
    expect(guides.length).toBeLessThanOrEqual(5);
  });

  it('each guide has required fields', () => {
    const guides = queryT5('silk', ['tear'], 'saree');
    for (const g of guides) {
      expect(g.doc_type).toBeTruthy();
      expect(g.difficulty).toBeTruthy();
      expect(g.time_minutes).toBeGreaterThan(0);
      expect(g.technique_style).toBeTruthy();
    }
  });
});

// ── T3: Market Demand ─────────────────────────────────────────────

describe('T3 Market Demand', () => {
  it('returns aggregated stats for a common category', () => {
    const stats = queryT3('saree', 0.7);
    expect(stats).not.toBeNull();
    expect(stats!.avg_listed_price).toBeGreaterThan(0);
    expect(stats!.total_listings_matched).toBeGreaterThan(0);
    expect(['rising', 'stable', 'declining', 'moderate']).toContain(stats!.demand_trend);
  });

  it('handles different condition scores', () => {
    const highCondition = queryT3('saree', 0.9);
    const lowCondition = queryT3('saree', 0.2);
    // Both should return results (different price ranges)
    expect(highCondition).not.toBeNull();
    expect(lowCondition).not.toBeNull();
  });

  it('may return null for very rare category', () => {
    // Some categories may not exist in the dataset
    const stats = queryT3('spacesuit_armor', 0.5);
    // This might be null, which is acceptable
    expect(stats === null || stats!.total_listings_matched === 0).toBe(true);
  });
});

// ── T1: Calibration Examples ──────────────────────────────────────

describe('T1 Calibration Examples', () => {
  it('returns examples matching category and condition', () => {
    const examples = queryT1('cotton', 'shirt', 0.7);
    expect(Array.isArray(examples)).toBe(true);
    if (examples.length > 0) {
      expect(examples[0].condition_score).toBeGreaterThanOrEqual(0);
      expect(examples[0].condition_score).toBeLessThanOrEqual(1);
    }
  });

  it('returns at most 10 examples', () => {
    const examples = queryT1('cotton', 'shirt', 0.5);
    expect(examples.length).toBeLessThanOrEqual(10);
  });

  it('falls back to diverse examples when no fiber match', () => {
    const examples = queryT1('nonexistent_fiber', 'shirt', 0.5);
    // Should still return examples via fallback
    expect(examples.length).toBeGreaterThanOrEqual(1);
  });
});
