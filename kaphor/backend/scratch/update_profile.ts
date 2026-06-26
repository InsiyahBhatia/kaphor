import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateProfile() {
    try {
        const targetEmail = 'ambhatia1113@gmail.com';
        const targetUsername = 'insiyahmbhatia';

        const user = await prisma.user.findFirst({
            where: { email: targetEmail }
        });

        if (!user) {
            console.error(`User with email ${targetEmail} not found!`);
            return;
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { 
                username: targetUsername,
                displayName: 'Insiyah Bhatia'
            }
        });

        console.log(`Updated profile for ${targetEmail} to username: ${targetUsername}`);

    } catch (error) {
        console.error('Update failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateProfile();
