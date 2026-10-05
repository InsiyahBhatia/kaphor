/**
 * Kaphor — Lifecycle Optimization Engine (LOE)
 * Core patentable component.
 * Determines routing action for each garment-user pair.
 */

import db from '../lib/prisma';
import { emitToUser } from '../lib/socket';

export type LOEAction = 'PROMOTE' | 'SUPPRESS' | 'TRANSITION' | 'SCHEDULE';

interface LOEInput {
  garmentId: string;
  userId: string;
}

export interface LOEResult {
  action: LOEAction;
  newState?: string;
  targetUsers?: string[];
  cooldownEnd?: Date;
  score: number;
}

// ── Configurable thresholds ──────────────────────
const THRESHOLDS = {
  INTEREST_THRESHOLD: Number(process.env.INTEREST_THRESHOLD) || 0.4,
  DECLINE_THRESHOLD: Number(process.env.DECLINE_THRESHOLD) || 0.15,
  SATURATION_WINDOW_DAYS: Number(process.env.SATURATION_WINDOW_DAYS) || 7,
  SATURATION_MAX_EVENTS: Number(process.env.SATURATION_MAX_EVENTS) || 20,
  // Extrapolated/Assumed thresholds
  COMPAT_MIN: 0.45,
  ENGAGEMENT_MIN: 0.2,
  DECAY_MAX: 0.7,
  COOLDOWN_BASE_HRS: 24,
};

const LOE_MUTABLE_STATES: string[] = ['LISTED', 'INTEREST', 'DECLINE', 'CIRCULATION'];

// ── Cosine similarity ────────────────────────────
function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function computeCompatibilityScore(userVector: number[], garmentVector: number[]): number {
  return cosine(userVector, garmentVector);
}

// ── Main LOE decision ────────────────────────────
export async function evaluateLifecycle(garmentId: string, userId: string, eventType: string): Promise<LOEResult> {
  const [garment, user, signal] = await Promise.all([
    db.garment.findUnique({ where: { id: garmentId } }),
    db.user.findUnique({ where: { id: userId } }),
    db.behaviourSignal.findUnique({
      where: { userId_garmentId: { userId, garmentId } }
    }),
  ]);

  if (!garment || !user) {
    return { action: 'SUPPRESS', score: 0 };
  }

  // Behavioural routing must never touch garments that are reserved, in escrow, in a wardrobe,
  // paused/de-listed, or otherwise outside the live-marketplace states.
  if (
    !garment.isActive ||
    garment.reservedOrderId ||
    !LOE_MUTABLE_STATES.includes(garment.lifecycleState)
  ) {
    return { action: 'SUPPRESS', score: 0 };
  }

  // 1. Compute compatibility score
  const compatScore = computeCompatibilityScore(user.styleVector, garment.garmentVector);

  const interestScore = signal?.interestScore ?? 0;
  const engagementRate = signal?.engagementRate ?? 0;
  const interactionDecay = signal?.interactionDecay ?? 0;
  const recentEventCount = signal?.recentEventCount ?? 0;

  // 2. Calculate saturationScore = α×RecentEventCount + (1-EngagementRate) + β×InteractionDecay
  const alpha = 0.5;
  const beta = 0.5;
  const saturationScore = (alpha * recentEventCount) + (1 - engagementRate) + (beta * interactionDecay);

  // 3. Saturation check
  const saturated =
    recentEventCount >= THRESHOLDS.SATURATION_MAX_EVENTS ||
    saturationScore > 10; // Assuming a threshold for saturation score

  // Calculate cooldown end and target users if saturated
  let targetUsers: string[] = [];
  let cooldownEnd: Date | undefined;

  if (saturated) {
    const severityMultiplier = Math.min(recentEventCount / THRESHOLDS.SATURATION_MAX_EVENTS, 3);
    const cooldownHrs = THRESHOLDS.COOLDOWN_BASE_HRS * severityMultiplier;
    cooldownEnd = new Date(Date.now() + cooldownHrs * 3600 * 1000);
    targetUsers = await findCompatibleUsers(garment.garmentVector, userId, 20);

    for (const targetId of targetUsers) {
      await db.circulationSchedule.create({
        data: {
          garmentId,
          userId: targetId,
          cooldownStart: new Date(),
          cooldownEnd,
          saturationScore,
          status: 'PENDING',
        },
      });
    }

    return { action: 'SUPPRESS', targetUsers, cooldownEnd, score: compatScore };
  }

  // 4. & 5. Transition Logic
  if (interestScore < THRESHOLDS.DECLINE_THRESHOLD && interactionDecay > THRESHOLDS.DECAY_MAX && garment.lifecycleState !== 'DECLINE') {
    const declined = await db.garment.updateMany({
      where: { id: garmentId, isActive: true, reservedOrderId: null, lifecycleState: { in: LOE_MUTABLE_STATES as any } },
      data: { lifecycleState: 'DECLINE' },
    });
    if (declined.count === 0) return { action: 'SUPPRESS', score: compatScore };

    emitToUser(garment.sellerId, 'lifecycle:update', {
      garmentId,
      newState: 'DECLINE',
      message: 'Your garment is showing declining interest. Consider re-listing.',
    });

    return { action: 'TRANSITION', newState: 'DECLINE', score: compatScore };
  }

  if (garment.lifecycleState === 'DECLINE') {
    // DECLINE + no match: transition to CIRCULATION, schedule cooldown
    const circulated = await db.garment.updateMany({
      where: { id: garmentId, isActive: true, reservedOrderId: null, lifecycleState: 'DECLINE' },
      data: { lifecycleState: 'CIRCULATION' },
    });
    if (circulated.count === 0) return { action: 'SUPPRESS', score: compatScore };

    // schedule cooldown
    const cooldownHrs = THRESHOLDS.COOLDOWN_BASE_HRS;
    cooldownEnd = new Date(Date.now() + cooldownHrs * 3600 * 1000);
    targetUsers = await findCompatibleUsers(garment.garmentVector, userId, 20);

    for (const targetId of targetUsers) {
      await db.circulationSchedule.create({
        data: {
          garmentId,
          userId: targetId,
          cooldownStart: new Date(),
          cooldownEnd,
          saturationScore,
          status: 'PENDING',
        },
      });
    }

    return { action: 'TRANSITION', newState: 'CIRCULATION', targetUsers, cooldownEnd, score: compatScore };
  }

  if (interestScore > THRESHOLDS.INTEREST_THRESHOLD && garment.lifecycleState !== 'INTEREST') {
    const interested = await db.garment.updateMany({
      where: { id: garmentId, isActive: true, reservedOrderId: null, lifecycleState: { in: LOE_MUTABLE_STATES as any } },
      data: { lifecycleState: 'INTEREST' },
    });
    if (interested.count === 0) return { action: 'SUPPRESS', score: compatScore };
    return { action: 'TRANSITION', newState: 'INTEREST', score: compatScore };
  }

  return { action: 'PROMOTE', score: compatScore };
}

