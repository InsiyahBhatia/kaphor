import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import db from '../src/lib/prisma';
import { hashToken } from '../src/utils/jwt';
import { sendVerificationEmail } from '../src/services/email.service';

async function testEmailVerification() {
  console.log('=== STARTING EMAIL VERIFICATION TEST ===');
  
  // 1. Pick a recipient email (use SMTP_USER or kaphor.team@gmail.com)
  const targetEmail = process.env.SMTP_USER || 'ambhatia1113@gmail.com';
  console.log(`Target email: ${targetEmail}`);

  // 2. Find or create a test user
  let user = await db.user.findFirst({
    where: { email: targetEmail.toLowerCase() },
  });

  if (!user) {
    console.log(`User not found with ${targetEmail}, checking any existing user...`);
    user = await db.user.findFirst();
  }

  if (!user) {
    console.error('No users found in database to test.');
    process.exit(1);
  }

  console.log(`Testing with user: ID=${user.id}, email=${user.email}, isVerified=${user.isVerified}`);

  // 3. Set user to unverified for test
  await db.user.update({
    where: { id: user.id },
    data: { isVerified: false },
  });
  console.log('Step 1: Set user.isVerified = false');

  // 4. Generate verification token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken, 'verify');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.user.update({
    where: { id: user.id },
    data: {
      verificationToken: tokenHash,
      verificationExpires: expires,
    },
  });
  console.log(`Step 2: Generated token. Raw Token = ${rawToken.substring(0, 8)}... (Hash = ${tokenHash.substring(0, 8)}...)`);

  // 5. Send actual email
  console.log(`Step 3: Sending verification email to ${targetEmail}...`);
  await sendVerificationEmail(targetEmail, rawToken);
  console.log('✓ Email dispatch triggered successfully!');

  // 6. Test verification simulation using rawToken
  console.log('Step 4: Simulating email link click (verifying with raw token)...');
  const foundUser = await db.user.findFirst({
    where: {
      verificationToken: hashToken(rawToken, 'verify'),
      verificationExpires: { gte: new Date() },
    },
  });

  if (!foundUser) {
    throw new Error('Verification failed: user not found by token hash!');
  }
  console.log(`✓ User found by token hash: ${foundUser.email}`);

  // 7. Mark verified
  const verifiedUser = await db.user.update({
    where: { id: foundUser.id },
    data: {
      isVerified: true,
      verificationToken: null,
      verificationExpires: null,
    },
  });

  console.log(`✓ Step 5: User marked verified! Database state: isVerified = ${verifiedUser.isVerified}, token = ${verifiedUser.verificationToken}`);

  console.log('\n=== ALL EMAIL VERIFICATION CHECKS PASSED ===');
  await db.$disconnect();
}

testEmailVerification().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
