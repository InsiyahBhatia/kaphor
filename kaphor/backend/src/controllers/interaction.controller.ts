import { Request, Response } from 'express';
import db from '../lib/prisma';
import { EventType } from '@prisma/client';
import { logger } from '../lib/logger';
import { evaluateLifecycle } from '../services/lifecycle.service';

export async function createInteraction(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }

        const { garmentId, eventType, metadata } = req.body;

        if (!garmentId || !eventType || !(eventType in EventType)) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid garmentId or eventType' });
            return;
        }

        // 1. Create BehaviourEvent
        await db.behaviourEvent.create({
            data: {
                userId: req.user.id,
                garmentId: String(garmentId),
                eventType: eventType as EventType,
                metadata: metadata ? (metadata as any) : undefined,
            }
        });

        // 2. Upsert BehaviourSignal
        // We update interestScore based on event type heuristics
        const scoreImpact: Record<string, number> = {
            VIEW: 0.05,
            SAVE: 0.15,
            WISHLIST: 0.20,
            ADD_TO_CART: 0.30,
            PURCHASE_INTENT: 0.40,
        };

        const impact = scoreImpact[eventType as string] || 0.05;

        await db.behaviourSignal.upsert({
            where: {
                userId_garmentId: { userId: req.user.id, garmentId: String(garmentId) }
            },
            update: {
                recentEventCount: { increment: 1 },
                interestScore: { increment: impact },
            },
            create: {
                userId: req.user.id,
                garmentId: String(garmentId),
                recentEventCount: 1,
                interestScore: impact,
            }
        });

        // 3. Trigger LOE execution
        const loeResult = await evaluateLifecycle(String(garmentId), req.user.id, String(eventType));

        // 4. Return action
        res.status(201).json({ data: loeResult });
    } catch (err) {
        logger.error('createInteraction failed', { error: err instanceof Error ? err.message : String(err) });
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
}
