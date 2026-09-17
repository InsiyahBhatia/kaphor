import db from '../lib/prisma';
import { logger } from '../lib/logger';

export interface PayoutAccountRecord {
  id: string;
  userId: string;
  accountHolderName: string;
  accountNumber: string; // masked to last 4 digits
  ifsc: string;
  bankName: string;
  upiId?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

export async function getUserPayoutAccounts(userId: string): Promise<PayoutAccountRecord[]> {
  try {
    const accounts = await db.payoutAccount.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return accounts.map((acc: any) => ({
      id: acc.id,
      userId: acc.userId,
      accountHolderName: acc.accountHolderName,
      accountNumber: acc.accountNumber,
      ifsc: acc.ifsc,
      bankName: acc.bankName,
      upiId: acc.upiId,
      isDefault: acc.isDefault,
      createdAt: acc.createdAt.toISOString(),
      updatedAt: acc.updatedAt?.toISOString(),
    }));
  } catch (err) {
    logger.error('Failed to get user payout accounts from db', { userId, error: err });
    return [];
  }
}

export async function addPayoutAccount(
  userId: string,
  data: {
    accountHolderName: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    upiId?: string;
    isDefault?: boolean;
  }
): Promise<PayoutAccountRecord> {
  const existingCount = await db.payoutAccount.count({ where: { userId } });
  const shouldBeDefault = data.isDefault ?? (existingCount === 0);

  if (shouldBeDefault && existingCount > 0) {
    await db.payoutAccount.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  const rawNum = String(data.accountNumber || '').replace(/\s+/g, '');
  const masked = rawNum.length > 4 ? `••••${rawNum.slice(-4)}` : rawNum;

  const created = await db.payoutAccount.create({
    data: {
      userId,
      accountHolderName: String(data.accountHolderName).trim(),
      accountNumber: masked,
      ifsc: String(data.ifsc).toUpperCase().trim(),
      bankName: String(data.bankName).trim(),
      upiId: data.upiId ? String(data.upiId).trim() : null,
      isDefault: shouldBeDefault,
    },
  });

  return {
    id: created.id,
    userId: created.userId,
    accountHolderName: created.accountHolderName,
    accountNumber: created.accountNumber,
    ifsc: created.ifsc,
    bankName: created.bankName,
    upiId: created.upiId,
    isDefault: created.isDefault,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function deletePayoutAccount(userId: string, accountId: string): Promise<boolean> {
  try {
    const existing = await db.payoutAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!existing) return false;

    const wasDefault = existing.isDefault;
    await db.payoutAccount.delete({ where: { id: accountId } });

    if (wasDefault) {
      const nextDefault = await db.payoutAccount.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (nextDefault) {
        await db.payoutAccount.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }

    return true;
  } catch (err) {
    logger.error('Failed to delete payout account from db', { accountId, error: err });
    return false;
  }
}
