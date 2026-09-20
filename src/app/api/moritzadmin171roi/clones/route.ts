import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const ADMIN_AUTHORIZED_EMAIL = 'moritzadmin777roi@gmail.com';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    const userEmail = session?.user?.email?.toLowerCase();

    const isAuthorized = userEmail === ADMIN_AUTHORIZED_EMAIL || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

    if (!session?.user || !isAuthorized) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';
    const status = searchParams.get('status');

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sourceUrl: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const clones = await prisma.clone.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        page: {
          select: { id: true, slug: true, status: true }
        }
      }
    });

    return NextResponse.json({ clones });
  } catch (error) {
    console.error('Erro ao listar clonagens:', error);
    return NextResponse.json({ error: 'Erro interno ao listar clonagens' }, { status: 500 });
  }
}
