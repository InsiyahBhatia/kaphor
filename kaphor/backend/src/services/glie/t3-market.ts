/**
 * T3 — Market Demand & Resale Valuation Engine
 * 5000+ rows loaded at startup, with canonical taxonomy resolution,
 * condition-aware decay scaling, IQR outlier filtering, engagement-driven demand,
 * and brand-tier valuation support.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../lib/logger';
import type { T3Stats } from './formulas';

export interface T3Raw {
  listing_id: string;
  garment_category: string;
  listed_price_inr: number;
  sold_price_inr: number;
  was_sold: string;
  days_to_sell: number;
  resale_value_ratio: number;
  num_views: number;
  num_saves: number;
  num_offers: number;
  platform_demand_score: number;
  style_tags: string;
  color_family: string;
  season: string;
  trend_score_at_listing: number;
  seller_condition_label: string;
  condition_score_at_listing: number;
  source_platform: string;
  [key: string]: any;
}

export interface QueryT3Options {
  brand?: string;
  brandTier?: 'luxury' | 'designer' | 'premium' | 'high_street' | 'budget';
}

let marketRecords: T3Raw[] | null = null;

// Canonical category taxonomy mapping to prevent false-positive substring collisions
const CANONICAL_CATEGORIES = new Set([
  'saree', 'lehenga', 'anarkali', 'kurta', 'dress', 'jeans',
  'trousers', 'tshirt', 'shirt', 'blouse', 'jacket', 'blazer',
  'sweater', 'skirt', 'dupatta', 'shorts', 'formal_shirt', 'coat', 'activewear'
]);

const CATEGORY_SYNONYMS: Record<string, string> = {
  // Ethnic
  saree: 'saree',
  sari: 'saree',
  saris: 'saree',
  sarees: 'saree',
  lehenga: 'lehenga',
  lehengas: 'lehenga',
  ghagra: 'lehenga',
  chaniya: 'lehenga',
  anarkali: 'anarkali',
  anarkalis: 'anarkali',
  kurta: 'kurta',
  kurtas: 'kurta',
  kurti: 'kurta',
  kurtis: 'kurta',
  dupatta: 'dupatta',
  dupattas: 'dupatta',
  shawl: 'dupatta',
  stole: 'dupatta',
  scarf: 'dupatta',
  blouse: 'blouse',
  blouses: 'blouse',
  choli: 'blouse',

  // Western Tops
  tshirt: 'tshirt',
  tshirts: 'tshirt',
  't-shirt': 'tshirt',
  't-shirts': 'tshirt',
  tee: 'tshirt',
  tees: 'tshirt',
  top: 'tshirt',
  tops: 'tshirt',
  croptop: 'tshirt',
  tank: 'tshirt',
  cami: 'tshirt',
  shirt: 'shirt',
  shirts: 'shirt',
  formal_shirt: 'formal_shirt',
  formalshirt: 'formal_shirt',
  sweater: 'sweater',
  sweaters: 'sweater',
  cardigan: 'sweater',
  cardigans: 'sweater',
  pullover: 'sweater',
  knitwear: 'sweater',
  hoodie: 'sweater',
  hoodies: 'sweater',
  sweatshirt: 'sweater',

  // Western Bottoms
  jeans: 'jeans',
  denim: 'jeans',
  trousers: 'trousers',
  trouser: 'trousers',
  pant: 'trousers',
  pants: 'trousers',
  chino: 'trousers',
  chinos: 'trousers',
  slacks: 'trousers',
  shorts: 'shorts',
  short: 'shorts',
  skirt: 'skirt',
  skirts: 'skirt',

  // Outerwear
  jacket: 'jacket',
  jackets: 'jacket',
  bomber: 'jacket',
  blazer: 'blazer',
  blazers: 'blazer',
  suit: 'blazer',
  coat: 'coat',
  coats: 'coat',
  trench: 'coat',
  overcoat: 'coat',

  // Dresses & Sport
  dress: 'dress',
  dresses: 'dress',
  gown: 'dress',
  gowns: 'dress',
  maxi: 'dress',
  frock: 'dress',
  kaftan: 'dress',
  activewear: 'activewear',
  sportswear: 'activewear',
  leggings: 'activewear',
  joggers: 'trousers',
};

const DESIGNER_BRAND_REGEX =
  /sabyasachi|tarun tahiliani|manish malhotra|anita dongre|payal singhal|falguni|itrh|raw mango|gucci|prada|armani|dolce|versace|burberry|chanel|dior|hermes|valentino|tom ford|givenchy|saint laurent/i;

const PREMIUM_BRAND_REGEX =
  /zara|h&m|massimo dutti|mango|levi|calvin klein|ralph lauren|tommy hilfiger|vero moda|pepe jeans|wills lifestyle|ray ban|nike|adidas|puma|ethnix/i;

function normalize(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9_\s]/g, '');
}

/**
 * Resolves a raw category name or title to the canonical T3 taxonomy category.
 */
