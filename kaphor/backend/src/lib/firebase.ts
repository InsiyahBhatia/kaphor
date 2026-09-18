import admin from 'firebase-admin';
import { logger } from './logger';

import fs from 'fs';
import path from 'path';

try {
  if (!admin.apps.length) {
    const serviceAccountPath = path.resolve(__dirname, '../../firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      logger.info('Firebase Admin initialized successfully from service account file');
    } else {
      const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
      const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
      let rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
      // Unquote if wrapped in quotes and normalize newline escapes
      if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
        rawKey = rawKey.slice(1, -1);
      }
      const FIREBASE_PRIVATE_KEY = rawKey.replace(/\\n/g, '\n');

      if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
        logger.warn('Firebase Admin credentials not found. Push notifications will rely on Expo proxy.');
      } else {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: FIREBASE_PROJECT_ID,
            clientEmail: FIREBASE_CLIENT_EMAIL,
            privateKey: FIREBASE_PRIVATE_KEY,
          }),
        });
        logger.info('Firebase Admin initialized successfully from environment');
      }
    }
  }
} catch (error) {
  logger.error('Firebase Admin initialization failed', { error });
}

export default admin;
