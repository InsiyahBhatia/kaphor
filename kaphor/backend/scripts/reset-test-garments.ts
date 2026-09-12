import db from '../src/lib/prisma';

async function main() {
  console.log('Querying all garments...');
  const garments: any[] = await db.garment.findMany({
    select: {
      id: true,
      title: true,
      lifecycleState: true,
      isActive: true,
      reservedOrderId: true,
    },
  });

  console.log(`Total garments found: ${garments.length}`);
  const notListed = garments.filter(
    (g: any) => g.lifecycleState !== 'LISTED' || !g.isActive || g.reservedOrderId !== null
  );

  console.log(`Garments needing reset to LISTED: ${notListed.length}`);
  notListed.forEach((g: any) => {
    console.log(`- [${g.id}] "${g.title}": state=${g.lifecycleState}, active=${g.isActive}, orderId=${g.reservedOrderId}`);
  });

  if (notListed.length > 0) {
    const ids = notListed.map((g: any) => g.id);
    const result = await db.garment.updateMany({
      where: { id: { in: ids } },
      data: {
        lifecycleState: 'LISTED',
        isActive: true,
        reservedOrderId: null,
      },
    });
    console.log(`Successfully reset ${result.count} garments back to LISTED!`);
  } else {
    console.log('All garments are already in LISTED active state.');
  }
}

main()
  .catch((err) => {
    console.error('Error resetting garments:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
