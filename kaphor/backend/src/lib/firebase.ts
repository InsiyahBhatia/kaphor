import admin from 'firebase-admin';
import { logger } from './logger';

// Placeholders for Firebase Admin config.
// In production, these should be replaced with actual Service Account JSON values.
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY,
      }),
    });
    logger.info('Firebase Admin initialized successfully');
  }
} catch (error) {
  logger.error('Firebase Admin initialization failed', { error });
}

export default admin;
