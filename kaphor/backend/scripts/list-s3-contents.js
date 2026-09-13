/**
 * READ-ONLY inventory of every object in the S3 bucket.
 * Lists objects grouped by top-level folder with counts and sizes,
 * and writes the full key list to scripts/s3-inventory.json.
 * Usage: node scripts/list-s3-contents.js
 */
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const region = process.env.AWS_REGION || 'eu-north-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME;

if (!bucketName || !process.env.AWS_ACCESS_KEY_ID) {
  console.error('Missing AWS credentials/bucket in .env');
  process.exit(1);
}

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function main() {
  console.log(`Bucket: ${bucketName} (${region})\n`);

  const allObjects = [];
  let token;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1000, ContinuationToken: token })
    );
    for (const obj of res.Contents || []) {
      allObjects.push({ key: obj.Key, size: obj.Size, lastModified: obj.LastModified });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  // Group by top-level folder
  const groups = {};
  for (const obj of allObjects) {
    const folder = obj.key.includes('/') ? obj.key.split('/')[0] : '(root)';
    (groups[folder] = groups[folder] || []).push(obj);
  }

  const totalMB = allObjects.reduce((s, o) => s + o.size, 0) / (1024 * 1024);
  console.log(`Total objects: ${allObjects.length} (${totalMB.toFixed(1)} MB)\n`);
  console.log('=== BY FOLDER ===');
  for (const [folder, objs] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    const mb = objs.reduce((s, o) => s + o.size, 0) / (1024 * 1024);
    console.log(`  ${folder.padEnd(20)} ${String(objs.length).padStart(4)} files  ${mb.toFixed(1)} MB`);
  }

  // Full listing per folder
  for (const [folder, objs] of Object.entries(groups).sort()) {
    console.log(`\n=== ${folder} (${objs.length}) ===`);
    for (const o of objs.sort((a, b) => a.key.localeCompare(b.key))) {
      const kb = o.size < 1024 ? `${o.size} B` : `${(o.size / 1024).toFixed(0)} KB`;
      const mod = o.lastModified ? o.lastModified.toISOString().slice(0, 10) : '';
      console.log(`  ${o.key}  [${kb}, ${mod}]`);
    }
  }

  // Persist inventory for recovery purposes
  const outPath = path.join(__dirname, 's3-inventory.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({ bucket: bucketName, region, generatedAt: new Date().toISOString(), objects: allObjects }, null, 2)
  );
  console.log(`\nFull inventory saved to: scripts/s3-inventory.json`);
}

main().catch((e) => {
  console.error('Listing failed:', e.message);
  process.exit(1);
});
