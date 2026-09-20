import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const adminEmail = process.env.ADMIN_EMAIL || 'moritzadmin777roi@gmail.com';
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || '$2b$12$7d.gAXsML6/lVg4VVBKMNO/vEvbO3olX3W24bnDk.6MRY/eXTgR32';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Moritz Admin',
        passwordHash,
        role: 'SUPER_ADMIN',
        emailVerified: new Date(),
      },
    });

    console.log('✅ Admin user created:', admin.email);
  } else {
    console.log('ℹ️ Admin user already exists');
  }

  const settings = [
    { key: 'site_name', value: 'ROI Clone', description: 'Nome do site', isPublic: true },
    { key: 'site_description', value: 'Clone páginas e publique no seu domínio', description: 'Descrição do site', isPublic: true },
    { key: 'max_clones_per_month', value: 100, description: 'Limite de clonagens por mês (0 = ilimitado)', isPublic: false },
    { key: 'clone_timeout_ms', value: 120000, description: 'Timeout para clonagem em ms', isPublic: false },
    { key: 'allow_registration', value: true, description: 'Permitir registro de novos usuários', isPublic: true },
    { key: 'maintenance_mode', value: false, description: 'Modo de manutenção', isPublic: false },
  ];

  for (const setting of settings) {
    await prisma.settings.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description, isPublic: setting.isPublic },
      create: setting,
    });
  }

  console.log('✅ Settings created');
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });