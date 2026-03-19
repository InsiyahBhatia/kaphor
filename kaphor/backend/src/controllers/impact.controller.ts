import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { IMPACT_CONSTANTS, calculateTier } from '../lib/impact.constants';

export async function getMyImpact(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        const user = await db.user.findUnique({
            where: { id: req.user.id },
            include: { impactRecord: true }
        });

        if (!user) {
            res.status(404).json({ error: 'NOT_FOUND' });
            return;
        }

        const impact = user.impactRecord || {
            carbonSavedKg: 0,
            waterSavedL: 0,
            itemsCirculated: 0,
            itemsUpcycled: 0,
            itemsRecycled: 0
        };

        const tierInfo = calculateTier(impact.carbonSavedKg);
        const equivalentTrees = Math.floor(impact.carbonSavedKg / IMPACT_CONSTANTS.TREE_CO2_EQ_KG);

        // Next milestone copy
        let nextMilestone = "Maintain your incredible streak!";
        if (tierInfo.nextTier) {
            nextMilestone = `You are ${tierInfo.nextTierKgRemaining.toFixed(1)}kg away from ${tierInfo.nextTier} status!`;
        }

        res.json({
            data: {
                impactRecord: impact,
                tier: tierInfo.currentTier,
                nextTierKgRemaining: tierInfo.nextTierKgRemaining,
                progressPercentage: tierInfo.progress,
                equivalentTrees,
                nextMilestone,
                user: {
                    displayName: user.displayName,
                    avatar: user.avatar,
                    createdAt: user.createdAt
                }
            }
        });
    } catch (error) {
        logger.error('Failed fetching impact record', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function getImpactReport(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED' });
            return;
        }

        // Mock detail aggregation, representing historical performance compared to average
        const mockMonthlyHistory = [
            { month: 'Jan', kg: 4, label: 'Resell' },
            { month: 'Feb', kg: 12, label: 'Upcycle' },
            { month: 'Mar', kg: 8, label: 'Resell' },
            { month: 'Apr', kg: 3, label: 'Rental' },
        ];

        const mockCommunityAvgKg = 15;

        res.json({
            data: {
                monthlyHistory: mockMonthlyHistory,
                communityAverageKg: mockCommunityAvgKg,
                message: "You are heavily outperforming the monthly community average threshold! Keep circulating."
            }
        });

    } catch (error) {
        logger.error('Failed fetching impact generic report', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}
