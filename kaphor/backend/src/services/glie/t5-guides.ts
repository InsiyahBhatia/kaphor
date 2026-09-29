/**
 * T5 — Repair / Upcycle Guide Search
 * 200+ documents loaded at startup, filtered by fiber + damage + category
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../lib/logger';
import { isKnownFiber } from './t2-fibers';

export interface T5Step {
  step?: number;
  instruction: string;
  tip?: string;
}

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
  steps: T5Step[];
  technique_style?: string;
  pro_tip?: string;
  care_instructions?: string;
  upcycle_alternative?: string;
  quality_score?: number;
  /** true when the doc is garment repair/upcycling (skipped for garment queries) */
  is_garment?: boolean;
  /** provenance — "kaphor_artisan_library" | "youtube" | ... */
  source?: string;
  /** YouTube video id when the guide was derived from a tutorial */
  source_id?: string;
  source_url?: string;
}

export interface T5GuideCondensed {
  doc_type: string;
  title: string;
  difficulty: string;
  time_minutes: number;
  technique_style: string;
  tools_required: string[];
  steps: string[];         // Full instructions for quick view
  detailed_steps?: T5Step[];
  pro_tip?: string;
  care_instructions?: string;
  upcycle_alternative?: string;
  quality_score: number;
  source?: string;
  source_id?: string;
  source_url?: string;
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

  // T5.json keys are numeric strings "0".."61" or array elements
  for (const key of Object.keys(data)) {
    const doc = data[key];
    if (!doc || !doc.doc_id) continue;

    const rawTech = Array.isArray(doc.technique_style) ? doc.technique_style[0] : (doc.technique_style || '');
    const cleanTech = cleanTechniqueName(rawTech);

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
      technique_style: cleanTech,
      pro_tip: doc.pro_tip || '',
      care_instructions: doc.care_instructions || '',
      upcycle_alternative: doc.upcycle_alternative || '',
      // Non-garment upcycling docs (furniture, bottles, pallets) carry no
      // real fiber — mark them so they never surface for garment assessments.
      is_garment: (doc.fiber_types || doc.fiber_type || []).some((f: string) =>
        typeof f === 'string' && isKnownFiber(f)
      ),
    };
// Estimate quality score based on number of steps + specificity
      const stepsScore = Math.min(1, (guide.steps?.length || 0) / 10);
      const haveTools = guide.tools_required?.length > 0 ? 0.2 : 0;
      const hasFiber = guide.fiber_types?.length > 0 ? 0.1 : 0;
      guide.quality_score = Math.round((stepsScore + haveTools + hasFiber) * 1000) / 1000;

      guide.source = doc.source || '';
      guide.source_id = doc.source_id || '';
      guide.source_url = doc.source_url || '';

    guideDocs.push(guide);
    qualityMap.set(guide.doc_id, guide.quality_score);
  }

  logger.info(`[GLIE/T5] Loaded ${guideDocs.length} guides`);
}

interface GuideMatch {
  guide: T5Guide;
  score: number;
}

/**
 * Score guides by fiber + damage + category overlap (skipping non-garment docs).
 * Returns matches sorted by relevance descending.
 */
