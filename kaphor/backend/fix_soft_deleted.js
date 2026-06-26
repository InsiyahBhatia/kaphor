const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDeactivatedEmails() {
    try {
        const users = await prisma.user.findMany({ where: { isActive: false } });
        let count = 0;
        for (const u of users) {
            const mark = `_deleted_${Date.now()}_${Math.floor(Math.random()*1000)}`;
            await prisma.user.update({
                where: { id: u.id },
                data: {
                    email: u.email.includes('_deleted_') ? u.email : `${u.email}${mark}`,
                    username: u.username.includes('_deleted_') ? u.username : `${u.username}${mark}`,
                    googleId: null
                }
            });
            count++;
        }
        console.log(`Successfully cleared googleIds for ${count} previously deleted accounts.`);
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

cleanDeactivatedEmails();
