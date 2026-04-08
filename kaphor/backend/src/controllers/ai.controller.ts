import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '../lib/prisma';
import { redisGet, redisSet, redisDel } from '../lib/redis';
import { logger } from '../lib/logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const models = {
  primary: genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }),
  secondary: genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }),
  tertiary: genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' }),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Helper to try multiple models in case of quota or service errors, with exponential backoff */
async function generateWithFallback(prompt: string, config: any = { responseMimeType: 'application/json' }) {
    const sequence: (keyof typeof models)[] = ['primary', 'secondary', 'tertiary'];
    let lastError: any = null;

    for (const key of sequence) {
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            try {
                const model = models[key];
                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: config
                });
                return result.response.text();
            } catch (err: any) {
                lastError = err;
                const status = err.status || (err as any).response?.status;
                // 429 = Quota, 503 = Overloaded → wait and retry
                if (status === 429 || status === 503) {
                    attempts++;
                    if (attempts < maxAttempts) {
                        const delay = Math.pow(2, attempts) * 1000; // 2s, 4s
                        logger.warn(`AI Model ${key} returned ${status}, retrying in ${delay}ms (attempt ${attempts}/${maxAttempts})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    logger.warn(`AI Model ${key} exhausted retries (Status: ${status}), trying next fallback...`);
                    break; // Move to next model
                }
                if (status === 404) {
                    logger.warn(`AI Model ${key} not found, trying next fallback...`);
                    break; // Move to next model
                }
                throw err; // Re-throw other errors immediately
            }
        }
    }
    throw lastError;
}


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

/** Sophisticated scoring logic to determine user style aesthetic deterministically */
function generateHeuristicProfile(answers: string[]) {
    const text = answers.join(' ').toUpperCase();
    
    const scores = {
        MINIMALIST: 0,
        VINTAGE: 0,
        BOLD: 0,
        ETHNIC: 0,
        STREETWEAR: 0,
        LUXURY: 0
    };

    // 1. Scoring Logic
    answers.forEach(ans => {
        const a = ans.toUpperCase();
        
        // Streetwear cues
        if (a.includes('STREETWEAR') || a.includes('OVERSIZED') || a.includes('GRAPHIC') || a.includes('DENIM') || a.includes('EDGY') || a.includes('RELAXED') || a.includes('LOOSE')) scores.STREETWEAR += 2;
        
        // Minimalist cues
        if (a.includes('MINIMAL') || a.includes('NEUTRALS') || a.includes('CLEAN') || a.includes('SIMPLE') || a.includes('TIMELESS') || a.includes('SOLID')) scores.MINIMALIST += 2;
        
        // Vintage cues
        if (a.includes('VINTAGE') || a.includes('FLORAL') || a.includes('SILK') || a.includes('LINEN') || a.includes('RETRO')) scores.VINTAGE += 2;
        
        // Ethnic cues
        if (a.includes('ETHNIC') || a.includes('TRADITIONAL') || a.includes('FLOWING') || a.includes('PATTERNS')) scores.ETHNIC += 2;
        
        // Bold cues
        if (a.includes('BOLD') || a.includes('BRIGHT') || a.includes('EXPERIMENTAL') || a.includes('STATEMENT') || a.includes('CHIC') || a.includes('TRENDY')) scores.BOLD += 2;
        
        // Luxury cues
        if (a.includes('LUXURY') || a.includes('ELEGANT') || a.includes('REFINED') || a.includes('POLISHED') || a.includes('TAILORED') || a.includes('CLASSY')) scores.LUXURY += 2;
    });

    // 2. Find winner
    const aesthetic = (Object.keys(scores) as (keyof typeof scores)[]).reduce((a, b) => scores[a] > scores[b] ? a : b);

    // 3. Vector Definition (Stable seeds for each aesthetic)
    const vectors: Record<string, number[]> = {
        MINIMALIST: [0.1, 0.1, 0.1, 0.9, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1],
        STREETWEAR: [0.9, 0.8, 0.1, 0.1, 0.2, 0.9, 0.1, 0.1, 0.7, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
        VINTAGE:    [0.2, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1, 0.8, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
        ETHNIC:     [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1, 0.9, 0.8, 0.1, 0.1, 0.1],
        BOLD:       [0.8, 0.9, 0.1, 0.1, 0.1, 0.5, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.9, 0.9, 0.1],
        LUXURY:     [0.1, 0.1, 0.1, 0.5, 0.5, 0.1, 0.1, 0.1, 0.1, 0.1, 0.5, 0.1, 0.1, 0.1, 0.1, 0.9]
    };

    const summaries: Record<string, string> = {
        MINIMALIST: "Your archive priorities are clean lines, high-quality basics, and a versatile neutral palette.",
        STREETWEAR: "You thrive in oversized silhouettes, bold graphics, and urban-industrial textures.",
        VINTAGE:    "You value the history of garments, seeking unique silhouettes and heritage textiles.",
        ETHNIC:     "Your style celebrates traditional craftsmanship, vibrant patterns, and natural flowing fabrics.",
        BOLD:       "You are a statement-maker, choosing experimental cuts and high-impact color combinations.",
        LUXURY:     "Your aesthetic is defined by impeccable tailoring, refined materials, and a polished contemporary silhouette."
    };

    return {
        styleVector: vectors[aesthetic] || vectors.LUXURY,
        styleAesthetic: aesthetic,
        recommendedBrands: ["KaPhor Selects", "Heritage Archive"],
        preferredCategories: ["Apparel", "Outerwear"],
        colorPalette: ["#1A1A1A", "#F5F0E8", "#C41E3A"], // Brand palette
        summary: summaries[aesthetic]
    };
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
        const quizHash = `quiz:v3:${Buffer.from(JSON.stringify(answers)).toString('base64').substring(0, 32)}`;
        const cached = await redisGet(quizHash);
        if (cached) {
            const profile = JSON.parse(cached);
            await db.user.update({
                where: { id: req.user.id },
                data: {
                    styleVector: profile.styleVector,
                    styleAesthetic: profile.styleAesthetic,
                    onboardingDone: true
                }
            });
            res.json({ data: { ...profile, message: 'Style profile updated (cached)' } });
            return;
        }

        // Logic-based generation (Determinstic)
        logger.info('Processing style quiz via Logic Engine');
        const profile = generateHeuristicProfile(answers);

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
                styleAesthetic: profile.styleAesthetic as any,
                onboardingDone: true
            }
        });

        // Store in cache for 24 hours
        await redisSet(quizHash, JSON.stringify(profile), 60 * 60 * 24);

        res.json({
            data: {
                ...profile,
                message: 'Style profile generated via Logic Engine'
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

        const { message, garmentId, conversationId, stream = true } = req.body;
        if (!message) { res.status(400).json({ error: 'message required' }); return; }

        // Find or create conversation
        let conversation;
        if (conversationId) {
            conversation = await db.chatConversation.findUnique({
                where: { id: conversationId },
                include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } }
            });
        }

        if (!conversation) {
            conversation = await db.chatConversation.create({
                data: {
                    userId: req.user.id,
                    garmentId: garmentId ? String(garmentId) : null,
                    title: message.substring(0, 40)
                },
                include: { messages: true }
            });
        }

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

        // Build conversation history from DB

        const historyParts = conversation.messages.map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }));

        // Save user message
        await db.chatMessage.create({
            data: { conversationId: conversation.id, role: 'user', content: message }
        });

        // Set headers based on streaming mode
        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();
        }

        let fullResponse = '';
        let chatAttempts = 0;
        const chatMaxAttempts = 3;
        if (stream) {
            let streamSuccess = false;
            while (chatAttempts < chatMaxAttempts && !streamSuccess) {
                try {
                    const chatSession = models.primary.startChat({
                        history: historyParts as any,
                        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] }
                    });

                    const result = await chatSession.sendMessageStream(message);

                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        fullResponse += chunkText;
                        res.write(`data: ${JSON.stringify({ text: chunkText, conversationId: conversation.id })}\n\n`);
                    }
                    streamSuccess = true;
                } catch (streamErr: any) {
                    const status = streamErr.status;
                    if ((status === 503 || status === 429) && chatAttempts < chatMaxAttempts - 1) {
                        chatAttempts++;
                        const delay = Math.pow(2, chatAttempts) * 1000;
                        logger.warn(`Chat stream failed (${status}), retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        fullResponse = ''; // Reset
                    } else {
                        throw streamErr;
                    }
                }
            }

            // Save assistant response
            await db.chatMessage.create({
                data: {
                    conversationId: conversation.id,
                    role: 'assistant',
                    content: fullResponse
                }
            });

            res.write('data: [DONE]\n\n');
            res.end();
        } else {
            const chatSession = models.primary.startChat({
                history: historyParts as any,
                systemInstruction: { role: "system", parts: [{ text: systemPrompt }] }
            });

            const result = await chatSession.sendMessage(message);
            fullResponse = result.response.text();

            // Save assistant response
            await db.chatMessage.create({
                data: {
                    conversationId: conversation.id,
                    role: 'assistant',
                    content: fullResponse
                }
            });

            res.json({ text: fullResponse, conversationId: conversation.id });
        }
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

