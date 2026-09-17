const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Database Garment Repair ---');

  // 1. Fix Gold Coiled Wire Cuff (misnamed as Croissant Leather Shoulder Bag)
  try {
    const cuff = await prisma.garment.update({
      where: { id: '170c0ca0-bbcc-45a5-9909-e74bff63a626' },
      data: {
        title: 'Gold Coiled Wire Statement Cuff',
        description: 'Sculptural coiled gold-tone statement cuff bracelet featuring archival wire wrap craftsmanship and brilliant high-polish finish. 1:1 accessory swap eligible.',
        brand: 'Archive Atelier',
        category: 'Jewelry',
        subCategory: 'Bracelets',
        listingType: 'ACCESSORY_SWAP',
        price: 0,
      },
    });
    console.log('✓ Repaired Cuff:', cuff.id, cuff.title, cuff.category);
  } catch (e) {
    console.log('Note on Cuff update:', e.message);
  }

  // 2. Fix Baroque Pearl Drop Earrings (misnamed as Cannolo Top Handle Bag)
  try {
    const pearl = await prisma.garment.update({
      where: { id: 'b46b8d9e-4f6b-4a78-adc0-e5a42981458d' },
      data: {
        title: 'Sculptural Baroque Pearl Drop Earrings',
        description: 'Artisanal baroque freshwater pearl drop earrings mounted on textured gold vermeil findings. Organically shaped statement jewelry piece.',
        brand: 'Archive Atelier',
        category: 'Jewelry',
        subCategory: 'Earrings',
        listingType: 'ACCESSORY_SWAP',
        price: 0,
      },
    });
    console.log('✓ Repaired Earrings:', pearl.id, pearl.title, pearl.category);
  } catch (e) {
    console.log('Note on Pearl Earrings update:', e.message);
  }

  // 3. Fix Brown Pinstripe Pleated Ribbon Skirt (misclassified as Heels)
  try {
    const skirt = await prisma.garment.update({
      where: { id: '7d11af52-437b-4f99-bfa3-7c7c5d14b599' },
      data: {
        title: 'Brown Pinstripe Pleated Ribbon Skirt',
        description: 'Archival tailored brown pleated midi skirt with contrast ribbon detailing and subtle pinstripe pattern. Pristine drape and structure.',
        brand: 'Archive Collection',
        category: 'Skirts',
        subCategory: 'Pleated Skirts',
        listingType: 'SALE',
        price: 2499,
      },
    });
    console.log('✓ Repaired Skirt:', skirt.id, skirt.title, skirt.category);
  } catch (e) {
    console.log('Note on Skirt update:', e.message);
  }

  // 4. Fix Pavé Crystal Silver Bangle (was Bags)
  try {
    const bangle = await prisma.garment.update({
      where: { id: '72a78a71-635a-4cfa-8e39-a21714190758' },
      data: {
        category: 'Jewelry',
        subCategory: 'Bracelets',
        listingType: 'ACCESSORY_SWAP',
        price: 0,
      },
    });
    console.log('✓ Repaired Bangle:', bangle.id, bangle.title, bangle.category);
  } catch (e) {
    console.log('Note on Bangle update:', e.message);
  }

  // 5. Fix Bohemian Tiered Disc Hoop Earrings (was Eyewear)
  try {
    const hoop = await prisma.garment.update({
      where: { id: '52475ca6-f8fc-4169-b249-1cb7aea30d6c' },
      data: {
        category: 'Jewelry',
        subCategory: 'Earrings',
        listingType: 'ACCESSORY_SWAP',
        price: 0,
      },
    });
    console.log('✓ Repaired Hoop Earrings:', hoop.id, hoop.title, hoop.category);
  } catch (e) {
    console.log('Note on Hoop update:', e.message);
  }

  // 6. Fix Gothic Cross Pendant Necklace (was Eyewear)
  try {
    const cross = await prisma.garment.update({
      where: { id: '2c88b2fc-246e-41d6-b118-2ad1a4f00bb0' },
      data: {
        category: 'Jewelry',
        subCategory: 'Necklaces',
        listingType: 'ACCESSORY_SWAP',
        price: 0,
      },
    });
    console.log('✓ Repaired Cross Necklace:', cross.id, cross.title, cross.category);
  } catch (e) {
    console.log('Note on Cross update:', e.message);
  }

  // 7. Fix any remaining broken render upload URLs in garments
  const renderItems = await prisma.garment.findMany({
    where: {
      images: {
        hasSome: [
          'https://kaphor-backend.onrender.com/uploads/garments/e08cf4a9-6175-4cfd-9b42-f28fcad82fb8-1773724021287.jpeg',
          'https://kaphor-backend.onrender.com/uploads/garments/a5c7aa31-50e5-4f73-9a3d-c12e96bb9114-1773722026858.jpeg'
        ]
      }
    }
  });

  for (const item of renderItems) {
    let newImages = item.images.map(img => {
      if (img.includes('e08cf4a9')) return 'swaps/11.jpg'; // Baroque drop pearl earrings
      if (img.includes('a5c7aa31')) return 'swaps/3.jpg';  // Archive denim / structured outerwear
      return img;
    });
    await prisma.garment.update({
      where: { id: item.id },
      data: { images: newImages }
    });
    console.log(`✓ Repaired image URLs for item ${item.id} (${item.title})`);
  }

  // Check any other garments with /uploads/ on onrender.com
  const allGarments = await prisma.garment.findMany({
    select: { id: true, title: true, images: true, category: true }
  });

  let fixedCount = 0;
  for (const g of allGarments) {
    const hasRenderUpload = (g.images || []).some(img => img.includes('onrender.com/uploads/'));
    if (hasRenderUpload) {
      const fixedImages = g.images.map(img => {
        if (img.includes('onrender.com/uploads/')) {
          if (g.category.toLowerCase().includes('jewel') || g.title.toLowerCase().includes('earring')) {
            return 'swaps/11.jpg';
          }
          if (g.category.toLowerCase().includes('jacket') || g.title.toLowerCase().includes('denim')) {
            return 'swaps/3.jpg';
          }
          return 'swaps/4.jpg';
        }
        return img;
      });
      await prisma.garment.update({
        where: { id: g.id },
        data: { images: fixedImages }
      });
      fixedCount++;
      console.log(`✓ Replaced ephemeral Render upload URL for: ${g.title}`);
    }
  }

  console.log(`--- Finished! Total additional items repaired: ${fixedCount} ---`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
