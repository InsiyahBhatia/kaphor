import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import os from 'os';

const region = process.env.AWS_REGION || 'eu-north-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const bucketName = process.env.AWS_S3_BUCKET_NAME;

let cachedIp: string | null = null;

// ── Presigned URL Cache ──────────────────────────────────────────────────────
// S3 presigned URLs are valid for 1 hour; cache them for 50 minutes.
const presignCache = new Map<string, { url: string; expiresAt: number }>();
const PRESIGN_TTL_MS = 50 * 60 * 1000; // 50 minutes

function getCachedPresign(key: string): string | null {
  const entry = presignCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.url;
  if (entry) presignCache.delete(key);
  return null;
}

function setCachedPresign(key: string, url: string): void {
  presignCache.set(key, { url, expiresAt: Date.now() + PRESIGN_TTL_MS });
  // Evict stale entries periodically (max 1000)
  if (presignCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of presignCache) {
      if (now >= v.expiresAt) presignCache.delete(k);
    }
  }
}

function getLocalIp(): string {
  if (cachedIp) return cachedIp;

  const interfaces = os.networkInterfaces();
  
  // Prefer 192.168.x.x addresses (typical for home networks/phones)
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
        cachedIp = iface.address;
        return cachedIp;
      }
    }
  }

  // Fallback to any external IPv4
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        cachedIp = iface.address;
        return cachedIp;
      }
    }
  }
  cachedIp = 'localhost';
  return cachedIp;
}

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || '',
  },
});

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Uploads a buffer to AWS S3, with a local fallback if S3 fails.
 * @param buffer - The file buffer to upload.
 * @param folder - The folder within the bucket (e.g., 'garments', 'profiles').
 * @param mimetype - The MIME type of the file.
 * @returns An object containing the public URL and the S3 key.
 */
export async function uploadToS3(
  buffer: Buffer,
  folder: string,
  mimetype: string = 'image/jpeg'
): Promise<UploadResult> {
  const filename = `${crypto.randomUUID()}-${Date.now()}.${mimetype.split('/')[1] || 'jpg'}`;
  const key = `${folder}/${filename}`;

  // Try S3 first
  if (accessKeyId && secretAccessKey && bucketName) {
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      });

      await s3Client.send(command);

      const url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
      logger.info(`File uploaded to S3: ${url}`);

      return { url, key };
    } catch (err: any) {
      logger.warn(`S3 upload failed, falling back to local storage: ${err.message}`);
    }
  } else {
    logger.info('S3 credentials missing, using local storage.');
  }

  // Local Fallback
  try {
    const uploadsDir = path.join(__dirname, '../../uploads');
    const folderPath = path.join(uploadsDir, folder);
    
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const localPath = path.join(folderPath, filename);
    fs.writeFileSync(localPath, buffer);

    const isProd = process.env.NODE_ENV === 'production' || !!process.env.BACKEND_URL;
    const baseUrl = isProd
      ? (process.env.BACKEND_URL || 'https://kaphor-backend.onrender.com')
      : `http://${getLocalIp()}:${process.env.PORT || 4000}`;
    const url = `${baseUrl}/uploads/${folder}/${filename}`;
    logger.info(`File saved locally: ${url}`);

    return { url, key: `local://${key}` };
  } catch (localErr: any) {
    logger.error('Local upload also failed', { error: localErr.message });
    throw new Error('FAILED_TO_UPLOAD_TO_S3_OR_LOCAL');
  }
}

/**
 * Generates a viewable URL for a stored file.
 * If the URL is in S3, it generates a presigned URL (valid for 1 hour).
 * If the URL is local fallback, it ensures the IP is correct and returns it.
 * @param originalUrlOrKey - The URL or key stored in the database.
 * @returns A publicly accessible URL.
 */
