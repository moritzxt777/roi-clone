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

    const clone = await prisma.clone.findFirst({
      where: { 
        id: id,
        userId: session.user.id 
      },
    });

    if (!clone) {
      return NextResponse.json({ error: 'Clone não encontrado' }, { status: 404 });
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
      return NextResponse.json({ error: 'Clone não encontrado ou não autorizado' }, { status: 404 });
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
