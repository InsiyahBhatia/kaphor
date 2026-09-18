/**
 * T5 Enrichment Script — YouTube transcript → structured repair guide
 *
 * Converts real YouTube repair/upcycle tutorials into T5Guide docs and
 * appends them to data/T5.json with source attribution (source / source_id /
 * source_url) so the Repair & Refresh UI can show the steps under the video.
 *
 * Usage:
 *   npx ts-node scripts/enrich-t5-from-youtube.ts --videos VIDEO_ID[,VIDEO_ID,...]
 *   npx ts-node scripts/enrich-t5-from-youtube.ts --file scripts/videos.json
 *
 *   --file expects an array of { videoId?: string } objects (or strings)
 *   --output path/to/T5.json  (default: backend/data/T5.json)
 *   --max-chars 4000          (transcript char budget fed to the LLM, default 4000)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { YoutubeTranscript } from 'youtube-transcript';
import { z } from 'zod';
import { generateWithGroq } from '../src/services/groq.service';
import { logger } from '../src/lib/logger';

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_OUTPUT = path.resolve(__dirname, '../data/T5.json');

interface SlopArgs {
  videos: string[];
  output: string;
  maxChars: number;
}

function parseArgs(argv: string[]): SlopArgs {
  const args: SlopArgs = { videos: [], output: DEFAULT_OUTPUT, maxChars: 4000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--videos') {
      args.videos = (argv[i + 1] || '').split(',').map((s) => s.trim()).filter(Boolean);
      i++;
    } else if (arg === '--file') {
      const filePath = path.resolve(argv[i + 1] || '');
      const list = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      args.videos = list
        .map((entry: any) => (typeof entry === 'string' ? entry : entry?.videoId))
        .filter(Boolean);
      i++;
    } else if (arg === '--output') {
      args.output = path.resolve(argv[i + 1] || DEFAULT_OUTPUT);
      i++;
    } else if (arg === '--max-chars') {
      args.maxChars = Number(argv[i + 1]) || 4000;
      i++;
    }
  }
  return args;
}

// ── Validation schema (mirrors T5Guide in src/services/glie/t5-guides.ts) ────

const TECHNIQUE_STYLES = [
  'plain_repair', 'embroidery', 'block_print', 'zari',
  'patchwork', 'kantha', 'upcycling', 'restoration', 'reconstruction',
] as const;

const DOC_TYPES = ['repair', 'upcycle', 'restore', 'dye_guide'] as const;
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

const T5GuideSchema = z.object({
  title: z.string().min(8).max(120),
  doc_type: z.enum(DOC_TYPES),
  difficulty: z.enum(DIFFICULTIES),
  time_minutes: z.number().int().min(5).max(600),
  fiber_types: z.array(z.string().min(2)).min(0).max(6),
  damage_types: z.array(z.string().min(2)).min(1).max(6),
  garment_categories: z.array(z.string().min(2)).min(1).max(6),
  damage_location: z.array(z.string().min(2)).max(6).optional(),
  technique_style: z.enum(TECHNIQUE_STYLES),
  tools_required: z.array(z.string().min(2)).max(10),
  steps: z.array(
    z.object({
      step: z.number().int().min(1).optional(),
      instruction: z.string().min(8).max(220),
      tip: z.string().min(2).max(160).nullable().optional(),
    }),
  ).min(2).max(8),
  pro_tip: z.string().min(2).max(200).nullable(),
  care_instructions: z.string().min(2).max(200).nullable(),
  upcycle_alternative: z.string().min(2).max(200).nullable(),
});

type NewT5Guide = z.infer<typeof T5GuideSchema>;

// ── Prompt ────────────────────────────────────────────────────────────────────

const FIBER_VOCAB = [
  'Mulberry Silk', 'Banarasi Silk', 'Kanjivaram Silk', 'Chanderi', 'Raw Silk',
  'Georgette', 'Chiffon', 'Velvet', 'Net / Mesh', 'Standard Cotton',
  'Organic Cotton', 'Khadi', 'Linen', 'Wool / Cashmere', 'Cashmere',
  'Leather / Suede', 'Polyester', 'Nylon', 'Rayon', 'Viscose', 'Acrylic',
  'Denim', 'Jute', 'Hemp', 'Satin',
].join(', ');

const DAMAGE_VOCAB = [
  'tear', 'hole', 'stain', 'fraying', 'fading', 'broken_zip', 'pilling',
  'snag', 'wear_zone', 'seam_ripped', 'loose_button', 'broken_button',
  'scratch', 'crack', 'burn', 'mold', 'rust', 'stretch', 'discolored',
].join(', ');

const CATEGORY_VOCAB = [
  'saree', 'kurta', 'kurti', 'lehenga', 'blouse', 'anarkali', 'shirt',
  'tshirt', 'top', 'dress', 'trousers', 'jeans', 'pants', 'shorts', 'skirt',
  'jacket', 'blazer', 'coat', 'sweater', 'hoodie', 'sweatshirt', 'dupatta',
  'accessory', 'other',
].join(', ');

function buildPrompt(transcript: string): string {
  return `You convert raw YouTube repair-tutorial transcripts into a structured repair/upcycle guide for a circular-fashion app.
Take ONLY the actual method shown in the transcript. Never invent steps that are not in the video. Keep the speech-to-text "ums", praise and off-topic talk OUT.

Respond with a single valid JSON object and nothing else — no markdown fences, no commentary.

Schema:
{
  "title": string,            // short, like "Denim Knee Rip Sashiko Mending"
  "doc_type": "repair" | "upcycle" | "restore" | "dye_guide",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "time_minutes": number,     // realistic estimate
  "fiber_types": string[],    // pick from: ${FIBER_VOCAB} (or closest match)
  "damage_types": string[],   // pick from: ${DAMAGE_VOCAB}
  "garment_categories": string[], // pick from: ${CATEGORY_VOCAB}
  "damage_location": string[],    // e.g. ["knee"], ["overall"], ["collar"]
  "technique_style": "plain_repair" | "embroidery" | "block_print" | "zari" | "patchwork" | "kantha" | "upcycling" | "restoration" | "reconstruction",
  "tools_required": string[],     // tools/fabrics actually named in the video
  "steps": [ { "step": 1, "instruction": "...", "tip": "..." } ],
  "pro_tip": string | null,   // one concrete practical tip (or null)
  "care_instructions": string | null,
  "upcycle_alternative": string | null
}

Rules:
- 2 to 6 steps total; each instruction is one imperative sentence, under 30 words, from the video's actual order.
- Tips are short practical notes (null if none). Tip field optional.
- damage_types and garment_categories must use the vocabulary lists above.
- Plain, factual tone. NO marketing phrases like "transforms", "museum quality", "elevates". No emojis.

TRANSCRIPT:
${transcript}`;
}

// ── T5 file helpers (surgical append, preserves existing bytes) ──────────────

interface T5File {
  raw: string;
  docs: any[];
}

function readT5(output: string): T5File {
  const raw = fs.readFileSync(output, 'utf-8');
  const docs = JSON.parse(raw) as any[];
  return { raw, docs };
}

function nextDocId(docs: any[]): string {
  let max = 0;
  for (const doc of docs) {
    const m = String(doc.doc_id || '').match(/^t5-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `t5-${String(max + 1).padStart(3, '0')}`;
}

function appendGuide(output: string, raw: string, guide: NewT5Guide, meta: { doc_id: string }): void {
  const doc = { ...guide, ...meta, source: 'youtube' };
  // Serialize then re-indent 2 spaces to match the file's base object indent.
  const lines = JSON.stringify(doc, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
  const pre = raw.replace(/\n[ \t]*\][ \t]*$/, '');
  const next = `${pre.replace(/[ \t]+$/, '')},\n${lines}\n]\n`;
  fs.writeFileSync(output, next, 'utf-8');
}

// ── Transcript fetching ───────────────────────────────────────────────────────

async function fetchTranscriptText(videoId: string, maxChars: number): Promise<string> {
  const parts: { text: string; duration: number; offset: number }[] =
    await new YoutubeTranscript().fetchTranscript(videoId);
  const full = parts.map((p) => p.text.trim()).filter(Boolean).join(' ');
  return full.length > maxChars ? full.slice(0, full.lastIndexOf(' ', maxChars)) : full;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.videos.length === 0) {
    logger.error('[Enrich] No video IDs. Usage: --videos ID1,ID2 --file list.json');
    return 1;
  }

  let added = 0;
  let skipped = 0;

  for (const videoId of args.videos) {
    logger.info(`[Enrich] --- Processing ${videoId} ---`);
    let transcript: string;
    try {
      transcript = await fetchTranscriptText(videoId, args.maxChars);
    } catch (err: any) {
      logger.warn(`[Enrich] Transcript unavailable for ${videoId}: ${err.message}`);
      skipped++;
      continue;
    }
    if (transcript.length < 120) {
      logger.warn(`[Enrich] Transcript too short (${transcript.length} chars) for ${videoId}, skipping`);
      skipped++;
      continue;
    }

    logger.info(`[Enrich] Transcript (${transcript.length} chars) → LLM conversion`);
    let rawJson: string;
    try {
      rawJson = await generateWithGroq(buildPrompt(transcript), {
        temperature: 0.2,
        maxTokens: 4096,
        responseFormat: 'json',
      });
    } catch (err: any) {
      logger.error(`[Enrich] LLM conversion failed for ${videoId}: ${err.message}`);
      skipped++;
      continue;
    }

    let parsed: NewT5Guide;
    try {
      const cleaned = rawJson.replace(/```json\s*/i, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start < 0 || end <= start) throw new Error('no JSON object found');
      parsed = T5GuideSchema.parse(JSON.parse(cleaned.slice(start, end + 1)));
    } catch (err: any) {
      logger.warn(`[Enrich] Invalid guide for ${videoId}: ${err.message}`);
      logger.warn(`[Enrich] Raw: ${rawJson.slice(0, 500)}`);
      skipped++;
      continue;
    }

    const { raw, docs } = readT5(args.output);
    const docId = nextDocId(docs);
    appendGuide(args.output, raw, parsed, { doc_id: docId });
    logger.info(
      `[Enrich] Added ${docId} — "${parsed.title}" (${parsed.steps.length} steps, ${parsed.fiber_types.join('/') || 'no fiber'}) from ${videoId}`,
    );
    added++;
  }

  logger.info(`[Enrich] Done. added=${added} skipped=${skipped}`);
  return added > 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    logger.error(`[Enrich] Fatal: ${err.message}`);
    process.exit(1);
  });