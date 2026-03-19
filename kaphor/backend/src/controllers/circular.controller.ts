import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';

// Mock Cloudinary/Anthropic response for now (since we don't have keys)
// Real implementation would upload to Cloudinary -> pass URL to Anthropic -> parse JSON response
export async function checkCondition(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const { garmentId } = req.body;
        // conditionImages[] would be in req.files if we used multer

        if (!garmentId) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing garmentId' });
            return;
        }

        const garment = await db.garment.findUnique({ where: { id: garmentId } });
        if (!garment || garment.sellerId !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Garment not found or unauthorized' });
            return;
        }

        // --- Mock Anthropic Assessment ---
        // Let's assume the AI determines it based on its initial recyclableFiber or random mock
        const mockFiber = garment.recyclableFiber || 75;
        let recommendedAction = 'RE_SELL';
        let conditionStr = 'PRISTINE';

        if (mockFiber > 80) {
            recommendedAction = 'RECYCLE_ONLY';
            conditionStr = 'RECYCLE_ONLY';
        } else if (mockFiber > 50) {
            recommendedAction = 'UPCYCLE';
            conditionStr = 'UPCYCLE';
        } else {
            // Let it default to resell if fiber is low or it's new
            conditionStr = 'MINOR_WEAR';
        }

        res.json({
            data: {
                condition: conditionStr,
                recommendedAction,
                recyclableFiber: mockFiber
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
