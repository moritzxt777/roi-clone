import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@roiclone.com';
  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
      emailVerified: new Date()
    },
    create: {
      email,
      name: 'Admin User',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      emailVerified: new Date()
    },
  });

  console.log('User created/updated and verified:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
