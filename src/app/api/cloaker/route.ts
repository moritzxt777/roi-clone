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

      const isExternal = meta.type === 'external_cloaker' || !!cloaker.isExternalOffer;

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        domain: p.domain?.name,
        url: `/p/${p.slug}`,
        isExternal,
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
    const { isNewExternal, name, slug, pageId, cloaker } = body;

    // Caso 1: Criação de Novo Link de Cloaker para Oferta Externa
    if (isNewExternal) {
      if (!name || !cloaker?.blackPageUrl) {
        return NextResponse.json(
          { error: 'Nome e URL da Oferta Externa (Black Page) são obrigatórios.' },
          { status: 400 }
        );
      }

      let cleanSlug = (slug || name)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      if (!cleanSlug) {
        cleanSlug = `oferta-${Date.now().toString().slice(-6)}`;
      }

      const existing = await prisma.page.findFirst({
        where: { domainId: null, slug: cleanSlug },
      });

      if (existing) {
        cleanSlug = `${cleanSlug}-${Math.random().toString(36).substring(2, 6)}`;
      }

      const fullCloaker: CloakerConfig = {
        ...DEFAULT_CLOAKER_CONFIG,
        ...cloaker,
        enabled: true,
        isExternalOffer: true,
        stats: {
          totalHits: 0,
          blackHits: 0,
          whiteHits: 0,
        },
      };

      const newPage = await prisma.page.create({
        data: {
          name,
          slug: cleanSlug,
          userId: session.user.id,
          html: '',
          css: '',
          js: '',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          meta: {
            type: 'external_cloaker',
            cloaker: fullCloaker,
          },
        },
      });

      return NextResponse.json({
        success: true,
        pageId: newPage.id,
        slug: newPage.slug,
        url: `/p/${newPage.slug}`,
        cloaker: fullCloaker,
      });
    }

    // Caso 2: Atualização de Link / Página Existente
    if (!pageId || !cloaker) {
      return NextResponse.json(
        { error: 'pageId e cloaker são obrigatórios.' },
        { status: 400 }
      );
    }

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

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const url = new URL(req.url);
    const pageId = url.searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json({ error: 'pageId é obrigatório' }, { status: 400 });
    }

    await prisma.page.deleteMany({
      where: { id: pageId, userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao deletar cloaker:', error);
    return NextResponse.json({ error: 'Erro ao remover' }, { status: 500 });
  }
}
