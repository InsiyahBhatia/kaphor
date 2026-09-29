import 'dotenv/config';
import db, { prisma } from '../src/lib/prisma';

async function main() {
  console.log('DATABASE_URL set:', Boolean(process.env.DATABASE_URL));
  console.log('db.glieCorrection:', typeof (db as any).glieCorrection);
  console.log('prisma.glieCorrection:', typeof (prisma as any).glieCorrection);
  if ((prisma as any).glieCorrection) {
    try {
      const count = await (prisma as any).glieCorrection.count();
      console.log('glieCorrection.count:', count);
    } catch (e: any) {
      console.log('count failed:', e.message);
    }
  }
}

main().finally(() => process.exit(0));