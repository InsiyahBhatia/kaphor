import 'dotenv/config';
import { randomBytes } from 'crypto';
import prisma from '../src/lib/prisma';
import { hashPassword } from '../src/utils/hash';
import { auditLog } from '../src/services/audit.service';

async function main() {
  const email = (process.env.ADMIN_EMAIL || 'kaphor.team@gmail.com').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || randomBytes(16).toString('base64url');
  const generated = !process.env.ADMIN_PASSWORD;

  const passwordHash = await hashPassword(password);
  const data = {
    passwordHash,
    role: 'ADMIN' as const,
    isActive: true,
    isVerified: true,
    verificationStatus: 'VERIFIED' as const,
  };

  let user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, username: true, role: true } });

  if (user) {
    user = await prisma.user.update({ where: { id: user.id }, data, select: { id: true, email: true, username: true, role: true } });
    console.log(`ADMIN_PROVISIONED existing user ${user.email} (role=${user.role})`);
  } else {
    const suffix = Date.now().toString(36).slice(-4);
    user = await prisma.user.create({
      data: {
        ...data,
        email,
        username: `kaphorteam_${suffix}`,
        displayName: 'KaPhor Admin',
        styleVector: Array(16).fill(0),
      },
      select: { id: true, email: true, username: true, role: true },
    });
    console.log(`ADMIN_PROVISIONED new user ${user.email} (role=${user.role})`);
  }

  await prisma.impactRecord.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  await auditLog({ userId: user.id, action: 'ADMIN_PROVISIONED', resource: 'User', metadata: { email } });

  if (generated) {
    console.log(`\nADMIN PASSWORD: ${password}`);
    console.log('Copy it now. Re-run with ADMIN_PASSWORD set to rotate later.');
  } else {
    console.log('Password set from ADMIN_PASSWORD env (not printed).');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());