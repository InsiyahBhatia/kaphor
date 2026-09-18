const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const check = await prisma.user.findFirst({ where: { username: 'insiyah' } });
  if (check && check.email !== 'insiyahmbhatia@gmail.com') {
    await prisma.user.update({ where: { id: check.id }, data: { username: 'insiyah_somaiya' } });
  }
  await prisma.user.update({
    where: { email: 'insiyahmbhatia@gmail.com' },
    data: { username: 'insiyah', displayName: 'Insiyah' }
  });
  console.log('Successfully set insiyahmbhatia@gmail.com to username: insiyah, displayName: Insiyah');
}

main().catch(console.error).finally(() => prisma.$disconnect());