// ── 5. AI Vision: Condition Assessment + Upcycle ─────────────────────────────
export async function assessCondition(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { image, description, garmentId } = req.body;
        if (!image && !description) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Provide an image (base64) and/or a description' });
            return;
        }

        // Optionally enrich with garment data from DB
        let garmentContext = '';
        if (garmentId) {
            const garment = await db.garment.findUnique({
                where: { id: garmentId },
                select: { title: true, brand: true, material: true, color: true, category: true, condition: true }
            });
            if (garment) {
                garmentContext = `\nKnown garment details:\n- Name: ${garment.title}\n- Brand: ${garment.brand}\n- Material: ${(garment.material as string[]).join(', ')}\n- Color: ${(garment.color as string[]).join(', ')}\n- Category: ${garment.category}\n- Listed condition: ${garment.condition}`;
            }
        }

        const prompt = `You are KaPhor AI, a luxury sustainable fashion condition expert.
Analyze the provided garment image and description, then return ONLY valid JSON with this exact structure:
{
  "condition": {
    "grade": "EXCELLENT|GOOD|FAIR|POOR|WORN",
    "score": /* integer 0-100 */,
    "fiberHealth": "EXCELLENT|GOOD|FAIR|DEGRADED",
    "wearAnalysis": "2-3 sentence description of visible wear, stains, damage, or pristine condition",
    "colorFading": "NONE|MINIMAL|MODERATE|SIGNIFICANT",
    "structuralIntegrity": "INTACT|MINOR_ISSUES|NEEDS_REPAIR"
  },
  "circularRecommendation": {
    "action": "RESELL|RENT|UPCYCLE|RECYCLE|DONATE",
    "reasoning": "1-2 sentence explanation of why this action is best",
    "estimatedValue": "HIGH|MEDIUM|LOW",
    "sustainabilityScore": /* integer 0-100, how eco-friendly this path is */
  },
  "upcycleSuggestions": [
    {
      "title": "Creative name for the idea",
      "description": "2-3 sentence description of the transformation",
      "difficulty": "Easy|Intermediate|Advanced",
      "materialsNeeded": ["material1", "material2"],
      "estimatedTime": "e.g. 2-3 hours",
      "sustainabilityImpact": "1 sentence on environmental benefit"
    }
    /* exactly 3 suggestions */
  ]
}
${garmentContext}
${description ? `User description: ${description}` : ''}
Analyze the garment carefully. Be specific about visible defects or quality indicators.`;

        // Build multimodal parts
        const parts: any[] = [];

        if (image) {
            // image is expected as a base64 data URI or raw base64
            let base64Data = image;
            let mimeType = 'image/jpeg';

            if (image.startsWith('data:')) {
                // Extract mime type and base64 from data URI
                const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
                if (match) {
                    mimeType = match[1];
                    base64Data = match[2];
                }
            }

            parts.push({
                inlineData: { mimeType, data: base64Data }
            });
        }

        parts.push({ text: prompt });

        const result = await models.primary.generateContent({
            contents: [{ role: 'user', parts }],
            generationConfig: { responseMimeType: 'application/json' }
        });

        const rawResult = result.response.text();
        const assessment = safeJson(rawResult);

        res.json({ data: assessment });
    } catch (error) {
        logger.error('Condition assessment failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── 6. Upcycle Suggestions (text-only legacy) ────────────────────────────────
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

        const raw = await generateWithFallback(prompt);
        const resJson = safeJson(raw);

        res.json({ data: resJson.suggestions });
    } catch (error) {
        logger.error('Upcycle suggestions failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── 6. Chat History ───────────────────────────────────────────────────────────
export async function getChatHistory(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { conversationId } = req.params;
        if (conversationId) {
            const messages = await db.chatMessage.findMany({
                where: { conversationId },
                orderBy: { createdAt: 'asc' }
            });
            res.json({ data: messages });
        } else {
            const convs = await db.chatConversation.findMany({
                where: { userId: req.user.id },
                include: { garment: { select: { title: true, images: true } } },
                orderBy: { updatedAt: 'desc' }
            });
            res.json({ data: convs });
        }
    } catch (error) {
        logger.error('getChatHistory failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}
