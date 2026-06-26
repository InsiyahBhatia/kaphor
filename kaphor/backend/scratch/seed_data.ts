import { PrismaClient, ListingType, GarmentCondition } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { uploadToS3 } from '../src/lib/s3';
import { logger } from '../src/lib/logger';

const prisma = new PrismaClient();

const THRIFT_DIR = 'c:/Users/Insiyah/Kaphor/KAPHOR THRIFT DATA';
const SWAP_DIR = 'c:/Users/Insiyah/Kaphor/KHAPHOR SWAP DATA';

const THRIFT_ITEMS = [
  { id: 1, title: 'Essential Grey Cotton Tee', brand: 'Bewakoof', size: 'L', price: 199, category: 'Tops', condition: 'Gently used', description: 'Clean, everyday tee in a soft grey tone. Easy to style and perfect for layering or wearing solo.', fabric: 'Cotton', color: ['grey'] },
  { id: 2, title: 'Rust Textured Co-ord Set', brand: 'Zara', size: 'S', price: 399, category: 'Co-ord Sets', condition: 'Excellent', description: 'Matching set with a subtle textured finish. Designed to be worn together for a put-together look or styled separately for versatility.', fabric: 'Textured Fabric', color: ['rust'] },
  { id: 3, title: 'Relaxed Blue Everyday Shirt', brand: 'M&S woman', size: 'M', price: 199, category: 'Shirts', condition: 'Gently used', description: 'Lightweight shirt with a laid-back fit. Ideal for casual days or easy layering.', fabric: 'Cotton/Linen', color: ['blue'] },
  { id: 4, title: 'Utility Sag Green Cargo Pants', brand: 'H&M', size: 'M', price: 349, category: 'Bottoms', condition: 'Good', description: 'Functional and easy to style, with multiple pockets and a relaxed fit.', fabric: 'Cotton Twill', color: ['sage green'] },
  { id: 5, title: 'Beige Linen Relaxed Pants', brand: 'H&M', size: 'L', price: 299, category: 'Bottoms', condition: 'Good', description: 'Lightweight linen pants with a relaxed fit. Breathable, easy to wear, and perfect for warmer days while still looking put together.', fabric: 'Linen', color: ['beige'] },
  { id: 6, title: 'Minimal Everyday Shirt', brand: 'XLINE', size: 'XXL', price: 299, category: 'Shirts', condition: 'Gently used', description: 'Clean silhouette with a versatile vibe. Works across casual and semi-formal looks.', fabric: 'Cotton', color: ['pink'] },
  { id: 7, title: 'Soft Blue Casual Knit Cardigan', brand: 'M12', size: 'M', price: 199, category: 'Knitwear', condition: 'Good', description: 'Comfortable and breathable piece for daily wear.', fabric: 'Knit', color: ['blue'] },
  { id: 8, title: 'Black Y2k Top with Silver Details', brand: 'PICADILLY', size: 'M', price: 249, category: 'Tops', condition: 'Good', description: 'Slightly oversized feel with a relaxed aesthetic.', fabric: 'Cotton Blend', color: ['black'] },
  { id: 9, title: 'Casual Chic Marble Printed Blue Jeans', brand: 'H&M', size: 'M', price: 299, category: 'Denim', condition: 'Excellent', description: 'Effortless piece with a clean finish. Easy to dress up or down.', fabric: 'Denim', color: ['blue'] },
  { id: 10, title: 'Comfortable Bellbottom Formal Black Pants', brand: 'H&M', size: 'M', price: 349, category: 'Bottoms', condition: 'Good', description: 'Comfortable bellbottom formal black pants officeware.', fabric: 'Polyester Blend', color: ['black'] },
  { id: 11, title: 'Smart Casual Button-Up Jean Jacket', brand: 'Para jeans company', size: 'XL', price: 499, category: 'Jacket', condition: 'Excellent', description: 'The jacket features a collared neck, full sleeves, button-front closure, and distressed detailing on the front pockets and seams.', fabric: 'Denim', color: ['blue'] },
  { id: 12, title: 'Simple Light Blue Jeans', brand: 'X\'pose Attitude', size: 'M', price: 299, category: 'Denim', condition: 'Good', description: 'Breathable and comfortable light blue jeans for dailywear.', fabric: 'Denim', color: ['light blue'] },
  { id: 13, title: 'Black Sweatpants with Gold Zip', brand: 'Zudio', size: 'M', price: 249, category: 'Bottoms', condition: 'Gently used', description: 'Simple and comfy black sweatpants with gold zip details.', fabric: 'Jersey', color: ['black'] },
  { id: 14, title: 'Black Formal Sleeveless Dress', brand: 'EXATIC', size: 'XXL', price: 349, category: 'Dress', condition: 'Good', description: 'Black formal sleeveless dress with a straight fit.', fabric: 'Crepe', color: ['black'] },
  { id: 15, title: 'White and Blue Floral A-line Dress', brand: 'Savana', size: 'L', price: 499, category: 'Dress', condition: 'Excellent', description: 'White comfortable A-line dress with floral pattern, milkmade bust, puffy sleeves and slit.', fabric: 'Cotton', color: ['white', 'blue'] },
  { id: 16, title: 'White Button Up Dress with Puffy Sleeves', brand: 'Zudio', size: 'XL', price: 299, category: 'Dress', condition: 'Gently used', description: 'Easy styling white button up dress with puffy sleeves.', fabric: 'Cotton', color: ['white'] },
  { id: 17, title: 'White Top with Lacey Details', brand: 'Zudio', size: 'M', price: 199, category: 'Tops', condition: 'Good', description: 'Simple and versatile white top with lacey details and flowy fit.', fabric: 'Lace/Cotton', color: ['white'] },
  { id: 18, title: 'Black Knitted Top with Buttons', brand: 'Generic', size: 'M', price: 199, category: 'Knitwear', condition: 'Good', description: 'A clean finish black knitted top with buttons.', fabric: 'Knit', color: ['black'] },
  { id: 19, title: 'Black Wool Skirt', brand: 'BREAL', size: 'M', price: 249, category: 'Skirt', condition: 'Gently used', description: 'Minimal and comfy black wool skirt with flowy fit.', fabric: 'Wool', color: ['black'] }
];

