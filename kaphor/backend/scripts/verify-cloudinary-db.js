const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function verify() {
  try {
    const garments = await prisma.garment.findMany({
      select: { id: true, title: true, images: true },
      take: 10,
    });

    console.log('Sample Garments in DB:');
    for (const g of garments) {
      console.log(`- ${g.title}: ${g.images ? g.images[0] : 'no images'}`);
    }

    const totalGarments = await prisma.garment.count();
    const cloudinaryGarments = await prisma.garment.count({
      where: {
        images: {
          hasSome: ['https://res.cloudinary.com'],
        },
      },
    });

    const users = await prisma.user.findMany({
      where: { avatar: { not: null } },
      select: { username: true, avatar: true },
    });

    console.log('\nUsers with avatars:');
    for (const u of users) {
      console.log(`- ${u.username}: ${u.avatar}`);
    }

    const messages = await prisma.directMessage.findMany({
      where: { imageUrl: { not: null } },
      select: { id: true, imageUrl: true },
    });

    console.log('\nDirect messages with images:');
    for (const m of messages) {
      console.log(`- ${m.id}: ${m.imageUrl}`);
    }
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
