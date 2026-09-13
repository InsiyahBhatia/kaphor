/**
 * End-to-end test: fetches garments from the backend API (simulating what the app does)
 * and checks that returned image URLs are presigned S3 URLs that actually return 200.
 */
const https = require('https');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const region = process.env.AWS_REGION || 'eu-north-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'kaphor-media-uploads';
const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function testUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300 });
      res.resume();
    });
    req.on('error', (err) => resolve({ status: 'ERROR', ok: false, err: err.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 'TIMEOUT', ok: false }); });
  });
}

// Simulates what getDownloadUrl does
async function getDownloadUrl(storedUrl) {
  const trimmed = storedUrl.trim();

  let s3Key = null;

  if (trimmed.includes('.amazonaws.com/') && !trimmed.includes('onrender.com')) {
    try {
      const urlParts = new URL(trimmed);
      s3Key = urlParts.pathname.startsWith('/') ? urlParts.pathname.substring(1) : urlParts.pathname;
    } catch { s3Key = null; }
  } else if (trimmed.startsWith('/uploads/')) {
    s3Key = trimmed.replace(/^\/uploads\//, '');
  } else if (trimmed.startsWith('uploads/')) {
    s3Key = trimmed.replace(/^uploads\//, '');
  } else if (trimmed.includes('/uploads/')) {
    const idx = trimmed.indexOf('/uploads/');
    s3Key = trimmed.substring(idx + '/uploads/'.length);
  }

  if (s3Key && bucketName) {
    const command = new GetObjectCommand({ Bucket: bucketName, Key: s3Key });
    return getSignedUrl(s3, command, { expiresIn: 3600 });
  }
  return trimmed;
}

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const garments = await prisma.garment.findMany({
    where: { isActive: true },
    select: { id: true, title: true, images: true, listingType: true },
  });

  console.log(`\n=== TESTING PRESIGNED URL GENERATION AND ACCESSIBILITY ===\n`);

  let ok = 0, fail = 0;
  for (const g of garments) {
    const img = g.images[0];
    if (!img) continue;

    const presigned = await getDownloadUrl(img);
    const result = await testUrl(presigned);
    const icon = result.ok ? '✅' : '❌';
    console.log(`  ${icon} [${result.status}] "${g.title.substring(0, 40)}"`);
    if (!result.ok) {
      console.log(`    DB URL: ${img}`);
      console.log(`    Presigned: ${presigned.substring(0, 100)}...`);
    }
    result.ok ? ok++ : fail++;
  }

  console.log(`\n${ok} working, ${fail} failing\n`);
  await prisma.$disconnect();
}

main().catch(console.error);
