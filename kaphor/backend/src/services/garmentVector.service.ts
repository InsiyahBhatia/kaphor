/**
 * Garment Vector Generator — Gemini Vision + Attribute Fallback
 *
 * Primary: Gemini Vision analyzes garment image → 20-dim style vector
 * Fallback: Attribute lookup tables (category, style, color, fabric, pattern)
 *
 * Each dimension represents a style axis:
 *   d0:  BOLD/CONTEMPORARY    d10: REFINED/LUXURY
 *   d1:  GRAPHIC/STATEMENT    d11: ARTISANAL/HANDCRAFT
 *   d2:  HERITAGE/VINTAGE     d12: HANDWOVEN/HANDMADE
 *   d3:  CLEAN/STRUCTURED     d13: VIVID/EXPERIMENTAL
 *   d4:  FORMAL/TAILORED      d14: DRAMATIC/OPULENT
 *   d5:  URBAN/STREET         d15: POLISHED/ELEVATED
 *   d6:  CULTURAL/TRADITIONAL d16: DARK/NOCTURNAL
 *   d7:  EARTHY/NATURAL       d17: CRAFTED/ARTISAN
 *   d8:  MODERN/TECH          d18: FLOWING/FREE
 *   d9:  ORGANIC/BOHEMIAN     d19: SOPHISTICATED/CLASSIC
 */

import { logger } from '../lib/logger';
import { generateWithGemini } from './gemini.service';

// ── Gemini Vision Client ─────────────────────────────────────────────────────

const VECTOR_PROMPT = `Analyze this garment image and generate a 20-dimensional style vector.

Each dimension is scored 0.0 to 1.0:
d0: BOLD/CONTEMPORARY (edgy, avant-garde)
d1: GRAPHIC/STATEMENT (prints, logos, bold graphics)
d2: HERITAGE/VINTAGE (retro, archival, classic)
d3: CLEAN/STRUCTURED (minimalist, sharp lines)
d4: FORMAL/TAILORED (suiting, professional)
d5: URBAN/STREET (streetwear, casual cool)
d6: CULTURAL/TRADITIONAL (ethnic, cultural motifs)
d7: EARTHY/NATURAL (organic tones, nature-inspired)
d8: MODERN/TECH (futuristic, techwear)
d9: ORGANIC/BOHEMIAN (free-spirited, relaxed)
d10: REFINED/LUXURY (premium, elegant)
d11: ARTISANAL/HANDCRAFT (handmade quality)
d12: HANDWOVEN/HANDMADE (weaving, artisanal textile)
d13: VIVID/EXPERIMENTAL (bold colors, experimental)
d14: DRAMATIC/OPULENT (opulent, theatrical)
d15: POLISHED/ELEVATED (sophisticated, refined)
d16: DARK/NOCTURNAL (dark palette, moody)
d17: CRAFTED/ARTISAN (detailed craftsmanship)
d18: FLOWING/FREE (draped, fluid, ethereal)
d19: SOPHISTICATED/CLASSIC (timeless, polished)

Return ONLY a JSON object with this exact structure:
{"vector":[d0,d1,d2,d3,d4,d5,d6,d7,d8,d9,d10,d11,d12,d13,d14,d15,d16,d17,d18,d19]}

Rules:
- All values between 0.0 and 1.0
- Use 0.1-0.2 for low presence, 0.5-0.6 for moderate, 0.8-0.9 for dominant
- Be precise — a red silk saree with zari borders should score high on d6, d12, d14
- A black leather jacket should score high on d0, d5, d16
- Return ONLY the JSON, no explanation`;

interface GeminiVectorResult {
  success: boolean;
  vector: number[];
  model: string;
  error?: string;
}

async function generateVectorWithGemini(imageBase64: string, mimeType: string): Promise<GeminiVectorResult> {
  try {
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType || 'image/jpeg',
      },
    };

    const text = await generateWithGemini([VECTOR_PROMPT, imagePart], {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    });
    const trimmed = text.trim();

    // Extract JSON from response
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, vector: [], model: 'gemini', error: 'No JSON in response' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const vector = parsed.vector;

    if (!Array.isArray(vector) || vector.length !== 20) {
      return { success: false, vector: [], model: 'gemini', error: `Invalid vector length: ${vector?.length}` };
    }

    // Clamp all values to [0, 1]
    const clamped = vector.map((v: number) => Math.max(0, Math.min(1, Math.round(v * 100) / 100)));

    logger.info('[GarmentVector] Gemini Vision generated 20-dim vector');
    return { success: true, vector: clamped, model: 'gemini' };
  } catch (error: any) {
    logger.warn(`[GarmentVector] Gemini Vision failed: ${error.message}`);
    return { success: false, vector: [], model: 'gemini', error: error.message };
  }
}

