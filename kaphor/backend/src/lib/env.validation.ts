import { logger } from './logger';

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_PRIVATE_KEY',
  'JWT_PUBLIC_KEY',
  'REDIS_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'ALLOWED_ORIGINS',
];

export function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    logger.error('Missing required environment variables:', { missing });
    throw new Error(`CRITICAL: Missing required environment variables: ${missing.join(', ')}`);
  }

  logger.info('Environment variables validated successfully');
}
