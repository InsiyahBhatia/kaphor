/**
 * Shared helpers for turning raw LLM output into safe, readable values.
 * No endpoint should ever return a JSON-looking string or markdown as user text.
 */
import { z, ZodTypeAny } from 'zod';

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again in a moment.';

/** Standard error body: never includes internal error details. */
export function errorBody(code = 'INTERNAL_ERROR', message = GENERIC_ERROR_MESSAGE) {
  return { error: code, message };
}

/** Remove ```json ... ``` fences (keeps the inner text). */
export function stripCodeFences(text: string): string {
  if (!text) return '';
  const fenced = text.match(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.replace(/```[a-zA-Z0-9_-]*/g, '').trim();
}

/** Find the first balanced {...} or [...] block that parses (string/escape aware). */
export function extractFirstJson(text: string): string | null {
  if (!text) return null;
  for (let start = 0; start < text.length; start++) {
    const open = text[start];
    if (open !== '{' && open !== '[') continue;
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {
            break; // try next start
          }
        }
      }
    }
  }
  return null;
}

/** Parse JSON out of messy model output. Returns undefined when nothing parses. */
export function parseLlmJson(text: string): unknown | undefined {
  if (!text || typeof text !== 'string') return undefined;
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch { /* fall through */ }
  const block = extractFirstJson(cleaned) ?? extractFirstJson(text);
  if (!block) return undefined;
  try {
    return JSON.parse(block);
  } catch {
    return undefined;
  }
}

/** Parse and validate with a zod schema. Returns null when invalid. */
export function parseLlmJsonWith<S extends ZodTypeAny>(text: string, schema: S): z.infer<S> | null {
  const raw = parseLlmJson(text);
  if (raw === undefined) return null;
  const res = schema.safeParse(raw);
  return res.success ? res.data : null;
}

/** Strip markdown markers so text reads cleanly in a plain chat bubble. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[a-zA-Z0-9_-]*\n?/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s).,!?]|$)/g, '$1$2')
    .replace(/\*\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function humanizeKey(key: string): string {
  const s = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function jsonToLines(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((v) =>
      v && typeof v === 'object' ? jsonToLines(v) : [`• ${String(v)}`],
    );
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Common wrappers: {reply: "..."} {message: "..."} {text: "..."}
    for (const k of ['reply', 'message', 'text', 'response', 'answer', 'content']) {
      if (typeof obj[k] === 'string' && Object.keys(obj).length <= 3) return [String(obj[k])];
    }
    return Object.entries(obj).flatMap(([k, v]) => {
      if (v === null || v === undefined || v === '') return [];
      if (typeof v === 'object') {
        const inner = jsonToLines(v);
        return inner.length ? [`${humanizeKey(k)}:`, ...inner] : [];
      }
      return [`${humanizeKey(k)}: ${String(v)}`];
    });
  }
  return [String(value)];
}

/**
 * Turn any model output into clean, human-readable plain text.
 * - strips code fences and markdown markers
 * - if the text is JSON, converts it to readable lines
 * - falls back to `fallback` when nothing readable is left
 */
export function toReadableText(input: unknown, fallback = ''): string {
  if (input === null || input === undefined) return fallback;
  if (typeof input !== 'string') {
    const lines = jsonToLines(input);
    return lines.length ? lines.join('\n') : fallback;
  }
  const trimmed = stripCodeFences(input).trim();
  if (/^[{[]/.test(trimmed)) {
    const parsed = parseLlmJson(trimmed);
    if (parsed !== undefined) {
      const lines = jsonToLines(parsed);
      return lines.length ? stripMarkdown(lines.join('\n')) : fallback;
    }
    // Looks like JSON but is broken: never show it.
    if (/^[{[]\s*"/.test(trimmed)) return fallback;
  }
  const out = stripMarkdown(trimmed);
  return out || fallback;
}

/** Short, friendly chat reply: plain text, no markdown, no JSON. */
export function cleanChatReply(
  input: unknown,
  fallback = 'Here are a few ideas for you. Take a look below.',
): string {
  return toReadableText(input, fallback);
}
