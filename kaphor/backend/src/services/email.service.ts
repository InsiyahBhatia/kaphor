import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../lib/logger';

/**
 * Outgoing email.
 *
 * Production: set RESEND_API_KEY (and EMAIL_FROM, a sender verified in Resend) to deliver real mail,
 * or SMTP_HOST / SMTP_USER / SMTP_PASS (Brevo, Gmail app password, ...) when you have no verified domain.
 * Resend wins if both are set.
 * Development / nothing configured: the message is logged (and the first link is printed) instead of sent.
 */
const isProd = process.env.NODE_ENV === 'production';

let smtpTransport: Transporter | null = null;

function getSmtpTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  if (!smtpTransport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    smtpTransport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 10_000,
      socketTimeout: 10_000,
    });
  }
  return smtpTransport;
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const smtp = apiKey ? null : getSmtpTransport();

  if (smtp) {
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER || 'Kaphor <no-reply@localhost>';
    try {
      await smtp.sendMail({ from, to, subject, html });
    } catch (error) {
      logger.error('SMTP send failed', { error, to, subject });
    }
    return;
  }

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
