/**
 * Stage 1 — T1 dataset generation from the GLIE image corpus.
 *
 * Reads every image in docs/glie-images, sends each through Groq vision
 * (generateWithGroqVision — multi-key rotation + backoff) and asks the model
 * to produce a full T1 annotation row per docs/PROMPT_T1_DATASET_AND_VALIDATION.md.
 *
 * IMPORTANT: Gemini is NOT used here — it is reserved for independent
 * validation of the held-out test fraction (see validate-glie-t1.ts).
 *
 * Output: data/T1_glie_raw.jsonl — one JSON record per image, appended
 * incrementally so the run is resumable (already-annotated files are skipped).
 *
 * Env:
 *   PACE_MS  delay between image calls (default 3000)
 *   LIMIT    process at most N not-yet-done images (smoke testing)
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { generateWithGroqVision } from '../src/services/groq.service';

const IMAGE_DIR = path.resolve(__dirname, '../../../docs/glie-images');
const OUT = path.resolve(__dirname, '../data/T1_glie_raw.jsonl');

interface VisionRow {
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

const CATEGORY_ENUM = [
  'kurta', 'saree', 'jeans', 'jacket', 'trousers', 'shirt', 'tshirt',
  'dress', 'blouse', 'lehenga', 'sweater', 'socks', 'skirt', 'hoodie',
  'top', 'sweatshirt', 'palazzo', 'dupatta', 'kurti', 'other',
];

const LOCATIONS = ['overall', 'sleeve', 'hem', 'collar', 'pocket', 'knee', 'back', 'front', 'cuffs', 'seam'];

const DAMAGE_TYPES = ['none', 'tear', 'hole', 'stain', 'fading', 'pilling', 'broken_zip', 'loose_threads', 'seam_split', 'bleaching', 'snag', 'color_transfer'];

// Stage-1 annotation prompt from docs/PROMPT_T1_DATASET_AND_VALIDATION.md
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function parseJson(text: string): Omit<VisionRow, 'file' | 'model'> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const p = JSON.parse(match[0]);
    const num = (v: any, d = 0): number => {
      const n = Number(v);
      return isNaN(n) ? d : clamp(n, 0, 1);
    };
    const category = String(p.garment_category || 'other').toLowerCase().trim();
    const routing = String(p.ai_routing || '').toUpperCase().trim();
    const damageTypes = Array.isArray(p.damage_types)
      ? p.damage_types.map(String).map((s: string) => s.trim().toLowerCase()).filter((s: string) => DAMAGE_TYPES.includes(s))
      : [];
    return {
      garment_category: CATEGORY_ENUM.includes(category) ? category : 'other',
      garment_subcategory: String(p.garment_subcategory || '').trim(),
      fiber: String(p.fiber || '').trim().toLowerCase() || 'cotton',
      photo_angle: String(p.photo_angle || 'front').trim().toLowerCase(),
      damage_ratio: num(p.damage_ratio),
      stain_ratio: num(p.stain_ratio),
      wear_zone_ratio: num(p.wear_zone_ratio),
      fiber_degradation: num(p.fiber_degradation),
      damage_types: damageTypes.length ? damageTypes : ['none'],
      damage_location: LOCATIONS.includes(String(p.damage_location || '').toLowerCase().trim())
        ? String(p.damage_location).toLowerCase().trim()
        : 'overall',
      condition_score: num(p.condition_score, 0.5),
      human_condition_label: String(p.human_condition_label || 'fair').toLowerCase().trim(),
      ai_routing: ['RESELL', 'UPCYCLE', 'RECYCLE'].includes(routing)
        ? routing as VisionRow['ai_routing']
        : 'UPCYCLE',
      routing_confidence: num(p.routing_confidence, 0.5),
      description: String(p.description || '').trim(),
    };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function annotateOne(file: string): Promise<Omit<VisionRow, 'file' | 'model'>> {
  const base64 = fs.readFileSync(path.join(IMAGE_DIR, file)).toString('base64');

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await generateWithGroqVision(
        SYSTEM_PROMPT,
        attempt === 1
          ? 'Assess this garment now. Respond with ONLY the JSON object.'
          : 'Your previous reply was not parseable JSON. Respond again with ONLY the raw JSON object, no prose.',
        base64,
        { temperature: 0.1, maxTokens: 1000 },
      );
      const row = parseJson(text);
      if (!row) throw new Error('Unparseable JSON response');
      return row;
    } catch (err: any) {
      lastErr = err;
      if (attempt < 2) await sleep(2000);
    }
  }
  throw lastErr || new Error('Annotation failed');
}

function loadDoneFiles(): Set<string> {
  const done = new Set<string>();
  if (!fs.existsSync(OUT)) return done;
  for (const line of fs.readFileSync(OUT, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.file) done.add(rec.file);
    } catch { /* ignore corrupt trailing line */ }
  }
  return done;
}

function collectImages(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? path.join(base, entry.name) : entry.name;
    if (entry.isDirectory()) {
      out.push(...collectImages(path.join(dir, entry.name), rel));
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name) && entry.isFile()) {
      out.push(rel.split(path.sep).join('/'));
    }
  }
  return out;
}

async function main() {
  if (!fs.existsSync(IMAGE_DIR)) {
    console.error(`Image dir not found: ${IMAGE_DIR}`);
    process.exit(1);
  }

  const files = collectImages(IMAGE_DIR, '')
    .sort();

  const done = loadDoneFiles();
  const pending = files.filter((f) => !done.has(f));
  const limit = Number(process.env.LIMIT || 0);
  const queue = limit > 0 ? pending.slice(0, limit) : pending;
  const paceMs = Number(process.env.PACE_MS || 3000);

  console.log(`Images: ${files.length} total, ${done.size} already done, ${queue.length} to annotate (pace ${paceMs}ms)`);

  let ok = 0;
  let failed = 0;
  const failedFiles: string[] = [];

  for (let i = 0; i < queue.length; i++) {
    const file = queue[i];
    try {
      const row = await annotateOne(file);
      const record: VisionRow = { file, model: 'groq-vision', ...row };
      fs.appendFileSync(OUT, JSON.stringify(record) + '\n', 'utf-8');
      ok++;
      console.log(`[${i + 1}/${queue.length}] OK ${file} -> ${row.garment_category}/${row.fiber} cs=${row.condition_score} ${row.human_condition_label} ${row.ai_routing}`);
    } catch (err: any) {
      failed++;
      failedFiles.push(file);
      console.error(`[${i + 1}/${queue.length}] FAILED ${file}: ${err.message}`);
    }
    if (i < queue.length - 1) await sleep(paceMs);
  }

  console.log(`\nDone. ok=${ok} failed=${failed} total_annotated=${done.size + ok}/${files.length}`);
  if (failedFiles.length) console.log(`Failed files (re-run to retry): ${failedFiles.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
