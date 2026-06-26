const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    await prisma.user.updateMany({
        data: { onboardingDone: true }
    });
    console.log("Fixed all existing accounts to onboardingDone: true");
    process.exit(0);
}

fix();
