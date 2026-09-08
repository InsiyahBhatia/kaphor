/**
 * T1 — Calibration Examples
 * 324 rows (filtered subset of 10k+ full dataset), loaded at startup
 * Used for few-shot calibration in the Gemini prompt
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../lib/logger';

export interface T1Example {
  garment_category: string;
  garment_subcategory: string;
  fiber: string;
  damage_ratio: number;
  stain_ratio: number;
  wear_zone_ratio: number;
  fiber_degradation: number;
  damage_types: string;
  damage_location: string;
  condition_score: number;
  human_condition_label: string;
  glie_routing: string;
  annotation_confidence: string;
}

let examples: T1Example[] | null = null;

function normalize(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function loadT1(): void {
  if (examples) return;

  const filePath = path.resolve(__dirname, '../../../data/T1.csv');
  logger.info(`[GLIE/T1] Loading calibration examples from ${filePath}`);

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  if (lines.length < 2) {
    logger.warn('[GLIE/T1] T1.csv is empty or missing header');
    examples = [];
    return;
  }

  const headers = parseCSVLine(lines[0]);
  examples = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 2) continue;

    const record: Record<string, any> = {};
    for (let j = 0; j < headers.length && j < row.length; j++) {
      let value = row[j].replace(/^"|"$/g, '').trim();
      const num = Number(value);
      record[headers[j]] = isNaN(num) ? value : num;
    }

    // Fiber column might be named differently; try to find fiber info
    // T1 has no explicit fiber column — infer from garment_subcategory if available
    const example: T1Example = {
      garment_category: record.garment_category || '',
      garment_subcategory: record.garment_subcategory || '',
      fiber: record.fiber || record.material || record.fiber_type || '',
      damage_ratio: Number(record.damage_ratio) || 0,
      stain_ratio: Number(record.stain_ratio) || 0,
      wear_zone_ratio: Number(record.wear_zone_ratio) || 0,
      fiber_degradation: Number(record.fiber_degradation) || 0,
      damage_types: record.damage_types || '',
      damage_location: record.damage_location || '',
      condition_score: Number(record.condition_score) || 0.5,
      human_condition_label: record.human_condition_label || '',
      glie_routing: record.glie_routing || '',
      annotation_confidence: record.annotation_confidence || '',
    };
    examples.push(example);
  }

  logger.info(`[GLIE/T1] Loaded ${examples.length} calibration examples`);
}

/**
 * Query T1 — find calibration examples matching fiber + category + condition score
 * Returns up to 10 examples for few-shot prompting
 */
export function queryT1(
  fiber: string,
  category: string,
  conditionScore: number,
): T1Example[] {
  if (!examples) loadT1();
  if (!examples || examples.length === 0) return [];

  const fiberKey = normalize(fiber);
  const categoryKey = normalize(category);
  const csMin = Math.max(0, conditionScore - 0.15);
  const csMax = Math.min(1, conditionScore + 0.15);

  // Score and rank
  const scored = examples.map(ex => {
    let score = 0;

    // Fiber match (if ex has fiber data)
    if (ex.fiber) {
      const exFiber = normalize(ex.fiber);
      if (exFiber === fiberKey || exFiber.includes(fiberKey) || fiberKey.includes(exFiber)) {
        score += 0.40;
      }
    }

    // Category match
    const exCat = normalize(ex.garment_category);
    if (exCat === categoryKey || exCat.includes(categoryKey) || categoryKey.includes(exCat)) {
      score += 0.30;
    }

    // Condition score proximity
    const exCs = ex.condition_score;
    if (exCs >= csMin && exCs <= csMax) {
      score += 0.30 - Math.abs(exCs - conditionScore) * 0.50; // bonus for closeness
    }

    return { ex, score };
  });

  // Sort by score descending, take top 10 that have at least some relevance
  const top = scored
    .filter(s => s.score > 0.10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (top.length < 3) {
    // Fallback: return diverse examples across condition scores
    return getDiverseExamples(category, conditionScore);
  }

  return top.map(s => s.ex);
}

/**
 * Fallback: return diverse calibration examples to cover the range
 */
function getDiverseExamples(category: string, conditionScore: number): T1Example[] {
  if (!examples || examples.length === 0) return [];

  const categoryKey = normalize(category);

  // Prefer same-category examples near the target condition score
  const catExamples = examples.filter(ex => {
    const exCat = normalize(ex.garment_category);
    return exCat === categoryKey || exCat.includes(categoryKey) || categoryKey.includes(exCat);
  });

  const pool = catExamples.length >= 5 ? catExamples : examples;

  // Pick 5 examples that span the condition range
  const sorted = [...pool].sort((a, b) =>
    Math.abs(a.condition_score - conditionScore) - Math.abs(b.condition_score - conditionScore)
  );

  return sorted.slice(0, 5);
}
