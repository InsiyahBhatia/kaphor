import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const impactData = [
  // Natural Fibres
  { name: 'Cotton (T-shirt)', category: 'Natural', co2Kg: 2.5, waterL: 2700, avgWeightG: 200, reuseFactor: 0.8, sourceRef: 'Quantis 2018; WWF' },
  { name: 'Cotton (Jeans)', category: 'Natural', co2Kg: 33.4, waterL: 7500, avgWeightG: 700, reuseFactor: 0.85, sourceRef: "Levi's LCA 2015; UNEP 2019" },
  { name: 'Cotton (Shirt)', category: 'Natural', co2Kg: 4.3, waterL: 3400, avgWeightG: 300, reuseFactor: 0.8, sourceRef: 'Quantis 2018' },
  { name: 'Organic Cotton', category: 'Natural', co2Kg: 1.8, waterL: 1900, avgWeightG: 250, reuseFactor: 0.8, sourceRef: 'Textile Exchange 2021' },
  { name: 'Linen (Flax)', category: 'Natural', co2Kg: 1.7, waterL: 1000, avgWeightG: 300, reuseFactor: 0.85, sourceRef: 'European Flax; Quantis 2018' },
  { name: 'Hemp', category: 'Natural', co2Kg: 1.1, waterL: 300, avgWeightG: 280, reuseFactor: 0.88, sourceRef: 'Stockholm Environment Institute' },
  { name: 'Wool (Knit)', category: 'Natural', co2Kg: 5.5, waterL: 170, avgWeightG: 400, reuseFactor: 0.82, sourceRef: 'Wool Research Organisation NZ' },
  { name: 'Merino Wool', category: 'Natural', co2Kg: 6.0, waterL: 200, avgWeightG: 350, reuseFactor: 0.83, sourceRef: 'IWTO Lifecycle Report 2020' },
  { name: 'Silk (Saree)', category: 'Natural', co2Kg: 35.0, waterL: 9500, avgWeightG: 600, reuseFactor: 0.9, sourceRef: 'Muthu et al. 2012; UNEP' },
  { name: 'Silk (Blouse/Top)', category: 'Natural', co2Kg: 15.0, waterL: 4800, avgWeightG: 200, reuseFactor: 0.88, sourceRef: 'Muthu et al. 2012' },
  { name: 'Jute', category: 'Natural', co2Kg: 0.55, waterL: 400, avgWeightG: 500, reuseFactor: 0.87, sourceRef: 'FAO Jute Report 2016' },
  { name: 'Bamboo Fabric', category: 'Natural', co2Kg: 2.2, waterL: 2100, avgWeightG: 220, reuseFactor: 0.82, sourceRef: 'Textile Exchange; MADE-BY' },
  // Synthetic Fibres
  { name: 'Polyester (T-shirt)', category: 'Synthetic', co2Kg: 5.5, waterL: 71, avgWeightG: 200, reuseFactor: 0.75, sourceRef: 'Quantis 2018; PE International' },
  { name: 'Polyester (Jacket)', category: 'Synthetic', co2Kg: 12.0, waterL: 150, avgWeightG: 600, reuseFactor: 0.75, sourceRef: 'Quantis 2018' },
  { name: 'Recycled Polyester', category: 'Synthetic', co2Kg: 3.0, waterL: 50, avgWeightG: 200, reuseFactor: 0.78, sourceRef: 'Textile Exchange RPet Report 2021' },
  { name: 'Nylon', category: 'Synthetic', co2Kg: 7.0, waterL: 84, avgWeightG: 250, reuseFactor: 0.73, sourceRef: 'Franklin Associates 2011' },
  { name: 'Acrylic', category: 'Synthetic', co2Kg: 5.9, waterL: 70, avgWeightG: 300, reuseFactor: 0.72, sourceRef: 'MADE-BY Environmental Benchmark' },
  { name: 'Spandex/Elastane', category: 'Synthetic', co2Kg: 6.3, waterL: 55, avgWeightG: 150, reuseFactor: 0.7, sourceRef: 'Higg Materials Sustainability Index' },
  // Blended Fabrics
  { name: 'Cotton-Poly Blend', category: 'Blended', co2Kg: 4.0, waterL: 1400, avgWeightG: 250, reuseFactor: 0.77, sourceRef: 'Derived: weighted avg Quantis 2018' },
  { name: 'Denim (Cotton-Lycra)', category: 'Blended', co2Kg: 30.0, waterL: 6800, avgWeightG: 650, reuseFactor: 0.83, sourceRef: "Levi's LCA 2015; Quantis" },
  { name: 'Silk-Cotton Blend', category: 'Blended', co2Kg: 18.0, waterL: 6200, avgWeightG: 300, reuseFactor: 0.86, sourceRef: 'Derived: Muthu + Quantis' },
  // Indian Traditional
  { name: 'Banarasi Silk Saree', category: 'Indian Traditional', co2Kg: 40.0, waterL: 11000, avgWeightG: 700, reuseFactor: 0.92, sourceRef: 'NIFT India Sustainability Report 2020' },
  { name: 'Chanderi Cotton Saree', category: 'Indian Traditional', co2Kg: 8.5, waterL: 3800, avgWeightG: 400, reuseFactor: 0.88, sourceRef: 'Handloom India; UNEP 2019' },
  { name: 'Kanjivaram Silk', category: 'Indian Traditional', co2Kg: 38.0, waterL: 10500, avgWeightG: 800, reuseFactor: 0.92, sourceRef: 'NIFT India 2020' },
  { name: 'Khadi (Handspun Cotton)', category: 'Indian Traditional', co2Kg: 0.8, waterL: 800, avgWeightG: 350, reuseFactor: 0.9, sourceRef: 'Khadi Commission India; Goswami 2019' },
  { name: 'Pashmina (Cashmere)', category: 'Indian Traditional', co2Kg: 62.0, waterL: 220, avgWeightG: 200, reuseFactor: 0.9, sourceRef: 'Journal of Cleaner Production 2017' },
  { name: 'Ikat Cotton Fabric', category: 'Indian Traditional', co2Kg: 5.5, waterL: 3000, avgWeightG: 400, reuseFactor: 0.87, sourceRef: 'Handloom Board India' },
  // Accessories
  { name: 'Leather (Bag/Belt)', category: 'Accessories', co2Kg: 17.0, waterL: 17000, avgWeightG: 500, reuseFactor: 0.85, sourceRef: 'Higg Index; FAO 2010' },
  { name: 'Faux Leather (PU)', category: 'Accessories', co2Kg: 5.0, waterL: 100, avgWeightG: 400, reuseFactor: 0.76, sourceRef: 'MADE-BY 2018' },
  { name: 'Denim Accessories', category: 'Accessories', co2Kg: 6.0, waterL: 1500, avgWeightG: 100, reuseFactor: 0.84, sourceRef: "Levi's LCA 2015" },
  { name: 'Cotton Socks/Pouch', category: 'Accessories', co2Kg: 1.2, waterL: 800, avgWeightG: 60, reuseFactor: 0.78, sourceRef: 'Quantis 2018 (scaled)' },
];

async function main() {
  console.log('Seeding material impact database...');
  for (const item of impactData) {
    await prisma.materialImpact.upsert({
      where: { name: item.name },
      update: item,
      create: item,
    });
  }
  console.log('Successfully seeded 31 materials.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
