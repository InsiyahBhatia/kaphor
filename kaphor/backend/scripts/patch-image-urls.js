/**
 * Patches all garment image URLs in the database:
 * - /uploads/xxx/file.jpeg  -> https://bucket.s3.region.amazonaws.com/xxx/file.jpeg
 * - https://onrender.com/uploads/xxx/file.jpeg -> same S3 URL (if confirmed exists)
 * - Already proper S3 URLs remain untouched
 *
 * Usage: node scripts/patch-image-urls.js [--dry-run]
 */
const { PrismaClient } = require('@prisma/client');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();
const region = process.env.AWS_REGION || 'eu-north-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'kaphor-media-uploads';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const isDryRun = process.argv.includes('--dry-run');

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
});

// Cache to avoid duplicate HeadObject calls
const s3ExistenceCache = new Map();

async function s3KeyExists(key) {
  if (s3ExistenceCache.has(key)) return s3ExistenceCache.get(key);
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    s3ExistenceCache.set(key, true);
    return true;
  } catch {
    s3ExistenceCache.set(key, false);
    return false;
  }
}

/**
 * Given a raw image URL from the DB, attempts to produce a verified S3 URL.
 * Returns null if no valid S3 object found.
 */
async function resolveToS3Url(img) {
  const trimmed = img.trim();

  // Already a real S3 URL
  if (trimmed.includes('amazonaws.com') && !trimmed.includes('onrender.com')) {
    return trimmed;
  }

  // Extract the relative path (e.g., "swaps/1.jpeg", "thrift/5.jpeg")
  let relPath = null;
  if (trimmed.startsWith('/uploads/')) {
    relPath = trimmed.replace(/^\/uploads\//, '');
  } else if (trimmed.startsWith('uploads/')) {
    relPath = trimmed.replace(/^uploads\//, '');
  } else if (trimmed.includes('/uploads/')) {
    const idx = trimmed.indexOf('/uploads/');
    relPath = trimmed.substring(idx + '/uploads/'.length);
  }

  if (!relPath) return null;

  // Try the key without uploads/ prefix first (our upload convention stores as "swaps/1.jpeg")
  const keysToTry = [relPath, `uploads/${relPath}`];
  for (const key of keysToTry) {
    if (await s3KeyExists(key)) {
      return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
    }
  }

  return null; // Not found in S3
}

async function main() {
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE PATCH'}`);
  console.log(`Bucket: ${bucketName} (${region})\n`);

  const garments = await prisma.garment.findMany({
    select: { id: true, title: true, images: true },
  });

  let totalPatched = 0;
  let totalNotFound = 0;
  let totalAlreadyOk = 0;
  const notFoundItems = [];

  for (const garment of garments) {
    const newImages = [];
    let changed = false;

    for (const img of garment.images) {
      if (!img || img.trim() === '') {
        newImages.push(img);
        continue;
      }

      const s3Url = await resolveToS3Url(img);

      if (s3Url === img) {
        // Already correct S3 URL
        newImages.push(img);
        totalAlreadyOk++;
        continue;
      }

      if (s3Url) {
        console.log(`  [PATCH] "${garment.title.substring(0, 40)}": ${img.substring(0, 60)} -> ${s3Url.substring(0, 60)}`);
        newImages.push(s3Url);
        totalPatched++;
        changed = true;
      } else {
        console.log(`  [NOT IN S3] "${garment.title.substring(0, 40)}": ${img.substring(0, 80)}`);
        newImages.push(img); // Keep as-is; cannot fix
        notFoundItems.push({ id: garment.id, title: garment.title, img });
        totalNotFound++;
      }
    }

    if (changed && !isDryRun) {
      await prisma.garment.update({
        where: { id: garment.id },
        data: { images: newImages },
      });
    }
  }

  console.log(`\n=== PATCH SUMMARY ===`);
  console.log(`Garments scanned:        ${garments.length}`);
  console.log(`URLs already correct:    ${totalAlreadyOk}`);
  console.log(`URLs patched to S3:      ${totalPatched}`);
  console.log(`URLs not in S3 (broken): ${totalNotFound}`);

  if (notFoundItems.length > 0) {
    console.log(`\n=== BROKEN IMAGES (need re-upload) ===`);
    for (const item of notFoundItems) {
      console.log(`  - [${item.id}] "${item.title}": ${item.img}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
