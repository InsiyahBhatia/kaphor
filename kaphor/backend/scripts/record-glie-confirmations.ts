/**
 * Record user-confirmed GLIE corrections (positive feedback) into glie_corrections.
 *
 * Reads matching rows from T1_glie_dataset.csv and inserts one confirmation row
 * per image: original == corrected (the user validated the model was RIGHT), so
 * submitter = "annotator-review", notes mark it as a confirmed-correct decision.
 *
 * Usage: npx ts-node scripts/record-glie-confirmations.ts
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import db from '../src/lib/prisma';

const CSV_PATH = path.resolve(__dirname, '../data/T1_glie_dataset.csv');

const CONFIRMATIONS: string[] = [
  '15833036184280337.jpg',                                  // jeans
  '2040762329642917.jpg',                                   // sweatshirt
  'Gilda Midani Dresses _ Gilda Midan Oversized Square Tie-Dye Shirt Dress White & Gray Size M Logenlok _ Color_ Gray_White _ Size_ M.jpg',
  'Les 15 vestes en jean homme stars du printemps.jpg',     // denim jackets
  'Shoonya 019.jpg',                                        // shirt
];

function escapeCsv(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function main() {
  const lines = fs.readFileSync(CSV_PATH, 'utf-8').split('\n').filter((l) => l.trim());
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const rec: Record<string, string> = {};
    let cur = '';
    let q = false;
    const cols: string[] = [];
    for (const ch of line) {
      if (ch === '"') { q = !q; continue; }
      if (ch === ',' && !q) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    headers.forEach((h, i) => { rec[h] = cols[i] ?? ''; });
    return rec;
  });

  const matches = rows.filter((r) =>
    CONFIRMATIONS.some((f) => (r.image_url || '').endsWith(f)) &&
    r.glie_routing === 'RESELL' && r.formula_routing === 'RESELL'
  );

  if (matches.length !== CONFIRMATIONS.length) {
    console.error(`Expected ${CONFIRMATIONS.length} matches, found ${matches.length}`);
    process.exit(1);
  }

  console.log(`Recording confirmed feedback for ${matches.length} images...`);

  async function run() {
    for (const m of matches) {
      const rec = await db.glieCorrection.create({
        data: {
          assessmentId: m.garment_id || null,
          userId: null,
          garmentCategory: m.garment_category,
          fiberType: m.garment_subcategory.split('(')[0].trim(),
          originalConditionScore: Number(m.condition_score),
          correctedConditionScore: Number(m.condition_score),
          originalRouting: 'RESELL',
          correctedRouting: 'RESELL',
          originalPriceInr: m.original_price_inr ? Number(m.original_price_inr) : null,
          notes: 'annotator-review: user confirmed correct RESELL',
        },
      });
      console.log(`saved ${rec.id} for ${m.image_url || m.garment_id}`);
    }
  }

  run()
    .then(() => { console.log('Done.'); process.exit(0); })
    .catch((e) => { console.error('Failed:', e.message); process.exit(1); });
}

main();