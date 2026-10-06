import { logger } from '../lib/logger';

/**
 * Outgoing email.
 *
 * Production: set RESEND_API_KEY (and EMAIL_FROM, a sender verified in Resend) to deliver real mail.
 * Development / no key: the message is logged (and the first link is printed) instead of sent.
 */
const isProd = process.env.NODE_ENV === 'production';

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (apiKey) {
    const from = process.env.EMAIL_FROM || 'Kaphor <onboarding@resend.dev>';
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        logger.error('Email provider rejected message', { status: res.status, to, subject });
      }
    } catch (error) {
      logger.error('Email send failed', { error, to, subject });
    }
    return;
  }

  if (isProd) {
    logger.error('RESEND_API_KEY is not set: email was NOT delivered', { to, subject });
    return;
  }

  logger.info(`[dev] Email to ${to}: ${subject}`);
  const link = html.match(/https?:\/\/[^\s"]+/)?.[0];
  if (link) console.log(`[dev] link: ${link}`);
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
