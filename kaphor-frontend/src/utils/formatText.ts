/**
 * Helpers that make sure users only ever see plain, readable text:
 * no markdown markers, no code fences, no raw JSON, no "[object Object]".
 */

/** "damageFound" / "damage_found" -> "Damage found" */
export function humanizeKey(key: string): string {
  const s = String(key ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Turn any value into a short readable string. Empty values give ''. */
export function formatValue(value: unknown, maxLength = 80): string {
  if (value === null || value === undefined) return '';
  let out: string;
  if (typeof value === 'string') out = value.trim();
  else if (typeof value === 'number') out = Number.isFinite(value) ? String(value) : '';
  else if (typeof value === 'boolean') out = value ? 'Yes' : 'No';
  else if (value instanceof Date) out = value.toLocaleString('en-IN');
  else if (Array.isArray(value)) {
    out = value.map((v) => formatValue(v, maxLength)).filter(Boolean).join(', ');
  } else if (typeof value === 'object') {
    out = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const f = formatValue(v, maxLength);
        return f ? `${humanizeKey(k)}: ${f}` : '';
      })
      .filter(Boolean)
      .join(', ');
  } else out = String(value);
  if (maxLength > 0 && out.length > maxLength) out = `${out.slice(0, maxLength - 1).trimEnd()}…`;
  return out;
}

/** Readable label/value pairs from an object. Skips empty values. */
export function objectToPairs(obj: unknown, maxLength = 80): { label: string; value: string }[] {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => ({ label: humanizeKey(k), value: formatValue(v, maxLength) }))
    .filter((p) => p.label && p.value);
}

function stripFences(text: string): string {
  const fenced = text.match(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.replace(/```[a-zA-Z0-9_-]*/g, '').trim();
}

function tryParseJson(text: string): unknown | undefined {
  const t = text.trim();
  if (!/^[{[]/.test(t)) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

function toLines(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object') return [String(value)];
  if (Array.isArray(value)) {
    return value.flatMap((v) => (v && typeof v === 'object' ? toLines(v) : [`• ${formatValue(v, 0)}`]));
  }
  const obj = value as Record<string, unknown>;
  for (const k of ['reply', 'message', 'text', 'response', 'answer', 'content']) {
    if (typeof obj[k] === 'string' && Object.keys(obj).length <= 3) return [obj[k] as string];
  }
  return Object.entries(obj).flatMap(([k, v]) => {
    if (v === null || v === undefined || v === '') return [];
    if (typeof v === 'object') {
      const inner = toLines(v);
      return inner.length ? [`${humanizeKey(k)}:`, ...inner] : [];
    }
    return [`${humanizeKey(k)}: ${formatValue(v, 0)}`];
  });
}

/**
 * Clean model text for display:
 * - converts JSON (even inside code fences) to readable lines
 * - removes markdown markers (**bold**, # headings, `code`)
 * - turns "-" / "*" list markers into bullet characters
 */
export function cleanText(input: unknown, fallback = ''): string {
  if (input === null || input === undefined) return fallback;
  let text: string;
  if (typeof input === 'string') text = input;
  else text = toLines(input).join('\n');

  text = stripFences(text);
  const parsed = tryParseJson(text);
  if (parsed !== undefined) {
    text = toLines(parsed).join('\n');
  } else if (/^[{[]\s*"/.test(text)) {
    // Looks like broken JSON: never show it
    return fallback;
  }

  text = text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s).,!?]|$)/g, '$1$2')
    .replace(/\*\*/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || fallback;
}

export interface TextBlock {
  type: 'paragraph' | 'bullet';
  text: string;
}

/** Split clean text into paragraph and bullet lines for rendering. */
export function toBlocks(input: unknown, fallback = ''): TextBlock[] {
  const text = cleanText(input, fallback);
  if (!text) return [];
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) =>
      /^[•]\s*/.test(line)
        ? { type: 'bullet' as const, text: line.replace(/^[•]\s*/, '') }
        : { type: 'paragraph' as const, text: line },
    );
}
