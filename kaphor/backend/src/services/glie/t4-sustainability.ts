/**
 * T4 — Sustainability Data Lookup
 * 41 rows, loaded at startup into a Map keyed by fiber name
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../lib/logger';

export interface T4Sustainability {
  fiber_name: string;
  garment_type_example: string;
  co2_per_garment_kg: number;
  co2_raw_material_kg: number;
  co2_processing_kg: number;
  co2_source: string;
  water_per_garment_litres: number;
  water_source: string;
  circulation_multiplier_base: number;
  carbon_saving_per_cycle_kg: number;
  water_saving_per_cycle_l: number;
  trees_equivalent_per_cycle: number;
  carbon_saving_score: number;
  water_saving_score: number;
  max_co2_benchmark_kg: number;
  max_water_benchmark_l: number;
  source_confidence: string;
  source_type: string;
}

let sustainMap: Map<string, T4Sustainability> | null = null;

function normalize(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

export function loadT4(): void {
  if (sustainMap) return;

  const filePath = path.resolve(__dirname, '../../../data/T4.csv');
  logger.info(`[GLIE/T4] Loading sustainability from ${filePath}`);

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  if (lines.length < 2) {
    logger.warn('[GLIE/T4] T4.csv is empty or missing header');
    sustainMap = new Map();
    return;
  }

  const headers = parseCSVLine(lines[0]);
  sustainMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 2) continue;

    const record = rowToRecord(headers, row) as unknown as T4Sustainability;
    if (!record.fiber_name) continue;

    const key = normalize(record.fiber_name);
    sustainMap.set(key, record);
  }

  logger.info(`[GLIE/T4] Loaded ${sustainMap.size} sustainability records`);
}

const FABRIC_ALIAS_MAP: Record<string, string> = {
  denim: 'Standard Cotton',
  jean: 'Standard Cotton',
  jeans: 'Standard Cotton',
  canvas: 'Standard Cotton',
  corduroy: 'Standard Cotton',
  flannel: 'Standard Cotton',
  terry: 'Standard Cotton',
  toweling: 'Standard Cotton',
  twill: 'Standard Cotton',
  poplin: 'Standard Cotton',
  chambray: 'Standard Cotton',
  velvet: 'Polyester',
  fleece: 'Polyester',
  satin: 'Polyester',
  organza: 'Polyester',
  mesh: 'Polyester',
  net: 'Nylon',
  tweed: 'Wool',
  merino: 'Wool',
  wool: 'Wool',
  cashmere: 'Cashmere',
  pashmina: 'Cashmere',
  viscose: 'Viscose',
  rayon: 'Viscose',
  bamboo: 'Viscose',
  modal: 'Modal',
  lyocell: 'Lyocell',
  tencel: 'Lyocell',
  linen: 'Linen',
  flax: 'Linen',
  silk: 'Mulberry Silk',
  cotton: 'Standard Cotton',
};

/**
 * Lookup sustainability data by fiber name — case-insensitive, fabric fallback, partial match
 */
export function lookupT4(fiberName: string): T4Sustainability | null {
  if (!sustainMap) loadT4();
  if (!sustainMap) return null;

  const key = normalize(fiberName);

  // Direct match
  if (sustainMap.has(key)) return sustainMap.get(key)!;

  // Fabric alias match (e.g. Denim -> Standard Cotton)
  if (FABRIC_ALIAS_MAP[key]) {
    const targetFiber = normalize(FABRIC_ALIAS_MAP[key]);
    if (sustainMap.has(targetFiber)) return sustainMap.get(targetFiber)!;
  }

  // Partial match
  for (const [stored, record] of sustainMap) {
    if (key.includes(stored) || stored.includes(key)) return record;
  }

  // Partial fabric match fallback (e.g. "heavy denim jacket" -> denim -> Standard Cotton)
  for (const [fabricKey, mappedName] of Object.entries(FABRIC_ALIAS_MAP)) {
    if (key.includes(fabricKey) || fabricKey.includes(key)) {
      const targetFiber = normalize(mappedName);
      if (sustainMap.has(targetFiber)) return sustainMap.get(targetFiber)!;
    }
  }

  logger.warn(`[GLIE/T4] No sustainability data for: "${fiberName}"`);
  return null;
}

// ── CSV Helpers ──────────────────────────────────────────────────────────────

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

function rowToRecord(headers: string[], row: string[]): Record<string, any> {
  const record: Record<string, any> = {};
  for (let i = 0; i < headers.length && i < row.length; i++) {
    let value = row[i].replace(/^"|"$/g, '').trim();
    const num = Number(value);
    record[headers[i]] = isNaN(num) ? value : num;
  }
  return record;
}
