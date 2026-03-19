import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';
import { getIO } from '../lib/socket';
import { uploadImage } from '../lib/cloudinary';

// ──────────────────────────────
// FEED
// ──────────────────────────────
export async function getFeed(req: Request, res: Response): Promise<void> {
    try {
        const cursor = req.query.cursor as string | undefined;
        const limit = 10;

        // Get IDs of followed users (or return curated if not auth'd)
        let followedUserIds: string[] = [];
        if (req.user) {
            const follows = await db.follow.findMany({
                where: { followerId: req.user.id },
                select: { followingId: true }
            });
            followedUserIds = follows.map((f: any) => f.followingId);
        }

        const posts = await db.post.findMany({
            take: limit + 1,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            where: {
                isPublished: true,
                ...(followedUserIds.length > 0 ? { userId: { in: followedUserIds } } : {})
            },
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        location: true
                    }
                },
                likes: { select: { id: true } },
                comments: { select: { id: true } }
            }
        });

        const hasNextPage = posts.length > limit;
        const items = hasNextPage ? posts.slice(0, -1) : posts;
        const nextCursor = hasNextPage ? items[items.length - 1].id : null;

        const enriched = items.map((p: any) => ({
            ...p,
            likeCount: p.likes.length,
            commentCount: p.comments.length,
            likes: undefined,
            comments: undefined
        }));

        res.json({ data: enriched, nextCursor });
    } catch (error) {
        logger.error('Failed to fetch feed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ──────────────────────────────
// CREATE POST
// ──────────────────────────────
export async function createPost(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { type, caption, garmentIds, tags } = req.body;
        let images: string[] = req.body.images || [];

        // Handle multipart upload from frontend
        if (req.file) {
            const uploaded = await uploadImage(req.file.buffer, 'social_posts');
            images.push(uploaded.url);
        }

        const post = await db.post.create({
            data: {
                userId: req.user.id,
                type: type || 'OUTFIT',
                caption: caption || '',
                images,
                garmentIds: Array.isArray(garmentIds) ? garmentIds : [],
                tags: Array.isArray(tags) ? tags : [],
                isPublished: true
            }
        });

        res.status(201).json({ data: post });
    } catch (error) {
        logger.error('Failed creating post', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ──────────────────────────────
// TOGGLE LIKE
// ──────────────────────────────
export async function toggleLike(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { id: postId } = req.params;

        const existing = await db.like.findFirst({
            where: { userId: req.user.id, postId }
        });

        if (existing) {
            await db.like.delete({ where: { id: existing.id } });
            res.json({ liked: false });
        } else {
            await db.like.create({ data: { userId: req.user.id, postId } });
            res.json({ liked: true });
        }
    } catch (error) {
        logger.error('Failed toggling like', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ──────────────────────────────
// ADD COMMENT
// ──────────────────────────────
export async function addComment(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { id: postId } = req.params;
        const { content } = req.body;

        if (!content?.trim()) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Comment content is required' });
            return;
        }

        const post = await db.post.findUnique({ where: { id: postId }, select: { userId: true } });
        if (!post) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

        const comment = await db.comment.create({
            data: { userId: req.user.id, postId, content },
            include: { user: { select: { username: true, avatar: true } } }
        });

        // Emit Socket.IO event to post owner
        try {
            const io = getIO();
            if (io) io.to(`user:${post.userId}`).emit('comment:new', { postId, comment });
        } catch (_) { /* socket not critical */ }

        res.status(201).json({ data: comment });
    } catch (error) {
        logger.error('Failed adding comment', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ──────────────────────────────
// GET COMMENTS
// ──────────────────────────────
export async function getComments(req: Request, res: Response): Promise<void> {
    try {
        const { id: postId } = req.params;
        const cursor = req.query.cursor as string | undefined;
        const limit = 20;

        const comments = await db.comment.findMany({
            where: { postId },
            take: limit + 1,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { username: true, avatar: true } } }
        });

        const hasNextPage = comments.length > limit;
        const items = hasNextPage ? comments.slice(0, -1) : comments;
        const nextCursor = hasNextPage ? items[items.length - 1].id : null;

        res.json({ data: items, nextCursor });
    } catch (error) {
        logger.error('Failed getting comments', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ──────────────────────────────
// FOLLOW / UNFOLLOW
// ──────────────────────────────
export async function followUser(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { userId: followingId } = req.params;
        if (followingId === req.user.id) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot follow yourself' });
            return;
        }

        const existing = await db.follow.findFirst({
            where: { followerId: req.user.id, followingId }
        });

        if (!existing) {
            await db.follow.create({ data: { followerId: req.user.id, followingId } });
        }

        res.json({ following: true });
    } catch (error) {
        logger.error('Failed following user', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function unfollowUser(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { userId: followingId } = req.params;

        await db.follow.deleteMany({
            where: { followerId: req.user.id, followingId }
        });

        res.json({ following: false });
    } catch (error) {
        logger.error('Failed unfollowing user', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}