// ── Initiate resell: OWNERSHIP → SELL_INTENT ───────
export async function initiateResell(garmentId: string, userId: string): Promise<LOEResult> {
  const garment = await db.garment.findUnique({ where: { id: garmentId } });
  if (!garment) {
    return { action: 'SUPPRESS', score: 0 };
  }

  if (garment.sellerId !== userId) {
    return { action: 'SUPPRESS', score: 0 };
  }

  if (garment.lifecycleState !== 'OWNERSHIP') {
    return { action: 'SUPPRESS', score: 0 };
  }

  const moved = await db.garment.updateMany({
    where: { id: garmentId, sellerId: userId, lifecycleState: 'OWNERSHIP', reservedOrderId: null },
    data: { lifecycleState: 'SELL_INTENT' },
  });
  if (moved.count === 0) {
    return { action: 'SUPPRESS', score: 0 };
  }

  emitToUser(userId, 'lifecycle:update', {
    garmentId,
    newState: 'SELL_INTENT',
    message: 'Garment marked for resale. Complete the listing to put it back on the marketplace.',
  });

  return { action: 'TRANSITION', newState: 'SELL_INTENT', score: 1.0 };
}

// ── Find compatible users for a garment ──────────
async function findCompatibleUsers(
  garmentVector: number[],
  excludeUserId: string,
  limit: number
): Promise<string[]> {
  const users = await db.user.findMany({
    where: { isActive: true, id: { not: excludeUserId } },
    select: { id: true, styleVector: true },
    take: 200, // sample pool
  });

  return users
    .map((u: any) => ({ id: u.id, score: cosine(u.styleVector as number[], garmentVector) }))
    .filter((u: any) => u.score >= THRESHOLDS.COMPAT_MIN)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit)
    .map((u: any) => u.id);
}

