import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const ADMIN_AUTHORIZED_EMAIL = 'moritzadmin777roi@gmail.com';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    const userEmail = session?.user?.email?.toLowerCase();

    if (!session?.user || userEmail !== ADMIN_AUTHORIZED_EMAIL || (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 404 });
    }

    const [
      totalUsers,
      totalClones,
      totalCompletedClones,
      totalPages,
      totalLeads,
      totalDomains,
      recentUsers,
      recentClones
    ] = await Promise.all([
      prisma.user.count(),
      prisma.clone.count(),
      prisma.clone.count({ where: { status: 'COMPLETED' } }),
      prisma.page.count(),
      prisma.formSubmission.count(),
      prisma.domain.count(),
      prisma.user.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: {
            select: { clones: true, pages: true }
          }
        }
      }),
      prisma.clone.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, name: true } },
          page: { select: { slug: true } }
        }
      })
    ]);

    return NextResponse.json({
      stats: {
        totalUsers,
        totalClones,
        totalCompletedClones,
        totalPages,
        totalLeads,
        totalDomains,
      },
      recentUsers,
      recentClones,
      systemHealth: {
        database: 'ONLINE',
        roiIaEngine: process.env.NVIDIA_API_KEY ? 'ACTIVE' : 'READY',
        environment: process.env.NODE_ENV || 'production',
        adminUser: userEmail,
      }
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas do painel Moritz Admin:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
