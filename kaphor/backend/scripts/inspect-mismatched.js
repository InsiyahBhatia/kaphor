const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const list = await p.garment.findMany({
    where: {
      OR: [
        { title: { contains: 'Curated' } },
        { title: { contains: 'Croissant' } },
        { title: { contains: 'Cannolo' } },
        { title: { contains: 'Denim Vest' } },
        { title: { contains: 'Earring' } },
        { category: 'Footwear' },
        { category: 'Bags' }
      ]
    },
    select: {
      id: true,
      title: true,
      brand: true,
      category: true,
      listingType: true,
      images: true,
    }
  });

  console.log(JSON.stringify(list, null, 2));
  await p.$disconnect();
}

check();
