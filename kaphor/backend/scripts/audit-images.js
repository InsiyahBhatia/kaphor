const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const garments = await prisma.garment.findMany({
    where: { isActive: true },
    select: { id: true, title: true, images: true, listingType: true },
  });

  const noImage = [];
  const localUrl = [];
  const legacyS3Url = [];
  const emptyString = [];

  for (const g of garments) {
    if (!g.images || g.images.length === 0) {
      noImage.push(g);
    } else {
      for (const img of g.images) {
        if (!img || img.trim() === '') {
          emptyString.push(g);
        } else if (img.includes('onrender.com/uploads/') || img.includes('localhost') || img.startsWith('/uploads/') || img.startsWith('local://')) {
          localUrl.push({ ...g, img });
        } else if (img.includes('amazonaws.com') || img.includes('s3.')) {
          legacyS3Url.push({ ...g, img });
        } else {
          localUrl.push({ ...g, img });
        }
      }
    }
  }

  console.log(`\n=== IMAGE AUDIT ===`);
  console.log(`Total active garments: ${garments.length}`);
  console.log(`No image at all: ${noImage.length}`);
  console.log(`Empty string image: ${emptyString.length}`);
  console.log(`Legacy S3 URLs (no longer served, migrate these to Cloudinary): ${legacyS3Url.length}`);
  console.log(`Local/Render ephemeral (broken) URLs: ${localUrl.length}`);

  console.log(`\n=== LOCAL/BROKEN URLs (first 30) ===`);
  for (const g of localUrl.slice(0, 30)) {
    console.log(`  ID: ${g.id} | Title: ${g.title} | URL: ${g.img}`);
  }

  console.log(`\n=== GARMENTS WITH NO IMAGE ===`);
  for (const g of noImage) {
    console.log(`  ID: ${g.id} | Title: ${g.title}`);
  }

  console.log(`\n=== GARMENTS WITH EMPTY STRING IMAGE ===`);
  for (const g of emptyString) {
    console.log(`  ID: ${g.id} | Title: ${g.title}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
