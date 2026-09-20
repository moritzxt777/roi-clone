import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateSiteZip, SubpageZipData } from '@/lib/zip-exporter';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(context.params);
    const id = resolvedParams.id;

    // 1. Tentar encontrar por Clone
    const clone = await prisma.clone.findFirst({
      where: { id, userId: session.user.id },
      include: { page: true },
    });

    let projectName = '';
    let mainHtml = '';
    let mainCss = '';
    const subpages: SubpageZipData[] = [];

    if (clone) {
      projectName = clone.name;
      mainHtml = clone.page?.html || clone.resultHtml || '';
      mainCss = clone.page?.css || clone.resultCss || '';

      // Buscar outras subpáginas do mesmo usuário
      const relatedPages = await prisma.page.findMany({
        where: {
          userId: session.user.id,
          id: { not: clone.pageId || '' },
        },
        take: 10,
      });

      relatedPages.forEach((p) => {
        subpages.push({
          name: p.name,
          slug: p.slug,
          html: p.html,
          css: p.css,
        });
      });
    } else {
      // 2. Tentar encontrar diretamente como Page
      const page = await prisma.page.findFirst({
        where: { id, userId: session.user.id },
      });

      if (!page) {
        return NextResponse.json({ error: 'Projeto ou página não encontrada' }, { status: 404 });
      }

      projectName = page.name;
      mainHtml = page.html;
      mainCss = page.css;
    }

    const zip = await generateSiteZip({
      projectName,
      html: mainHtml,
      css: mainCss,
      subpages,
    });

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const safeName = (projectName || 'site-clonado')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');

    return new NextResponse(zipBuffer as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeName}-site-completo.zip"`,
      },
    });
  } catch (error) {
    console.error('ZIP export error:', error);
    return NextResponse.json({ error: 'Erro ao gerar arquivo ZIP do site' }, { status: 500 });
  }
}
