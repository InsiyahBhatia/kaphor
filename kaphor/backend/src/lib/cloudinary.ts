import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { logger } from './logger';
import { getDownloadUrl as getS3DownloadUrl, deleteFromS3, uploadToS3 as uploadToAwsS3 } from './s3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  logger.info(`Cloudinary initialized with cloud_name: ${cloudName}`);
} else {
  logger.warn('Cloudinary credentials missing in environment.');
}

let cachedIp: string | null = null;
function getLocalIp(): string {
  if (cachedIp) return cachedIp;
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
        cachedIp = iface.address;
        return cachedIp;
      }
    }
  }
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

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Optimizes a Cloudinary URL with f_auto,q_auto transformations if not already present.
 */
export function optimizeCloudinaryUrl(url: string): string {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  if (url.includes('/image/upload/f_auto,q_auto/')) return url;
  return url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
}

/**
 * Uploads a buffer to Cloudinary with automatic optimization (f_auto,q_auto),
 * with local disk fallback if Cloudinary credentials are unavailable or upload fails.
 *
 * @param buffer - File buffer to upload.
 * @param folder - Folder within Cloudinary (e.g., 'garments', 'avatars', 'swaps', 'messages').
 * @param mimetype - MIME type of the file.
 * @returns An object containing the optimized public CDN URL and the public ID key.
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  mimetype: string = 'image/jpeg'
): Promise<UploadResult> {
  const cleanFolder = folder.replace(/^\/+/, '').replace(/\/+$/, '');
  const targetFolder = cleanFolder.startsWith('kaphor/') ? cleanFolder : `kaphor/${cleanFolder}`;
  const filename = `${crypto.randomUUID()}-${Date.now()}`;

  // 1. Try Cloudinary upload
  if (cloudName && apiKey && apiSecret) {
    try {
      const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: targetFolder,
            public_id: filename,
            resource_type: 'auto',
          },
          (error, result) => {
            if (error || !result) reject(error || new Error('Upload stream returned undefined result'));
            else resolve(result);
          }
        );
        stream.end(buffer);
      });

      const optimizedUrl = optimizeCloudinaryUrl(uploadResult.secure_url);
      logger.info(`File uploaded to Cloudinary: ${optimizedUrl} (public_id: ${uploadResult.public_id})`);

      return {
        url: optimizedUrl,
        key: uploadResult.public_id,
      };
    } catch (err: any) {
      logger.warn(`Cloudinary upload failed, attempting S3 storage fallback: ${err.message}`);
    }
  } else {
    logger.info('Cloudinary credentials missing, attempting S3 storage fallback.');
  }

  // 2. S3 Fallback (persistent cloud storage)
  try {
    const s3Result = await uploadToAwsS3(buffer, cleanFolder, mimetype);
    if (s3Result && s3Result.url && !s3Result.url.includes('/uploads/')) {
      logger.info(`File successfully uploaded to S3 fallback: ${s3Result.url}`);
      return s3Result;
    }
  } catch (s3Err: any) {
    logger.warn(`S3 fallback upload failed, attempting local storage fallback: ${s3Err.message}`);
  }

  // 3. Local Fallback (for development / offline)
  try {
    const ext = mimetype.split('/')[1] || 'jpg';
    const localFilename = `${filename}.${ext}`;
    const uploadsDir = path.join(__dirname, '../../uploads');
    const folderPath = path.join(uploadsDir, cleanFolder);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const localPath = path.join(folderPath, localFilename);
    fs.writeFileSync(localPath, buffer);

    const isProd = process.env.NODE_ENV === 'production' || !!process.env.BACKEND_URL;
    const baseUrl = isProd
      ? (process.env.BACKEND_URL || 'https://kaphor-backend.onrender.com')
      : `http://${getLocalIp()}:${process.env.PORT || 4000}`;
    const url = `${baseUrl}/uploads/${cleanFolder}/${localFilename}`;
    logger.info(`File saved locally: ${url}`);

    return { url, key: `local://${cleanFolder}/${localFilename}` };
  } catch (localErr: any) {
    logger.error('Local upload fallback failed', { error: localErr.message });
    throw new Error('FAILED_TO_UPLOAD_TO_CLOUDINARY_OR_LOCAL');
  }
}

/**
 * Universal dual-read URL resolver:
 * 1. Cloudinary URLs (res.cloudinary.com) -> returns instantly (with f_auto,q_auto).
 * 2. Unmigrated S3 URLs / S3 keys -> presigns or retrieves via S3 bridge.
 * 3. Local paths / data URIs -> passes through or resolves against local dev server.
 *
 * @param originalUrlOrKey - Stored database URL or key.
 */
export async function getDownloadUrl(originalUrlOrKey: string): Promise<string> {
  if (!originalUrlOrKey) return '';
  const trimmed = originalUrlOrKey.trim();
  if (!trimmed) return '';

  // 1. Cloudinary URL
  if (trimmed.includes('res.cloudinary.com')) {
    return optimizeCloudinaryUrl(trimmed);
  }

  // 2. Data or direct external URLs (not S3 or local)
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('blob:') ||
    (trimmed.startsWith('http') && !trimmed.includes('amazonaws.com') && !trimmed.includes('/uploads/'))
  ) {
    return trimmed;
  }

  // 3. Unmigrated S3 URLs / S3 keys / local:// prefixes -> delegate to S3 resolver
  return getS3DownloadUrl(trimmed);
}

/**
 * Deletes a file from Cloudinary (or delegates to S3/local fallback).
 *
 * @param originalUrlOrKey - Cloudinary URL, public ID, or S3 key/URL.
 */
export async function deleteFromCloudinary(originalUrlOrKey: string): Promise<boolean> {
  if (!originalUrlOrKey) return false;
  const trimmed = originalUrlOrKey.trim();

  // Cloudinary deletion
  if (trimmed.includes('res.cloudinary.com') || trimmed.startsWith('kaphor/')) {
    let publicId = trimmed;

    if (trimmed.includes('res.cloudinary.com')) {
      try {
        // e.g. https://res.cloudinary.com/cloud/image/upload/v12345/kaphor/garments/xyz.jpg
        const match = trimmed.match(/\/upload\/(?:[a-zA-Z0-9_,]+\/)?(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
        if (match && match[1]) {
          publicId = match[1];
        }
      } catch {
        publicId = trimmed;
      }
    }

    if (cloudName && apiKey && apiSecret) {
      try {
        const result = await cloudinary.uploader.destroy(publicId);
        logger.info(`Deleted file from Cloudinary: ${publicId} (result: ${result.result})`);
        return result.result === 'ok';
      } catch (err: any) {
        logger.warn(`Failed to delete from Cloudinary (${publicId}): ${err.message}`);
      }
    }
  }

  // Fall back to S3 / local deletion
  return deleteFromS3(trimmed);
}

// Backward compatibility aliases
export { uploadToCloudinary as uploadToS3, deleteFromCloudinary as deleteFromS3 };
