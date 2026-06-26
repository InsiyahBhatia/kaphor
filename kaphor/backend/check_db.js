const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const users = await prisma.user.findMany();
    console.log("ALL USERS IN DB:", users.map(u => ({ id: u.id, email: u.email, isActive: u.isActive })));
    process.exit(0);
}

check();
