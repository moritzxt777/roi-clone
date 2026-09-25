import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { validateUrl } from '@/lib/security/url-validator';
import { checkCloneHealth } from '@/lib/clone-health';
import { getAppUrl } from '@/lib/url';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Runs a health check against a published clone.
 *
 * A clone that was correct when it was copied degrades silently: the origin
 * drops an image, a CDN path 404s, a cross-origin fetch is refused. The page
 * stays published and the editor looks fine, so the only place the breakage is
 * visible is a real browser. This surfaces it on demand, read-only.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
      select: {
        id: true,
        name: true,
        slug: true,
        html: true,
        css: true,
        sourceUrl: true,
        status: true,
      },
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    if (!page.html || page.html.trim().length === 0) {
      return NextResponse.json(
        { error: 'Esta página não tem HTML publicado para verificar.' },
        { status: 400 }
      );
    }

    // Probed at the real published URL so relative URLs resolve exactly as they
    // will for a visitor.
    const cloneUrl = `${getAppUrl()}/p/${page.slug}`;

    // `sourceUrl` is user input that was persisted earlier, so it goes through
    // the same validator as a fresh clone target before anything reads it.
    let sourceOrigin: string | null = null;
    if (page.sourceUrl) {
      const validated = await validateUrl(page.sourceUrl).catch(() => null);
      if (validated) {
        try {
          sourceOrigin = new URL(validated).origin;
        } catch {
          sourceOrigin = null;
        }
      }
    }

    const report = await checkCloneHealth({
      cloneUrl,
      html: `${page.html}\n<style>${page.css ?? ''}</style>`,
      sourceOrigin,
    });

    return NextResponse.json({
      pageId: page.id,
      pageName: page.name,
      slug: page.slug,
      status: page.status,
      checkedAt: new Date().toISOString(),
      report,
    });
  } catch (error) {
    console.error('[clone-health] erro:', error);
    return NextResponse.json({ error: 'Erro ao verificar a página' }, { status: 500 });
  }
}
