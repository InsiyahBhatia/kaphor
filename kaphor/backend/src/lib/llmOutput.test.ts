import { z } from 'zod';
import {
  stripCodeFences, extractFirstJson, parseLlmJson, parseLlmJsonWith,
  stripMarkdown, toReadableText, cleanChatReply, errorBody,
} from './llmOutput';

describe('llmOutput', () => {
  it('strips code fences', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('extracts the first balanced object, ignoring braces in strings', () => {
    const t = 'Sure! {"a":"x } y","b":{"c":2}} trailing {"z":1}';
    expect(JSON.parse(extractFirstJson(t)!)).toEqual({ a: 'x } y', b: { c: 2 } });
  });

  it('parses fenced and chatty JSON, returns undefined for garbage', () => {
    expect(parseLlmJson('Here:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseLlmJson('no json here')).toBeUndefined();
  });

  it('validates with zod', () => {
    const s = z.object({ title: z.string() });
    expect(parseLlmJsonWith('{"title":"hi"}', s)).toEqual({ title: 'hi' });
    expect(parseLlmJsonWith('{"title":5}', s)).toBeNull();
  });

  it('strips markdown markers', () => {
    expect(stripMarkdown('## Hi\n**Bold** and `code`\n* item')).toBe('Hi\nBold and code\n• item');
  });

  it('turns JSON replies into readable text', () => {
    expect(toReadableText('{"reply":"Try wide-leg jeans."}')).toBe('Try wide-leg jeans.');
    expect(toReadableText('```json\n{"fabric":"silk","damageFound":"small tear"}\n```'))
      .toBe('Fabric: silk\nDamage found: small tear');
  });

  it('never returns broken JSON as text', () => {
    expect(cleanChatReply('{"reply": "oops', 'Sorry')).toBe('Sorry');
  });

  it('keeps normal text', () => {
    expect(cleanChatReply('**Nice** pick!')).toBe('Nice pick!');
  });

  it('error body has no internals', () => {
    expect(errorBody()).toEqual({ error: 'INTERNAL_ERROR', message: expect.any(String) });
  });
});
