import db from './src/lib/prisma';

async function main() {
  const id = 'd4401bfe-fa29-48e4-abf1-d0c1add72938';
  const garment = await db.garment.findFirst({
      where: { id, isActive: true },
      include: {
        seller: { select: { id: true, displayName: true, username: true, avatar: true } },
        reviews: true
      },
    });
  console.log('Result for known ID:', garment ? 'FOUND' : 'NOT FOUND');
  if (garment) {
      console.log('ID:', garment.id);
      console.log('Active:', garment.isActive);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
