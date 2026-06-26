import { PrismaClient, ListingType, GarmentCondition } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const STYLE_VECTOR_LENGTH = 16;
const defaultVector = () => Array.from({ length: STYLE_VECTOR_LENGTH }, () => Math.random() * 0.4 - 0.2);

async function main() {
  const seller = await prisma.user.findUnique({
    where: { email: 'seller@kaphor.com' },
  });

  if (!seller) {
    console.error('Seller user not found. Please run the main seed first.');
    return;
  }

  const catalogueText = fs.readFileSync(path.join(__dirname, '../scratch/catalogue_text.txt'), 'utf-8');

  const blocks = catalogueText.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 0);
  console.log(`Found ${blocks.length} blocks.`);
  let currentGender = 'WOMEN';
  let womenCount = 0;
  let menCount = 0;

  for (const block of blocks) {
    console.log(`Processing block: ${block.slice(0, 50)}...`);
    if (block.includes('--- WOMEN ---')) {
      currentGender = 'WOMEN';
      continue;
    }
    if (block.includes('--- MEN ---')) {
      currentGender = 'MEN';
      continue;
    }

    const lines = block.trim().split('\n');
    if (lines.length < 5) continue;

    let title = '';
    let description = '';
    let brand = 'Unknown';
    let category = '';
    let size = '';
    let condition: GarmentCondition = 'PRISTINE';
    let rentalPriceDay = 0;
    let rentalPriceWeek = 0;
    let fabric = '';
    let color: string[] = [];
    let style = '';
    let pattern = '';

    if (currentGender === 'WOMEN') {
        // Women's format
        const titleIndex = lines.findIndex(l => l.trim() === 'Title');
        if (titleIndex !== -1) title = lines[titleIndex + 1]?.trim();
        
        const descIndex = lines.findIndex(l => l.trim() === 'Description');
        if (descIndex !== -1) description = lines[descIndex + 1]?.trim();

        const brandIndex = lines.findIndex(l => l.trim() === 'Brand');
        if (brandIndex !== -1) brand = lines[brandIndex + 1]?.trim();

        const catIndex = lines.findIndex(l => l.trim() === 'Category');
        if (catIndex !== -1) category = lines[catIndex + 1]?.trim();

        const sizeIndex = lines.findIndex(l => l.trim() === 'Size');
        if (sizeIndex !== -1) size = lines[sizeIndex + 1]?.trim();

        const condIndex = lines.findIndex(l => l.trim() === 'Condition');
        if (condIndex !== -1) {
            const condStr = lines[condIndex + 1]?.trim().toUpperCase();
            if (condStr === 'EXCELLENT' || condStr === 'PRISTINE') condition = 'PRISTINE';
            else if (condStr === 'GOOD') condition = 'MINOR_WEAR';
        }

        const dayIndex = lines.findIndex(l => l.trim() === 'Rental / Day');
        if (dayIndex !== -1) rentalPriceDay = parseInt(lines[dayIndex + 1]?.replace(/[^0-9]/g, '') || '0');

        const weekIndex = lines.findIndex(l => l.trim() === 'Rental / Week');
        if (weekIndex !== -1) rentalPriceWeek = parseInt(lines[weekIndex + 1]?.replace(/[^0-9]/g, '') || '0');

        const fabIndex = lines.findIndex(l => l.trim() === 'Fabric');
        if (fabIndex !== -1) fabric = lines[fabIndex + 1]?.trim();

        const colIndex = lines.findIndex(l => l.trim() === 'Color');
        if (colIndex !== -1) color = lines[colIndex + 1]?.trim().split(/[&,]/).map(s => s.trim());

        const styleIndex = lines.findIndex(l => l.trim() === 'Style');
        if (styleIndex !== -1) style = lines[styleIndex + 1]?.trim();

        const patIndex = lines.findIndex(l => l.trim() === 'Pattern');
        if (patIndex !== -1) pattern = lines[patIndex + 1]?.trim();

        // Categorization for the frontend
        if (title.toLowerCase().includes('saree')) category = 'Sarees';
        else if (title.toLowerCase().includes('lehenga')) category = 'Lehengas';
        else if (title.toLowerCase().includes('kurta') || title.toLowerCase().includes('suit')) category = 'Suits';
        else category = 'Sarees'; // Default

        womenCount++;
        const imageName = `${womenCount}.jpeg`;

        await prisma.garment.create({
            data: {
                sellerId: seller.id,
                title,
                description,
                brand,
                category,
                size,
                condition,
                rentalPriceDay,
                rentalPriceWeek,
                fabric,
                color,
                style,
                pattern,
                images: [`/uploads/rentals/${imageName}`],
                listingType: 'RENTAL',
                isActive: true,
                lifecycleState: 'LISTED',
                garmentVector: defaultVector(),
            }
        });
    } else {
        // Men's format
        title = lines[0].trim();
        
        const brandLine = lines.find(l => l.includes('Brand:'));
        if (brandLine) brand = brandLine.split(':')[1].trim();

        const sizeLine = lines.find(l => l.includes('Size:'));
        if (sizeLine) size = sizeLine.split(':')[1].trim();

        const condLine = lines.find(l => l.includes('Condition:'));
        if (condLine) {
            const condStr = condLine.split(':')[1].trim().toUpperCase();
            if (condStr === 'EXCELLENT' || condStr === 'PRISTINE') condition = 'PRISTINE';
            else if (condStr === 'GOOD') condition = 'MINOR_WEAR';
        }

        const dayLine = lines.find(l => l.includes('Per Day:'));
        if (dayLine) rentalPriceDay = parseInt(dayLine.replace(/[^0-9]/g, '') || '0');

        const weekLine = lines.find(l => l.includes('Per Week:'));
        if (weekLine) rentalPriceWeek = parseInt(weekLine.replace(/[^0-9]/g, '') || '0');

        const fabLine = lines.find(l => l.includes('Fabric:'));
        if (fabLine) fabric = fabLine.split(':')[1].trim();

        const colLine = lines.find(l => l.includes('Color:'));
        if (colLine) color = colLine.split(':')[1].trim().split(/[&,]/).map(s => s.trim());

        const styleLine = lines.find(l => l.includes('Style:'));
        if (styleLine) style = styleLine.split(':')[1].trim();

        const patLine = lines.find(l => l.includes('Pattern:'));
        if (patLine) pattern = patLine.split(':')[1].trim();

        const descIndex = lines.findIndex(l => l.trim() === 'Description');
        if (descIndex !== -1) description = lines[descIndex + 1]?.trim();

        category = 'Sherwanis'; // Default for men's ethnic in this catalogue

        menCount++;
        const imageName = `m${menCount}.jpeg`;

        await prisma.garment.create({
            data: {
                sellerId: seller.id,
                title,
                description,
                brand,
                category,
                size,
                condition,
                rentalPriceDay,
                rentalPriceWeek,
                fabric,
                color,
                style,
                pattern,
                images: [`/uploads/rentals/${imageName}`],
                listingType: 'RENTAL',
                isActive: true,
                lifecycleState: 'LISTED',
                garmentVector: defaultVector(),
            }
        });
    }
  }

  console.log(`Seed complete: ${womenCount} women's rentals and ${menCount} men's rentals created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
