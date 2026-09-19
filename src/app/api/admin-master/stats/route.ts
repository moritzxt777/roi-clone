import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;

    if (!session?.user || (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
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
        take: 6,
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
        take: 6,
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
      }
    });
  } catch (error) {
    console.error('Admin master stats error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
