import { PrismaClient } from '@prisma/client';
import os from 'os';

const db = new PrismaClient();

function getCorrectIp(): string {
  // Hardcoded for user's confirmed network setup
  return '192.168.1.71';
}

async function main() {
  const ip = getCorrectIp();
  console.log(`Targeting local IP: ${ip}`);

  const allGarments = await db.garment.findMany();
  let count = 0;
  
  for (const g of allGarments) {
      const needsUpdate = g.images.some(url => 
        url.includes('localhost:4000') || 
        (url.includes(':4000') && !url.includes(ip))
      );

      if (needsUpdate) {
          const newImages = g.images.map(url => {
            // Replace any IP:4000 or localhost:4000 with current_ip:4000
            return url.replace(/(?:localhost|[\d\.]+):4000/g, `${ip}:4000`);
          });
          
          await db.garment.update({
              where: { id: g.id },
              data: { images: newImages }
          });
          console.log(`Updated garment ${g.id} to use ${ip}:4000`);
          count++;
      }
  }
  console.log(`Migration complete. Updated ${count} garments.`);
}

main().catch(console.error).finally(() => db.$disconnect());
