import { v2 as cloudinary } from 'cloudinary';
import { logger } from './logger';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const useCloudinary = !!(cloudName && apiKey && apiSecret);

if (useCloudinary) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

// Ensure local upload directory exists
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface UploadResult {
  url: string;
  publicId: string;
}

export async function uploadImage(
  buffer: Buffer,
  folder: string
): Promise<UploadResult> {
  // ── Cloud path ──
  if (useCloudinary) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          quality: 'auto',
          fetch_format: 'auto',
          transformation: [{ width: 2000, crop: 'limit' }],
        },
        (err, result) => {
          if (err) {
            logger.error('Cloudinary upload failed', { error: err.message });
            reject(new Error(err.message || 'Image upload failed'));
            return;
          }
          if (!result?.secure_url || !result.public_id) {
            reject(new Error('Invalid Cloudinary response'));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      );
      uploadStream.end(buffer);
    });
  }

  // ── Local fallback ──
  const folderPath = path.join(UPLOAD_DIR, folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const filename = `${crypto.randomUUID()}.jpg`;
  const filePath = path.join(folderPath, filename);
  fs.writeFileSync(filePath, buffer);

  const port = process.env.PORT || 4000;
  const host = process.env.HOST || '0.0.0.0';
  const url = `http://${host}:${port}/uploads/${folder}/${filename}`;
  logger.info(`Image saved locally: ${url}`);

  return { url, publicId: `${folder}/${filename}` };
}

export { cloudinary };
export default uploadImage;
