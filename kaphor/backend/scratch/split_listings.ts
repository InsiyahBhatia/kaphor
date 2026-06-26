import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function splitListings() {
    try {
        const targetEmail = 'insiyahmbhatia@gmail.com';
        
        // Find or create the second user
        let user = await prisma.user.findFirst({
            where: { email: targetEmail }
        });

        if (!user) {
            console.log(`User ${targetEmail} not found, creating...`);
            user = await prisma.user.create({
                data: {
                    email: targetEmail,
                    username: 'insiyah_alt',
                    displayName: 'Insiyah (Alt)',
                    passwordHash: 'social_login',
                }
            });
        }

        console.log(`Target User: ${user.username} (${user.id})`);

        // Transfer 20 items to this user
        const itemsToTransfer = await prisma.garment.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' }
        });

        const ids = itemsToTransfer.map(i => i.id);
        
        const result = await prisma.garment.updateMany({
            where: { id: { in: ids } },
            data: { sellerId: user.id }
        });

        console.log(`Successfully transferred ${result.count} items to ${targetEmail}`);

    } catch (error) {
        console.error('Transfer failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

splitListings();
