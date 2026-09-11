const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const garments = await prisma.garment.findMany({
    select: { id: true, title: true, brand: true, category: true, price: true, isActive: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`Total garments (${garments.length}):`);
  garments.forEach((g, i) => console.log(`${i + 1}. [${g.id}] ${g.brand} - ${g.title} (₹${(g.price || 0) / 100}) [Active: ${g.isActive}]`));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