export function resolveCanonicalCategory(raw: string): string | null {
  if (!raw) return null;
  const clean = normalize(raw);

  // 1. Direct synonym match
  if (CATEGORY_SYNONYMS[clean]) {
    return CATEGORY_SYNONYMS[clean];
  }

  // 2. Direct canonical set match
  if (CANONICAL_CATEGORIES.has(clean)) {
    return clean;
  }

  // 3. Token-based word boundary scan
  const words = clean.split(/\s+/);
  for (const w of words) {
    if (CATEGORY_SYNONYMS[w]) return CATEGORY_SYNONYMS[w];
    if (CANONICAL_CATEGORIES.has(w)) return w;
  }

  // 4. Controlled substring fallback (only allow known canonical categories)
  for (const canon of CANONICAL_CATEGORIES) {
    if (clean.includes(canon)) {
      return canon;
    }
  }

  return null;
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

export function loadT3(): void {
  if (marketRecords) return;

  const filePath = path.resolve(__dirname, '../../../data/T3.csv');
  logger.info(`[GLIE/T3] Loading market data from ${filePath}`);

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  if (lines.length < 2) {
    logger.warn('[GLIE/T3] T3.csv is empty or missing header');
    marketRecords = [];
    return;
  }

  const headers = parseCSVLine(lines[0]);
  marketRecords = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 2) continue;

    const record: Record<string, any> = {};
    for (let j = 0; j < headers.length && j < row.length; j++) {
      let value = row[j].replace(/^"|"$/g, '').trim();
      const num = Number(value);
      record[headers[j]] = isNaN(num) ? value : num;
    }

    // Normalize boolean-ish columns (CSV exports vary: TRUE/FALSE, 1/0, true/false)
    const wasSold = String(record.was_sold || '').trim().toLowerCase();
    record.was_sold = ['1', 'true', 'yes'].includes(wasSold) ? '1' : '0';

    // Backfill missing condition_score_at_listing from the seller's label
    if (!record.condition_score_at_listing) {
      record.condition_score_at_listing = labelToCondition(String(record.seller_condition_label || ''));
    }

    // Normalize category
    record.garment_category = normalize(String(record.garment_category || ''));

    marketRecords.push(record as unknown as T3Raw);
  }

  logger.info(`[GLIE/T3] Loaded ${marketRecords.length} market listings`);
}

/**
 * Filter extreme outliers using the Interquartile Range (IQR) method
 */
function filterOutliersIQR(values: number[]): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const filtered = sorted.filter(v => v >= lower && v <= upper);
  return filtered.length > 0 ? filtered : values;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Query T3 by category + condition score range (within ±0.15)
 * Returns aggregated market stats with condition-aware calibration,
 * outlier filtering, and brand tier adjustment.
 */
