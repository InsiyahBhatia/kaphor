import { Request, Response } from 'express';
import db from '../lib/prisma';
import { logger } from '../lib/logger';

export async function addToCart(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { garmentId } = req.body;
    if (!garmentId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'garmentId is required' });
      return;
    }

    const existing = await db.cartItem.findUnique({
      where: {
        userId_garmentId: {
          userId: req.user.id,
          garmentId: String(garmentId),
        },
      },
    });

    if (existing) {
      res.status(409).json({
        error: 'ALREADY_IN_CART',
        message: 'This unique circular piece is already in your shopping bag',
      });
      return;
    }

    const cartItem = await db.cartItem.create({
      data: {
        userId: req.user.id,
        garmentId: String(garmentId),
      },
    });

    res.status(201).json({ data: cartItem, message: 'Item added to shopping bag' });
  } catch (error) {
    logger.error('addToCart failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function getCart(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const cartItems = await db.cartItem.findMany({
      where: { userId: req.user.id },
      include: {
        garment: {
          select: {
            id: true,
            title: true,
            brand: true,
            price: true,
            images: true,
            category: true,
            size: true,
            seller: { select: { displayName: true } },
          },
        },
      },
    });

    const resolvedItems = await Promise.all(
      cartItems.map(async (item: any) => {
        if (item.garment && item.garment.images) {
          const { getDownloadUrl } = await import('../lib/cloudinary');
          const resolvedImages = await Promise.all(
            item.garment.images.map((img: string) => getDownloadUrl(img))
          );
          return {
            ...item,
            garment: { ...item.garment, images: resolvedImages },
          };
        }
        return item;
      })
    );

    res.json({ data: resolvedItems });
  } catch (error) {
    logger.error('getCart failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function removeFromCart(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const { garmentId } = req.params;

    await db.cartItem.delete({
      where: {
        userId_garmentId: {
          userId: req.user.id,
          garmentId: String(garmentId),
        },
      },
    });

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    logger.error('removeFromCart failed', { error });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}
