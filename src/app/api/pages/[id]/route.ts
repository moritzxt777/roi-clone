import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updatePageSchema } from '@/lib/validations';
import { generateSlug } from '@/lib/validations';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
      include: {
        domain: true,
        elements: { orderBy: { position: 'asc' } },
        clones: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    return NextResponse.json(page);
  } catch (error) {
    console.error('Get page error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updatePageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    const data: any = { ...parsed.data };
    if (data.slug) {
      data.slug = generateSlug(data.slug);
      const existing = await prisma.page.findFirst({
        where: { domainId: page.domainId, slug: data.slug, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Slug já existe' }, { status: 409 });
      }
    }

    if (data.status === 'PUBLISHED' && page.status !== 'PUBLISHED') {
      data.publishedAt = new Date();
    }

    const updated = await prisma.page.update({
      where: { id },
      data,
      include: { domain: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_PAGE',
        entity: 'Page',
        entityId: id,
        oldData: { status: page.status },
        newData: data,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update page error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    await prisma.page.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_PAGE',
        entity: 'Page',
        entityId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete page error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}