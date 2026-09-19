import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, versionId } = await params;

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    const version = await prisma.pageVersion.findFirst({
      where: { id: versionId, pageId: id },
    });

    if (!version) {
      return NextResponse.json({ error: 'Versão não encontrada' }, { status: 404 });
    }

    // Create a new version before rolling back (so user can go back)
    const lastVersion = await prisma.pageVersion.findFirst({
      where: { pageId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    await prisma.pageVersion.create({
      data: {
        pageId: id,
        version: (lastVersion?.version ?? 0) + 1,
        label: `Rollback to v${version.version}`,
        html: page.html,
        css: page.css,
        js: page.js,
        components: page.components,
        meta: page.meta,
        userId: session.user.id,
      },
    });

    // Restore page from version
    const updatedPage = await prisma.page.update({
      where: { id },
      data: {
        html: version.html,
        css: version.css,
        js: version.js,
        meta: version.meta,
      },
    });

    // Restore components
    await prisma.pageComponent.deleteMany({ where: { pageId: id } });

    if (version.components) {
      const components = version.components as any[];
      
      async function createComponents(components: any[], parentId: string | null = null) {
        for (const comp of components) {
          const created = await prisma.pageComponent.create({
            data: {
              pageId: id,
              componentId: comp.componentId,
              props: comp.props || {},
              position: comp.position,
              parentId,
            },
          });
          if (comp.children && comp.children.length > 0) {
            await createComponents(comp.children, created.id);
          }
        }
      }

      await createComponents(version.components);
    }

    return NextResponse.json({ 
      success: true, 
      page: updatedPage,
      message: `Restaurado para versão ${version.version}` 
    });
  } catch (error) {
    console.error('Rollback version error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, versionId } = await params;

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    await prisma.pageVersion.delete({
      where: { id: versionId, pageId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete version error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}