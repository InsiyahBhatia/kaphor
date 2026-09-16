/**
 * Migration Script: Transfers all images from AWS S3 (and local uploads) to Cloudinary,
 * and updates database records in Supabase/Postgres with the new permanent Cloudinary CDN URLs.
 *
 * Features:
 * - Idempotent: skips images already hosted on res.cloudinary.com
 * - Deduplicated: caches uploaded URLs so shared images aren't uploaded multiple times
 * - Supports --dry-run to preview actions without making database updates
 * - Handles garments, user avatars, posts, messages, and upcycle requests
 *
 * Usage:
 *   node scripts/migrate-s3-to-cloudinary.js --dry-run
 *   node scripts/migrate-s3-to-cloudinary.js
 */

const { PrismaClient } = require('@prisma/client');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { v2: cloudinary } = require('cloudinary');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

// Cloudinary config
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error('❌ Missing Cloudinary credentials in .env');
  process.exit(1);
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

// AWS S3 config
const region = process.env.AWS_REGION || 'eu-north-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'kaphor-media-uploads';
const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const uploadsBaseDir = path.join(__dirname, '../uploads');

// Map of originalUrlOrKey -> newCloudinaryUrl
const migrationCache = new Map();

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function extractS3Key(urlOrPath) {
  if (!urlOrPath) return null;
  const trimmed = urlOrPath.trim();

  if (trimmed.includes('.amazonaws.com/')) {
    try {
      const parsed = new URL(trimmed);
      return parsed.pathname.replace(/^\/+/, '');
    } catch {
      return null;
    }
  }

  let rel = trimmed.replace(/^local:\/\//, '').replace(/^\/+/, '');
  if (rel.startsWith('uploads/')) {
    rel = rel.substring('uploads/'.length);
  }
  return rel;
}

function optimizeUrl(url) {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  if (url.includes('/image/upload/f_auto,q_auto/')) return url;
  return url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
}

async function uploadBufferToCloudinary(buffer, targetFolder, baseName) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: targetFolder,
        public_id: baseName,
        resource_type: 'image',
        overwrite: true,
      },
      (error, result) => {
        if (error || !result) reject(error || new Error('Upload failed with empty result'));
        else resolve(optimizeUrl(result.secure_url));
      }
    );
    stream.end(buffer);
  });
}

async function migrateSingleImage(imgUrl, defaultFolder = 'garments') {
  if (!imgUrl || typeof imgUrl !== 'string') return imgUrl;
  const trimmed = imgUrl.trim();
  if (!trimmed) return trimmed;

  // Already migrated
  if (trimmed.includes('res.cloudinary.com')) {
    return optimizeUrl(trimmed);
  }

  // Check cache
  if (migrationCache.has(trimmed)) {
    return migrationCache.get(trimmed);
  }

  const s3Key = extractS3Key(trimmed);
  let buffer = null;

  // 1. Try fetching from S3
  if (s3Key && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      const resp = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: s3Key }));
      buffer = await streamToBuffer(resp.Body);
    } catch (s3Err) {
      // S3 fetch failed, will try local
    }
  }

  // 2. Try fetching from local disk
  if (!buffer && s3Key) {
    const localPath = path.join(uploadsBaseDir, s3Key);
    if (fs.existsSync(localPath)) {
      buffer = fs.readFileSync(localPath);
    }
  }

  // 3. Fallback: if it's a publicly accessible HTTP URL, let Cloudinary fetch it directly
  if (!buffer && trimmed.startsWith('http')) {
    if (isDryRun) {
      console.log(`  [DRY-RUN] Would fetch remote URL to Cloudinary: ${trimmed}`);
      return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/kaphor/${defaultFolder}/mock.jpg`;
    }
    try {
      const result = await cloudinary.uploader.upload(trimmed, {
        folder: `kaphor/${defaultFolder}`,
        resource_type: 'image',
      });
      const cdnUrl = optimizeUrl(result.secure_url);
      migrationCache.set(trimmed, cdnUrl);
      return cdnUrl;
    } catch (fetchErr) {
      console.warn(`  ⚠️ Could not upload remote URL: ${trimmed} (${fetchErr.message})`);
      return trimmed;
    }
  }

  if (!buffer) {
    console.warn(`  ⚠️ Could not find source image on S3 or local disk: ${trimmed}`);
    return trimmed;
  }

  // Determine folder and clean filename
  const folderParts = (s3Key || defaultFolder).split('/');
  const rawFileName = folderParts.pop() || 'image';
  const subFolder = folderParts.join('/') || defaultFolder;
  const targetFolder = `kaphor/${subFolder}`;
  const baseName = path.parse(rawFileName).name;

  if (isDryRun) {
    const mockUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${targetFolder}/${baseName}.jpg`;
    console.log(`  [DRY-RUN] Upload ${s3Key} (${buffer.length} bytes) -> ${mockUrl}`);
    migrationCache.set(trimmed, mockUrl);
    return mockUrl;
  }

  try {
    const cdnUrl = await uploadBufferToCloudinary(buffer, targetFolder, baseName);
    console.log(`  ✅ Uploaded: ${s3Key} -> ${cdnUrl}`);
    migrationCache.set(trimmed, cdnUrl);
    return cdnUrl;
  } catch (err) {
    console.error(`  ❌ Failed to upload ${s3Key} to Cloudinary:`, err.message);
    return trimmed;
  }
}

