import { prisma } from '../lib/prisma';

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

export async function isAccountLocked(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { lockUntil: true },
  });
  if (!user?.lockUntil) return false;
  return user.lockUntil > new Date();
}

export async function recordFailedLogin(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, failedLoginAttempts: true, lockUntil: true },
  });
  if (!user) return;

  const nextCount = (user.failedLoginAttempts || 0) + 1;

  if (nextCount >= MAX_FAILURES) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: nextCount,
        lockUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000),
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: nextCount },
    });
  }
}

export async function clearFailedLogins(email: string): Promise<void> {
  await prisma.user.updateMany({
    where: { email: email.toLowerCase().trim() },
    data: { failedLoginAttempts: 0, lockUntil: null },
  });
}
