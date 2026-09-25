import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes('connection_limit')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=25&pool_timeout=30`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: process.env.DATABASE_URL
      ? {
          db: {
            url: getDatabaseUrl(),
          },
        }
      : undefined,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

globalForPrisma.prisma = prisma;

export default prisma;