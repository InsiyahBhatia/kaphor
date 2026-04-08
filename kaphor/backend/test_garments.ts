import db from './src/lib/prisma';

async function main() {
  const garments = await db.garment.findMany({
    select: { id: true, title: true, isActive: true, images: true }
  });
  console.log(JSON.stringify(garments, null, 2));
}

main().catch(console.error).finally(() => db.$disconnect());
