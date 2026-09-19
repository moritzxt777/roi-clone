import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

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

    const versions = await prisma.pageVersion.findMany({
      where: { pageId: id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { version: 'desc' },
    });

    return NextResponse.json(versions);
  } catch (error) {
    console.error('Get versions error:', error);
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
    const { label } = body;

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
      include: {
        components: {
          include: { component: true, children: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    // Get next version number
    const lastVersion = await prisma.pageVersion.findFirst({
      where: { pageId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = (lastVersion?.version ?? 0) + 1;

    // Build component tree for snapshot
    const componentMap = new Map(page.components.map(c => [c.id, { ...c, children: [] }]));
    const roots: any[] = [];

    page.components.forEach(c => {
      const node = componentMap.get(c.id)!;
      if (c.parentId && componentMap.has(c.parentId)) {
        componentMap.get(c.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const version = await prisma.pageVersion.create({
      data: {
        pageId: id,
        version: nextVersion,
        label: label || `v${nextVersion}`,
        html: page.html,
        css: page.css,
        js: page.js,
        components: roots,
        meta: page.meta,
        userId: session.user.id,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error('Create version error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}