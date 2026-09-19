const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function getEstimatedRetailValue(category, brand, price, listingType) {
  const cat = (category || '').toLowerCase();
  const b = (brand || '').toLowerCase();

  let base = 1899;

  // Category specific baselines (INR)
  if (cat.includes('watch') || cat.includes('timepiece')) {
    base = 5999;
  } else if (cat.includes('bag') || cat.includes('handbag') || cat.includes('clutch') || cat.includes('tote')) {
    base = 4999;
  } else if (cat.includes('shoe') || cat.includes('sneaker') || cat.includes('heel') || cat.includes('boot')) {
    base = 3999;
  } else if (cat.includes('jewel') || cat.includes('necklace') || cat.includes('earring') || cat.includes('ring') || cat.includes('bracelet')) {
    base = 1999;
  } else if (cat.includes('eyewear') || cat.includes('sunglass') || cat.includes('glasses')) {
    base = 2999;
  } else if (cat.includes('belt') || cat.includes('wallet') || cat.includes('cardholder')) {
    base = 1999;
  } else if (cat.includes('scarf') || cat.includes('hat') || cat.includes('tie')) {
    base = 1499;
  } else if (cat.includes('lehenga') || cat.includes('saree') || cat.includes('sherwani')) {
    base = 7999;
  } else if (cat.includes('dress') || cat.includes('gown') || cat.includes('indo-western')) {
    base = 4999;
  } else if (cat.includes('jacket') || cat.includes('coat') || cat.includes('blazer')) {
    base = 3999;
  } else if (cat.includes('kurta') || cat.includes('kurti')) {
    base = 2999;
  } else if (cat.includes('top') || cat.includes('shirt') || cat.includes('tee') || cat.includes('t-shirt')) {
    base = 1299;
  } else if (cat.includes('denim') || cat.includes('jean') || cat.includes('pant') || cat.includes('skirt')) {
    base = 1999;
  }

  // Luxury / Designer multipliers
  const ultraLuxury = [
    'gucci', 'prada', 'chanel', 'louis vuitton', 'dior', 'rolex',
    'hermes', 'balenciaga', 'fendi', 'saint laurent', 'versace',
    'burberry', 'cartier', 'omega'
  ];
  const premium = [
    'coach', 'michael kors', 'tory burch', 'kate spade', 'sabyasachi',
    'manish malhotra', 'tarun tahiliani', 'ralph lauren', 'hugo boss', 'armani', 'abhinav mishra'
  ];

  if (ultraLuxury.some((l) => b.includes(l))) {
    base = Math.round(base * 2.8);
  } else if (premium.some((p) => b.includes(p))) {
    base = Math.round(base * 1.8);
  }

  // Ensure originalPrice is always higher than selling price
  const numPrice = Number(price) || 0;
  if (numPrice > 0) {
    if (listingType === 'SALE') {
      const minFromResale = Math.round(numPrice * 2.2);
      return Math.max(base, minFromResale);
    } else if (listingType === 'RENTAL') {
      const minFromRental = Math.round(numPrice * 2.5);
      return Math.max(base, minFromRental);
    }
  }

  return Math.max(base, Math.round(numPrice * 1.5));
}

async function backfill() {
  const garments = await p.garment.findMany({
    where: { originalPrice: null },
    select: { id: true, title: true, brand: true, category: true, price: true, listingType: true }
  });

  console.log(`Found ${garments.length} garments without originalPrice.`);
  let updated = 0;

  for (const g of garments) {
    const estimatedMRP = getEstimatedRetailValue(g.category, g.brand, g.price, g.listingType);
    await p.garment.update({
      where: { id: g.id },
      data: { originalPrice: estimatedMRP }
    });
    updated++;
  }

  console.log(`Successfully backfilled ${updated} garments with realistic MRP originalPrice.`);
  await p.$disconnect();
}

backfill().catch((err) => {
  console.error('Backfill error:', err);
  p.$disconnect();
});
