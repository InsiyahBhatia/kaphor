import { logger } from '../lib/logger';
import { cacheWrap } from '../lib/cache';
import { AI_ATTEMPT_TIMEOUT_MS, AI_CACHE_TTL_MS, AI_TOTAL_TIMEOUT_MS, assertImageSize, capPrompt, digest, startBudget } from '../lib/aiGuard';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function getGroqKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.GROQ_API_KEY;
  if (primary) {
    const clean = primary.split('#')[0].trim();
    if (clean) keys.push(clean);
  }
  for (let i = 1; i <= 8; i++) {
    const extra = process.env[`GROQ_API_KEY${i}`];
    if (extra) {
      const clean = extra.split('#')[0].trim();
      if (clean) keys.push(clean);
    }
  }
  return keys;
}

export interface GroqConfig {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

/**
 * One pass over the configured keys (rotating on 429/5xx/timeouts) inside a single shared time budget.
 * No exponential-backoff rounds: callers all have a curated fallback, and a user waiting is worse than a quick fallback.
 */
async function callGroq(label: string, body: Record<string, unknown>): Promise<string> {
  const keys = getGroqKeys();
  if (keys.length === 0) throw new Error('No GROQ_API_KEY configured');
  const budget = startBudget();
  const errors: string[] = [];

  for (const apiKey of keys) {
    if (budget.expired()) {
      errors.push(`timed out after ${AI_TOTAL_TIMEOUT_MS}ms`);
      break;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(AI_ATTEMPT_TIMEOUT_MS, budget.remaining()));
    try {
      const res = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.ok) {
        const json: any = await res.json();
        const content = json?.choices?.[0]?.message?.content;
        if (content && content.trim().length > 0) return content;
        errors.push(`key ${apiKey.slice(-4)}: empty content`);
        continue;
      }

      const bodyText = await res.text().catch(() => '');
      if (RETRYABLE_STATUSES.has(res.status)) {
        logger.warn(`[${label}] key ${apiKey.slice(-4)} returned ${res.status}, rotating key...`);
        errors.push(`key ${apiKey.slice(-4)}: ${res.status}`);
        continue;
      }
      // A 4xx (bad request, auth) will not improve by trying another key with the same payload.
      throw new Error(`Groq ${res.status}: ${bodyText.slice(0, 300)}`);
    } catch (err: any) {
      if (controller.signal.aborted) {
        errors.push(`key ${apiKey.slice(-4)}: timed out`);
        continue;
      }
      if (/^Groq \d{3}:/.test(err?.message || '')) throw err;
      errors.push(`key ${apiKey.slice(-4)}: ${err?.message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`All Groq attempts failed (${label}): ${errors.join(' | ') || 'no keys configured'}`);
}

/**
 * Vision-capable Groq call — uses the multimodal model (qwen/qwen3.8-27b)
 * on the free tier. Returns the raw text (typically JSON).
 */
export async function generateWithGroqVision(
  systemPrompt: string,
  userPrompt: string,
  imageBase64: string,
  config: GroqConfig = {},
): Promise<string> {
  assertImageSize(imageBase64);
  let base64Data = imageBase64;
  let mimeType = 'image/jpeg';
  if (imageBase64.startsWith('data:')) {
    const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }
  }
  const system = capPrompt(systemPrompt);
  const user = capPrompt(userPrompt);
  const body = {
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: user },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
        ],
      },
    ],
    temperature: config.temperature ?? 0.1,
    max_tokens: config.maxTokens ?? 1000,
  };
  return cacheWrap(`ai:groqv:${digest(GROQ_MODEL, system, user, base64Data, body.temperature, body.max_tokens)}`, AI_CACHE_TTL_MS, () =>
    callGroq('Groq/Vision', body),
  );
}

export async function generateWithGroq(
  prompt: string,
  config: GroqConfig = {},
): Promise<string> {
  const text = capPrompt(prompt);
  const body = {
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: text }],
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 2048,
    ...(config.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
  };
  return cacheWrap(`ai:groq:${digest(GROQ_MODEL, text, body.temperature, body.max_tokens, config.responseFormat ?? '')}`, AI_CACHE_TTL_MS, () =>
    callGroq('Groq', body),
  );
}
