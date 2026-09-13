/**
 * Distributes all active garment listings equally across three accounts.
 * Round-robin assignment → 17/16/16 for 49 garments.
 *
 * Usage:
 *   node scripts/distribute-listings.js --dry-run   # preview only
 *   node scripts/distribute-listings.js             # live
 */
const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

const TARGET_EMAILS = [
  'insiyahmbhatia@gmail.com',
  'ambhatia1113@gmail.com',
  'insiyah.b@somaiya.edu',
];

async function main() {
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

  const users = await prisma.user.findMany({
    where: { email: { in: TARGET_EMAILS } },
    select: { id: true, email: true, displayName: true },
  });

  if (users.length !== TARGET_EMAILS.length) {
    const found = new Set(users.map((u) => u.email));
    const missing = TARGET_EMAILS.filter((e) => !found.has(e));
    console.error(`ABORT: missing accounts: ${missing.join(', ')}`);
    process.exit(1);
  }

  const garments = await prisma.garment.findMany({
    where: { isActive: true },
    select: { id: true, title: true, sellerId: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Garments to distribute: ${garments.length}`);
  console.log(`Accounts: ${users.map((u) => u.email).join(', ')}\n`);

  const counts = new Array(users.length).fill(0);
  const plan = [];

  garments.forEach((g, i) => {
    const idx = i % users.length;
    counts[idx]++;
    plan.push({ garmentId: g.id, title: g.title, from: g.sellerId, to: users[idx].id, toEmail: users[idx].email });
  });

  for (let i = 0; i < users.length; i++) {
    console.log(`  ${users[i].email} -> ${counts[i]} listings`);
  }
  console.log('');

  if (isDryRun) {
    console.log('=== SAMPLE ASSIGNMENTS (first 10) ===');
    plan.slice(0, 10).forEach((p) => console.log(`  "${p.title.substring(0, 40)}" -> ${p.toEmail}`));
    console.log('\nDry run complete. Run without --dry-run to apply.');
    return;
  }

  let moved = 0;
  for (const p of plan) {
    if (p.from === p.to) continue;
    await prisma.garment.update({
      where: { id: p.garmentId },
      data: { sellerId: p.to },
    });
    moved++;
  }

  console.log(`Reassigned ${moved} listings.`);

  // Verify
  const verify = await prisma.user.findMany({
    where: { email: { in: TARGET_EMAILS } },
    select: { email: true, _count: { select: { garments: true } } },
  });
  console.log('\n=== FINAL COUNTS ===');
  verify.forEach((u) => console.log(`  ${u.email} -> ${u._count.garments}`));
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
