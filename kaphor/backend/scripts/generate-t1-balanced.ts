/**
 * Generate a balanced T1 calibration set programmatically.
 *
 * The real T1.csv (10,050 rows) is 71% like_new with zero poor/destroyed
 * samples, so Gemini's few-shot calibration is starved of realistic damage
 * examples. This generator produces a deterministic 7-band × 8-fiber × 10-category
 * grid (560 rows) where every condition band is equally represented and each
 * row's damage ratios are internally consistent with its condition score,
 * following the scoring rubric used in prompt-builder.ts.
 *
 * Output: kaphor/backend/data/T1_balanced.csv
 */
import * as fs from 'fs';
import * as path from 'path';

const OUT = path.resolve(__dirname, '../data/T1_balanced.csv');

interface Band {
  cs: number;
  label: string;
  damage: number;   // damage_ratio
  stain: number;    // stain_ratio
  wear: number;     // wear_zone_ratio
  fiberD: number;   // fiber_degradation
  types: string[];  // damage_types
}

const BANDS: Band[] = [
  { cs: 1.00, label: 'like_new', damage: 0.00, stain: 0.00, wear: 0.00, fiberD: 0.00, types: ['none'] },
  { cs: 0.85, label: 'like_new', damage: 0.02, stain: 0.02, wear: 0.05, fiberD: 0.03, types: ['none'] },
  { cs: 0.70, label: 'good',     damage: 0.06, stain: 0.08, wear: 0.12, fiberD: 0.10, types: ['pilling', 'fading'] },
  { cs: 0.55, label: 'fair',     damage: 0.16, stain: 0.20, wear: 0.18, fiberD: 0.20, types: ['tear', 'stain', 'fading'] },
  { cs: 0.40, label: 'fair',     damage: 0.40, stain: 0.35, wear: 0.30, fiberD: 0.35, types: ['tear', 'hole', 'stain'] },
  { cs: 0.25, label: 'fair',     damage: 0.70, stain: 0.50, wear: 0.50, fiberD: 0.55, types: ['hole', 'tear', 'stain', 'broken_zip'] },
  { cs: 0.10, label: 'fair',     damage: 0.90, stain: 0.70, wear: 0.80, fiberD: 0.80, types: ['hole', 'tear', 'stain'] },
];

// Fiber → material_score (approximation used only to derive the routing label)
const FIBERS: Array<{ fiber: string; subcategory: string; ms: number }> = [
  { fiber: 'Standard Cotton',     subcategory: 'Cotton',       ms: 0.55 },
  { fiber: 'Mulberry Silk',       subcategory: 'Silk',         ms: 0.90 },
  { fiber: 'Wool',                subcategory: 'Merino Wool',  ms: 0.85 },
  { fiber: 'Linen',               subcategory: 'Linen',        ms: 0.80 },
  { fiber: 'Recycled Polyester',  subcategory: 'Recycled Poly',ms: 0.60 },
  { fiber: 'Polyester',           subcategory: 'Polyester',    ms: 0.30 },
  { fiber: 'Nylon',               subcategory: 'Nylon',        ms: 0.35 },
  { fiber: 'Viscose',             subcategory: 'Viscose',      ms: 0.50 },
];

const CATEGORIES = [
  'kurta', 'saree', 'jeans', 'jacket', 'trousers',
  'shirt', 'tshirt', 'dress', 'blouse', 'lehenga',
];

const LOCATIONS = ['overall', 'sleeve', 'hem', 'collar', 'pocket', 'knee', 'back'];
const BRANDS = ['Unbranded', 'Nexa', 'Udyog', 'Zudio', 'Urbanic', 'FabIndia', 'H&M', 'Zara'];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function roundN(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function routing(cs: number, ms: number): 'RESELL' | 'UPCYCLE' | 'RECYCLE' {
  const glie = 0.35 * cs + 0.25 * ms + 0.20; // MDS=0.5, SS=0.5 (deterministic constants)
  if (glie >= 0.63) return 'RESELL';
  if (glie >= 0.50 || cs >= 0.45) return 'UPCYCLE';
  return 'RECYCLE';
}

function uuid(): string {
  const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`;
}

const HEADER = [
  'garment_id', 'photo_id', 'image_url', 'photo_angle', 'garment_category',
  'garment_subcategory', 'fiber', 'brand', 'original_price_inr', 'age_months',
  'times_worn', 'damage_ratio', 'stain_ratio', 'wear_zone_ratio', 'fiber_degradation',
  'damage_types', 'damage_location', 'condition_score', 'human_condition_label',
  'glie_routing', 'annotator_id', 'annotation_confidence',
];

const rows: string[] = [HEADER.join(',')];
let total = 0;
const bandCount: Record<string, number> = {};
const routeCount: Record<string, number> = {};

for (const band of BANDS) {
  for (const cat of CATEGORIES) {
    for (const f of FIBERS) {
      // Deterministic-ish noise: derived from a stable seed per (band,cat,fiber)
      const seed = (BANDS.indexOf(band) * 80 + CATEGORIES.indexOf(cat) * 8 + FIBERS.indexOf(f)) % 1000;
      const n = (seed % 10) / 100; // 0.00..0.09 noise
      const csOffset = seed % 2 === 0 ? n : -n;

      const cs = roundN(clamp(band.cs + csOffset, 0.05, 1));
      const damage = roundN(clamp(band.damage + (seed / 1000) * 0.05, 0, 1));
      const stain = roundN(clamp(band.stain + ((seed + 3) / 1000) * 0.05, 0, 1));
      const wear = roundN(clamp(band.wear + ((seed + 7) / 1000) * 0.05, 0, 1));
      const fiberD = roundN(clamp(band.fiberD + ((seed + 11) / 1000) * 0.05, 0, 1));

      const price = Math.round(rand(499, 8999) / 49) * 49;
      const age = Math.round(rand(2, 60));
      const worn = Math.round(rand(0, 200));

      const record = [
        uuid(), uuid(), `synthetic/${cat}_${f.fiber.replace(/\s+/g, '_')}_${BANDS.indexOf(band)}.jpg`, 'front',
        cat, f.subcategory, f.fiber, BRANDS[(seed * 7) % BRANDS.length], String(price),
        String(age), String(worn),
        String(damage), String(stain), String(wear), String(fiberD),
        band.types.join(' '), LOCATIONS[seed % LOCATIONS.length],
        String(cs), band.label, routing(cs, f.ms), 'synthetic_v1', '0.95',
      ];
      rows.push(record.join(','));

      bandCount[band.cs.toFixed(2)] = (bandCount[band.cs.toFixed(2)] || 0) + 1;
      routeCount[routing(cs, f.ms)] = (routeCount[routing(cs, f.ms)] || 0) + 1;
      total++;
    }
  }
}

fs.writeFileSync(OUT, rows.join('\n') + '\n', 'utf-8');
console.log(`Wrote ${total} rows → ${OUT}`);
console.log('Route distribution:', JSON.stringify(routeCount));