const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.garment.count();
  const garments = await prisma.garment.findMany({
    select: {
      id: true,
      title: true,
      brand: true,
      category: true,
      condition: true,
      listingType: true,
      price: true,
      rentalPriceDay: true,
      images: true,
    }
  });
  console.log(`Total Garments in DB: ${count}`);
  console.log(JSON.stringify(garments, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
