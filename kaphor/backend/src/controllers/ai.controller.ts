import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import db from '../lib/prisma';
import { redisGet, redisSet, redisDel } from '../lib/redis';
import { logger } from '../lib/logger';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Dot-product cosine similarity between two equal-length float arrays */
function cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

function safeJson(text: string): any {
    // Extract JSON object/array even if Claude wraps it in markdown
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    return JSON.parse(match ? match[1].trim() : text.trim());
}

// ── 1. Style Quiz ─────────────────────────────────────────────────────────────
export async function processStyleQuiz(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { answers } = req.body;
        if (!Array.isArray(answers) || !answers.length) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'answers[] required' });
            return;
        }

        const prompt = `Analyze these fashion style quiz answers and return ONLY valid JSON (no markdown) with this exact shape:
{
  "styleVector": [/* 16 floats between 0 and 1 */],
  "styleAesthetic": "MINIMALIST|VINTAGE|BOLD|ETHNIC|STREETWEAR|LUXURY",
  "recommendedBrands": ["brand1","brand2","brand3"],
  "preferredCategories": ["category1","category2"],
  "colorPalette": ["#hex1","#hex2","#hex3","#hex4"],
  "summary": "2-3 sentence style personality description"
}
Quiz answers: ${JSON.stringify(answers)}`;

        const message = await anthropic.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 1024,
            system: 'You are a luxury fashion stylist AI for KaPhor, a circular fashion platform. Return only valid JSON, no prose.',
            messages: [{ role: 'user', content: prompt }]
        });

        const raw = (message.content[0] as Anthropic.TextBlock).text;
        const profile = safeJson(raw);

        // Validate aesthetic
        const validAesthetics = ['MINIMALIST', 'VINTAGE', 'BOLD', 'ETHNIC', 'STREETWEAR', 'LUXURY'];
        if (!validAesthetics.includes(profile.styleAesthetic)) {
            profile.styleAesthetic = 'LUXURY';
        }

        // Persist to user
        await db.user.update({
            where: { id: req.user.id },
            data: {
                styleVector: profile.styleVector,
                styleAesthetic: profile.styleAesthetic,
                onboardingDone: true
            }
        });

        // Bust recommendations cache
        await redisDel(`recs:${req.user.id}`);
        res.json({
            data: {
                ...profile,
                message: 'Style profile updated successfully'
            }
        });
    } catch (error) {
        logger.error('Style quiz failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── 2. Recommendations ────────────────────────────────────────────────────────
export async function getRecommendations(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const cacheKey = `recs:${req.user.id}`;
        const cached = await redisGet(cacheKey);
        if (cached) {
            res.json({ data: JSON.parse(cached), cached: true });
            return;
        }

        const user = await db.user.findUnique({
            where: { id: req.user.id },
            select: { styleVector: true }
        });

        const garments = await db.garment.findMany({
            where: { isActive: true, lifecycleState: 'LISTED' },
            take: 200,
            select: {
                id: true, title: true, brand: true, category: true,
                condition: true, price: true, images: true,
                garmentVector: true, recyclableFiber: true,
                seller: { select: { username: true } }
            }
        });

        const userVec = user?.styleVector ?? [];

        const scored = garments
            .map((g: any) => {
                const score = userVec.length && g.garmentVector.length
                    ? cosineSimilarity(userVec, g.garmentVector)
                    : Math.random() * 0.3 + 0.6; // fallback for no vector
                return { ...g, fitScore: Math.round(score * 100) };
            })
            .sort((a: any, b: any) => b.fitScore - a.fitScore)
            .slice(0, 20);

        await redisSet(cacheKey, JSON.stringify(scored), 30 * 60);
        res.json({ data: scored, cached: false });
    } catch (error) {
        logger.error('Recommendations failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── 3. Fit Score ──────────────────────────────────────────────────────────────
export async function getFitScore(req: Request, res: Response): Promise<void> {
    try {
        const { userId, garmentId } = req.params;

        const [user, garment] = await Promise.all([
            db.user.findUnique({ where: { id: userId }, select: { styleVector: true, styleAesthetic: true } }),
            db.garment.findUnique({ where: { id: garmentId }, select: { garmentVector: true, styleTags: true, material: true, color: true } })
        ]);

        if (!user || !garment) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

        const overall = cosineSimilarity(user.styleVector, garment.garmentVector);

        // Simulated sub-dimension scores derived from the overall + noise
        const base = overall * 100;
        const colorMatch = Math.min(100, Math.round(base * 0.95 + Math.random() * 8));
        const styleMatch = Math.min(100, Math.round(base * 1.05 + Math.random() * 5));
        const sizeCompat = Math.min(100, Math.round(80 + Math.random() * 20));
        const occasionFit = Math.min(100, Math.round(base * 0.90 + Math.random() * 10));
        const overallScore = Math.min(100, Math.round((colorMatch + styleMatch + sizeCompat + occasionFit) / 4));

        res.json({
            data: {
                colorMatch,
                styleMatch,
                sizeCompatibility: sizeCompat,
                occasionFit,
                overallScore,
                label: `${overallScore}% FIT`
            }
        });
    } catch (error) {
        logger.error('Fit score failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── 4. Chat (SSE streaming) ───────────────────────────────────────────────────
export async function chat(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { message, history = [] } = req.body;
        if (!message) { res.status(400).json({ error: 'message required' }); return; }

        // Fetch user context
        const user = await db.user.findUnique({
            where: { id: req.user.id },
            select: { styleAesthetic: true, displayName: true }
        });

        const systemPrompt = `You are KaPhor AI, a luxury sustainable fashion consultant.
Help users discover garments, understand sustainability impact, and receive style advice.
Always align with circular fashion principles — re-sell, rent, upcycle, recycle.
The user's name is ${user?.displayName ?? 'Valued Guest'} and their style aesthetic is ${user?.styleAesthetic ?? 'LUXURY'}.
Be warm, knowledgeable, and concise. Never suggest fast fashion.`;

        // Build message history
        const messages: Anthropic.MessageParam[] = [
            ...history.map((h: { role: string; content: string }) => ({
                role: h.role as 'user' | 'assistant',
                content: h.content
            })),
            { role: 'user', content: message }
        ];

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const stream = await anthropic.messages.stream({
            model: 'claude-opus-4-5',
            max_tokens: 1024,
            system: systemPrompt,
            messages
        });

        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        logger.error('Chat failed', { error });
        if (!res.headersSent) {
            res.status(500).json({ error: 'INTERNAL_ERROR' });
        } else {
            res.write('data: [ERROR]\n\n');
            res.end();
        }
    }
}

// ── 5. Upcycle Suggestions ───────────────────────────────────────────────────
export async function getUpcycleSuggestions(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { garmentId, condition, targetCategory } = req.body;
        if (!garmentId) { res.status(400).json({ error: 'garmentId required' }); return; }

        const garment = await db.garment.findUnique({
            where: { id: garmentId },
            select: { title: true, brand: true, material: true, color: true, category: true, condition: true }
        });

        if (!garment) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

        const prompt = `You are a sustainable fashion upcycling expert for KaPhor.
Given this garment, return ONLY valid JSON (no markdown) with exactly 3 upcycle transformation ideas.
Each idea must have: { "title": string, "description": string, "difficulty": "Easy|Intermediate|Advanced", "materialsNeeded": string[], "estimatedTime": string, "sustainabilityImpact": string }

Garment details:
- Name: ${garment.title}
- Brand: ${garment.brand}
- Material: ${garment.material.join(', ')}
- Color: ${garment.color.join(', ')}
- Category: ${garment.category}
- Condition: ${condition || garment.condition}
- Target category: ${targetCategory || 'any'}

Return: { "suggestions": [ ...3 ideas... ] }`;

        const message = await anthropic.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 1200,
            messages: [{ role: 'user', content: prompt }]
        });

        const raw = (message.content[0] as Anthropic.TextBlock).text;
        const result = safeJson(raw);

        res.json({ data: result.suggestions });
    } catch (error) {
        logger.error('Upcycle suggestions failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}