// ── Attribute lookup tables (fallback) ───────────────────────────────────────

const CATEGORY_VECTORS: Record<string, number[]> = {
  blazer:    [0.2, 0.1, 0.2, 0.8, 0.9, 0.1, 0.1, 0.1, 0.3, 0.1, 0.7, 0.1, 0.1, 0.1, 0.1, 0.8, 0.2, 0.1, 0.1, 0.8],
  coat:      [0.3, 0.1, 0.3, 0.7, 0.7, 0.2, 0.1, 0.2, 0.2, 0.1, 0.6, 0.1, 0.1, 0.1, 0.2, 0.7, 0.3, 0.1, 0.2, 0.7],
  jacket:    [0.4, 0.3, 0.2, 0.5, 0.5, 0.4, 0.1, 0.1, 0.4, 0.1, 0.4, 0.1, 0.1, 0.2, 0.2, 0.4, 0.4, 0.1, 0.2, 0.4],
  shirt:     [0.3, 0.2, 0.2, 0.6, 0.5, 0.2, 0.2, 0.2, 0.3, 0.2, 0.5, 0.2, 0.2, 0.1, 0.1, 0.5, 0.2, 0.2, 0.2, 0.6],
  blouse:    [0.2, 0.1, 0.2, 0.5, 0.5, 0.1, 0.3, 0.2, 0.1, 0.2, 0.5, 0.3, 0.2, 0.1, 0.2, 0.5, 0.1, 0.2, 0.4, 0.5],
  tshirt:    [0.5, 0.5, 0.1, 0.3, 0.1, 0.6, 0.1, 0.1, 0.5, 0.1, 0.1, 0.1, 0.1, 0.3, 0.1, 0.1, 0.3, 0.1, 0.1, 0.2],
  top:       [0.3, 0.3, 0.1, 0.4, 0.3, 0.3, 0.2, 0.1, 0.3, 0.2, 0.3, 0.2, 0.1, 0.2, 0.1, 0.3, 0.2, 0.1, 0.3, 0.3],
  sweater:   [0.2, 0.1, 0.3, 0.5, 0.4, 0.1, 0.2, 0.4, 0.1, 0.3, 0.4, 0.3, 0.3, 0.1, 0.1, 0.4, 0.2, 0.4, 0.3, 0.4],
  hoodie:    [0.6, 0.6, 0.1, 0.2, 0.1, 0.8, 0.1, 0.1, 0.5, 0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.4, 0.1, 0.1, 0.1],
  sweatshirt:[0.5, 0.5, 0.1, 0.2, 0.1, 0.7, 0.1, 0.1, 0.4, 0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.3, 0.1, 0.1, 0.1],
  kurta:     [0.1, 0.1, 0.3, 0.4, 0.4, 0.1, 0.8, 0.3, 0.1, 0.3, 0.3, 0.7, 0.7, 0.1, 0.1, 0.3, 0.1, 0.5, 0.3, 0.3],
  kurti:     [0.1, 0.1, 0.2, 0.4, 0.3, 0.1, 0.7, 0.2, 0.1, 0.2, 0.3, 0.6, 0.6, 0.1, 0.1, 0.3, 0.1, 0.4, 0.3, 0.3],
  saree:     [0.1, 0.1, 0.4, 0.3, 0.4, 0.1, 0.9, 0.4, 0.1, 0.3, 0.3, 0.9, 0.9, 0.1, 0.2, 0.3, 0.1, 0.6, 0.5, 0.3],
  lehenga:   [0.2, 0.2, 0.3, 0.3, 0.4, 0.1, 0.8, 0.3, 0.1, 0.2, 0.3, 0.8, 0.8, 0.2, 0.3, 0.3, 0.1, 0.5, 0.5, 0.3],
  trousers:  [0.2, 0.1, 0.2, 0.7, 0.7, 0.1, 0.1, 0.1, 0.2, 0.1, 0.6, 0.1, 0.1, 0.1, 0.1, 0.7, 0.2, 0.1, 0.1, 0.7],
  jeans:     [0.4, 0.3, 0.3, 0.3, 0.1, 0.5, 0.1, 0.2, 0.3, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.2, 0.3, 0.2, 0.1, 0.3],
  skirt:     [0.2, 0.1, 0.2, 0.5, 0.5, 0.1, 0.3, 0.2, 0.1, 0.2, 0.4, 0.3, 0.2, 0.1, 0.2, 0.5, 0.1, 0.2, 0.5, 0.5],
  shorts:    [0.4, 0.3, 0.1, 0.2, 0.1, 0.5, 0.1, 0.1, 0.4, 0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.2, 0.1, 0.2, 0.1],
  dress:     [0.3, 0.2, 0.2, 0.5, 0.5, 0.2, 0.3, 0.2, 0.2, 0.2, 0.5, 0.3, 0.2, 0.2, 0.3, 0.5, 0.2, 0.2, 0.5, 0.5],
  activewear:[0.6, 0.4, 0.1, 0.2, 0.1, 0.6, 0.1, 0.1, 0.7, 0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.3, 0.1, 0.1, 0.1],
  accessory: [0.3, 0.3, 0.3, 0.4, 0.4, 0.2, 0.3, 0.3, 0.2, 0.3, 0.5, 0.4, 0.3, 0.2, 0.3, 0.5, 0.2, 0.4, 0.2, 0.5],
  other:     [0.3, 0.2, 0.2, 0.4, 0.3, 0.3, 0.2, 0.2, 0.3, 0.2, 0.3, 0.2, 0.2, 0.2, 0.2, 0.3, 0.2, 0.2, 0.2, 0.3],
};