const SWAP_ITEMS = [
  { id: 1, title: 'Chunky Silver Belt', brand: 'Generic', size: 'OS', price: 100, category: 'Jewelry', condition: 'Good', description: 'Bold chain-link belt with oversized loops. Strong statement piece for layering or standalone wear.', fabric: 'Alloy', color: ['silver'] },
  { id: 2, title: 'Oxidised Coin Charm Belt', brand: 'Generic', size: 'OS', price: 150, category: 'Jewelry', condition: 'Excellent', description: 'Traditional-style belt with detailed coin charms. Adds a vintage, boho touch to outfits.', fabric: 'Alloy', color: ['oxidised silver'] },
  { id: 3, title: 'Minimal Silver Band Bangle', brand: 'Generic', size: 'OS', price: 150, category: 'Jewelry', condition: 'Excellent', description: 'Clean, polished bangle with a solid finish. Easy everyday essential.', fabric: 'Stainless Steel', color: ['silver'] },
  { id: 4, title: 'Gold-Tone Statement Cuff Bracelet', brand: 'Generic', size: 'OS', price: 100, category: 'Jewelry', condition: 'Excellent', description: 'Sculptural cuff with a bold, artistic design. Elevates simple outfits instantly.', fabric: 'Alloy', color: ['gold'] },
  { id: 5, title: 'Two-Tone Square Dial Watch', brand: 'Generic', size: 'OS', price: 299, category: 'Watches', condition: 'Good', description: 'Classic watch with gold and silver links and a square dial. Slight vintage feel.', fabric: 'Stainless Steel', color: ['gold', 'silver'] },
  { id: 6, title: 'Vintage Minimal Round Dial Watch', brand: 'Generic', size: 'OS', price: 259, category: 'Watches', condition: 'Good', description: 'Sleek silver-tone watch with a clean round dial. Subtle and versatile.', fabric: 'Stainless Steel', color: ['silver'] },
  { id: 7, title: 'Delicate Star Charm Bracelet', brand: 'Generic', size: 'OS', price: 199, category: 'Jewelry', condition: 'Excellent', description: 'Slim bracelet with tiny star accents. Soft, minimal aesthetic.', fabric: 'Alloy', color: ['silver'] },
  { id: 8, title: 'Gold Belt with Pearl Detail', brand: 'Generic', size: 'OS', price: 279, category: 'Jewelry', condition: 'Good', description: 'Multi-link chain belt with a slightly chunky feel. Great for stacking.', fabric: 'Alloy', color: ['gold'] },
  { id: 9, title: 'Oxidised Floral Jhumka Earrings', brand: 'Generic', size: 'OS', price: 129, category: 'Jewelry', condition: 'Excellent', description: 'Traditional jhumka style with floral top and bell drop. Statement ethnic piece.', fabric: 'Alloy', color: ['oxidised silver'] },
  { id: 10, title: 'Oxidised Circular Drop Earrings', brand: 'Generic', size: 'OS', price: 50, category: 'Jewelry', condition: 'Good', description: 'Detailed circular drops with engraved patterns. Bold and vintage-inspired.', fabric: 'Alloy', color: ['oxidised silver'] },
  { id: 11, title: 'Minimal Pendant Chain Necklace', brand: 'Generic', size: 'OS', price: 199, category: 'Jewelry', condition: 'Excellent', description: 'Fine chain with a small pendant. Clean and easy for daily wear.', fabric: 'Alloy', color: ['silver'] },
  { id: 12, title: 'Gold Chain with Green Stone Pendant', brand: 'Generic', size: 'OS', price: 149, category: 'Jewelry', condition: 'Excellent', description: 'Slim chain featuring a small green stone detail. Subtle pop of color.', fabric: 'Alloy', color: ['gold', 'green'] },
  { id: 13, title: 'Oxidised Fan Motif Stud Earrings', brand: 'Generic', size: 'OS', price: 60, category: 'Jewelry', condition: 'Excellent', description: 'Small fan-shaped studs with textured detailing. Minimal yet distinct.', fabric: 'Alloy', color: ['oxidised silver'] },
  { id: 14, title: 'Textured Hoop Earrings', brand: 'Generic', size: 'OS', price: 50, category: 'Jewelry', condition: 'Good', description: 'Small hoops with a rugged texture for added edge. Everyday wearable.', fabric: 'Alloy', color: ['silver'] },
  { id: 15, title: 'Dual Floral Statement Rings', brand: 'Generic', size: 'OS', price: 100, category: 'Jewelry', condition: 'Good', description: 'Bold floral ring with intricate detailing. Strong vintage aesthetic.', fabric: 'Alloy', color: ['oxidised silver'] },
  { id: 16, title: 'Boho Charm Statement Necklace', brand: 'Generic', size: 'OS', price: 100, category: 'Jewelry', condition: 'Good', description: 'Layered necklace with beads and dangling charms. Perfect for statement styling.', fabric: 'Alloy', color: ['oxidised silver'] }
];

