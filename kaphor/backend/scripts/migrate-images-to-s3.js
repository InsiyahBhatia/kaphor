/**
 * Mass migration script: upload all local seed images to S3 and patch the database.
 * Usage: node scripts/migrate-images-to-s3.js
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

const region = process.env.AWS_REGION || 'eu-north-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'kaphor-media-uploads';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!bucketName || !accessKeyId || !secretAccessKey) {
  console.error('Missing AWS credentials. Check .env file.');
  process.exit(1);
}

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
});

const uploadsBaseDir = path.join(__dirname, '../uploads');

/**
 * Converts a local /uploads/xxx/file.jpeg path to an absolute disk path.
 */
function resolveLocalPath(urlOrPath) {
  // Handle /uploads/swaps/1.jpeg, uploads/swaps/1.jpeg, local://uploads/...
  let rel = urlOrPath.trim();
  rel = rel.replace(/^local:\/\//, '');
  rel = rel.replace(/^\//, '');
  // Remove any host prefix like http://...:4000/
  const uploadsIdx = rel.indexOf('uploads/');
  if (uploadsIdx > 0) {
    rel = rel.substring(uploadsIdx);
  }
  return path.join(__dirname, '..', rel);
}

/**
 * Determines the S3 key from a relative path.
 * /uploads/swaps/1.jpeg -> swaps/1.jpeg
 */
function toS3Key(urlOrPath) {
  let rel = urlOrPath.trim();
  rel = rel.replace(/^local:\/\//, '').replace(/^\//, '');
  const uploadsIdx = rel.indexOf('uploads/');
  if (uploadsIdx >= 0) {
    rel = rel.substring(uploadsIdx + 'uploads/'.length);
  }
  return rel;
}

async function s3KeyExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadFileToS3(localPath, s3Key) {
  const buffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
  await s3.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;
}

async function main() {
  console.log(`Connecting to S3 bucket: ${bucketName} (${region})`);

  // Gather all active garments
  const garments = await prisma.garment.findMany({
    where: { isActive: true },
    select: { id: true, title: true, images: true },
  });

  console.log(`Found ${garments.length} active garments to process.\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let noLocalFile = 0;
  let alreadyS3 = 0;

  for (const garment of garments) {
    const newImages = [];
    let changed = false;

    for (const img of garment.images) {
      if (!img || img.trim() === '') {
        newImages.push(img);
        continue;
      }

      // Already a proper S3 URL
      if (img.includes('amazonaws.com') && !img.includes('onrender.com')) {
        newImages.push(img);
        alreadyS3++;
        continue;
      }

      // This is a local/Render path — migrate it
      const localPath = resolveLocalPath(img);
      const s3Key = toS3Key(img);

      if (!s3Key) {
        newImages.push(img);
        failed++;
        continue;
      }

      if (!fs.existsSync(localPath)) {
        console.log(`  [MISSING LOCAL] ${garment.title}: ${img} -> ${localPath}`);
        newImages.push(img); // Keep old URL — file doesn't exist locally
        noLocalFile++;
        continue;
      }

      // Check if already uploaded
      const exists = await s3KeyExists(s3Key);
      if (exists) {
        const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;
        console.log(`  [ALREADY IN S3] ${garment.title}: ${s3Key}`);
        newImages.push(s3Url);
        skipped++;
        changed = true;
        continue;
      }

      // Upload to S3
      try {
        const s3Url = await uploadFileToS3(localPath, s3Key);
        console.log(`  [UPLOADED] ${garment.title}: ${s3Key} -> ${s3Url}`);
        newImages.push(s3Url);
        uploaded++;
        changed = true;
      } catch (err) {
        console.error(`  [ERROR] ${garment.title}: ${img} -> ${err.message}`);
        newImages.push(img);
        failed++;
      }
    }

    if (changed) {
      await prisma.garment.update({
        where: { id: garment.id },
        data: { images: newImages },
      });
    }
  }

  console.log(`\n=== MIGRATION COMPLETE ===`);
  console.log(`Uploaded to S3:          ${uploaded}`);
  console.log(`Already in S3 (skipped): ${skipped}`);
  console.log(`Already S3 URLs:         ${alreadyS3}`);
  console.log(`Missing local file:      ${noLocalFile}`);
  console.log(`Errors:                  ${failed}`);
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
