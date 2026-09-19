import { Request, Response } from 'express';
import { RecommendationService } from '../services/recommendation.service';
import { PreferenceService } from '../services/preference.service';
import { logger } from '../lib/logger';

export async function getPersonalizedFeed(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const userId = req.user?.id || 'guest';
    const feed = await RecommendationService.getPersonalizedFeed(userId, limit);
    res.json({ data: feed });
  } catch (error: any) {
    logger.error('getPersonalizedFeed failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch recommendations' });
  }
}

export async function getSimilarGarments(req: Request, res: Response): Promise<void> {
  try {
    const { garmentId } = req.params;
    if (!garmentId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'garmentId is required' });
      return;
    }
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '8'), 10)));
    const similar = await RecommendationService.getSimilarGarments(garmentId, limit);
    res.json({ data: similar });
  } catch (error: any) {
    logger.error('getSimilarGarments failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch similar items' });
  }
}

export async function getRentalRecommendations(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));
    const userId = req.user?.id || 'guest';
    const rentals = await RecommendationService.getRentalRecommendations(userId, limit);
    res.json({ data: rentals });
  } catch (error: any) {
    logger.error('getRentalRecommendations failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch rental recommendations' });
  }
}

export async function getFairSwapRecommendations(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '8'), 10)));
    const userId = req.user?.id || 'guest';
    const swaps = await RecommendationService.getFairSwapRecommendations(userId, limit);
    res.json({ data: swaps });
  } catch (error: any) {
    logger.error('getFairSwapRecommendations failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch swap recommendations' });
  }
}

export async function getUserTasteProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const profile = await PreferenceService.getTasteProfile(req.user.id);
    if (!profile) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User profile not found' });
      return;
    }
    res.json({ data: profile });
  } catch (error: any) {
    logger.error('getUserTasteProfile failed', { error: error.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch taste profile' });
  }
}
