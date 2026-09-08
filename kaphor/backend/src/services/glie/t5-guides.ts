/**
 * T5 — Repair / Upcycle Guide Search
 * 200+ documents loaded at startup, filtered by fiber + damage + category
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../lib/logger';

export interface T5Guide {
  doc_id: string;
  doc_type: string;       // "repair" | "upcycle" | "restore"
  title: string;
  difficulty: string;     // "beginner" | "intermediate" | "advanced"
  time_minutes: number;
  fiber_types: string[];
  damage_types: string[];
  garment_categories: string[];
  damage_location: string;
  tools_required: string[];
  steps: Array<{ instruction: string; tip: string }>;
  technique_style?: string;
  quality_score?: number;
}

export interface T5GuideCondensed {
  doc_type: string;
  title: string;
  difficulty: string;
  time_minutes: number;
  technique_style: string;
  tools_required: string[];
  steps: string[];         // First 3 steps (instruction only)
  quality_score: number;
}

let guideDocs: T5Guide[] | null = null;
let qualityMap: Map<string, number> | null = null; // doc_id → quality score

function normalize(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

export function loadT5(): void {
  if (guideDocs) return;

  const filePath = path.resolve(__dirname, '../../../data/T5.json');
  logger.info(`[GLIE/T5] Loading guides from ${filePath}`);

  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  guideDocs = [];
  qualityMap = new Map();

  // T5.json keys are numeric strings "0".."61"
  for (const key of Object.keys(data)) {
    const doc = data[key];
    if (!doc || !doc.doc_id) continue;

    const guide: T5Guide = {
      doc_id: doc.doc_id || '',
      doc_type: doc.doc_type || 'repair',
      title: doc.title || '',
      difficulty: doc.difficulty || 'beginner',
      time_minutes: doc.time_minutes || 30,
      fiber_types: (doc.fiber_types || doc.fiber_type || []).map((f: string) => f.trim()),
      damage_types: (doc.damage_types || doc.damage_type || []).map((d: string) => d.trim()),
      garment_categories: (doc.garment_categories || doc.garment_category || []).map((g: string) => g.trim()),
      damage_location: doc.damage_location || '',
      tools_required: doc.tools_required || [],
      steps: doc.steps || [],
    };
    // Estimate quality score based on number of steps + specificity
    const stepsScore = Math.min(1, (guide.steps?.length || 0) / 10);
    const haveTools = guide.tools_required?.length > 0 ? 0.2 : 0;
    const hasFiber = guide.fiber_types?.length > 0 ? 0.1 : 0;
    guide.quality_score = Math.round((stepsScore + haveTools + hasFiber) * 1000) / 1000;

    guideDocs.push(guide);
    qualityMap.set(guide.doc_id, guide.quality_score);
  }

  logger.info(`[GLIE/T5] Loaded ${guideDocs.length} guides`);
}

/**
 * Query T5 — filter by fiber + damage + category, return top 5 condensed guides
 */
export function queryT5(
  fiber: string,
  damageTypes: string[],
  category: string,
): T5GuideCondensed[] {
  if (!guideDocs) loadT5();
  if (!guideDocs || guideDocs.length === 0) return [];

  const fiberKey = normalize(fiber);
  const categoryKey = normalize(category);
  const damageKeys = damageTypes.map(d => normalize(d));

  // Score each guide by relevance
  const scored = guideDocs.map(guide => {
    let score = 0;

    // Fiber match (weight: 40%)
    const fiberMatch = guide.fiber_types.some(f => {
      const fk = normalize(f);
      return fk === fiberKey || fk.includes(fiberKey) || fiberKey.includes(fk);
    });
    if (fiberMatch) score += 0.40;

    // Damage type match (weight: 30%)
    const damageMatch = guide.damage_types.some(gd => {
      const gdk = normalize(gd);
      return damageKeys.some(dk => gdk === dk || gdk.includes(dk) || dk.includes(gdk));
    });
    if (damageMatch) score += 0.30;

    // Category match (weight: 20%)
    const catMatch = guide.garment_categories.some(gc => {
      const gck = normalize(gc);
      return gck === categoryKey || gck.includes(categoryKey) || categoryKey.includes(gck);
    }) || categoryKey === 'other' || categoryKey === '';
    if (catMatch) score += 0.20;

    // Quality bonus (weight: 10%)
    score += (guide.quality_score || 0) * 0.10;

    return { guide, score };
  });

  // Sort by score desc, fallback to top quality guides if scores are low
  const sorted = scored.sort((a, b) => b.score - a.score);
  const relevant = sorted.filter(s => s.score >= 0.10);
  const selected = relevant.length > 0 ? relevant : sorted.slice(0, 5);
  const top5 = selected.slice(0, 5);

  return top5.map(({ guide }) => ({
    doc_type: guide.doc_type,
    title: guide.title,
    difficulty: guide.difficulty,
    time_minutes: guide.time_minutes,
    technique_style: guide.technique_style || mapDocType(guide.doc_type),
    tools_required: guide.tools_required || [],
    steps: (guide.steps || []).slice(0, 3).map(s =>
      typeof s === 'string' ? s : (s.instruction || s.tip || '')
    ),
    quality_score: guide.quality_score || 0,
  }));
}

function mapDocType(docType: string): string {
  const map: Record<string, string> = {
    repair: 'Repair & Mend',
    upcycle: 'Upcycle Transformation',
    restore: 'Restoration',
  };
  return map[docType] || 'General Technique';
}
