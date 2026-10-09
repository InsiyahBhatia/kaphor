import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { logger } from './logger';
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

const CLOUDINARY_UPLOAD_SEGMENT = '/image/upload/';

/**
 * Returns a Cloudinary delivery URL with f_auto,q_auto and (optionally) a width cap (c_limit never upscales).
 * Non-Cloudinary URLs (local, data URIs, other hosts) and URLs that already carry custom transformations are returned unchanged,
 * so this is always safe to call on any stored image value.
 */
export function cloudinaryImageUrl(url: string, opts: { width?: number; height?: number } = {}): string {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes(CLOUDINARY_UPLOAD_SEGMENT)) return url;
  const idx = url.indexOf(CLOUDINARY_UPLOAD_SEGMENT);
  const head = url.slice(0, idx + CLOUDINARY_UPLOAD_SEGMENT.length);
  let rest = url.slice(idx + CLOUDINARY_UPLOAD_SEGMENT.length);
  if (rest.startsWith('f_auto,q_auto/')) {
    rest = rest.slice('f_auto,q_auto/'.length);
  } else if (/^(?:[a-z]{1,3}_[^/]+\/)+/.test(rest)) {
    // Some other transformation chain is already present: do not stack another one.
    return url;
  }
  const parts = ['f_auto', 'q_auto'];
  const w = Math.floor(Number(opts.width));
  const h = Math.floor(Number(opts.height));
  if (Number.isFinite(w) && w > 0) parts.push(`w_${Math.min(w, 4000)}`);
  if (Number.isFinite(h) && h > 0) parts.push(`h_${Math.min(h, 4000)}`);
  if (parts.length > 2) parts.push('c_limit');
  return `${head}${parts.join(',')}/${rest}`;
}

/** Small list-view image (default 480px wide). Same value as the input for non-Cloudinary images. */
export function thumbnailUrl(url: string | null | undefined, width = 480): string | null {
  if (!url) return null;
  return cloudinaryImageUrl(url, { width });
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
            // Compress and shrink server-side so the stored original is never a 10MB phone photo.
            ...(mimetype.startsWith('image/')
              ? { transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }] }
              : {}),
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
      logger.warn(`Cloudinary upload failed, attempting local storage fallback: ${err.message}`);
    }
  } else {
    logger.info('Cloudinary credentials missing, using local storage fallback.');
  }

  // 2. Local fallback (development / offline; erased on every Render deploy)
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

/** Folder prefixes older records used for locally stored files (e.g. "garments/abc.jpg"). */
const LOCAL_KEY_PREFIXES = ['garments/', 'profiles/', 'chat/', 'swaps/', 'swap/', 'rentals/', 'thrift/', 'sectors/', 'upcycle/'];

/**
 * Maps a locally stored file reference to its path under the uploads folder, or null if it is not a local reference.
 *   local://swaps/1.jpg, /uploads/swaps/1.jpg, uploads/swaps/1.jpg, https://host/uploads/swaps/1.jpg, swaps/1.jpg -> "swaps/1.jpg"
 */
function localKeyFrom(value: string): string | null {
  if (value.startsWith('local://')) return value.replace('local://', '').replace(/^\//, '').replace(/^uploads\//, '');
  if (value.startsWith('/uploads/')) return value.replace(/^\/uploads\//, '');
  if (value.startsWith('uploads/')) return value.replace(/^uploads\//, '');
  if (value.includes('/uploads/')) return value.substring(value.indexOf('/uploads/') + '/uploads/'.length);
  if (LOCAL_KEY_PREFIXES.some((p) => value.startsWith(p))) return value;
  return null;
}

/**
 * Universal dual-read URL resolver:
 * 1. Cloudinary URLs (res.cloudinary.com) -> returns instantly (with f_auto,q_auto).
 * 2. Data URIs and other external URLs -> passed through unchanged.
 * 3. Local paths (local://, /uploads/...) -> resolved against this backend's URL.
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

  // 2. Data or direct external URLs (not local uploads)
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('blob:') ||
    (trimmed.startsWith('http') && !trimmed.includes('/uploads/'))
  ) {
    return trimmed;
  }

  // 3. Local paths -> this backend's /uploads route
  const localKey = localKeyFrom(trimmed);
  if (localKey) {
    const baseUrl = process.env.BACKEND_URL || `http://${getLocalIp()}:${process.env.PORT || 4000}`;
    return `${baseUrl}/uploads/${localKey}`;
  }

  return trimmed;
}

/**
 * Deletes a file from Cloudinary (or from local disk for locally stored files).
 *
 * @param originalUrlOrKey - Cloudinary URL, public ID, or local path.
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

  // Local disk deletion
  const localKey = localKeyFrom(trimmed);
  if (!localKey) return false;
  try {
    const localPath = path.join(path.join(__dirname, '../../uploads'), localKey);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      logger.info(`Deleted local file: ${localPath}`);
      return true;
    }
  } catch (err: any) {
    logger.warn(`Failed to delete local file: ${err.message}`);
  }
  return false;
}
