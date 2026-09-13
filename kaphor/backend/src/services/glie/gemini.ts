/**
 * Gemini API Client for GLIE vision scoring
 * Uses the shared multi-key + multi-model rotation client
 */

import { logger } from '../../lib/logger';
import { generateWithGemini } from '../gemini.service';

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
}

/**
 * Call Gemini Vision API with the RAG-augmented prompt
 */
export async function callGeminiVision(
  systemPrompt: string,
  userPrompt: string,
  imageBase64: string,
): Promise<GeminiResult> {
  // 1. Try local fine-tuned Qwen2-VL GLIE endpoint ONLY if explicitly enabled in .env
  const qwenEndpoint = process.env.QWEN_GLIE_URL;
  if (qwenEndpoint) {
    try {
      logger.info(`[GLIE/VLM] Attempting fine-tuned Qwen2-VL endpoint at ${qwenEndpoint}`);
      const res = await fetch(qwenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, systemPrompt, userPrompt }),
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

    logger.info('[GLIE/Gemini] Assessment succeeded');
    return {
      success: true,
      data: parsed,
      model: 'gemini',
    };
  } catch (err: any) {
    logger.error(`[GLIE/Gemini] Failed: ${err.message}`);
    return {
      success: false,
      data: null,
      model: 'none',
      error: err.message,
    };
  }
}

/**
 * Parse and validate Gemini JSON response
 * Extracts JSON block via regex, clamps values to [0,1]
 */
function parseGeminiResponse(text: string): GeminiSubScores | null {
  // Try to find JSON block
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);

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
      description: typeof parsed.description === 'string' ? parsed.description : '',
    };
  } catch (e) {
    logger.warn('[GLIE/Gemini] JSON parse failed', { error: (e as Error).message, text: text.slice(0, 200) });
    return null;
  }
}
