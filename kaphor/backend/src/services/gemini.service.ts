import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../lib/logger';

// Free-tier model chain (no paid plan), ordered best → fallback.
// Every model here is verified working on all configured keys.
// `gemini-2.5-flash` is kept last because it only works on the primary key.
// Free-tier model chain (no paid plan), ordered best/most stable → fallback.
// Every model here is verified working across configured keys.
export const GEMINI_MODEL_CHAIN = [
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.6-flash',
];

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function getGeminiKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.GEMINI_API_KEY;
  if (primary) {
    const clean = primary.split('#')[0].trim();
    if (clean) keys.push(clean);
  }
  for (let i = 1; i <= 8; i++) {
    const extra = process.env[`GEMINI_API_KEY${i}`];
    if (extra) {
      const clean = extra.split('#')[0].trim();
      if (clean) keys.push(clean);
    }
  }
  return keys;
}

export interface GeminiGenConfig {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
}

export async function generateWithGemini(
  input: string | any[],
  config: GeminiGenConfig = {},
): Promise<string> {
  const keys = getGeminiKeys();
  if (keys.length === 0) throw new Error('No GEMINI_API_KEY configured');

  const parts = typeof input === 'string' ? [{ text: input }] : input;
  const generationConfig: any = {
    temperature: config.temperature ?? 0.7,
    maxOutputTokens: config.maxOutputTokens ?? 2048,
  };
  if (config.responseMimeType) generationConfig.responseMimeType = config.responseMimeType;

  let lastError: any = null;

  for (const apiKey of keys) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const keySuffix = apiKey.slice(-4);

    for (const modelName of GEMINI_MODEL_CHAIN) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts }],
          generationConfig,
        });
        const text = result.response.text();
        if (text && text.trim().length > 0) {
          return text;
        }
        logger.warn(`[Gemini] ${modelName} (key ...${keySuffix}) returned empty response`);
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.response?.status;
        if (status === 404) {
          logger.warn(`[Gemini] model ${modelName} unavailable on key ...${keySuffix}, trying next model`);
          continue;
        }
        if (status === 429) {
          // 429 quota is per-model on Gemini free tier; try next model before abandoning key
          logger.warn(`[Gemini] ${modelName} (key ...${keySuffix}) quota limit (429), trying next model on same key`);
          continue;
        }
        if (RETRYABLE_STATUSES.has(status)) {
          logger.warn(`[Gemini] ${modelName} (key ...${keySuffix}) server status ${status}, trying next model`);
          continue;
        }
        logger.warn(`[Gemini] ${modelName} (key ...${keySuffix}) error: ${err.message}, trying next`);
      }
    }
  }

  throw lastError || new Error('All Gemini keys and models failed');
}