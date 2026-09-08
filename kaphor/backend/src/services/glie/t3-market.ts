/**
 * T3 — Market Demand Query
 * 5000+ rows, loaded at startup, filtered by category + condition range
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../lib/logger';
import type { T3Stats } from './formulas';

interface T3Raw {
  listing_id: string;
  garment_category: string;
  listed_price_inr: number;
  sold_price_inr: number;
  was_sold: string;
  days_to_sell: number;
  resale_value_ratio: number;
  platform_demand_score: number;
  style_tags: string;
  color_family: string;
  season: string;
  trend_score_at_listing: number;
  seller_condition_label: string;
  condition_score_at_listing: number;
  [key: string]: any;
}

let marketRecords: T3Raw[] | null = null;

function normalize(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
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
    marketRecords.push(record as unknown as T3Raw);
  }

  logger.info(`[GLIE/T3] Loaded ${marketRecords.length} market listings`);
}

/**
 * Query T3 by category + condition score range (within ±0.15)
 * Returns aggregated market stats
 */
export function queryT3(
  category: string,
  conditionScore: number,
): T3Stats | null {
  if (!marketRecords) loadT3();
  if (!marketRecords || marketRecords.length === 0) return null;

  const catKey = normalize(category);
  const csMin = Math.max(0, conditionScore - 0.15);
  const csMax = Math.min(1, conditionScore + 0.15);

  // Filter by category + condition score range
  const matched = marketRecords.filter(r => {
    const rCat = normalize(r.garment_category);
    const rCs = r.condition_score_at_listing;

    // Category match — exact or partial
    const catMatch = rCat === catKey || rCat.includes(catKey) || catKey.includes(rCat);

    // Condition score within range
    const csMatch = rCs >= csMin && rCs <= csMax;

    return catMatch && csMatch;
  });

  if (matched.length === 0) {
    logger.warn(`[GLIE/T3] No market matches for category="${category}" cs=${conditionScore}`);
    return null;
  }

  // Aggregate
  const prices = matched.map(r => r.listed_price_inr);
  const soldPrices = matched.filter(r => r.was_sold === '1' || r.was_sold === 'true').map(r => r.sold_price_inr);
  const daysToSell = matched.filter(r => r.was_sold === '1' || r.was_sold === 'true').map(r => r.days_to_sell);
  const ratios = matched.filter(r => r.was_sold === '1' || r.was_sold === 'true').map(r => r.resale_value_ratio);
  const demandScores = matched.map(r => r.platform_demand_score);
  const trendScores = matched.map(r => r.trend_score_at_listing);

  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const medianDays = daysToSell.length > 0 ? median(daysToSell) : 0;
  const avgRatio = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
  const avgDemand = demandScores.length > 0 ? demandScores.reduce((a, b) => a + b, 0) / demandScores.length : 0;
  const avgTrend = trendScores.length > 0 ? trendScores.reduce((a, b) => a + b, 0) / trendScores.length : 0;

  // Determine demand trend
  let demand_trend: T3Stats['demand_trend'] = 'stable';
  if (avgTrend >= 0.7) demand_trend = 'rising';
  else if (avgTrend >= 0.5) demand_trend = 'moderate';
  else if (avgTrend >= 0.3) demand_trend = 'stable';
  else demand_trend = 'declining';

  return {
    avg_listed_price: Math.round(avgPrice),
    median_days_to_sell: Math.round(medianDays),
    avg_resale_ratio: Math.round(avgRatio * 1000) / 1000,
    avg_demand_score: Math.round(avgDemand * 1000) / 1000,
    total_listings_matched: matched.length,
    demand_trend,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
