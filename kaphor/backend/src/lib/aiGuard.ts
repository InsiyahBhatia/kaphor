import crypto from 'crypto';

/**
 * Shared guard rails for every outbound LLM call (Gemini, Groq).
 *
 * - AI_TOTAL_TIMEOUT_MS: one budget for the whole call, however many keys/models are tried.
 * - Images bigger than ~6 MB are rejected before they are sent (they would time out or be refused anyway).
 * - Prompts are capped so a runaway RAG context cannot create a huge, slow, expensive request.
 * - Identical requests are cached for a few minutes (see AI_CACHE_TTL_MS) using a hash, never the raw text/image.
 */
export const AI_TOTAL_TIMEOUT_MS = Math.max(5_000, Number(process.env.AI_TIMEOUT_MS) || 25_000);
export const AI_ATTEMPT_TIMEOUT_MS = 15_000;
export const AI_CACHE_TTL_MS = 3 * 60_000;
export const MAX_PROMPT_CHARS = 60_000;
/** ~6 MB of binary data once base64 encoded (base64 is 4/3 the size). */
export const MAX_IMAGE_BASE64_CHARS = Math.ceil((6 * 1024 * 1024 * 4) / 3);

export class AiInputError extends Error {
  status = 413;
  code = 'IMAGE_TOO_LARGE';
  constructor(message = 'Image is too large (max 6 MB). Please use a smaller photo.') {
    super(message);
  }
}

export function assertImageSize(base64: string | undefined | null): void {
  if (base64 && base64.length > MAX_IMAGE_BASE64_CHARS) throw new AiInputError();
}

export function capPrompt(text: string): string {
  return text.length > MAX_PROMPT_CHARS ? text.slice(0, MAX_PROMPT_CHARS) : text;
}

/** Stable short digest of anything JSON-like; large strings (images) are hashed, not embedded. */
export function digest(...values: unknown[]): string {
  const h = crypto.createHash('sha256');
  for (const v of values) {
    h.update(typeof v === 'string' ? v : JSON.stringify(v) ?? '');
    h.update('\u0001');
  }
  return h.digest('hex');
}

/** Deadline helper: remaining milliseconds before the shared budget runs out. */
export function startBudget(totalMs = AI_TOTAL_TIMEOUT_MS) {
  const end = Date.now() + totalMs;
  return {
    remaining: () => end - Date.now(),
    expired: () => Date.now() >= end,
  };
}
