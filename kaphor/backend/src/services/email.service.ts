import { logger } from '../lib/logger';

/**
 * Service to handle outgoing emails.
 * Currently mocks sending by logging to console/logger.
 */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  // In a real app, use SendGrid, MailerSend, or AWS SES
  logger.info(`Sending email to ${to}: ${subject}`);
  logger.debug(`Email content: ${html}`);
  
  // LOG the magic link specifically for the user to see during testing
  if (html.includes('http')) {
     const link = html.match(/https?:\/\/[^\s"]+/)?.[0];
     if (link) {
       console.log('\x1b[36m%s\x1b[0m', '--- MAGIC LINK ---');
       console.log('\x1b[36m%s\x1b[0m', link);
       console.log('\x1b[36m%s\x1b[0m', '------------------');
     }
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:8081'}/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Verify your Kaphor account',
    html: `<p>Welcome to Kaphor! Click <a href="${url}">here</a> to verify your email. Link expires in 24h.</p>`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${process.env.FRONTEND_URL || 'http://localhost:8081'}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset your Kaphor password',
    html: `<p>Click <a href="${url}">here</a> to reset your password. Link expires in 1h.</p>`,
  });
}
