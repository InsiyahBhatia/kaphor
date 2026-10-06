import { Request, Response } from 'express';
import { errorBody } from '../lib/llmOutput';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { createNotification } from '../services/notification.service';
import { sendEmail } from '../services/email.service';

// ── STUDIO CONTENT (text only — no mock images per Kaphor image policy) ─────
// Thumbnails are intentionally empty strings; clients render the Kaphor
// placeholder card instead of third-party stock photos.
const STUDIO_TUTORIALS = [
    {
        id: 't1',
        title: 'Reconstructing the Classic Silk Blazer',
        description: 'Deconstruct a tailored silk blazer and rebuild it as a relaxed, boxy layer with raw-edge lapels. Covers seam-ripping, pattern mapping and finishing.',
        thumbnail: '',
        duration: '18:42',
        difficulty: 'Intermediate',
        isNewRelease: true,
        isFeatured: true,
        videoUrl: '',
        type: 'Tutorials'
    },
    {
        id: 't2',
        title: 'Dyeing Techniques for Heritage Sarees',
        description: 'Natural and fiber-reactive dye methods for silk and cotton sarees — including shibori folding, gradient dips and colour-fast setting.',
        thumbnail: '',
        duration: '12:05',
        difficulty: 'Beginner',
        isNewRelease: false,
        isFeatured: false,
        videoUrl: '',
        type: 'Tutorials'
    },
    {
        id: 't3',
        title: 'Zardosi Embroidery Restoration',
        description: 'How to re-secure tarnished zardosi metalwork, replace missing dabka coils and match historic gold thread on ceremonial garments.',
        thumbnail: '',
        duration: '24:17',
        difficulty: 'Advanced',
        isNewRelease: false,
        isFeatured: false,
        videoUrl: '',
        type: 'Tutorials'
    },
    {
        id: 't4',
        title: 'Upcycling Vintage Lehengas',
        description: 'Turn a heavy vintage lehenga skirt into a contemporary co-ord set — panel reuse, waistband reconstruction and weight redistribution.',
        thumbnail: '',
        duration: '09:33',
        difficulty: 'Beginner',
        isNewRelease: true,
        isFeatured: false,
        videoUrl: '',
        type: 'Services'
    }
];

const STUDIO_TRANSFORMATIONS = [
    {
        id: 'tr1',
        beforeImage: '',
        afterImage: '',
        description: 'Deconstructed 1990s bridal lehenga → contemporary asymmetric silhouette',
        creatorUsername: '@oria'
    },
    {
        id: 'tr2',
        beforeImage: '',
        afterImage: '',
        description: 'Faded silk saree → structured corset top + palazzo set',
        creatorUsername: '@nadiav'
    },
    {
        id: 'tr3',
        beforeImage: '',
        afterImage: '',
        description: 'Worn sherwani → reversible quilted jacket',
        creatorUsername: '@chloeX'
    }
];

// ── CONTROLLERS ──────────────────────────────────────────────────────────────
export async function getTutorials(req: Request, res: Response): Promise<void> {
    try {
        const { type } = req.query;
        const filtered = type
            ? STUDIO_TUTORIALS.filter((t: any) => t.type === type)
            : STUDIO_TUTORIALS;
        res.json({ data: filtered });
    } catch (error) {
        logger.error('Failed fetching tutorials', { error });
        res.status(500).json(errorBody());
    }
}

export async function getTransformations(req: Request, res: Response): Promise<void> {
    try {
        res.json({ data: STUDIO_TRANSFORMATIONS });
    } catch (error) {
        logger.error('Failed fetching transformations', { error });
        res.status(500).json(errorBody());
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
                    createNotification({
                        userId: u.id,
                        type: 'ADMIN_BESPOKE_REQUEST',
                        title: 'New Bespoke Consultation',
                        body: `New request from ${requester?.displayName ?? 'a user'}`,
                        data: { requestId: request.id, userId: req.user!.id, garmentId: request.garmentId ?? null },
                    })
                )
            );
        }

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
        res.status(500).json(errorBody());
    }
}