const STYLE_VECTORS: Record<string, number[]> = {
  casual:      [0.3, 0.3, 0.1, 0.3, 0.1, 0.4, 0.1, 0.1, 0.3, 0.2, 0.2, 0.1, 0.1, 0.2, 0.1, 0.2, 0.2, 0.1, 0.2, 0.2],
  formal:      [0.1, 0.1, 0.2, 0.8, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.7, 0.1, 0.1, 0.1, 0.1, 0.8, 0.2, 0.1, 0.1, 0.8],
  ethnic:      [0.1, 0.1, 0.3, 0.2, 0.3, 0.1, 0.9, 0.3, 0.1, 0.3, 0.2, 0.8, 0.8, 0.1, 0.1, 0.2, 0.1, 0.6, 0.3, 0.2],
  traditional: [0.1, 0.1, 0.4, 0.2, 0.3, 0.1, 0.9, 0.4, 0.1, 0.3, 0.2, 0.9, 0.9, 0.1, 0.1, 0.2, 0.1, 0.7, 0.3, 0.2],
  western:     [0.4, 0.3, 0.1, 0.5, 0.4, 0.4, 0.1, 0.1, 0.4, 0.1, 0.4, 0.1, 0.1, 0.2, 0.1, 0.4, 0.3, 0.1, 0.2, 0.5],
  party:       [0.4, 0.3, 0.1, 0.3, 0.4, 0.2, 0.2, 0.1, 0.2, 0.1, 0.3, 0.2, 0.1, 0.5, 0.5, 0.4, 0.3, 0.1, 0.5, 0.4],
  sport:       [0.5, 0.4, 0.1, 0.1, 0.1, 0.6, 0.1, 0.1, 0.6, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.3, 0.1, 0.1, 0.1],
};

