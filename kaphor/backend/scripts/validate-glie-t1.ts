/**
 * Stage 2 — GLIE formula validation with train/test split.
 *
 * Reads data/T1_glie_raw.jsonl (Stage 1 Groq annotations) and:
 *  1. Splits rows deterministically (FNV-1a hash of filename) into
 *     train (~80%) and test (~20%) — the test fraction stays "unseen".
 *  2. Writes data/T1_glie.csv (full dataset + split column) matching the
 *     production T1.csv column layout so loadT1() can ingest it.
 *  3. For every row, computes formula routing using the REAL production
 *     loaders — lookupT2 / lookupT4 / queryT3 — and the pure formulas
 *     from services/glie/formulas.ts. No approximated sub-scores.
 *  4. Train set: formula routing vs the annotation's independent ai_routing
 *     → data/T1_glie_validation.json
 *  5. Test set: a FRESH Gemini vision judgment (Gemini never sees the Groq
 *     annotation — independent opinion on unseen data) compared against
 *     both the formula and the Groq annotation
 *     → data/T1_glie_test_validation.json
 *
 * Env: TEST_LIMIT to cap Gemini calls on the test set (smoke testing).
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { generateWithGemini } from '../src/services/gemini.service';
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
const SPLIT_OUT = path.join(DATA_DIR, 'T1_glie_split.json');
const TRAIN_REPORT = path.join(DATA_DIR, 'T1_glie_validation.json');
const TEST_REPORT = path.join(DATA_DIR, 'T1_glie_test_validation.json');
const GEMINI_CACHE = path.join(DATA_DIR, 'T1_glie_gemini_cache.jsonl');
const IMAGE_DIR = path.resolve(__dirname, '../../../docs/glie-images');

// ── Stage 1 prompt (identical to generate-t1-from-glie-images.ts) ────────────
// Gemini judges with the SAME rubric but NO access to the Groq annotation.

const CATEGORY_ENUM = [
  'kurta', 'saree', 'jeans', 'jacket', 'trousers', 'shirt', 'tshirt',
  'dress', 'blouse', 'lehenga', 'sweater', 'socks', 'skirt', 'hoodie',
  'top', 'sweatshirt', 'palazzo', 'dupatta', 'kurti', 'other',
];
const LOCATIONS = ['overall', 'sleeve', 'hem', 'collar', 'pocket', 'knee', 'back', 'front', 'cuffs', 'seam'];
const DAMAGE_TYPES = ['none', 'tear', 'hole', 'stain', 'fading', 'pilling', 'broken_zip', 'loose_threads', 'seam_split', 'bleaching', 'snag', 'color_transfer'];

const SYSTEM_PROMPT = `You are a garment condition assessor for a circular-fashion platform.

Evaluate the garment in the photo and return STRICT JSON. No markdown, no prose.
Only a single JSON object with exactly these fields:
{
  "garment_category": one of ${CATEGORY_ENUM.join('|')},
  "garment_subcategory": "short subtype, e.g. slim-fit jeans / A-line dress / crew-neck tee",
  "fiber": "most likely fabric composition, e.g. cotton, denim, silk, polyester, wool, linen",
  "photo_angle": "front | back | side | detail | flat",
  "damage_ratio": 0-1 fraction of surface area with physical damage (rips, holes, broken seams, pilling),
  "stain_ratio": 0-1 fraction of surface with stains or discoloration,
  "wear_zone_ratio": 0-1 fraction of high-wear zones (knees, elbows, cuffs, hems, collar) showing wear,
  "fiber_degradation": 0-1 severity of fiber breakdown, thinning, tear-resistance loss, snags,
  "damage_types": array from [${DAMAGE_TYPES.join(', ')}],
  "damage_location": one of ${LOCATIONS.join('|')},
  "condition_score": 0-1 overall score. Rubric: 1.00=like_new no visible wear; 0.80-0.95=like_new faint signs; 0.70-0.79=good light wear; 0.55-0.69=fair visible tear/stain but wearable; 0.40-0.54=fair significant wear-zone damage; 0.25-0.39=poor heavily damaged; 0.05-0.24=destroyed. Be honest - visible damage must lower the score.
  "human_condition_label": one of [like_new, good, fair, poor, destroyed] consistent with condition_score,
  "ai_routing": one of [RESELL, UPCYCLE, RECYCLE] - your INDEPENDENT routing opinion based ONLY on what the photo shows: RESELL if good/excellent shape and clearly resale-able; UPCYCLE if damaged but a valuable/upcyclable material (denim, cotton, silk, wool, linen, jersey) with usable panels, or minor damage; RECYCLE if destroyed/rotted (very low condition) or a cheap low-value fiber with heavy damage beyond economical upcycle,
  "routing_confidence": 0-1 float for how sure you are about ai_routing given image quality and ambiguity,
  "description": "one sentence covering garment + condition"
}

Rules:
- condition_score must stay internally consistent with damage_ratio + stain_ratio + wear_zone_ratio + fiber_degradation (higher damage -> lower score). Default all ratios to 0 for a pristine item.
- When the photo is a collage, tutorial screenshot or shows multiple garments, assess the MAIN garment honestly and lower routing_confidence.
- Never fabricate condition when the item looks clean - use 1.0/like_new only when there is no visible wear.`;

// ── Types ────────────────────────────────────────────────────────────────────

interface RawRow {
  file: string;
  model: string;
  garment_category: string;
  garment_subcategory: string;
  fiber: string;
  photo_angle: string;
  damage_ratio: number;
  stain_ratio: number;
  wear_zone_ratio: number;
  fiber_degradation: number;
  damage_types: string[];
  damage_location: string;
  condition_score: number;
  human_condition_label: string;
  ai_routing: 'RESELL' | 'UPCYCLE' | 'RECYCLE';
  routing_confidence: number;
  description: string;
}

type Split = 'train' | 'test';

interface FormulaResult {
  fiber_resolved: string | null;
  t2_found: boolean;
  t4_found: boolean;
  market_listings: number;
  ms: number;
  mds: number;
  ss: number;
  glie: number;
  formula_routing: 'RESELL' | 'UPCYCLE' | 'RECYCLE';
}

interface ReportRow extends RawRow {
  split: Split;
  ai_confidence: number;
  formula: FormulaResult;
  formula_routing: 'RESELL' | 'UPCYCLE' | 'RECYCLE';
  agree: boolean;
}

interface GeminiJudgment {
  model: string;
  garment_category: string;
  fiber: string;
  condition_score: number;
  human_condition_label: string;
  ai_routing: 'RESELL' | 'UPCYCLE' | 'RECYCLE';
  routing_confidence: number;
  description: string;
}

// ── Split (deterministic) ────────────────────────────────────────────────────

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function splitFor(file: string): Split {
  return (fnv1a(file) % 100) < 80 ? 'train' : 'test';
}

// ── Formula evaluation with REAL loaders ─────────────────────────────────────

function evaluateFormula(row: Pick<RawRow, 'fiber' | 'garment_category' | 'condition_score'>): FormulaResult {
  const fiberResolved = resolveFiber(row.fiber);
  const fiberKey = fiberResolved || row.fiber;

  const t2 = lookupT2(fiberKey);
  const t4 = lookupT4(fiberKey);

  // Mirror assessGarment(): defaults when T2 missing
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

  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  return {
    fiber_resolved: fiberResolved,
    t2_found: !!t2,
    t4_found: !!t4,
    market_listings: marketStats?.total_listings_matched ?? 0,
    ms: r4(ms),
    mds: r4(mds),
    ss: r4(ss),
    glie: r4(glie),
    formula_routing: routing,
  };
}

// ── Gemini fresh judgment (test fraction only) ───────────────────────────────

function parseJudgment(text: string): Omit<GeminiJudgment, 'model'> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const p = JSON.parse(match[0]);
    const num = (v: any, d: number): number => {
      const n = Number(v);
      return isNaN(n) ? d : Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
    };
    const routing = String(p.ai_routing || '').toUpperCase().trim();
    if (!['RESELL', 'UPCYCLE', 'RECYCLE'].includes(routing)) return null;
    return {
      garment_category: CATEGORY_ENUM.includes(String(p.garment_category || '').toLowerCase())
        ? String(p.garment_category).toLowerCase()
        : 'other',
      fiber: String(p.fiber || '').trim().toLowerCase() || 'cotton',
      condition_score: num(p.condition_score, 0.5),
      human_condition_label: String(p.human_condition_label || 'fair').toLowerCase().trim(),
      ai_routing: routing as GeminiJudgment['ai_routing'],
      routing_confidence: num(p.routing_confidence, 0.5),
      description: String(p.description || '').trim(),
    };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cache so re-runs skip already-judged images (judgments are fresh+independent
// per image, so reusing a completed judgment is safe).
function loadGeminiCache(): Map<string, GeminiJudgment> {
  const cache = new Map<string, GeminiJudgment>();
  if (!fs.existsSync(GEMINI_CACHE)) return cache;
  for (const line of fs.readFileSync(GEMINI_CACHE, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.file && rec.judgment) cache.set(rec.file, rec.judgment);
    } catch { /* ignore corrupt trailing line */ }
  }
  return cache;
}

