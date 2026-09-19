import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const pageComponentSchema = z.object({
  componentId: z.string(),
  props: z.record(z.unknown()).optional(),
  position: z.number().int().nonnegative().optional(),
  parentId: z.string().optional(),
});

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
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    const components = await prisma.pageComponent.findMany({
      where: { pageId: id },
      include: {
        component: true,
        children: {
          include: { component: true },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { position: 'asc' },
    });

    // Build tree structure
    const componentMap = new Map(components.map(c => [c.id, { ...c, children: [] }]));
    const roots: any[] = [];

    components.forEach(c => {
      const node = componentMap.get(c.id)!;
      if (c.parentId && componentMap.has(c.parentId)) {
        componentMap.get(c.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return NextResponse.json(roots);
  } catch (error) {
    console.error('Get page components error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(
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
    const parsed = pageComponentSchema.safeParse(body);

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

    const component = await prisma.component.findFirst({
      where: {
        id: parsed.data.componentId,
        OR: [
          { userId: session.user.id },
          { isGlobal: true },
        ],
      },
    });

    if (!component) {
      return NextResponse.json({ error: 'Componente não encontrado' }, { status: 404 });
    }

    const maxPosition = await prisma.pageComponent.aggregate({
      where: { pageId: id, parentId: parsed.data.parentId || null },
      _max: { position: true },
    });

    const pageComponent = await prisma.pageComponent.create({
      data: {
        pageId: id,
        componentId: parsed.data.componentId,
        props: parsed.data.props || {},
        position: parsed.data.position ?? (maxPosition._max.position ?? -1) + 1,
        parentId: parsed.data.parentId || null,
      },
      include: { component: true },
    });

    return NextResponse.json(pageComponent, { status: 201 });
  } catch (error) {
    console.error('Add page component error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}