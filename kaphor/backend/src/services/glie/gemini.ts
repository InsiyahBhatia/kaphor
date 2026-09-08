/**
 * Gemini API Client with 5-model fallback chain
 * Uses the existing @google/generative-ai SDK
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../lib/logger';

// Model fallback chain — ordered by performance/availability
const MODEL_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

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

let genAIInstance: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

/**
 * Call Gemini Vision API with the RAG-augmented prompt
 * Tries each model in the fallback chain until one succeeds
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

  const genAI = getGenAI();

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

  for (const modelName of MODEL_CHAIN) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              { text: `${systemPrompt}\n\n${userPrompt}` },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
        },
      });

      const text = result.response.text();

      if (!text || text.trim().length === 0) {
        logger.warn(`[GLIE/Gemini] Model ${modelName} returned empty response`);
        continue;
      }

      const parsed = parseGeminiResponse(text);
      if (!parsed) {
        logger.warn(`[GLIE/Gemini] Model ${modelName} returned unparseable JSON`);
        continue;
      }

      logger.info(`[GLIE/Gemini] Model ${modelName} succeeded`);
      return {
        success: true,
        data: parsed,
        model: modelName,
      };
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      logger.warn(`[GLIE/Gemini] Model ${modelName} failed: status=${status} error=${err.message}`);
      // Continue to next model
    }
  }

  logger.error('[GLIE/Gemini] All models in fallback chain failed');
  return {
    success: false,
    data: null,
    model: 'none',
    error: 'All Gemini models failed',
  };
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
