/**
 * Gemini API Client for GLIE vision scoring
 * Uses the shared multi-key + multi-model rotation client
 * Fires Groq vision (fast, free) in background for cross-validation — never blocks user
 */

import { logger } from '../../lib/logger';
import { generateWithGemini } from '../gemini.service';
import { extractFirstJson, stripCodeFences, toReadableText } from '../../lib/llmOutput';
import { generateWithGroqVision } from '../groq.service';
import { assertImageSize, capPrompt } from '../../lib/aiGuard';

export interface GeminiSubScores {
  condition_score: number;
  damage_ratio: number;
  wear_zone_ratio: number;
  stain_ratio: number;
  fiber_degradation_score: number;
  damage_types: string[];
  description: string;
  [key: string]: any;
}

export interface GeminiResult {
  success: boolean;
  data: GeminiSubScores | null;
  model: string;
  rawText?: string;
  error?: string;
  /** true when Gemini + Groq agreed on condition within ±0.1 */
  model_agreement?: boolean;
  /** Groq's independent condition score (background validator) */
  validator_condition_score?: number;
}

/**
 * Call Gemini Vision API with the RAG-augmented prompt.
 * Groq fires in background and validates — never blocks the response.
 */
export async function callGeminiVision(
  systemPrompt: string,
  userPrompt: string,
  imageBase64: string,
): Promise<GeminiResult> {
  assertImageSize(imageBase64);
  const safeSystemPrompt = capPrompt(systemPrompt);
  const safeUserPrompt = capPrompt(userPrompt);

  // 1. Try local fine-tuned Qwen2-VL GLIE endpoint ONLY if explicitly enabled in .env
  const qwenEndpoint = process.env.QWEN_GLIE_URL;
  if (qwenEndpoint) {
    try {
      logger.info(`[GLIE/VLM] Attempting fine-tuned Qwen2-VL endpoint at ${qwenEndpoint}`);
      const res = await fetch(qwenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, systemPrompt: safeSystemPrompt, userPrompt: safeUserPrompt }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const json = await res.json();
        const parsed = parseGeminiResponse(typeof json === 'string' ? json : JSON.stringify(json));
        if (parsed) {
          logger.info('[GLIE/VLM] Fine-tuned Qwen2-VL assessment succeeded');
          return {
            success: true,
            data: parsed,
            model: 'qwen2-vl-7b-glie-finetuned',
          };
        }
      }
    } catch (err: any) {
      logger.warn(`[GLIE/VLM] Qwen2-VL local endpoint unreachable: ${err.message}. Falling back to Gemini chain.`);
    }
  }

  // 2. Fire Groq vision in background — never await, never block
  const groqPromise = generateWithGroqVision(
    systemPrompt,
    userPrompt,
    imageBase64,
    { temperature: 0.1, maxTokens: 1000 },
  ).catch((err) => {
    logger.warn(`[GLIE/Groq] Background call crashed: ${err.message}`);
    return null as string | null;
  });

  // Strip data: prefix if present
  let base64Data = imageBase64;
  let mimeType = 'image/jpeg';
  if (imageBase64.startsWith('data:')) {
    const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }
  }

  try {
    const text = await generateWithGemini(
      [
        { inlineData: { mimeType, data: base64Data } },
        { text: `${systemPrompt}\n\n${userPrompt}` },
      ],
      { temperature: 0.1, maxOutputTokens: 1000 },
    );

    if (!text || text.trim().length === 0) {
      throw new Error('Gemini returned empty response');
    }

    const parsed = parseGeminiResponse(text);
    if (!parsed) {
      throw new Error('Gemini returned unparseable JSON');
    }

    // 3. Resolve Groq result (already done or still pending — either way we return Gemini now)
    const groqText = await groqPromise;
    const groqScores = groqText ? parseGroqResponse(groqText) : null;

    let modelAgreement = false;
    let validatorCS: number | undefined;
    if (groqScores) {
      const gcs = groqScores.condition_score;
      validatorCS = gcs;
      modelAgreement = Math.abs(parsed.condition_score - gcs) <= 0.1;
      logger.info(`[GLIE/MultiModel] Gemini CS=${parsed.condition_score}, Groq CS=${gcs}, agree=${modelAgreement}`);
    } else {
      logger.info(`[GLIE/MultiModel] Groq unavailable or failed — using Gemini only`);
    }

    logger.info('[GLIE/Gemini] Assessment succeeded');
    return {
      success: true,
      data: parsed,
      model: 'gemini',
      model_agreement: groqScores ? modelAgreement : undefined,
      validator_condition_score: validatorCS,
    };
  } catch (err: any) {
    // Gemini failed — try Groq as fallback
    const groqText = await groqPromise;
    const groqScores = groqText ? parseGroqResponse(groqText) : null;
    if (groqScores) {
      logger.warn(`[GLIE/Gemini] Failed, falling back to Groq`);
      return {
        success: true,
        data: {
          condition_score: groqScores.condition_score,
          damage_ratio: groqScores.damage_ratio,
          wear_zone_ratio: groqScores.wear_zone_ratio,
          stain_ratio: groqScores.stain_ratio,
          fiber_degradation_score: groqScores.fiber_degradation_score,
          damage_types: groqScores.damage_types,
          description: groqText || '',
        },
        model: 'groq-qwen3.8-27b',
      };
    }

    logger.error(`[GLIE/Gemini] Failed: ${err.message}`);
    return {
      success: false,
      data: null,
      model: 'none',
      error: 'Image analysis is unavailable right now.',
    };
  }
}

