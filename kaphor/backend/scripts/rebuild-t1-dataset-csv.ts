/**
 * Rebuild T1_glie_dataset.csv from clean UTF-8 source T1_glie_raw.jsonl.
 *
 * The prior PowerShell Get-Content/Set-Content round-trip corrupted
 * non-ASCII filenames (read as ANSI, written as UTF-8). The raw JSONL is
 * untouched and correct, so this script regenerates the dataset CSV with the
 * EXACT same logic as validate-glie-t1.ts (same order, headers, deterministic
 * split, and REAL formula evaluation — computed locally, no Gemini calls),
 * then re-applies the human-verified routing corrections to glie_routing.
 *
 * Usage: npx ts-node scripts/rebuild-t1-dataset-csv.ts
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { lookupT2, resolveFiber } from '../src/services/glie/t2-fibers';
import { lookupT4 } from '../src/services/glie/t4-sustainability';
import { queryT3 } from '../src/services/glie/t3-market';
import {
  computeMaterialScore,
  computeSustainabilityScore,
  computeMarketDemandScore,
  computeGLIE,
  getRouting,
} from '../src/services/glie/formulas';

const DATA_DIR = path.resolve(__dirname, '../data');
const RAW = path.join(DATA_DIR, 'T1_glie_raw.jsonl');
const CSV_OUT = path.join(DATA_DIR, 'T1_glie_dataset.csv');

const HEADER = [
  'garment_id', 'photo_id', 'image_url', 'photo_angle', 'garment_category',
  'garment_subcategory', 'brand', 'original_price_inr', 'age_months',
  'times_worn', 'damage_ratio', 'stain_ratio', 'wear_zone_ratio',
  'fiber_degradation', 'damage_types', 'damage_location', 'condition_score',
  'human_condition_label', 'glie_routing', 'annotator_id',
  'annotation_confidence', 'split', 'formula_routing',
];

// Human-verified glie_routing corrections (AI routing was wrong for these):
// keyed by exact JSONL `file`. Value = correct ground-truth routing.
const HUMAN_CORRECTIONS: Record<string, string> = {
  '534239574558929826.jpg': 'RECYCLE',                                        // glie_0018 (test) — user: recycle, not resell
  'Distressed Hoodie.jpg': 'RECYCLE',                                         // glie_0037 (train) — user: correct recycle
  'stained&toned/143622675613409491.jpg': 'RECYCLE',                          // glie_0111 (train) — user: correct recycle
  'stained&toned/925489792194908917.jpg': 'RECYCLE',                          // glie_0122 (train) — user: correct recycle
  'stained&toned/Carmar Jackets & Coats _ Carmar Light Blue Distressed Oversized Denim Jacket _ Color_ Blue _ Size_ S.jpg': 'RECYCLE', // glie_0124 (train)
  'stained&toned/FRANK LEDERINK DYED VINTAGE BEDSHEET STAND COLLAR SHIRT -SLOW&STEADY.jpg': 'UPCYCLE', // glie_0126 (train) — user: correct upcycle
  'stained&toned/Jeans on Rocks, Jakarta.jpg': 'RECYCLE',                     // glie_0131 (train) — user: correct recycle
};

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function splitFor(file: string): 'train' | 'test' {
  return (fnv1a(file) % 100) < 80 ? 'train' : 'test';
}

function evaluateFormula(row: { fiber: string; garment_category: string; condition_score: number }) {
  const fiberResolved = resolveFiber(row.fiber);
  const fiberKey = fiberResolved || row.fiber;

  const t2 = lookupT2(fiberKey);
  const t4 = lookupT4(fiberKey);

  const t2Props = t2
    ? {
      fiber_quality_score: t2.fiber_quality_score,
      durability_rating: Number(t2.durability_rating) || 0.5,
      reusability_index: t2.reusability_index,
      eco_rating: t2.eco_rating,
    }
    : { fiber_quality_score: 0.5, durability_rating: 0.5, reusability_index: 0.5, eco_rating: 0.5 };

  const ms = computeMaterialScore(t2Props);

  const ss = t4
    ? computeSustainabilityScore(
      {
        carbon_saving_score: t4.carbon_saving_score,
        water_saving_score: t4.water_saving_score,
        max_co2_benchmark: t4.max_co2_benchmark_kg,
        max_water_benchmark: t4.max_water_benchmark_l,
      },
      t2Props.eco_rating,
    )
    : 0.4;

  const marketStats = queryT3(row.garment_category, row.condition_score);
  const mds = marketStats ? computeMarketDemandScore(marketStats) : 0.4;

  const glie = computeGLIE(row.condition_score, ms, mds, ss);
  const routing = getRouting(glie, row.condition_score, row.fiber, row.garment_category);
  return { formula_routing: routing, glie: Math.round(glie * 10000) / 10000 };
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function main() {
  const rows: any[] = fs.readFileSync(RAW, 'utf-8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
    .filter((r) => !!r.file);

  const lines: string[] = [HEADER.join(',')];
  let corrections = 0;
  let problems = 0;

  rows.forEach((r, i) => {
    const id = `glie_${String(i + 1).padStart(4, '0')}`;
    const split = splitFor(r.file);
    const { formula_routing } = evaluateFormula(r);
    const originalAi = String(r.ai_routing).toUpperCase();
    const corrected = HUMAN_CORRECTIONS[r.file];
    let glieRouting = originalAi;

    if (HUMAN_CORRECTIONS.hasOwnProperty(r.file)) {
      if (!corrected) {
        problems++;
      } else {
        glieRouting = corrected;
        corrections++;
      }
    }

    const subcat = csvEscape(`${r.garment_subcategory} (${r.fiber})`.trim());
    lines.push([
      id, id, csvEscape(r.file), r.photo_angle, r.garment_category, subcat,
      'Unbranded', '', '', '',
      r.damage_ratio, r.stain_ratio, r.wear_zone_ratio, r.fiber_degradation,
      csvEscape(r.damage_types.join(' ')), r.damage_location,
      r.condition_score, r.human_condition_label, glieRouting,
      `glie_${r.model}`, r.routing_confidence,
      split, formula_routing,
    ].join(','));
  });

  fs.writeFileSync(CSV_OUT, lines.join('\n') + '\n', 'utf-8');
  console.log(`Wrote ${rows.length} rows -> ${path.basename(CSV_OUT)}`);
  console.log(`Human corrections applied: ${corrections}, mismatched expected: ${problems}`);
}

main();