const COLOR_VECTORS: Record<string, number[]> = {
  black:       [0.4, 0.3, 0.2, 0.5, 0.4, 0.3, 0.1, 0.1, 0.3, 0.1, 0.5, 0.1, 0.1, 0.1, 0.2, 0.5, 0.9, 0.1, 0.1, 0.4],
  white:       [0.1, 0.1, 0.1, 0.8, 0.7, 0.1, 0.1, 0.1, 0.1, 0.1, 0.7, 0.1, 0.1, 0.1, 0.1, 0.7, 0.1, 0.1, 0.1, 0.6],
  blue:        [0.2, 0.2, 0.2, 0.4, 0.3, 0.3, 0.2, 0.2, 0.3, 0.2, 0.3, 0.2, 0.1, 0.1, 0.1, 0.3, 0.4, 0.1, 0.2, 0.4],
  red:         [0.6, 0.5, 0.1, 0.1, 0.2, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.8, 0.7, 0.2, 0.1, 0.1, 0.3, 0.2],
  green:       [0.2, 0.1, 0.2, 0.3, 0.2, 0.1, 0.3, 0.5, 0.1, 0.4, 0.2, 0.3, 0.2, 0.1, 0.1, 0.2, 0.2, 0.3, 0.3, 0.3],
  pink:        [0.3, 0.2, 0.1, 0.3, 0.3, 0.2, 0.2, 0.1, 0.1, 0.1, 0.3, 0.2, 0.1, 0.5, 0.4, 0.3, 0.1, 0.1, 0.4, 0.3],
  yellow:      [0.4, 0.3, 0.1, 0.1, 0.1, 0.2, 0.3, 0.2, 0.1, 0.2, 0.1, 0.3, 0.2, 0.6, 0.3, 0.1, 0.1, 0.1, 0.3, 0.1],
  purple:      [0.4, 0.3, 0.1, 0.2, 0.3, 0.2, 0.2, 0.1, 0.1, 0.1, 0.3, 0.2, 0.1, 0.6, 0.6, 0.3, 0.5, 0.1, 0.3, 0.3],
  brown:       [0.1, 0.1, 0.4, 0.3, 0.2, 0.1, 0.3, 0.7, 0.1, 0.6, 0.2, 0.4, 0.3, 0.1, 0.1, 0.2, 0.1, 0.5, 0.2, 0.3],
  gray:        [0.2, 0.1, 0.2, 0.6, 0.5, 0.2, 0.1, 0.1, 0.2, 0.1, 0.5, 0.1, 0.1, 0.1, 0.1, 0.5, 0.5, 0.1, 0.1, 0.5],
  neutrals:    [0.2, 0.1, 0.2, 0.6, 0.5, 0.2, 0.2, 0.3, 0.2, 0.3, 0.5, 0.2, 0.2, 0.1, 0.1, 0.5, 0.3, 0.2, 0.2, 0.5],
  multicolor:  [0.4, 0.4, 0.2, 0.1, 0.1, 0.3, 0.4, 0.2, 0.2, 0.3, 0.1, 0.4, 0.3, 0.5, 0.3, 0.1, 0.1, 0.3, 0.3, 0.2],
};

const FABRIC_VECTORS: Record<string, number[]> = {
  silk:        [0.1, 0.1, 0.3, 0.4, 0.5, 0.1, 0.4, 0.2, 0.1, 0.2, 0.6, 0.5, 0.3, 0.1, 0.4, 0.6, 0.1, 0.3, 0.5, 0.5],
  cotton:      [0.2, 0.1, 0.2, 0.4, 0.3, 0.2, 0.4, 0.4, 0.1, 0.3, 0.3, 0.5, 0.5, 0.1, 0.1, 0.3, 0.1, 0.4, 0.2, 0.3],
  linen:       [0.1, 0.1, 0.3, 0.4, 0.3, 0.1, 0.3, 0.5, 0.1, 0.5, 0.3, 0.4, 0.3, 0.1, 0.1, 0.3, 0.1, 0.4, 0.4, 0.3],
  wool:        [0.2, 0.1, 0.3, 0.6, 0.6, 0.1, 0.1, 0.3, 0.1, 0.2, 0.5, 0.2, 0.2, 0.1, 0.2, 0.6, 0.3, 0.3, 0.2, 0.6],
  denim:       [0.4, 0.3, 0.3, 0.2, 0.1, 0.5, 0.1, 0.2, 0.3, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.2, 0.3, 0.2, 0.1, 0.3],
  leather:     [0.5, 0.3, 0.2, 0.3, 0.3, 0.4, 0.1, 0.1, 0.3, 0.1, 0.4, 0.1, 0.1, 0.1, 0.3, 0.4, 0.7, 0.1, 0.1, 0.3],
  polyester:   [0.4, 0.4, 0.1, 0.2, 0.1, 0.5, 0.1, 0.1, 0.5, 0.1, 0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1],
  velvet:      [0.2, 0.1, 0.3, 0.4, 0.5, 0.1, 0.2, 0.2, 0.1, 0.1, 0.5, 0.2, 0.1, 0.2, 0.6, 0.5, 0.6, 0.2, 0.3, 0.5],
  chiffon:     [0.1, 0.1, 0.1, 0.3, 0.4, 0.1, 0.3, 0.1, 0.1, 0.1, 0.3, 0.3, 0.2, 0.1, 0.3, 0.4, 0.1, 0.1, 0.7, 0.3],
  georgette:   [0.1, 0.1, 0.2, 0.3, 0.3, 0.1, 0.4, 0.2, 0.1, 0.2, 0.3, 0.4, 0.3, 0.1, 0.2, 0.3, 0.1, 0.3, 0.6, 0.3],
  khadi:       [0.1, 0.1, 0.4, 0.3, 0.2, 0.1, 0.7, 0.5, 0.1, 0.4, 0.2, 0.8, 0.8, 0.1, 0.1, 0.2, 0.1, 0.7, 0.2, 0.2],
  chanderi:    [0.1, 0.1, 0.3, 0.4, 0.4, 0.1, 0.7, 0.3, 0.1, 0.2, 0.4, 0.7, 0.7, 0.1, 0.2, 0.4, 0.1, 0.5, 0.4, 0.3],
  banarasi:    [0.1, 0.1, 0.4, 0.3, 0.4, 0.1, 0.9, 0.4, 0.1, 0.2, 0.4, 0.9, 0.9, 0.1, 0.3, 0.4, 0.1, 0.7, 0.4, 0.3],
  modal:       [0.1, 0.1, 0.2, 0.4, 0.3, 0.1, 0.3, 0.3, 0.1, 0.3, 0.4, 0.3, 0.2, 0.1, 0.1, 0.4, 0.1, 0.3, 0.4, 0.4],
  rayon:       [0.2, 0.2, 0.1, 0.3, 0.2, 0.2, 0.3, 0.2, 0.1, 0.2, 0.2, 0.3, 0.2, 0.2, 0.2, 0.2, 0.1, 0.2, 0.4, 0.2],
  mesh:        [0.5, 0.4, 0.1, 0.1, 0.1, 0.5, 0.1, 0.1, 0.5, 0.1, 0.1, 0.1, 0.1, 0.3, 0.1, 0.1, 0.3, 0.1, 0.1, 0.1],
  cashmere:    [0.1, 0.1, 0.2, 0.6, 0.6, 0.1, 0.1, 0.2, 0.1, 0.1, 0.7, 0.2, 0.1, 0.1, 0.3, 0.8, 0.2, 0.2, 0.3, 0.8],
  net:         [0.3, 0.2, 0.1, 0.2, 0.3, 0.2, 0.2, 0.1, 0.2, 0.1, 0.2, 0.2, 0.1, 0.3, 0.3, 0.2, 0.2, 0.1, 0.4, 0.2],
  tulle:       [0.1, 0.1, 0.1, 0.3, 0.4, 0.1, 0.2, 0.1, 0.1, 0.1, 0.3, 0.2, 0.1, 0.2, 0.5, 0.4, 0.1, 0.1, 0.6, 0.3],
};

