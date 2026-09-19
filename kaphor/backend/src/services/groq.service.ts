import { logger } from '../lib/logger';

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
 * Vision-capable Groq call — uses the multimodal model (qwen/qwen3.8-27b)
 * on the free tier. Returns the raw text (typically JSON).
 */
export async function generateWithGroqVision(
  systemPrompt: string,
  userPrompt: string,
  imageBase64: string,
  config: GroqConfig = {},
): Promise<string> {
  let base64Data = imageBase64;
  let mimeType = 'image/jpeg';
  if (imageBase64.startsWith('data:')) {
    const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }
  }

  const keys = getGroqKeys();
  const lastErrors: string[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const apiKey of keys) {
      try {
        const res = await fetch(GROQ_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: userPrompt },
                  { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
                ],
              },
            ],
            temperature: config.temperature ?? 0.1,
            max_tokens: config.maxTokens ?? 1000,
          }),
        });

        if (res.ok) {
          const json: any = await res.json();
          const content = json?.choices?.[0]?.message?.content;
          if (content && content.trim().length > 0) return content;
          throw new Error('Groq vision returned empty content');
        }

        const status = res.status;
        const body = await res.text().catch(() => '');
        if (RETRYABLE_STATUSES.has(status)) {
          logger.warn(`[Groq/Vision] key ${apiKey.slice(-4)} returned ${status}, rotating key...`);
          continue;
        }
        throw new Error(`Groq ${status}: ${body.slice(0, 300)}`);
      } catch (err: any) {
        lastErrors.push(`key ${apiKey.slice(-4)}: ${err.message}`);
      }
    }

    if (attempt < 2) {
      const delay = 1000 * Math.pow(2, attempt);
      logger.warn(`[Groq/Vision] all keys exhausted (attempt ${attempt + 1}/3), retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const detail = lastErrors.join(' | ') || 'no keys configured';
  throw new Error(`All Groq vision attempts failed: ${detail}`);
}

export async function generateWithGroq(
  prompt: string,
  config: GroqConfig = {},
): Promise<string> {
  const keys = getGroqKeys();
  const lastErrors: string[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const apiKey of keys) {
      try {
        const res = await fetch(GROQ_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens ?? 2048,
            ...(config.responseFormat === 'json'
              ? { response_format: { type: 'json_object' } }
              : {}),
          }),
        });

        if (res.ok) {
          const json: any = await res.json();
          const content = json?.choices?.[0]?.message?.content;
          if (content && content.trim().length > 0) return content;
          throw new Error('Groq returned empty content');
        }

        const status = res.status;
        const body = await res.text().catch(() => '');
        if (RETRYABLE_STATUSES.has(status)) {
          logger.warn(`[Groq] key ${apiKey.slice(-4)} returned ${status}, rotating key...`);
          continue;
        }
        throw new Error(`Groq ${status}: ${body.slice(0, 300)}`);
      } catch (err: any) {
        const status = err?.status || (err?.message || '').match(/\b(\d{3})\b/)?.[1];
        if (status && RETRYABLE_STATUSES.has(Number(status))) {
          lastErrors.push(`key ${apiKey.slice(-4)}: ${err.message}`);
          continue;
        }
        lastErrors.push(`key ${apiKey.slice(-4)}: ${err.message}`);
      }
    }

    if (attempt < 2) {
      const delay = 1000 * Math.pow(2, attempt);
      logger.warn(`[Groq] all keys exhausted (attempt ${attempt + 1}/3), retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const detail = lastErrors.join(' | ') || 'no keys configured';
  throw new Error(`All Groq API keys failed: ${detail}`);
}