async function migrateGarments() {
  console.log('\n--- 👗 Migrating Garments ---');
  const garments = await prisma.garment.findMany({
    select: { id: true, title: true, images: true },
  });

  console.log(`Found ${garments.length} total garments.`);
  let updatedCount = 0;

  for (const g of garments) {
    if (!g.images || g.images.length === 0) continue;

    const newImages = [];
    let changed = false;

    for (const img of g.images) {
      const migrated = await migrateSingleImage(img, 'garments');
      newImages.push(migrated);
      if (migrated !== img) changed = true;
    }

    if (changed) {
      if (!isDryRun) {
        await prisma.garment.update({
          where: { id: g.id },
          data: { images: newImages },
        });
      }
      updatedCount++;
    }
  }

  console.log(`Garments migration finished. Updated: ${updatedCount}/${garments.length}`);
}

async function migrateUsers() {
  console.log('\n--- 👤 Migrating Users (Avatars & Docs) ---');
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { avatar: { not: null } },
        { verificationDocUrl: { not: null } },
      ],
    },
    select: { id: true, username: true, avatar: true, verificationDocUrl: true },
  });

  console.log(`Found ${users.length} users with avatars or verification docs.`);
  let updatedCount = 0;

  for (const u of users) {
    let newAvatar = u.avatar;
    let newDoc = u.verificationDocUrl;
    let changed = false;

    if (u.avatar) {
      newAvatar = await migrateSingleImage(u.avatar, 'avatars');
      if (newAvatar !== u.avatar) changed = true;
    }

    if (u.verificationDocUrl) {
      newDoc = await migrateSingleImage(u.verificationDocUrl, 'verifications');
      if (newDoc !== u.verificationDocUrl) changed = true;
    }

    if (changed) {
      if (!isDryRun) {
        await prisma.user.update({
          where: { id: u.id },
          data: { avatar: newAvatar, verificationDocUrl: newDoc },
        });
      }
      updatedCount++;
    }
  }

  console.log(`Users migration finished. Updated: ${updatedCount}/${users.length}`);
}

async function migratePosts() {
  console.log('\n--- 📸 Migrating Social Posts ---');
  const posts = await prisma.post.findMany({
    select: { id: true, images: true },
  });

  console.log(`Found ${posts.length} posts.`);
  let updatedCount = 0;

  for (const p of posts) {
    if (!p.images || p.images.length === 0) continue;

    const newImages = [];
    let changed = false;

    for (const img of p.images) {
      const migrated = await migrateSingleImage(img, 'posts');
      newImages.push(migrated);
      if (migrated !== img) changed = true;
    }

    if (changed) {
      if (!isDryRun) {
        await prisma.post.update({
          where: { id: p.id },
          data: { images: newImages },
        });
      }
      updatedCount++;
    }
  }

  console.log(`Posts migration finished. Updated: ${updatedCount}/${posts.length}`);
}

async function migrateDirectMessages() {
  console.log('\n--- 💬 Migrating Direct Messages ---');
  const messages = await prisma.directMessage.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, imageUrl: true },
  });

  console.log(`Found ${messages.length} messages with images.`);
  let updatedCount = 0;

  for (const m of messages) {
    if (!m.imageUrl) continue;
    const newUrl = await migrateSingleImage(m.imageUrl, 'messages');
    if (newUrl !== m.imageUrl) {
      if (!isDryRun) {
        await prisma.directMessage.update({
          where: { id: m.id },
          data: { imageUrl: newUrl },
        });
      }
      updatedCount++;
    }
  }

  console.log(`Messages migration finished. Updated: ${updatedCount}/${messages.length}`);
}

async function run() {
  console.log(`🚀 Starting S3 to Cloudinary Migration${isDryRun ? ' [DRY-RUN MODE]' : ''}...`);
  console.log(`Cloud Name: ${cloudName}`);
  console.log(`Source S3 Bucket: ${bucketName} (${region})\n`);

  try {
    await migrateGarments();
    await migrateUsers();
    await migratePosts();
    await migrateDirectMessages();

    console.log('\n🎉 S3 to Cloudinary Migration Complete!');
    console.log(`Unique images processed and cached: ${migrationCache.size}`);
  } catch (err) {
    console.error('❌ Migration encountered an error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
