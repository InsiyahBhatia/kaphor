const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      username: { startsWith: 'user_' }
    },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true
    }
  });

  console.log(`Found ${users.length} users with user_ prefix:`);
  for (const u of users) {
    console.log(`- ${u.email}: ${u.username} (${u.displayName})`);
    let clean = '';
    if (u.displayName && u.displayName !== 'Google User' && u.displayName.trim().length > 1) {
      clean = u.displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
    } else if (u.email) {
      clean = u.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
    }
    if (clean && clean !== u.username) {
      // Check if taken
      const exists = await prisma.user.findFirst({ where: { username: clean, id: { not: u.id } } });
      const targetUsername = exists ? `${clean}_${Date.now().toString().slice(-3)}` : clean;
      await prisma.user.update({
        where: { id: u.id },
        data: { username: targetUsername }
      });
      console.log(`  -> Updated ${u.email} username to: ${targetUsername}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
