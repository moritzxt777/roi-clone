import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { pageSchema, updatePageSchema } from '@/lib/validations';
import { generateSlug } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get('domainId');
    const status = searchParams.get('status');

    const where: any = { userId: session.user.id };
    if (domainId) where.domainId = domainId;
    if (status) where.status = status;

    const pages = await prisma.page.findMany({
      where,
      include: {
        domain: { select: { id: true, name: true } },
        clones: { select: { id: true, name: true, status: true } },
        _count: { select: { elements: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(pages);
  } catch (error) {
    console.error('Get pages error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = pageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, slug, sourceUrl, domainId } = parsed.data;
    const finalSlug = slug || generateSlug(name);

    if (domainId) {
      const domain = await prisma.domain.findFirst({
        where: { id: domainId, userId: session.user.id, status: 'VERIFIED' },
      });
      if (!domain) {
        return NextResponse.json({ error: 'Domínio não encontrado ou não verificado' }, { status: 404 });
      }
    }

    const existing = await prisma.page.findFirst({
      where: { domainId: domainId || null, slug: finalSlug },
    });

    if (existing) {
      return NextResponse.json({ error: 'Slug já existe neste domínio' }, { status: 409 });
    }

    const page = await prisma.page.create({
      data: {
        name,
        slug: finalSlug,
        sourceUrl: sourceUrl || null,
        domainId: domainId || null,
        userId: session.user.id,
        html: '',
        css: '',
        js: '',
        status: 'DRAFT',
      },
      include: { domain: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_PAGE',
        entity: 'Page',
        entityId: page.id,
        newData: { name, slug: finalSlug },
      },
    });

    return NextResponse.json(page, { status: 201 });
  } catch (error) {
    console.error('Create page error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}