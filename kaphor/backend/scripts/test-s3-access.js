/**
 * Tests if S3 images are publicly accessible by doing HTTP GET requests.
 */
const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const region = process.env.AWS_REGION || 'eu-north-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'kaphor-media-uploads';

function testUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      resolve({ url, status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300 });
      res.resume();
    });
    req.on('error', (err) => resolve({ url, status: 'ERROR', ok: false, err: err.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ url, status: 'TIMEOUT', ok: false }); });
  });
}

async function main() {
  const testKeys = ['swaps/1.jpeg', 'thrift/1.jpeg', 'rentals/1.jpeg', 'swaps/6.jpeg'];
  
  console.log(`\nTesting public S3 access for bucket: ${bucketName} (${region})\n`);
  
  for (const key of testKeys) {
    const url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
    const result = await testUrl(url);
    const icon = result.ok ? '✅' : '❌';
    console.log(`  ${icon} [${result.status}] ${url}`);
  }

  // Also test the presigned URL approach for comparison
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  
  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  console.log(`\n--- Testing presigned URL for swaps/1.jpeg ---`);
  const command = new GetObjectCommand({ Bucket: bucketName, Key: 'swaps/1.jpeg' });
  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  console.log(`Presigned URL: ${signedUrl.substring(0, 120)}...`);
  const presignResult = await testUrl(signedUrl);
  const icon2 = presignResult.ok ? '✅' : '❌';
  console.log(`  ${icon2} [${presignResult.status}] Presigned URL`);
}

main().catch(console.error);
