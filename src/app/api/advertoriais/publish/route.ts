import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { name, html, slug, config } = body;

    if (!html || !name) {
      return NextResponse.json({ error: 'Nome e Conteúdo HTML são obrigatórios.' }, { status: 400 });
    }

    // Gerar slug limpo
    let cleanSlug = (slug || name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!cleanSlug) {
      cleanSlug = `artigo-${Date.now().toString().slice(-6)}`;
    }

    // Garante unicidade do slug se já existir
    const existing = await prisma.page.findFirst({
      where: {
        domainId: null,
        slug: cleanSlug,
      },
    });

    if (existing) {
      cleanSlug = `${cleanSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    const page = await prisma.page.create({
      data: {
        name,
        slug: cleanSlug,
        userId: session.user.id,
        html,
        css: '',
        js: '',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        meta: {
          type: 'advertorial',
          template: config?.template || 'g1',
          headline: config?.headline || name,
          ctaUrl: config?.ctaUrl || '',
          createdAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      pageId: page.id,
      slug: page.slug,
      url: `/p/${page.slug}`,
    });
  } catch (error: any) {
    console.error('Erro ao publicar advertorial:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao publicar advertorial' },
      { status: 500 }
    );
  }
}
