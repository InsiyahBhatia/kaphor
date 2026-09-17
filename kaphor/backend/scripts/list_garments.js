const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const garments = await p.garment.findMany({
    select: {
      id: true,
      title: true,
      brand: true,
      category: true,
      images: true,
      listingType: true,
      price: true,
      rentalPriceDay: true,
    }
  });
  console.log('Total garments:', garments.length);
  for (const g of garments) {
    console.log(`[${g.id.slice(0, 8)}] "${g.title}" | Brand: ${g.brand} | Cat: ${g.category} | Type: ${g.listingType} | Price: ${g.price} | Images: ${g.images?.length ? g.images[0].slice(0, 70) : 'NONE'}`);
  }
  await p.$disconnect();
}

main();
