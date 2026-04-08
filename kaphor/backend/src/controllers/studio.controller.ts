import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { sendNotification } from '../services/notificationService';
import { sendEmail } from '../services/email.service';

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

        // Notify admins (in-app + email)
        const adminEmail = 'kaphor.team@gmail.com';
        const [adminUsers, requester] = await Promise.all([
            db.user.findMany({ where: { email: adminEmail }, select: { id: true } }),
            db.user.findUnique({
                where: { id: req.user.id },
                select: { displayName: true, email: true },
            }),
        ]);

        const html = `
          <h3>New Bespoke Consultation Request</h3>
          <p><b>Request ID:</b> ${request.id}</p>
          <p><b>Requester:</b> ${requester?.displayName ?? req.user.id} (${requester?.email ?? ''})</p>
          <p><b>Garment:</b> ${request.garmentId ?? 'N/A'}</p>
          <p><b>Contact email:</b> ${contactEmail}</p>
          <p><b>Description:</b></p>
          <pre style="white-space: pre-wrap;">${String(description).slice(0, 4000)}</pre>
        `;

        if (adminUsers.length) {
            await Promise.all(
                adminUsers.map((u: { id: string }) =>
                    sendNotification(u.id, {
                        type: 'ADMIN_BESPOKE_REQUEST',
                        title: 'New Bespoke Consultation',
                        body: `New request from ${requester?.displayName ?? 'a user'}`,
                        data: { requestId: request.id, userId: req.user!.id, garmentId: request.garmentId ?? null },
                    })
                )
            );
        }

        // Email is mocked/logged in this repo, but keeps the required integration point.
        await sendEmail({
            to: adminEmail,
            subject: 'Kaphor: New Bespoke Consultation Request',
            html,
        });

        logger.info('Bespoke consultation dispatched to admin', {
            requestId: request.id,
            to: adminEmail,
            adminsFound: adminUsers.length,
        });

        res.status(201).json({ data: request });
    } catch (error) {
        logger.error('Failed creating bespoke request', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}
