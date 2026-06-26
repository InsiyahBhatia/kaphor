import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function transferListings() {
    try {
        const targetEmail = 'ambhatia1113@gmail.com';
        const targetUsername = 'insiyahmbhatia';

        const user = await prisma.user.findFirst({
            where: { email: targetEmail }
        });

        if (!user) {
            console.error(`User with email ${targetEmail} not found!`);
            // Create user if not found? No, better to wait or check if they are the admin
            return;
        }

        console.log(`Found user: ${user.username} (${user.id})`);

        const updateResult = await prisma.garment.updateMany({
            data: { sellerId: user.id }
        });

        console.log(`Transferred ${updateResult.count} listings to ${user.username}`);

    } catch (error) {
        console.error('Transfer failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

transferListings();