async function geminiJudge(file: string, cache: Map<string, GeminiJudgment>): Promise<GeminiJudgment> {
  const cached = cache.get(file);
  if (cached) return cached;
  const base64 = fs.readFileSync(path.join(IMAGE_DIR, file)).toString('base64');
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await generateWithGemini(
        [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: `${SYSTEM_PROMPT}\n\nAssess this garment now. Respond with ONLY the JSON object.` },
        ],
        { temperature: 0.1, maxOutputTokens: 1000 },
      );
      const parsed = parseJudgment(text);
      if (!parsed) throw new Error('Unparseable or incomplete JSON');
      const judgment: GeminiJudgment = { model: 'gemini-fresh', ...parsed };
      fs.appendFileSync(GEMINI_CACHE, JSON.stringify({ file, judgment }) + '\n', 'utf-8');
      cache.set(file, judgment);
      return judgment;
    } catch (err: any) {
      lastErr = err;
      if (attempt < 2) await sleep(2000);
    }
  }
  throw lastErr || new Error('Gemini judgment failed');
}

// ── CSV output (production T1.csv layout + split column) ─────────────────────

const HEADER = [
  'garment_id', 'photo_id', 'image_url', 'photo_angle', 'garment_category',
  'garment_subcategory', 'brand', 'original_price_inr', 'age_months',
  'times_worn', 'damage_ratio', 'stain_ratio', 'wear_zone_ratio',
  'fiber_degradation', 'damage_types', 'damage_location', 'condition_score',
  'human_condition_label', 'glie_routing', 'annotator_id',
  'annotation_confidence', 'split', 'formula_routing',
];

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// ── Reports ──────────────────────────────────────────────────────────────────

