import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '../lib/prisma';
import { logger } from '../lib/logger';

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export async function checkCondition(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { garmentId } = req.body;

        if (!garmentId) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing garmentId' });
            return;
        }

        const garment = await db.garment.findUnique({ where: { id: garmentId } });
        if (!garment || garment.sellerId !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Garment not found or unauthorized' });
            return;
        }

        let conditionStr = garment.condition;
        let recommendedAction = 'RE_SELL';
        let recyclableFiber = garment.recyclableFiber || 50;

        if (genAI && garment.images?.length > 0) {
            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const imageUrl = garment.images[0];

                const prompt = `You are a textile condition assessment AI. Analyze this garment image and return ONLY valid JSON with these fields:
{
  "condition": "PRISTINE" | "MINOR_WEAR" | "MODERATE_WEAR" | "SIGNIFICANT_WEAR" | "DAMAGED",
  "recyclableFiberPercent": <number 0-100>,
  "recommendedAction": "RE_SELL" | "UPCYCLE" | "RECYCLE_ONLY",
  "notes": "<brief explanation>"
}

Base the recyclableFiberPercent on how much of the material can be mechanically or chemically recycled.`;

                const result = await model.generateContent([
                    { text: prompt },
                    { inlineData: { mimeType: 'image/jpeg', data: imageUrl.startsWith('http') ? '' : imageUrl } }
                ]);

                const text = result.response.text();
                const parsed = JSON.parse(text.replace(/```json?/g, '').replace(/```/g, '').trim());

                conditionStr = parsed.condition || conditionStr;
                recyclableFiber = typeof parsed.recyclableFiberPercent === 'number' ? parsed.recyclableFiberPercent : recyclableFiber;
                recommendedAction = parsed.recommendedAction || recommendedAction;
            } catch (aiErr) {
                logger.warn('Gemini condition assessment failed, using fallback', { error: aiErr instanceof Error ? aiErr.message : String(aiErr) });
                if (recyclableFiber > 80) {
                    recommendedAction = 'RECYCLE_ONLY';
                } else if (recyclableFiber > 50) {
                    recommendedAction = 'UPCYCLE';
                }
            }
        } else {
            if (recyclableFiber > 80) {
                recommendedAction = 'RECYCLE_ONLY';
            } else if (recyclableFiber > 50) {
                recommendedAction = 'UPCYCLE';
            }
        }

        res.json({
            data: {
                condition: conditionStr,
                recommendedAction,
                recyclableFiber,
            }
        });
    } catch (error) {
        logger.error('Failed condition check', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function getGarmentLifecycle(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;

        const garment = await db.garment.findUnique({
            where: { id }
        });

        if (!garment) {
            res.status(404).json({ error: 'NOT_FOUND' });
            return;
        }

        const mockFiber = garment.recyclableFiber || 75;
        let recommendedAction = 'RE_SELL';

        if (mockFiber > 80) recommendedAction = 'RECYCLE_ONLY';
        else if (mockFiber > 50) recommendedAction = 'UPCYCLE';

        res.json({
            data: {
                lifecycleState: garment.lifecycleState,
                recyclableFiber: mockFiber,
                condition: garment.condition,
                recommendedAction
            }
        });
    } catch (error) {
        logger.error('Failed fetching lifecycle', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function scheduleCollection(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { garmentId, address, preferredSlot, partnerId } = req.body;

        if (!garmentId || !address || !preferredSlot || !partnerId) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing fields' });
            return;
        }

        const garment = await db.garment.findUnique({ where: { id: garmentId } });
        if (!garment || garment.sellerId !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN' });
            return;
        }

        // Create the collection request
        const request = await db.circularRequest.create({
            data: {
                userId: req.user.id,
                garmentId,
                address,
                preferredSlot,
                partnerId,
                status: 'SCHEDULED'
            }
        });

        // Update garment lifecycle conceptually
        await db.garment.update({
            where: { id: garmentId },
            data: {
                lifecycleState: 'REUSE_UPCYCLE_RECYCLE',
                isActive: false
            }
        });

        // Simulate sending an email:
        logger.info(`Sending circular collection email to ${req.user.email} for slot ${preferredSlot}`);

        res.status(201).json({ data: request });
    } catch (error) {
        logger.error('Failed scheduling collection', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function getPartners(req: Request, res: Response): Promise<void> {
    try {
        const partners = [
            { id: 'p1', name: 'Renewcell', type: 'Recycler' },
            { id: 'p2', name: 'KaPhor Lab', type: 'Upcycler' },
            { id: 'p3', name: 'EcoCer', type: 'Processor' }
        ];

        res.json({ data: partners });
    } catch (error) {
        logger.error('Failed fetching partners', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}
