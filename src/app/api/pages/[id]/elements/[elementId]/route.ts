import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { elementSchema } from '@/lib/validations';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; elementId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, elementId } = await params;
    const body = await request.json();

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    const element = await prisma.pageElement.findFirst({
      where: { id: elementId, pageId: id },
    });

    if (!element) {
      return NextResponse.json({ error: 'Elemento não encontrado' }, { status: 404 });
    }

    const parsed = elementSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Transform undefined parentId to null for Prisma
    const updateData = { ...parsed.data };
    if (updateData.parentId === undefined) {
      delete updateData.parentId;
    } else if (updateData.parentId === '') {
      updateData.parentId = null;
    }

    const updated = await prisma.pageElement.update({
      where: { id: elementId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update element error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; elementId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, elementId } = await params;

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    await prisma.pageElement.delete({
      where: { id: elementId, pageId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete element error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}