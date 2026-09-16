import { Request, Response } from 'express';
import db from '../lib/prisma';
import { EventType } from '@prisma/client';
import { logger } from '../lib/logger';
import { evaluateLifecycle, initiateResell } from '../services/lifecycle.service';
import { ImpactService } from '../services/impact.service';
import { PreferenceService } from '../services/preference.service';

export async function createInteraction(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }

        const { garmentId, eventType, metadata } = req.body;

        if (!eventType || !(eventType in EventType)) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid or missing eventType' });
            return;
        }

        const isNonGarmentEvent = eventType === 'SEARCH' || eventType === 'FILTER_APPLY';
        if (!garmentId && !isNonGarmentEvent) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'garmentId is required for this eventType' });
            return;
        }

        // 1. Create BehaviourEvent
        await db.behaviourEvent.create({
            data: {
                userId: req.user.id,
                garmentId: garmentId ? String(garmentId) : null,
                eventType: eventType as EventType,
                metadata: metadata ? (metadata as any) : undefined,
            }
        });

        // Asynchronously process event in PreferenceService to evolve vector & profile
        PreferenceService.processEvent(
            req.user.id,
            eventType as EventType,
            garmentId ? String(garmentId) : null,
            metadata
        ).catch((e) => logger.warn('[PreferenceService] background error', e));

        if (!garmentId) {
            res.status(201).json({ data: { success: true, eventType } });
            return;
        }

        // 2. Upsert BehaviourSignal
        // We update interestScore based on event type heuristics
        const scoreImpact: Record<string, number> = {
            VIEW: 0.05,
            SAVE: 0.15,
            WISHLIST: 0.20,
            ADD_TO_CART: 0.30,
            PURCHASE_INTENT: 0.40,
            LOG_WEAR: 0.50,
        };

        const impact = scoreImpact[eventType as string] || 0.05;

        // If it's a LOG_WEAR event, reset decay, credit avoided manufacturing impact,
        // and ALWAYS maintain the garment in OWNERSHIP state in the user's digital wardrobe.
        if (eventType === 'LOG_WEAR') {
            const wearImpactData = await ImpactService.recordWearImpact(String(garmentId), req.user.id);
            await db.behaviourSignal.upsert({
                where: {
                    userId_garmentId: { userId: req.user.id, garmentId: String(garmentId) }
                },
                update: {
                    recentEventCount: { increment: 1 },
                    interestScore: { increment: 0.50 },
                    interactionDecay: 0,
                },
                create: {
                    userId: req.user.id,
                    garmentId: String(garmentId),
                    recentEventCount: 1,
                    interestScore: 0.50,
                    interactionDecay: 0,
                }
            });

            // Re-affirm that the garment remains in OWNERSHIP in user's digital closet
            await db.garment.updateMany({
                where: { id: String(garmentId), sellerId: req.user.id },
                data: { lifecycleState: 'OWNERSHIP' }
            });

            res.status(201).json({
                data: {
                    action: 'SUPPRESS',
                    newState: 'OWNERSHIP',
                    score: 1.0,
                    wearImpact: wearImpactData
                }
            });
            return;
        }

        // If it's a SELL_INTENT event, transition via lifecycle service (validates OWNERSHIP state)
        // Then return early — initiateResell handles the complete transition including socket emit.
        // Skipping evaluateLifecycle prevents LOE from overwriting SELL_INTENT state.
        if (eventType === 'SELL_INTENT') {
            const resellResult = await initiateResell(String(garmentId), req.user.id);
            if (resellResult.action === 'SUPPRESS') {
                res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot sell: garment is not in OWNERSHIP state' });
                return;
            }
            await db.behaviourSignal.upsert({
                where: {
                    userId_garmentId: { userId: req.user.id, garmentId: String(garmentId) }
                },
                update: {
                    recentEventCount: { increment: 1 },
                    interestScore: { increment: scoreImpact['SELL_INTENT'] || 0.50 },
                },
                create: {
                    userId: req.user.id,
                    garmentId: String(garmentId),
                    recentEventCount: 1,
                    interestScore: scoreImpact['SELL_INTENT'] || 0.50,
                }
            });
            res.status(201).json({ data: { action: 'TRANSITION', newState: 'SELL_INTENT', score: 1.0 } });
            return;
        }

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