export function queryT3(
  category: string,
  conditionScore: number,
  options?: QueryT3Options,
): T3Stats | null {
  if (!marketRecords) loadT3();
  if (!marketRecords || marketRecords.length === 0) return null;

  const canonicalCat = resolveCanonicalCategory(category);
  if (!canonicalCat) {
    logger.warn(`[GLIE/T3] Unknown garment category "${category}"`);
    return null;
  }

  const csMin = Math.max(0, conditionScore - 0.15);
  const csMax = Math.min(1, conditionScore + 0.15);

  // 1. Direct window matches: category + condition score window
  let matched = marketRecords.filter(r => {
    const rCat = r.garment_category;
    const rCs = r.condition_score_at_listing;
    return rCat === canonicalCat && rCs >= csMin && rCs <= csMax;
  });

  let conditionDecayFactor = 1.0;

  // 2. Condition-aware decay fallback:
  // If no direct window matches exist (e.g. dataset only has CS 0.75–0.95 and query has CS 0.2–0.5),
  // fallback to all listings for this category, but scale prices & ratios according to condition decay.
  if (matched.length === 0) {
    const categoryRecords = marketRecords.filter(r => r.garment_category === canonicalCat);
    if (categoryRecords.length > 0) {
      matched = categoryRecords;
      const baseCsAvg =
        categoryRecords.reduce((acc, r) => acc + (r.condition_score_at_listing || 0.75), 0) /
        categoryRecords.length;
      const targetCs = Math.max(0.1, conditionScore);
      const csRatio = targetCs / (baseCsAvg || 0.75);
      // Power-law depreciation: lower condition exponentially lowers resale value
      conditionDecayFactor = clamp(Math.pow(csRatio, 1.25), 0.15, 1.35);
    }
  }

  if (matched.length === 0) {
    logger.warn(`[GLIE/T3] No market matches found for category="${category}" (${canonicalCat})`);
    return null;
  }

  // 3. Brand tier multipliers
  let tierMultiplier = 1.0;
  let resaleRetentionMultiplier = 1.0;

  const brandTier = options?.brandTier;
  const brandName = options?.brand || '';

  if (brandTier === 'luxury' || brandTier === 'designer' || DESIGNER_BRAND_REGEX.test(brandName)) {
    tierMultiplier = 2.4;
    resaleRetentionMultiplier = 1.25;
  } else if (brandTier === 'premium' || PREMIUM_BRAND_REGEX.test(brandName)) {
    tierMultiplier = 1.5;
    resaleRetentionMultiplier = 1.12;
  } else if (brandTier === 'budget') {
    tierMultiplier = 0.8;
    resaleRetentionMultiplier = 0.9;
  }

  // 4. Clean prices and ratios with IQR outlier trimming
  const rawPrices = matched.map(r => r.listed_price_inr * conditionDecayFactor);
  const cleanPrices = filterOutliersIQR(rawPrices);

  const rawRatios = matched
    .filter(r => r.resale_value_ratio > 0)
    .map(r => clamp(r.resale_value_ratio * conditionDecayFactor, 0.05, 0.95));
  const cleanRatios = filterOutliersIQR(rawRatios.length > 0 ? rawRatios : [0.45 * conditionDecayFactor]);

  const avgPrice = cleanPrices.reduce((a, b) => a + b, 0) / (cleanPrices.length || 1);
  const medianPrice = median(cleanPrices);
  const avgRatio = cleanRatios.reduce((a, b) => a + b, 0) / (cleanRatios.length || 1);

  // 5. Dynamic Engagement and Demand Calculation from views & saves
  const engagementList = matched.map(r => {
    const views = Number(r.num_views) || 200;
    const saves = Number(r.num_saves) || 15;
    // Saves represent high-intent buyer interest; views represent broad market reach
    return (saves * 4.5 + views * 0.15) / 115;
  });
  const avgEngagement = engagementList.reduce((a, b) => a + b, 0) / (engagementList.length || 1);

  // Condition affects demand: degraded garments experience lower market pull
  const conditionDemandMod = Math.sqrt(clamp(conditionDecayFactor, 0.25, 1.2));
  const calibratedDemandScore = clamp((0.35 + 0.25 * avgEngagement) * conditionDemandMod, 0.15, 0.95);

  // 6. Realistic Liquidity (Days to Sell)
  const realDays = matched.filter(r => r.was_sold === '1' && r.days_to_sell > 0).map(r => r.days_to_sell);
  let medianDays: number;
  if (realDays.length > 0) {
    medianDays = median(filterOutliersIQR(realDays));
  } else {
    // Inverse velocity estimation: higher engagement & pristine condition sell faster (7-14d),
    // lower engagement or damaged items take longer to clear (28-55d)
    medianDays = Math.round(clamp(25 / (avgEngagement * Math.sqrt(Math.max(0.2, conditionScore))), 7, 55));
  }

  // 7. Trend determination based on aggregate engagement velocity
  let demand_trend: T3Stats['demand_trend'] = 'stable';
  if (avgEngagement >= 1.15) demand_trend = 'rising';
  else if (avgEngagement >= 0.90) demand_trend = 'moderate';
  else if (avgEngagement >= 0.70) demand_trend = 'stable';
  else demand_trend = 'declining';

  return {
    avg_listed_price: Math.round(avgPrice * tierMultiplier),
    median_listed_price: Math.round(medianPrice * tierMultiplier),
    median_days_to_sell: Math.round(medianDays),
    avg_resale_ratio: Math.round(clamp(avgRatio * resaleRetentionMultiplier, 0.05, 0.95) * 1000) / 1000,
    avg_demand_score: Math.round(calibratedDemandScore * 1000) / 1000,
    total_listings_matched: matched.length,
    demand_trend,
  };
}

/**
 * Map a seller_condition_label to a numeric condition score.
 * Used to backfill rows where condition_score_at_listing is missing.
 * Unknown labels default to 0.75 so the listing still participates in queries.
 */
function labelToCondition(label: string): number {
  const key = label.trim().toLowerCase();
  if (key.includes('new_with_tags')) return 1.0;
  if (key.includes('new')) return 0.95;
  if (key.includes('like_new')) return 0.92;
  if (key.includes('excellent')) return 0.88;
  if (key.includes('good')) return 0.80;
  if (key.includes('fair')) return 0.60;
  if (key.includes('poor')) return 0.40;
  return 0.75;
}
