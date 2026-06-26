const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const users = await prisma.user.findMany({ 
        select: { email: true, onboardingDone: true, styleAesthetic: true }
    });
    console.log("DB STATE:", JSON.stringify(users, null, 2));
    process.exit(0);
}

check();