const PATTERN_VECTORS: Record<string, number[]> = {
  solid:       [0.2, 0.1, 0.1, 0.6, 0.5, 0.2, 0.1, 0.1, 0.2, 0.1, 0.5, 0.1, 0.1, 0.1, 0.1, 0.5, 0.3, 0.1, 0.1, 0.5],
  striped:     [0.3, 0.3, 0.2, 0.5, 0.4, 0.3, 0.1, 0.1, 0.3, 0.1, 0.3, 0.1, 0.1, 0.2, 0.1, 0.4, 0.2, 0.1, 0.1, 0.4],
  plaid:       [0.2, 0.2, 0.4, 0.4, 0.3, 0.2, 0.1, 0.3, 0.1, 0.3, 0.3, 0.2, 0.1, 0.1, 0.1, 0.3, 0.2, 0.2, 0.1, 0.5],
  floral:      [0.2, 0.1, 0.3, 0.2, 0.2, 0.1, 0.4, 0.3, 0.1, 0.3, 0.2, 0.4, 0.3, 0.3, 0.3, 0.2, 0.1, 0.3, 0.5, 0.2],
  geometric:   [0.4, 0.3, 0.1, 0.5, 0.3, 0.3, 0.2, 0.1, 0.4, 0.1, 0.3, 0.1, 0.1, 0.4, 0.2, 0.3, 0.3, 0.1, 0.1, 0.3],
  abstract:    [0.5, 0.4, 0.1, 0.2, 0.2, 0.3, 0.2, 0.1, 0.3, 0.1, 0.1, 0.2, 0.1, 0.6, 0.4, 0.1, 0.2, 0.1, 0.2, 0.2],
  blockprint:  [0.1, 0.1, 0.3, 0.2, 0.2, 0.1, 0.7, 0.4, 0.1, 0.3, 0.2, 0.8, 0.7, 0.1, 0.1, 0.2, 0.1, 0.6, 0.2, 0.2],
  ikat:        [0.1, 0.1, 0.3, 0.2, 0.2, 0.1, 0.6, 0.3, 0.1, 0.3, 0.2, 0.7, 0.6, 0.1, 0.1, 0.2, 0.1, 0.5, 0.3, 0.2],
  paisley:     [0.2, 0.1, 0.3, 0.2, 0.2, 0.1, 0.6, 0.3, 0.1, 0.3, 0.2, 0.6, 0.5, 0.2, 0.3, 0.2, 0.1, 0.4, 0.4, 0.2],
  polka:       [0.3, 0.2, 0.3, 0.3, 0.2, 0.2, 0.1, 0.2, 0.1, 0.2, 0.2, 0.1, 0.1, 0.3, 0.2, 0.2, 0.1, 0.1, 0.3, 0.3],
  checked:     [0.2, 0.2, 0.3, 0.4, 0.3, 0.2, 0.1, 0.2, 0.2, 0.2, 0.3, 0.1, 0.1, 0.1, 0.1, 0.3, 0.2, 0.1, 0.1, 0.4],
};

