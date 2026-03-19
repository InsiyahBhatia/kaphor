import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { getIO } from '../lib/socket';

// ── MOCK DATA (real impl would be a DB seed / CMS) ───────────────────────────
const MOCK_TUTORIALS = [
    {
        id: 't1',
        title: 'Reconstructing the Classic Silk Blazer',
        thumbnail: 'https://picsum.photos/seed/tut1/600/340',
        duration: '18:42',
        difficulty: 'Intermediate',
        isNewRelease: true,
        isFeatured: true,
        videoUrl: 'https://example.com/videos/silk-blazer',
        type: 'Tutorials'
    },
    {
        id: 't2',
        title: 'Dyeing Techniques for Heritage Sarees',
        thumbnail: 'https://picsum.photos/seed/tut2/600/340',
        duration: '12:05',
        difficulty: 'Beginner',
        isNewRelease: false,
        isFeatured: false,
        videoUrl: 'https://example.com/videos/saree-dye',
        type: 'Tutorials'
    },
    {
        id: 't3',
        title: 'Zardosi Embroidery Restoration',
        thumbnail: 'https://picsum.photos/seed/tut3/600/340',
        duration: '24:17',
        difficulty: 'Advanced',
        isNewRelease: false,
        isFeatured: false,
        videoUrl: 'https://example.com/videos/zardosi',
        type: 'Tutorials'
    },
    {
        id: 't4',
        title: 'Upcycling Vintage Lehengas',
        thumbnail: 'https://picsum.photos/seed/tut4/600/340',
        duration: '09:33',
        difficulty: 'Beginner',
        isNewRelease: true,
        isFeatured: false,
        videoUrl: 'https://example.com/videos/lehenga-upcycle',
        type: 'Services'
    }
];

const MOCK_TRANSFORMATIONS = [
    {
        id: 'tr1',
        beforeImage: 'https://picsum.photos/seed/bef1/400/500',
        afterImage: 'https://picsum.photos/seed/aft1/400/500',
        description: 'Deconstructed 1990s bridal lehenga → contemporary asymmetric silhouette',
        creatorUsername: '@oria'
    },
    {
        id: 'tr2',
        beforeImage: 'https://picsum.photos/seed/bef2/400/500',
        afterImage: 'https://picsum.photos/seed/aft2/400/500',
        description: 'Faded silk saree → structured corset top + palazzo set',
        creatorUsername: '@nadiav'
    },
    {
        id: 'tr3',
        beforeImage: 'https://picsum.photos/seed/bef3/400/500',
        afterImage: 'https://picsum.photos/seed/aft3/400/500',
        description: 'Worn sherwani → reversible quilted jacket',
        creatorUsername: '@chloeX'
    }
];

// ── CONTROLLERS ──────────────────────────────────────────────────────────────
export async function getTutorials(req: Request, res: Response): Promise<void> {
    try {
        const { type } = req.query;
        const filtered = type
            ? MOCK_TUTORIALS.filter((t: any) => t.type === type)
            : MOCK_TUTORIALS;
        res.json({ data: filtered });
    } catch (error) {
        logger.error('Failed fetching tutorials', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function getTransformations(req: Request, res: Response): Promise<void> {
    try {
        res.json({ data: MOCK_TRANSFORMATIONS });
    } catch (error) {
        logger.error('Failed fetching transformations', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function createBespokeRequest(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { garmentId, description, contactEmail } = req.body;
        if (!description || !contactEmail) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'description and contactEmail are required' });
            return;
        }

        const request = await db.bespokeRequest.create({
            data: {
                userId: req.user.id,
                garmentId: garmentId || null,
                description,
                contactEmail
            }
        });

        // Notify admin via Socket.IO
        try {
            const io = getIO();
            if (io) io.emit('bespoke:new', { requestId: request.id, userId: req.user.id });
        } catch (_) { /* not critical */ }

        // Simulate email confirmation log
        logger.info(`Bespoke consultation email sent to ${contactEmail}`);

        res.status(201).json({ data: request });
    } catch (error) {
        logger.error('Failed creating bespoke request', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}
