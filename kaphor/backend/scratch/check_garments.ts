import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.garment.count();
  const seller = await prisma.user.findFirst({ where: { email: 'seed_seller@kaphor.com' } });
  if (seller) {
    const sellerCount = await prisma.garment.count({ where: { sellerId: seller.id } });
    console.log(`Total Garments: ${count}`);
    console.log(`Garments for seed_seller: ${sellerCount}`);
  } else {
    console.log('Seed seller not found');
  }
  process.exit(0);
}

check();
