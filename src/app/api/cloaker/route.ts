import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { CloakerConfig, DEFAULT_CLOAKER_CONFIG } from '@/lib/cloaker-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Busca todas as páginas do usuário
    const pages = await prisma.page.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        sourceUrl: true,
        meta: true,
        createdAt: true,
        domain: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const cloakedPages = pages.map((p) => {
      const meta = (p.meta as any) || {};
      const cloaker: CloakerConfig = meta.cloaker || {
        ...DEFAULT_CLOAKER_CONFIG,
      };

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        domain: p.domain?.name,
        url: `/p/${p.slug}`,
        cloaker,
      };
    });

    return NextResponse.json(cloakedPages);
  } catch (error: any) {
    console.error('Erro ao buscar páginas para cloaker:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { pageId, cloaker } = body;

    if (!pageId || !cloaker) {
      return NextResponse.json(
        { error: 'pageId e cloaker são obrigatórios.' },
        { status: 400 }
      );
    }

    // Verificar se a página pertence ao usuário
    const existing = await prisma.page.findFirst({
      where: { id: pageId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Página não encontrada.' },
        { status: 404 }
      );
    }

    const currentMeta = (existing.meta as any) || {};

    const updated = await prisma.page.update({
      where: { id: pageId },
      data: {
        meta: {
          ...currentMeta,
          cloaker: {
            ...cloaker,
            stats: currentMeta?.cloaker?.stats || {
              totalHits: 0,
              blackHits: 0,
              whiteHits: 0,
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      cloaker: (updated.meta as any)?.cloaker,
    });
  } catch (error: any) {
    console.error('Erro ao salvar cloaker:', error);
    return NextResponse.json({ error: 'Erro ao atualizar cloaker' }, { status: 500 });
  }
}
