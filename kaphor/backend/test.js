const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const users = await prisma.user.findMany({ select: { email: true, onboardingDone: true }});
    console.log("DB STATE:", users);
}

check();