function rankGuides(
  fiber: string,
  damageTypes: string[],
  category: string,
  guides: T5Guide[],
): GuideMatch[] {
  const fiberKey = normalize(fiber);
  const categoryKey = normalize(category);
  const damageKeys = damageTypes.map(d => normalize(d));

  return guides
    .filter(g => g.is_garment !== false)
    .map(guide => {
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
        return damageKeys.some(dk => dk && (gdk === dk || gdk.includes(dk) || dk.includes(gdk)));
      });
      if (damageMatch) score += 0.30;

      // Category match (weight: 20%)
      const catMatch = guide.garment_categories.some(gc => {
        const gck = normalize(gc);
        return gck === categoryKey || gck.includes(categoryKey) || categoryKey.includes(gck);
      }) || categoryKey === 'other' || categoryKey === '';
      if (catMatch) score += 0.20;

      // Only award quality bonus if at least one semantic criteria matched
      const hasCriteriaMatch = fiberMatch || damageMatch || catMatch;
      if (!hasCriteriaMatch) {
        return { guide, score: 0 };
      }

      // Quality bonus (weight: 10%)
      score += (guide.quality_score || 0) * 0.10;

      return { guide, score };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Condense a full guide into the lightweight shape returned to clients
 */
function toCondensed(guide: T5Guide): T5GuideCondensed {
  return {
    doc_type: guide.doc_type,
    title: guide.title,
    difficulty: guide.difficulty,
    time_minutes: guide.time_minutes,
    technique_style: guide.technique_style || mapDocType(guide.doc_type),
    tools_required: guide.tools_required || [],
    steps: (guide.steps || []).map(s =>
      typeof s === 'string' ? s : (s.instruction || s.tip || '')
    ),
    detailed_steps: guide.steps || [],
    pro_tip: guide.pro_tip || '',
    care_instructions: guide.care_instructions || '',
    upcycle_alternative: guide.upcycle_alternative || '',
    quality_score: guide.quality_score || 0,
    source: guide.source || '',
    source_id: guide.source_id || '',
    source_url: guide.source_url || '',
  };
}

/**
 * Query T5 — filter by fiber + damage + category + optional docType, return top 5 condensed guides
 */
export function queryT5(
  fiber: string,
  damageTypes: string[],
  category: string,
  docType?: 'repair' | 'upcycle',
): T5GuideCondensed[] {
  if (!guideDocs) loadT5();
  if (!guideDocs || guideDocs.length === 0) return [];

  let pool = guideDocs;
  if (docType === 'repair') {
    pool = guideDocs.filter(g => g.doc_type !== 'upcycle');
  } else if (docType === 'upcycle') {
    pool = guideDocs.filter(g => g.doc_type === 'upcycle');
  }

  const sorted = rankGuides(fiber, damageTypes, category, pool);
  const relevant = sorted.filter(s => s.score > 0);
  const top5 = relevant.slice(0, 5);

  return top5.map(({ guide }) => toCondensed(guide));
}

/**
 * Reading list — curated real blog articles (source === 'blog') users can open
 * in a browser. Real article titles + URLs, attributed and ToS-clean.
 * Best matches first, padded with a general set so the block is never empty.
 */
export function queryBlogReads(
  fiber: string,
  damageTypes: string[],
  category: string,
  limit = 6,
  docType?: 'repair' | 'upcycle',
): T5GuideCondensed[] {
  if (!guideDocs) loadT5();
  if (!guideDocs || guideDocs.length === 0) return [];

  let blogDocs = guideDocs.filter(g => g.source === 'blog');
  if (docType === 'repair') {
    blogDocs = blogDocs.filter(g => g.doc_type !== 'upcycle');
  } else if (docType === 'upcycle') {
    blogDocs = blogDocs.filter(g => g.doc_type === 'upcycle');
  }
  if (blogDocs.length === 0) return [];

  const picked: T5Guide[] = [];
  const seen = new Set<string>();
  const addDoc = (g: T5Guide) => {
    if (seen.has(g.doc_id)) return;
    seen.add(g.doc_id);
    picked.push(g);
  };

  // 1) Spec-matched articles, best relevance first
  const queryDamages = docType === 'upcycle' ? [] : damageTypes;
  const relevant = rankGuides(fiber, queryDamages, category, blogDocs);
  for (const { guide } of relevant) addDoc(guide);

  // 2) Pad with general articles so we always return a curated reading set
  for (const g of blogDocs) {
    if (picked.length >= limit) break;
    addDoc(g);
  }

  return picked.slice(0, limit).map(toCondensed);
}

function cleanTechniqueName(tech: string): string {
  const map: Record<string, string> = {
    plain_repair: 'Invisible Hand Mending',
    embroidery: 'Embroidery Thread Restoration',
    block_print: 'Artisan Block Printing',
    zari: 'Zari Metallic Couching',
    patchwork: 'Sashiko & Fabric Patchwork',
    kantha: 'Traditional Kantha Reinforcement',
    upcycling: 'Circular Haute Upcycling',
  };
  return map[tech] || (tech ? tech.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Artisan Technique');
}

function mapDocType(docType: string): string {
  const map: Record<string, string> = {
    repair: 'Repair & Mend',
    upcycle: 'Upcycle Transformation',
    restore: 'Restoration',
  };
  return map[docType] || 'General Technique';
}
