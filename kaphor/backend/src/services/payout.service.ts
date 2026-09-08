import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../lib/logger';

export interface PayoutAccountRecord {
  id: string;
  userId: string;
  accountHolderName: string;
  accountNumber: string; // masked to last 4 digits
  ifsc: string;
  bankName: string;
  upiId?: string;
  isDefault: boolean;
  createdAt: string;
}

const DATA_FILE = path.join(__dirname, '../../data/payout_accounts.json');

function loadAccounts(): PayoutAccountRecord[] {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as PayoutAccountRecord[];
  } catch (err) {
    logger.error('Failed to read payout accounts file', { error: err });
    return [];
  }
}

function saveAccounts(accounts: PayoutAccountRecord[]): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(accounts, null, 2), 'utf-8');
  } catch (err) {
    logger.error('Failed to write payout accounts file', { error: err });
  }
}

export function getUserPayoutAccounts(userId: string): PayoutAccountRecord[] {
  const all = loadAccounts();
  return all.filter((acc) => acc.userId === userId);
}

export function addPayoutAccount(
  userId: string,
  data: {
    accountHolderName: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    upiId?: string;
    isDefault?: boolean;
  }
): PayoutAccountRecord {
  const all = loadAccounts();
  const userAccounts = all.filter((acc) => acc.userId === userId);

  const shouldBeDefault = data.isDefault ?? (userAccounts.length === 0);

  if (shouldBeDefault) {
    for (const acc of all) {
      if (acc.userId === userId) {
        acc.isDefault = false;
      }
    }
  }

  // Mask account number: only keep last 4 digits
  const rawNum = String(data.accountNumber || '').replace(/\s+/g, '');
  const masked = rawNum.length > 4 ? `••••${rawNum.slice(-4)}` : rawNum;

  const newAccount: PayoutAccountRecord = {
    id: `payout_${crypto.randomUUID()}`,
    userId,
    accountHolderName: String(data.accountHolderName).trim(),
    accountNumber: masked,
    ifsc: String(data.ifsc).toUpperCase().trim(),
    bankName: String(data.bankName).trim(),
    upiId: data.upiId ? String(data.upiId).trim() : undefined,
    isDefault: shouldBeDefault,
    createdAt: new Date().toISOString(),
  };

  all.push(newAccount);
  saveAccounts(all);
  return newAccount;
}

export function deletePayoutAccount(userId: string, accountId: string): boolean {
  const all = loadAccounts();
  const index = all.findIndex((acc) => acc.id === accountId && acc.userId === userId);
  if (index === -1) return false;

  const wasDefault = all[index].isDefault;
  all.splice(index, 1);

  if (wasDefault) {
    const nextDefault = all.find((acc) => acc.userId === userId);
    if (nextDefault) {
      nextDefault.isDefault = true;
    }
  }

  saveAccounts(all);
  return true;
}
