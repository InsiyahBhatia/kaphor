/**
 * READ-ONLY test: invokes analyzeListingImage directly (no server/auth needed)
 * for each listing type with a real S3 garment photo, verifying the AI magic-fill
 * response branches correctly for SALE / RENTAL / ACCESSORY_SWAP.
 * Usage: npx tsx scripts/test-magic-fill.ts
 */
import 'dotenv/config';

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function fetchImageBase64(key: string): Promise<string> {
  const res = await s3.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key }));
  const chunks: Buffer[] = [];
  for await (const c of res.Body) chunks.push(c as Buffer);
  return `data:image/jpeg;base64,${Buffer.concat(chunks).toString('base64')}`;
}

function makeMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; },
  };
}

async function main() {
  const { analyzeListingImage } = await import('../src/controllers/ai.controller');

  const image = await fetchImageBase64('swaps/1.jpeg'); // floral platform slides
  console.log('Test image: swaps/1.jpeg (floral platform slides)\n');

  for (const listingType of ['SALE', 'RENTAL', 'ACCESSORY_SWAP']) {
    const req: any = { user: { id: 'test-user' }, body: { image, listingType } };
    const res = makeMockRes();
    await analyzeListingImage(req, res as any);
    const d = res.body?.data;
    if (!d) { console.log(`${listingType}: ❌ no data`); continue; }
    console.log(`=== listingType=${listingType} ===`);
    console.log(`  title:        ${d.title}`);
    console.log(`  category:     ${d.category} / ${d.subCategory}`);
    console.log(`  size:         ${d.size}`);
    console.log(`  condition:    ${d.condition}`);
    console.log(`  estPrice:     ${d.estimatedPrice}`);
    console.log(`  dayRate:      ${d.suggestedRentalPriceDay} / week ${d.suggestedRentalPriceWeek}`);
    console.log(`  isAccessory:  ${d.isAccessory}`);
    console.log(`  recommended:  ${d.recommendedListingType}`);

    // Assertions per mode
    const issues: string[] = [];
    if (listingType === 'ACCESSORY_SWAP' && d.recommendedListingType !== 'ACCESSORY_SWAP') issues.push('recommended != ACCESSORY_SWAP');
    if (listingType === 'RENTAL' && d.recommendedListingType !== 'RENTAL') issues.push('recommended != RENTAL');
    if (listingType === 'RENTAL' && !(d.suggestedRentalPriceDay >= 199)) issues.push('dayRate below min 199');
    if (listingType === 'SALE' && !(d.estimatedPrice > 0)) issues.push('missing estimatedPrice');
    console.log(issues.length ? `  ⚠️ ISSUES: ${issues.join(', ')}` : '  ✅ correct for this mode\n');
  }
}

main().catch((e) => { console.error('Test failed:', e.message); process.exit(1); });