/**
 * Parse Groq response — same schema as Gemini but condition_score may come
 * back on a 0–100 scale. Clamped then normalized to [0,1].
 */
function parseGroqResponse(text: string): Omit<GeminiSubScores, 'description'> | null {
  const block = extractFirstJson(stripCodeFences(text)) ?? extractFirstJson(text);
  if (!block) return null;

  try {
    const parsed = JSON.parse(block);
    const clamp = (val: any, d = 0.5): number => {
      const n = Number(val);
      if (isNaN(n)) return d;
      return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
    };
    return {
      condition_score: clamp(parsed.condition_score, 0.5),
      damage_ratio: clamp(parsed.damage_ratio, 0),
      wear_zone_ratio: clamp(parsed.wear_zone_ratio, 0),
      stain_ratio: clamp(parsed.stain_ratio, 0),
      fiber_degradation_score: clamp(parsed.fiber_degradation_score || parsed.fiber_degradation, 0),
      damage_types: Array.isArray(parsed.damage_types) ? parsed.damage_types.map(String) : ['none'],
    };
  } catch (e) {
    logger.warn('[GLIE/Groq] JSON parse failed', { error: (e as Error).message, text: text.slice(0, 200) });
    return null;
  }
}

/**
 * Parse and validate Gemini JSON response
 * Extracts JSON block via regex, clamps values to [0,1]
 */
function parseGeminiResponse(text: string): GeminiSubScores | null {
  // Try to find JSON block
  const block = extractFirstJson(stripCodeFences(text)) ?? extractFirstJson(text);
  if (!block) return null;

  try {
    const parsed = JSON.parse(block);

    // Ensure numeric fields are clamped to [0,1]
    const clamp = (val: any, defaultVal: number = 0.5): number => {
      const num = Number(val);
      return isNaN(num) ? defaultVal : Math.max(0, Math.min(1, num));
    };

    return {
      condition_score: clamp(parsed.condition_score, 0.5),
      damage_ratio: clamp(parsed.damage_ratio, 0),
      wear_zone_ratio: clamp(parsed.wear_zone_ratio, 0),
      stain_ratio: clamp(parsed.stain_ratio, 0),
      fiber_degradation_score: clamp(parsed.fiber_degradation_score || parsed.fiber_degradation, 0),
      damage_types: Array.isArray(parsed.damage_types) ? parsed.damage_types.map(String) : ['none'],
      description: typeof parsed.description === 'string' ? toReadableText(parsed.description) : '',
    };
  } catch (e) {
    logger.warn('[GLIE/Gemini] JSON parse failed', { error: (e as Error).message, text: text.slice(0, 200) });
    return null;
  }
}
