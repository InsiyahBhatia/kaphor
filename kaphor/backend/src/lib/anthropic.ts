import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger';

const apiKey = process.env.ANTHROPIC_API_KEY;
const defaultModel = 'claude-sonnet-4-20250514';

export const anthropic = apiKey
  ? new Anthropic({ apiKey })
  : (null as unknown as Anthropic);

export interface GenerateCompletionParams {
  system: string;
  user: string;
  maxTokens?: number;
}

export async function generateCompletion(params: GenerateCompletionParams): Promise<string> {
  if (!anthropic) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  const { system, user, maxTokens = 1024 } = params;
  try {
    const message = await anthropic.messages.create({
      model: defaultModel,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const textBlock = message.content.find((b) => b.type === 'text');
    return textBlock && 'text' in textBlock ? textBlock.text : '';
  } catch (err: unknown) {
    const isRateLimit = err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 429;
    if (isRateLimit) {
      await new Promise((r) => setTimeout(r, 1000));
      const retry = await anthropic.messages.create({
        model: defaultModel,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const textBlock = retry.content.find((b) => b.type === 'text');
      return textBlock && 'text' in textBlock ? textBlock.text : '';
    }
    logger.error('Anthropic API error', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export default anthropic;
