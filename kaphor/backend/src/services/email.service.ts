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
  const backendBase = (process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_URL || '').trim();
  const backendUrl = (backendBase && !backendBase.includes('localhost') && !backendBase.includes('127.0.0.1'))
    ? backendBase
    : 'https://kaphor-backend.onrender.com';

  const verifyUrl = `${backendUrl}/api/v1/auth/verify-email/${token}?email=${encodeURIComponent(email)}`;

  await sendEmail({
    to: email,
    subject: 'Verify your KaPhor account',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F7F3; margin: 0; padding: 40px 16px; color: #121212; }
    .container { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E5E5E0; padding: 40px 32px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.03); }
    .logo { font-size: 24px; font-weight: 800; letter-spacing: 4px; color: #121212; margin-bottom: 24px; }
    .title { font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #121212; }
    .desc { font-size: 14px; line-height: 1.6; color: #555555; margin-bottom: 32px; }
    .btn { display: inline-block; background-color: #121212; color: #FFFFFF !important; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-weight: 600; font-size: 14px; letter-spacing: 0.5px; }
    .footer { margin-top: 32px; font-size: 12px; color: #888888; line-height: 1.6; border-top: 1px solid #EEEEEE; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">KAPHOR</div>
    <div class="title">Verify Your Email Address</div>
    <div class="desc">
      Welcome to KaPhor, your luxury circular fashion archive.<br/>
      Please confirm your email to activate your account and access bespoke, rental, and swap services.
    </div>
    <a href="${verifyUrl}" class="btn">Verify My Email</a>
    <div class="footer">
      This link will expire in 24 hours.<br/>
      If you are having trouble with the button, <a href="${verifyUrl}" style="color: #121212; text-decoration: underline; font-weight: 600;">click here to verify</a>.<br/><br/>
      If you did not sign up for KaPhor, please ignore this email.
    </div>
  </div>
</body>
</html>`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const backendBase = (process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_URL || '').trim();
  const backendUrl = (backendBase && !backendBase.includes('localhost') && !backendBase.includes('127.0.0.1'))
    ? backendBase
    : 'https://kaphor-backend.onrender.com';
  const url = `${backendUrl}/api/v1/auth/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset your KaPhor password',
    html: `<p>Click <a href="${url}">here</a> to reset your password. Link expires in 1h.</p>`,
  });
}