interface Summary {
  total: number;
  agreement_rate: number;
  agreement_matrix: Record<string, Record<string, number>>;
  per_routing_agreement: Record<string, { total: number; agreed: number; rate: number }>;
  condition_mae: number;
  high_risk_disagreements: number;
}

function buildSummary(rows: ReportRow[]): Summary {
  const matrix: Record<string, Record<string, number>> = {
    RESELL: { RESELL: 0, UPCYCLE: 0, RECYCLE: 0 },
    UPCYCLE: { RESELL: 0, UPCYCLE: 0, RECYCLE: 0 },
    RECYCLE: { RESELL: 0, UPCYCLE: 0, RECYCLE: 0 },
  };
  const per: Record<string, { total: number; agreed: number }> = {
    RESELL: { total: 0, agreed: 0 },
    UPCYCLE: { total: 0, agreed: 0 },
    RECYCLE: { total: 0, agreed: 0 },
  };
  let csErrSum = 0;
  let highRisk = 0;

  for (const r of rows) {
    matrix[r.ai_routing][r.formula_routing]++;
    per[r.ai_routing].total++;
    if (r.agree) per[r.ai_routing].agreed++;
    csErrSum += Math.abs(r.condition_score - r.formula.glie);
    if (r.ai_routing === 'RECYCLE' && r.formula_routing !== 'RECYCLE') highRisk++;
  }

  const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 1000 : 0);
  return {
    total: rows.length,
    agreement_rate: rate(per.RESELL.agreed + per.UPCYCLE.agreed + per.RECYCLE.agreed, rows.length),
    agreement_matrix: matrix,
    per_routing_agreement: {
      RESELL: { ...per.RESELL, rate: rate(per.RESELL.agreed, per.RESELL.total) },
      UPCYCLE: { ...per.UPCYCLE, rate: rate(per.UPCYCLE.agreed, per.UPCYCLE.total) },
      RECYCLE: { ...per.RECYCLE, rate: rate(per.RECYCLE.agreed, per.RECYCLE.total) },
    },
    condition_mae: rows.length ? Math.round((csErrSum / rows.length) * 1000) / 1000 : 0,
    high_risk_disagreements: highRisk,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(RAW)) {
    console.error(`Raw annotations not found: ${RAW}\nRun generate-t1-from-glie-images.ts first.`);
    process.exit(1);
  }

  const rows: RawRow[] = fs.readFileSync(RAW, 'utf-8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as RawRow)
    .filter((r) => !!r.file);

  console.log(`Loaded ${rows.length} annotated rows`);

  // 1. Deterministic split
  const splitMap = new Map<string, Split>();
  for (const r of rows) splitMap.set(r.file, splitFor(r.file));
  const trainFiles = rows.filter((r) => splitMap.get(r.file) === 'train').map((r) => r.file);
  const testFiles = rows.filter((r) => splitMap.get(r.file) === 'test').map((r) => r.file);
  fs.writeFileSync(SPLIT_OUT, JSON.stringify({
    method: 'fnv1a(filename) % 100 < 80',
    generated_at: new Date().toISOString(),
    counts: { train: trainFiles.length, test: testFiles.length },
    train: trainFiles,
    test: testFiles,
  }, null, 2));
  console.log(`Split: ${trainFiles.length} train / ${testFiles.length} test -> ${path.basename(SPLIT_OUT)}`);

  // 2. Formula evaluation for every row (before CSV so formula_routing is
  //    written in-place rather than patched via split(','), which breaks on
  //    quoted fields containing commas)
  const reportRows: ReportRow[] = [];
  for (const r of rows) {
    const formula = evaluateFormula(r);
    reportRows.push({
      ...r,
      split: splitMap.get(r.file)!,
      ai_confidence: r.routing_confidence,
      formula,
      formula_routing: formula.formula_routing,
      agree: formula.formula_routing === r.ai_routing,
    });
  }

  // 3. CSV (full dataset + split column)
  const csvLines: string[] = [HEADER.join(',')];
  reportRows.forEach((r, i) => {
    const id = `glie_${String(i + 1).padStart(4, '0')}`;
    // T1.csv has no fiber column — fold it into subcategory like loadT1 expects
    const subcat = csvEscape(`${r.garment_subcategory} (${r.fiber})`.trim());
    csvLines.push([
      id, id, csvEscape(r.file), r.photo_angle, r.garment_category, subcat,
      'Unbranded', '', '', '',
      r.damage_ratio, r.stain_ratio, r.wear_zone_ratio, r.fiber_degradation,
      csvEscape(r.damage_types.join(' ')), r.damage_location,
      r.condition_score, r.human_condition_label, r.ai_routing,
      `glie_${r.model}`, r.routing_confidence,
      r.split, r.formula_routing,
    ].join(','));
  });
  fs.writeFileSync(CSV_OUT, csvLines.join('\n') + '\n');
  console.log(`Wrote ${rows.length} rows -> ${path.basename(CSV_OUT)}`);

  // 4. Train report — formula vs Groq annotation
  const trainRows = reportRows.filter((r) => r.split === 'train');
  const trainSummary = buildSummary(trainRows);
  fs.writeFileSync(TRAIN_REPORT, JSON.stringify({
    ...trainSummary,
    note: 'formula (real T2/T3/T4 loaders) vs Stage-1 Groq ai_routing',
    rows: trainRows.map((r) => ({
      image: r.file,
      garment_category: r.garment_category,
      fiber: r.fiber,
      condition_score: r.condition_score,
      ai_routing: r.ai_routing,
      ai_confidence: r.ai_confidence,
      formula_routing: r.formula_routing,
      glie_score: r.formula.glie,
      ms: r.formula.ms, mds: r.formula.mds, ss: r.formula.ss,
      t2_found: r.formula.t2_found,
      t4_found: r.formula.t4_found,
      market_listings: r.formula.market_listings,
      agree: r.agree,
    })),
  }, null, 2));
  console.log(`\n=== TRAIN (formula vs Groq) ===`);
  console.log(JSON.stringify(trainSummary, null, 2));

  // 5. Test report — fresh Gemini judgment on unseen images
  const testRows = reportRows.filter((r) => r.split === 'test');
  const testLimit = Number(process.env.TEST_LIMIT || 0);
  const testQueue = testLimit > 0 ? testRows.slice(0, testLimit) : testRows;
  console.log(`\nGemini judging ${testQueue.length} unseen test images...`);

  const judged: Array<ReportRow & { gemini: GeminiJudgment }> = [];
  let geminiFailed = 0;
  const cache = loadGeminiCache();
  const preCached = testQueue.filter((r) => cache.has(r.file)).length;
  if (preCached > 0) console.log(`(resuming: ${preCached} judgments already cached)`);
  for (let i = 0; i < testQueue.length; i++) {
    const row = testQueue[i];
    const wasNew = !cache.has(row.file);
    try {
      const gemini = await geminiJudge(row.file, cache);
      judged.push({ ...row, gemini });
      console.log(`[${i + 1}/${testQueue.length}] ${row.file}: gemini=${gemini.ai_routing} formula=${row.formula_routing} groq=${row.ai_routing}`);
    } catch (err: any) {
      geminiFailed++;
      console.error(`[${i + 1}/${testQueue.length}] Gemini failed for ${row.file}: ${err.message}`);
    }
    if (wasNew && i < testQueue.length - 1) await sleep(60000);
  }

  const geminiAgreeFormula = judged.filter((j) => j.gemini.ai_routing === j.formula_routing).length;
  const geminiAgreeGroq = judged.filter((j) => j.gemini.ai_routing === j.ai_routing).length;
  const csAgree = judged.filter((j) => Math.abs(j.gemini.condition_score - j.condition_score) <= 0.1).length;
  const csMae = judged.length
    ? Math.round((judged.reduce((s, j) => s + Math.abs(j.gemini.condition_score - j.condition_score), 0) / judged.length) * 1000) / 1000
    : 0;

  fs.writeFileSync(TEST_REPORT, JSON.stringify({
    total_test_rows: testRows.length,
    gemini_judged: judged.length,
    gemini_failed: geminiFailed,
    gemini_vs_formula_agreement: judged.length ? Math.round((geminiAgreeFormula / judged.length) * 1000) / 1000 : 0,
    gemini_vs_groq_agreement: judged.length ? Math.round((geminiAgreeGroq / judged.length) * 1000) / 1000 : 0,
    condition_agreement_within_0_1: judged.length ? Math.round((csAgree / judged.length) * 1000) / 1000 : 0,
    condition_mae_gemini_vs_groq: csMae,
    note: 'Fresh Gemini judgment on unseen test fraction — Gemini never saw the Groq annotation',
    rows: judged.map((j) => ({
      image: j.file,
      gemini: {
        condition_score: j.gemini.condition_score,
        routing: j.gemini.ai_routing,
        confidence: j.gemini.routing_confidence,
        fiber: j.gemini.fiber,
        category: j.gemini.garment_category,
      },
      groq_annotation: {
        condition_score: j.condition_score,
        routing: j.ai_routing,
        confidence: j.ai_confidence,
        fiber: j.fiber,
        category: j.garment_category,
      },
      formula: {
        routing: j.formula_routing,
        glie_score: j.formula.glie,
        ms: j.formula.ms, mds: j.formula.mds, ss: j.formula.ss,
        fiber_resolved: j.formula.fiber_resolved,
        market_listings: j.formula.market_listings,
      },
      gemini_agrees_formula: j.gemini.ai_routing === j.formula_routing,
      gemini_agrees_groq: j.gemini.ai_routing === j.ai_routing,
      formula_agrees_groq: j.agree,
    })),
  }, null, 2));
  console.log(`\n=== TEST (unseen, Gemini fresh judgment) ===`);
  console.log(`judged=${judged.length}/${testRows.length} failed=${geminiFailed}`);
  console.log(`Gemini vs formula agreement: ${geminiAgreeFormula}/${judged.length}`);
  console.log(`Gemini vs Groq agreement:    ${geminiAgreeGroq}/${judged.length}`);
  console.log(`Condition MAE (gemini-groq): ${csMae}`);
  console.log(`Wrote -> ${path.basename(TEST_REPORT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