export async function getDownloadUrl(originalUrlOrKey: string): Promise<string> {
  if (!originalUrlOrKey) return '';

  const trimmed = originalUrlOrKey.trim();

  // Normalize key from URL or relative path
  let s3CandidateKey: string | null = null;
  if (trimmed.includes('.amazonaws.com/')) {
    try {
      const urlParts = new URL(trimmed);
      s3CandidateKey = urlParts.pathname.startsWith('/') ? urlParts.pathname.substring(1) : urlParts.pathname;
    } catch {
      s3CandidateKey = null;
    }
  } else if (trimmed.startsWith('local://')) {
    const raw = trimmed.replace('local://', '');
    s3CandidateKey = raw.startsWith('/') ? raw.substring(1) : raw;
  } else if (trimmed.startsWith('/uploads/')) {
    s3CandidateKey = trimmed.substring(1); // 'uploads/...'
  } else if (trimmed.startsWith('uploads/')) {
    s3CandidateKey = trimmed;
  } else if (
    trimmed.startsWith('garments/') ||
    trimmed.startsWith('profiles/') ||
    trimmed.startsWith('chat/') ||
    trimmed.startsWith('swaps/') ||
    trimmed.startsWith('swap/') ||
    trimmed.startsWith('rentals/') ||
    trimmed.startsWith('thrift/') ||
    trimmed.startsWith('sectors/') ||
    trimmed.startsWith('upcycle/')
  ) {
    s3CandidateKey = trimmed;
  } else if (trimmed.includes('/uploads/')) {
    const idx = trimmed.indexOf('/uploads/');
    s3CandidateKey = trimmed.substring(idx + 1); // 'uploads/...'
  }

  // If S3 is configured and we have a candidate key, try S3 first
  if (s3CandidateKey && accessKeyId && secretAccessKey && bucketName) {
    const candidateKeys = [s3CandidateKey];
    if (s3CandidateKey.startsWith('uploads/')) {
      candidateKeys.push(s3CandidateKey.replace(/^uploads\//, ''));
    } else {
      candidateKeys.push(`uploads/${s3CandidateKey}`);
    }

    for (const keyToTry of candidateKeys) {
      const cached = getCachedPresign(keyToTry);
      if (cached) return cached;

      try {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: keyToTry,
        });
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        setCachedPresign(keyToTry, signedUrl);
        return signedUrl;
      } catch {
        // Continue to next key candidate
      }
    }
  }

  // Local fallback / server URL resolution
  if (
    trimmed.startsWith('local://') || 
    trimmed.includes('/uploads/') ||
    trimmed.startsWith('uploads/') ||
    trimmed.includes('localhost:4000') || 
    trimmed.includes(':4000') ||
    trimmed.includes(':10000')
  ) {
    const isProd = process.env.NODE_ENV === 'production' || !!process.env.BACKEND_URL;
    const baseUrl = isProd
      ? (process.env.BACKEND_URL || 'https://kaphor-backend.onrender.com')
      : `http://${getLocalIp()}:${process.env.PORT || 4000}`;

    if (trimmed.startsWith('local://')) {
      const clean = trimmed.replace('local://', '').replace(/^\//, '');
      const path = clean.startsWith('uploads/') ? clean : `uploads/${clean}`;
      return `${baseUrl}/${path}`;
    }
    if (trimmed.startsWith('/uploads/')) {
      return `${baseUrl}${trimmed}`;
    }
    if (trimmed.startsWith('uploads/')) {
      return `${baseUrl}/${trimmed}`;
    }
    if (trimmed.includes('/uploads/')) {
      const relativePath = trimmed.substring(trimmed.indexOf('/uploads/'));
      return `${baseUrl}${relativePath}`;
    }
    return trimmed.replace(/^(http:\/\/)(localhost|[\d\.]+)(:(?:4000|10000)\/uploads\/)/, `${baseUrl}/uploads/`);
  }

  return trimmed;
}

/**
 * Deletes a file from S3 (or local disk fallback) to prevent orphaned files.
 * @param originalUrlOrKey - The file URL or storage key.
 */
export async function deleteFromS3(originalUrlOrKey: string): Promise<boolean> {
  if (!originalUrlOrKey) return false;
  const trimmed = originalUrlOrKey.trim();

  let s3Key: string | null = null;
  if (trimmed.includes('.amazonaws.com/')) {
    try {
      const urlParts = new URL(trimmed);
      s3Key = urlParts.pathname.startsWith('/') ? urlParts.pathname.substring(1) : urlParts.pathname;
    } catch {
      s3Key = null;
    }
  } else if (trimmed.startsWith('local://')) {
    const raw = trimmed.replace('local://', '');
    s3Key = raw.startsWith('/') ? raw.substring(1) : raw;
  } else if (trimmed.startsWith('/uploads/')) {
    s3Key = trimmed.substring(1);
  } else if (trimmed.startsWith('uploads/')) {
    s3Key = trimmed;
  } else if (
    trimmed.startsWith('garments/') ||
    trimmed.startsWith('profiles/') ||
    trimmed.startsWith('chat/') ||
    trimmed.startsWith('swaps/')
  ) {
    s3Key = trimmed;
  }

  // 1. Delete from AWS S3
  if (s3Key && accessKeyId && secretAccessKey && bucketName) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
        })
      );
      if (!s3Key.startsWith('uploads/')) {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: `uploads/${s3Key}`,
          })
        ).catch(() => {});
      }
      logger.info(`Deleted file from S3: ${s3Key}`);
      return true;
    } catch (err: any) {
      logger.warn(`Failed to delete file from S3: ${err.message}`);
    }
  }

  // 2. Delete from local disk fallback
  try {
    const uploadsDir = path.join(__dirname, '../../uploads');
    const relativePath = (s3Key || '').replace(/^uploads\//, '');
    const localPath = path.join(uploadsDir, relativePath);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      logger.info(`Deleted local file: ${localPath}`);
      return true;
    }
  } catch (err: any) {
    logger.warn(`Failed to delete local fallback file: ${err.message}`);
  }

  return false;
}
