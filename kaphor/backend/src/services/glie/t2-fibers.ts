/**
 * T2 — Fiber Properties Lookup
 * 56 rows, loaded at startup into a Map keyed by normalized fiber name
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../lib/logger';

export interface T2FiberProps {
  fiber_name: string;
  fiber_family: string;
  fiber_aliases: string;
  common_in_india: string;
  fiber_quality_score: number;
  durability_rating: number;
  max_circular_cycles: number;
  reusability_index: number;
  washability: string;
  eco_rating: number;
  is_biodegradable: string;
  is_recyclable_industrially: string;
  microplastic_shedding: string;
  certifications: string;
  upcycle_difficulty: string;
  dyeable: string;
  stitchable: string;
  repair_notes: string;
  data_source: string;
  source_confidence: string;
  source_type: string;
}

let fiberMap: Map<string, T2FiberProps> | null = null;
let aliasMap: Map<string, string> | null = null; // alias → canonical fiber_name

function normalize(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

export function loadT2(): void {
  if (fiberMap) return; // already loaded

  const filePath = path.resolve(__dirname, '../../../data/T2.csv');
  logger.info(`[GLIE/T2] Loading fibers from ${filePath}`);

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  if (lines.length < 2) {
    logger.warn('[GLIE/T2] T2.csv is empty or missing header');
    fiberMap = new Map();
    aliasMap = new Map();
    return;
  }

  const headers = parseCSVLine(lines[0]);
  fiberMap = new Map();
  aliasMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 2) continue;

    const record = rowToRecord(headers, row) as unknown as T2FiberProps;
    if (!record.fiber_name) continue;

    const key = normalize(record.fiber_name);
    fiberMap.set(key, record);

    // Register aliases
    if (record.fiber_aliases) {
      const aliases = record.fiber_aliases.split(',').map(a => a.trim());
      for (const alias of aliases) {
        if (alias) {
          aliasMap.set(normalize(alias), key);
        }
      }
    }
  }

  logger.info(`[GLIE/T2] Loaded ${fiberMap.size} fibers with ${aliasMap!.size} aliases`);
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
 * Lookup fiber properties by name — case-insensitive, then alias/fabric fallback
 */
export function lookupT2(fiberName: string): T2FiberProps | null {
  if (!fiberMap || !aliasMap) {
    loadT2();
  }
  if (!fiberMap || !aliasMap) return null;

  const key = normalize(fiberName);

  // Direct match
  if (fiberMap.has(key)) return fiberMap.get(key)!;

  // Alias match
  const canonical = aliasMap.get(key);
  if (canonical && fiberMap.has(canonical)) return fiberMap.get(canonical)!;

  // Fabric / weave alias mapping (e.g. Denim -> Standard Cotton)
  if (FABRIC_ALIAS_MAP[key]) {
    const targetFiber = normalize(FABRIC_ALIAS_MAP[key]);
    if (fiberMap.has(targetFiber)) return fiberMap.get(targetFiber)!;
    const targetCanonical = aliasMap.get(targetFiber);
    if (targetCanonical && fiberMap.has(targetCanonical)) return fiberMap.get(targetCanonical)!;
  }

  // Partial match: check if key is contained in a stored name or vice versa
  for (const [stored, record] of fiberMap) {
    if (key.includes(stored) || stored.includes(key)) return record;
  }

  // Partial fabric match fallback (e.g. "heavy denim jacket" -> denim -> Standard Cotton)
  for (const [fabricKey, mappedName] of Object.entries(FABRIC_ALIAS_MAP)) {
    if (key.includes(fabricKey) || fabricKey.includes(key)) {
      const targetFiber = normalize(mappedName);
      if (fiberMap.has(targetFiber)) return fiberMap.get(targetFiber)!;
    }
  }

  logger.warn(`[GLIE/T2] No match for fiber: "${fiberName}"`);
  return null;
}

export function getT2FiberMap(): Map<string, T2FiberProps> {
  if (!fiberMap) loadT2();
  return fiberMap!;
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

function rowToRecord(headers: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (let i = 0; i < headers.length && i < row.length; i++) {
    const value = row[i].replace(/^"|"$/g, '').trim();
    const numVal = Number(value);
    record[headers[i]] = isNaN(numVal) ? value : String(numVal);
  }
  return record;
}
