/**
 * Identifies the 19 garments with broken images and shows their categories and listing types.
 * Then patches them with appropriate seed images from uploads/ based on category.
 */
const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = new PrismaClient();

const BROKEN_IDS = [
  '27736007-d819-4eb7-90f8-214697e1371e', // Vintage Floral Platform Slides
  'dc0dc5c7-4a3e-4db0-8665-d135a39313b5', // Forest Green Suede Hobo Bag
  '5d52a6b3-4ccc-4138-8a73-a72ed4fdf0e1', // Varsity Half-Zip Pullover Sweatshirt
  'aee89f95-49aa-45a5-9f04-554b4a7252af', // Purple Pinstripe Embroidered Skirt
  'e114dfe7-8897-4de5-9557-22b1ee3d0376', // Denim vest and skirt co-od set
  '94847c02-9e7c-41c6-82b2-5ed2a0563abc', // Vintage Rumours Quartz Bangle Watch
  '135fb66b-dcfa-4fef-967d-89fdaef4ecb4', // Black Pleated Knit Midi Skirt
  'a4bb3ce9-231a-4a90-953b-dc09edd8a8fa', // Patterned top
  '09b9067e-39c9-4112-a83a-47b117b8476a', // Elegant Pink Gold Floral Brocade
  'f5ed4abb-0477-4491-b33c-ed64e12b7de6', // Patterned top
  'e0125826-a68a-4f7e-9ad5-cfa5075fba91', // Curated Designer Item
  'bb3f68b4-4876-44b5-8f62-6356a9db7aa7', // Brown Pink Pinstripe Ribbon Skirt
  '28487f58-3081-4d2b-9bb8-0456b7fdf0a3', // Patterned top
  'd91ea2fa-28d1-40dc-b45f-140869f169e4', // Denim vest and skirt co-od set
  'dfbf6d5d-b5b6-4b6c-a8ba-d439c18e7ee6', // Patterned top
];

async function main() {
  const garments = await prisma.garment.findMany({
    where: { id: { in: BROKEN_IDS } },
    select: { id: true, title: true, listingType: true, category: true, images: true, isActive: true },
  });

  console.log(`\nBroken garments (${garments.length}):\n`);
  for (const g of garments) {
    console.log(`  "${g.title}" [${g.listingType}] [${g.category}] active:${g.isActive}`);
    console.log(`    images: ${JSON.stringify(g.images)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