async function seed() {
  try {
    // Find a seller user
    let seller = await prisma.user.findFirst({ where: { role: 'SELLER' } });
    if (!seller) {
      // Create a default seller if none exists
      seller = await prisma.user.create({
        data: {
          email: 'seed_seller@kaphor.com',
          username: 'seed_seller',
          passwordHash: 'dummy',
          displayName: 'Seed Curator',
          role: 'SELLER',
          tier: 'GOLD',
        }
      });
    }

    console.log(`Using seller: ${seller.email}`);

    // Helper to map condition string to enum
    const mapCondition = (cond: string): GarmentCondition => {
      const c = cond.toLowerCase();
      if (c.includes('excellent') || c.includes('pristine')) return 'PRISTINE';
      if (c.includes('gently used') || c.includes('good')) return 'MINOR_WEAR';
      return 'PRISTINE';
    };

    // Helper to map specific category to main category
    const getMainCategory = (sub: string): string => {
      const s = sub.toLowerCase();
      if (['tops', 'co-ord sets', 'shirts', 'bottoms', 'denim', 'jacket', 'dress', 'skirt', 'knitwear'].includes(s)) return 'APPAREL';
      if (['jewelry', 'watches', 'belts'].includes(s)) return 'ACCESSORIES';
      if (['sneakers', 'heels', 'boots'].includes(s)) return 'FOOTWEAR';
      if (['sarees', 'lehengas', 'kurtas'].includes(s)) return 'ETHNIC';
      return 'APPAREL';
    };

    // 1. Seed Thrift Items
    for (const item of THRIFT_ITEMS) {
      const imgPath = path.join(THRIFT_DIR, `${item.id}.jpeg`);
      if (fs.existsSync(imgPath)) {
        console.log(`Uploading image for thrift item ${item.id}...`);
        const buffer = fs.readFileSync(imgPath);
        const { url } = await uploadToS3(buffer, 'garments', 'image/jpeg');
        
        if (url) {
          const mainCat = getMainCategory(item.category);
          await prisma.garment.create({
            data: {
              sellerId: seller.id,
              title: item.title,
              description: item.description,
              brand: item.brand,
              category: mainCat,
              subCategory: item.category,
              size: item.size,
              price: item.price * 100, // stored in cents
              condition: mapCondition(item.condition),
              images: [url],
              color: item.color,
              material: [item.fabric],
              listingType: 'SALE',
              lifecycleState: 'LISTED'
            }
          });
          console.log(`Created Thrift Garment: ${item.title} (${mainCat} > ${item.category})`);
        }
      }
    }

    // 2. Seed Swap Items
    for (const item of SWAP_ITEMS) {
      const imgPath = path.join(SWAP_DIR, `${item.id}.jpeg`);
      if (fs.existsSync(imgPath)) {
        console.log(`Uploading image for swap item ${item.id}...`);
        const buffer = fs.readFileSync(imgPath);
        const { url } = await uploadToS3(buffer, 'garments', 'image/jpeg');
        
        if (url) {
          const mainCat = getMainCategory(item.category);
          await prisma.garment.create({
            data: {
              sellerId: seller.id,
              title: item.title,
              description: item.description,
              brand: item.brand,
              category: mainCat,
              subCategory: item.category,
              size: item.size,
              price: item.price * 100,
              condition: mapCondition(item.condition),
              images: [url],
              color: item.color,
              material: [item.fabric],
              listingType: 'ACCESSORY_SWAP',
              lifecycleState: 'LISTED'
            }
          });
          console.log(`Created Swap Accessory: ${item.title} (${mainCat} > ${item.category})`);
        }
      }
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
