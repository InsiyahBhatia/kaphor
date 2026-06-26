import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const count = await prisma.garment.count();
    console.log('GARMENT_COUNT:', count);
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    console.log('USERS:', JSON.stringify(users));
}
main().finally(() => prisma.$disconnect());
