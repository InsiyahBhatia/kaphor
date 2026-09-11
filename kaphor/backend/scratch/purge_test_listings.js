const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allGarments = await prisma.garment.findMany({
    select: { id: true, title: true, brand: true, price: true },
  });

  const testGarments = allGarments.filter((g) => {
    const t = g.title || '';
    const b = g.brand || '';
    return (
      /\d{10,}/.test(t) || // Timestamped test listings like 178905...
      t.toLowerCase().includes('basic info') ||
      t.toLowerCase().includes('e2e') ||
      t.toLowerCase().includes('test') ||
      (g.price === 0 && (t.includes('Details') || t.includes('Basic Info')))
    );
  });

  console.log(`Found ${testGarments.length} test listings to delete:`, testGarments);

  if (testGarments.length > 0) {
    const ids = testGarments.map((g) => g.id);
    await prisma.cartItem.deleteMany({ where: { garmentId: { in: ids } } });
    await prisma.behaviourEvent.deleteMany({ where: { garmentId: { in: ids } } });
    await prisma.behaviourSignal.deleteMany({ where: { garmentId: { in: ids } } });
    await prisma.directMessage.deleteMany({ where: { conversation: { garmentId: { in: ids } } } });
    await prisma.conversation.deleteMany({ where: { garmentId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { garmentId: { in: ids } } });
    await prisma.rental.deleteMany({ where: { garmentId: { in: ids } } });
    await prisma.swap.deleteMany({ where: { OR: [{ garmentOffered: { in: ids } }, { garmentWanted: { in: ids } }] } });
    const res = await prisma.garment.deleteMany({ where: { id: { in: ids } } });
    console.log(`Successfully deleted ${res.count} test listings!`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
