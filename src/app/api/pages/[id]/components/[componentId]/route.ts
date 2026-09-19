import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const updatePageComponentSchema = z.object({
  props: z.record(z.unknown()).optional(),
  position: z.number().int().nonnegative().optional(),
  parentId: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; componentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, componentId } = await params;
    const body = await request.json();
    const parsed = updatePageComponentSchema.safeParse(body);

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

    const pageComponent = await prisma.pageComponent.findFirst({
      where: { id: componentId, pageId: id },
    });

    if (!pageComponent) {
      return NextResponse.json({ error: 'Componente não encontrado na página' }, { status: 404 });
    }

    const updated = await prisma.pageComponent.update({
      where: { id: componentId },
      data: parsed.data,
      include: { component: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update page component error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; componentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, componentId } = await params;

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    // Delete component and all its children recursively
    async function deleteComponentAndChildren(compId: string) {
      const children = await prisma.pageComponent.findMany({
        where: { parentId: compId },
      });
      for (const child of children) {
        await deleteComponentAndChildren(child.id);
      }
      await prisma.pageComponent.delete({ where: { id: compId } });
    }

    await deleteComponentAndChildren(componentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete page component error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}