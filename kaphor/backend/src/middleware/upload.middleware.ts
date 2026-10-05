import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

const storage = multer.memoryStorage();

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_FILE_TYPE: Only .jpg, .png and .webp are allowed'));
  }
};

const baseUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 8,
    fields: 60,
    fieldSize: 1024 * 1024,
  },
});

/** Detects the real image type from the first bytes. Never trust the client mimetype. */
export function sniffImageType(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Rejects any uploaded file whose magic bytes are not a real JPEG/PNG/WebP and
 * overwrites `file.mimetype` with the detected type.
 */
export function validateImageMagicBytes(req: Request, res: Response, next: NextFunction) {
  const files: Express.Multer.File[] = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  else if (req.files && typeof req.files === 'object') {
    for (const list of Object.values(req.files)) files.push(...(list as Express.Multer.File[]));
  }
  for (const f of files) {
    const real = sniffImageType(f.buffer);
    if (!real) {
      res.status(400).json({ error: 'INVALID_FILE_TYPE', message: 'Only real JPEG, PNG or WebP images are allowed' });
      return;
    }
    f.mimetype = real;
  }
  next();
}

/**
 * Drop-in replacement for the multer instance: `upload.single()` and
 * `upload.array()` return [multer, magic-byte check], which Express accepts as
 * a middleware list. Existing call sites keep working unchanged.
 */
export const upload = {
  single: (field: string) => [baseUpload.single(field), validateImageMagicBytes],
  array: (field: string, max?: number) => [baseUpload.array(field, max), validateImageMagicBytes],
};
