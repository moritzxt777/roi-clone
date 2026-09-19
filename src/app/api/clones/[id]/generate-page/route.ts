import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generatePageFromClone } from '@/lib/cloning-engine';

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

    const clone = await prisma.clone.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!clone) {
      return NextResponse.json({ error: 'Clonagem não encontrada' }, { status: 404 });
    }

    if (clone.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Clonagem não foi concluída' }, { status: 400 });
    }

    if (clone.pageId) {
      return NextResponse.json({ error: 'Página já gerada para esta clonagem' }, { status: 400 });
    }

    const page = await prisma.page.create({
      data: {
        name: clone.name,
        slug: clone.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        userId: session.user.id,
        html: clone.resultHtml || '',
        css: clone.resultCss || '',
        js: clone.resultJs || '',
        status: 'DRAFT',
      },
    });

    await generatePageFromClone(clone.id, page.id);

    await prisma.clone.update({
      where: { id },
      data: { pageId: page.id },
    });

    return NextResponse.json({ pageId: page.id, message: 'Página criada com sucesso' });
  } catch (error) {
    console.error('Generate page error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}