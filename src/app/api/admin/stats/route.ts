import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== 'ADMIN' && (session.user as any).role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const [
      totalUsers,
      totalDomains,
      totalPages,
      totalClones,
      verifiedDomains,
      pendingDomains,
      failedClones,
      recentUsers,
      recentClones,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.domain.count(),
      prisma.page.count(),
      prisma.clone.count(),
      prisma.domain.count({ where: { status: 'VERIFIED' } }),
      prisma.domain.count({ where: { status: 'PENDING' } }),
      prisma.clone.count({ where: { status: 'FAILED' } }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      }),
      prisma.clone.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
    ]);

    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });

    const domainsByStatus = await prisma.domain.groupBy({
      by: ['status'],
      _count: true,
    });

    const clonesByStatus = await prisma.clone.groupBy({
      by: ['status'],
      _count: true,
    });

    const pagesByStatus = await prisma.page.groupBy({
      by: ['status'],
      _count: true,
    });

    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      usersLast7Days,
      clonesLast7Days,
      pagesLast7Days,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: last7Days } } }),
      prisma.clone.count({ where: { createdAt: { gte: last7Days } } }),
      prisma.page.count({ where: { createdAt: { gte: last7Days } } }),
    ]);

    return NextResponse.json({
      overview: {
        totalUsers,
        totalDomains,
        totalPages,
        totalClones,
        verifiedDomains,
        pendingDomains,
        failedClones,
      },
      usersByRole: usersByRole.map((r) => ({ role: r.role, count: r._count })),
      domainsByStatus: domainsByStatus.map((d) => ({ status: d.status, count: d._count })),
      clonesByStatus: clonesByStatus.map((c) => ({ status: c.status, count: c._count })),
      pagesByStatus: pagesByStatus.map((p) => ({ status: p.status, count: p._count })),
      recentActivity: {
        users: recentUsers,
        clones: recentClones,
      },
      growth: {
        usersLast7Days,
        clonesLast7Days,
        pagesLast7Days,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}