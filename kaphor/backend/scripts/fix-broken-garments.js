/**
 * Fixes all 15 broken garments by replacing lost Render/local image URLs
 * with appropriate existing S3 seed images based on category.
 */
const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();
const region = process.env.AWS_REGION || 'eu-north-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'kaphor-media-uploads';

function s3(key) {
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

// Map broken garment IDs to appropriate seed S3 image replacements
const FIXES = [
  {
    id: '27736007-d819-4eb7-90f8-214697e1371e', // Vintage Floral Platform Slides [Heels]
    images: [s3('swaps/1.jpeg')], // closest accessory/shoe category
  },
  {
    id: 'dc0dc5c7-4a3e-4db0-8665-d135a39313b5', // Forest Green Suede Hobo Bag [Bags]
    images: [s3('swaps/2.jpeg')],
  },
  {
    id: '5d52a6b3-4ccc-4138-8a73-a72ed4fdf0e1', // Varsity Half-Zip Pullover Sweatshirt [Tops]
    images: [s3('thrift/9.jpeg')],
  },
  {
    id: 'aee89f95-49aa-45a5-9f04-554b4a7252af', // Purple Pinstripe Embroidered Skirt [Skirts]
    images: [s3('thrift/19.jpeg')],
  },
  {
    id: 'e114dfe7-8897-4de5-9557-22b1ee3d0376', // Denim vest and skirt co-od set [Denims]
    images: [s3('thrift/12.jpeg')],
  },
  {
    id: '94847c02-9e7c-41c6-82b2-5ed2a0563abc', // Vintage Rumours Quartz Bangle Watch [Jewelry]
    images: [s3('swaps/5.jpeg')],
  },
  {
    id: '135fb66b-dcfa-4fef-967d-89fdaef4ecb4', // Black Pleated Knit Midi Skirt [Bottoms]
    images: [s3('thrift/4.jpeg')],
  },
  {
    id: 'a4bb3ce9-231a-4a90-953b-dc09edd8a8fa', // Patterned top [Tops]
    images: [s3('thrift/16.jpeg')],
  },
  {
    id: '09b9067e-39c9-4112-a83a-47b117b8476a', // Elegant Pink Gold Floral Brocade [Kurtas]
    images: [s3('thrift/2.jpeg')],
  },
  {
    id: 'f5ed4abb-0477-4491-b33c-ed64e12b7de6', // Patterned top [Tops]
    images: [s3('thrift/18.jpeg')],
  },
  {
    id: 'e0125826-a68a-4f7e-9ad5-cfa5075fba91', // Curated Designer Item [Rental/Sarees]
    images: [s3('rentals/1.jpeg'), s3('rentals/2.jpeg'), s3('rentals/3.jpeg')],
  },
  {
    id: 'bb3f68b4-4876-44b5-8f62-6356a9db7aa7', // Brown Pink Pinstripe Ribbon Skirt [Skirts]
    images: [s3('thrift/5.jpeg')],
  },
  {
    id: '28487f58-3081-4d2b-9bb8-0456b7fdf0a3', // Patterned top [Tops]
    images: [s3('thrift/11.jpeg')],
  },
  {
    id: 'd91ea2fa-28d1-40dc-b45f-140869f169e4', // Denim vest and skirt co-od set [Denims]
    images: [s3('thrift/3.jpeg')],
  },
  {
    id: 'dfbf6d5d-b5b6-4b6c-a8ba-d439c18e7ee6', // Patterned top [Tops]
    images: [s3('thrift/7.jpeg')],
  },
];

async function main() {
  console.log(`Patching ${FIXES.length} broken garments with seed images...\n`);

  for (const fix of FIXES) {
    const garment = await prisma.garment.findUnique({ where: { id: fix.id }, select: { title: true } });
    if (!garment) {
      console.log(`  [SKIP] ID ${fix.id} — not found`);
      continue;
    }
    await prisma.garment.update({
      where: { id: fix.id },
      data: { images: fix.images },
    });
    console.log(`  [FIXED] "${garment.title}" → ${fix.images[0]}`);
  }

  console.log(`\n✅ Done. All broken garments have been patched with seed images.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
