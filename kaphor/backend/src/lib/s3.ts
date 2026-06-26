import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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

    const port = process.env.PORT || 4000;
    const ip = getLocalIp();
    // Using IP instead of localhost so physical devices can reach it
    const url = `http://${ip}:${port}/uploads/${folder}/${filename}`;
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

  // Local Fallback handle
  if (originalUrlOrKey.startsWith('local://') || originalUrlOrKey.includes('localhost:4000') || originalUrlOrKey.includes(':4000')) {
    const ip = getLocalIp();
    const port = process.env.PORT || 4000;
    // Replace whatever host is there with current local IP for reliability
    return originalUrlOrKey
      .replace('local://', `http://${ip}:${port}/uploads/`)
      .replace(/^(http:\/\/)(localhost|[\d\.]+)(:4000\/uploads\/)/, `$1${ip}$3`);
  }

  // S3 Presigned URL handle
  if (originalUrlOrKey.startsWith('http') && originalUrlOrKey.includes('.amazonaws.com/')) {
    if (!accessKeyId || !secretAccessKey || !bucketName) return originalUrlOrKey;

    try {
      // Extract key from URL: https://bucket.s3.region.amazonaws.com/folder/file.jpg
      const urlParts = new URL(originalUrlOrKey);
      const key = urlParts.pathname.startsWith('/') ? urlParts.pathname.substring(1) : urlParts.pathname;

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      // Valid for 1 hour
      return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    } catch (err: any) {
      logger.error('Failed to generate presigned URL', { error: err.message, url: originalUrlOrKey });
      return originalUrlOrKey; // Fallback to original
    }
  }

  return originalUrlOrKey;
}

export default uploadToS3;