// ── Vector math helpers ─────────────────────────────────────────────────────

function clamp(val: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, val));
}

function lookup(table: Record<string, number[]>, key: string): number[] | null {
  if (!key) return null;
  const normalized = key.trim().toLowerCase();
  if (table[normalized]) return table[normalized];
  for (const [k, v] of Object.entries(table)) {
    if (normalized.includes(k) || k.includes(normalized)) return v;
  }
  return null;
}

// ── Attribute-based fallback ─────────────────────────────────────────────────

export interface GarmentAttributes {
  category?: string;
  subCategory?: string;
  style?: string;
  color?: string[] | string;
  fabric?: string;
  pattern?: string;
  sleeve?: string;
  shape?: string;
  weight?: string;
  tags?: string[];
  styleTags?: string[];
}

/**
 * Generate a 20-dim style vector from garment attributes (synchronous fallback).
 */
export function generateGarmentVector(attrs: GarmentAttributes): number[] {
  const vectors: number[][] = [];
  const weights: number[] = [];

  const catKey = attrs.category || attrs.subCategory || '';
  const catVec = lookup(CATEGORY_VECTORS, catKey);
  if (catVec) { vectors.push(catVec); weights.push(0.35); }

  const styleVec = lookup(STYLE_VECTORS, attrs.style || '');
  if (styleVec) { vectors.push(styleVec); weights.push(0.25); }

  const colorStr = Array.isArray(attrs.color) ? attrs.color[0] : (attrs.color || '');
  const colorVec = lookup(COLOR_VECTORS, colorStr);
  if (colorVec) { vectors.push(colorVec); weights.push(0.15); }

  const fabricVec = lookup(FABRIC_VECTORS, attrs.fabric || '');
  if (fabricVec) { vectors.push(fabricVec); weights.push(0.15); }

  const patternVec = lookup(PATTERN_VECTORS, attrs.pattern || '');
  if (patternVec) { vectors.push(patternVec); weights.push(0.10); }

  if (vectors.length === 0) {
    return new Array(20).fill(0.3);
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const result = new Array(20).fill(0);
  for (let i = 0; i < vectors.length; i++) {
    const w = weights[i] / totalWeight;
    for (let d = 0; d < 20; d++) {
      result[d] += vectors[i][d] * w;
    }
  }

  return result.map(v => clamp(Math.round(v * 100) / 100));
}

// ── Hybrid: Gemini Vision + attribute fallback ───────────────────────────────

/**
 * Generate a 20-dim style vector using Gemini Vision on the garment image.
 * Falls back to attribute-based generation if no image or Gemini fails.
 *
 * @param imageUrl - URL of the garment image
 * @param attrs - Garment attributes for fallback
 * @returns 20-dim vector + source info
 */
export async function generateGarmentVectorHybrid(
  imageUrl: string | null | undefined,
  attrs: GarmentAttributes
): Promise<{ vector: number[]; source: 'gemini' | 'attributes' }> {
  // If we have an image, try Gemini Vision first
  if (imageUrl) {
    try {
      // Fetch image and convert to base64
      const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        const geminiResult = await generateVectorWithGemini(base64, contentType);
        if (geminiResult.success && geminiResult.vector.length === 20) {
          logger.info(`[GarmentVector] Using Gemini Vision vector (model: ${geminiResult.model})`);
          return { vector: geminiResult.vector, source: 'gemini' };
        }
      }
    } catch (error: any) {
      logger.warn(`[GarmentVector] Gemini image fetch failed: ${error.message}`);
    }
  }

  // Fallback to attribute-based
  logger.info('[GarmentVector] Using attribute-based vector (fallback)');
  return { vector: generateGarmentVector(attrs), source: 'attributes' };
}
