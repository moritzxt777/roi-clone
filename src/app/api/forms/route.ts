import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');

    const where: any = {
      page: {
        userId: session.user.id,
      },
    };

    if (pageId) {
      where.pageId = pageId;
    }

    const submissions = await prisma.formSubmission.findMany({
      where,
      include: {
        page: { select: { name: true, domain: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limitando aos 100 mais recentes por segurança/performance inicial
    });

    return NextResponse.json(submissions);
  } catch (error) {
    console.error('Get form submissions error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
