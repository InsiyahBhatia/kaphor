const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const found = await prisma.garment.findMany({
    where: {
      OR: [
        { title: { contains: 'e2e', mode: 'insensitive' } },
        { title: { contains: 'test', mode: 'insensitive' } },
        { description: { contains: 'e2e', mode: 'insensitive' } },
        { description: { contains: 'test listing', mode: 'insensitive' } },
      ],
    },
    select: { id: true, title: true, brand: true, isActive: true },
  });

  console.log('Found listings to remove:', found);

  if (found.length > 0) {
    const ids = found.map((g) => g.id);
    // Delete any associated cart items, order items, rentals, swaps, behaviour events first if any
    await prisma.cartItem.deleteMany({ where: { garmentId: { in: ids } } });
    await prisma.behaviourEvent.deleteMany({ where: { garmentId: { in: ids } } });
    await prisma.behaviourSignal.deleteMany({ where: { garmentId: { in: ids } } });
    await prisma.directMessage.deleteMany({ where: { conversation: { garmentId: { in: ids } } } });
    await prisma.conversation.deleteMany({ where: { garmentId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { garmentId: { in: ids } } });
    await prisma.rental.deleteMany({ where: { garmentId: { in: ids } } });
    await prisma.garment.deleteMany({ where: { id: { in: ids } } });
    console.log(`Successfully removed ${found.length} test listings.`);
  } else {
    console.log('No test/e2e listings found in database.');
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
