import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const garments = await prisma.garment.findMany({
    take: 5,
    select: { id: true, title: true, images: true }
  });
  console.log(JSON.stringify(garments, null, 2));
  process.exit(0);
}

check();
