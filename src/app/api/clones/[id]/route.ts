import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

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

    let clone = await prisma.clone.findFirst({
      where: { 
        id: id,
        userId: session.user.id 
      },
    });

    if (!clone) {
      // Se não achar por clone.id, busca por page.id
      const page = await prisma.page.findFirst({
        where: { id: id, userId: session.user.id },
      });
      if (page) {
        return NextResponse.json({
          id: page.id,
          name: page.name,
          sourceUrl: page.sourceUrl || '',
          resultHtml: page.html,
          resultCss: page.css,
          pageId: page.id,
          status: 'COMPLETED',
        });
      }
      return NextResponse.json({ error: 'Clone ou Página não encontrado' }, { status: 404 });
    }

    return NextResponse.json(clone);
  } catch (error) {
    console.error('Get clone by id error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(
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
    const body = await request.json();

    const existingClone = await prisma.clone.findFirst({
      where: { 
        id: id,
        userId: session.user.id 
      },
    });

    if (!existingClone) {
      // Fallback para quando o usuário está editando diretamente uma Page (Página 2 / subpágina)
      const existingPage = await prisma.page.findFirst({
        where: { id: id, userId: session.user.id },
      });

      if (existingPage) {
        const pageUpdates: any = {};
        if (body.html !== undefined) pageUpdates.html = body.html;
        if (body.css !== undefined) pageUpdates.css = body.css;
        if (body.js !== undefined) pageUpdates.js = body.js;
        if (body.slug !== undefined) pageUpdates.slug = body.slug;
        if (body.domainId !== undefined) pageUpdates.domainId = body.domainId === 'platform' ? null : body.domainId;
        if (body.meta !== undefined) pageUpdates.meta = body.meta;

        const updatedPage = await prisma.page.update({
          where: { id: existingPage.id },
          data: pageUpdates,
        });

        return NextResponse.json({
          id: updatedPage.id,
          name: updatedPage.name,
          resultHtml: updatedPage.html,
          resultCss: updatedPage.css,
          pageId: updatedPage.id,
        });
      }

      return NextResponse.json({ error: 'Clone ou Página não encontrado' }, { status: 404 });
    }

    const clone = await prisma.clone.update({
      where: { id: id },
      data: {
        resultHtml: body.html,
        resultCss: body.css,
        resultJs: body.js
      }
    });

    if (clone.pageId) {
      const pageUpdates: any = {};
      if (body.html !== undefined) pageUpdates.html = body.html;
      if (body.css !== undefined) pageUpdates.css = body.css;
      if (body.slug !== undefined) pageUpdates.slug = body.slug;
      if (body.domainId !== undefined) pageUpdates.domainId = body.domainId === 'platform' ? null : body.domainId;
      if (body.meta !== undefined) pageUpdates.meta = body.meta;

      await prisma.page.update({
        where: { id: clone.pageId },
        data: pageUpdates,
      }).catch(() => {});
    }

    return NextResponse.json(clone);
  } catch (error) {
    console.error('Update clone error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(
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

    const clone = await prisma.clone.findFirst({
      where: { id, userId: session.user.id }
    });

    if (!clone) {
      return NextResponse.json({ error: 'Clone não encontrado' }, { status: 404 });
    }

    if (clone.pageId) {
      await prisma.page.delete({ where: { id: clone.pageId } }).catch(() => {});
    }

    await prisma.clone.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete clone error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
