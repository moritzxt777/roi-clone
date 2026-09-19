import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { cloneSchema } from '@/lib/validations';
import { clonePage } from '@/lib/cloning-engine';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const clones = await prisma.clone.findMany({
      where: { userId: session.user.id },
      include: {
        page: { select: { id: true, name: true, slug: true, domainId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(clones);
  } catch (error) {
    console.error('Get clones error:', error);
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
    const parsed = cloneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { sourceUrl, name } = parsed.data;

    const clone = await prisma.clone.create({
      data: {
        name,
        sourceUrl,
        userId: session.user.id,
        status: 'PENDING',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_CLONE',
        entity: 'Clone',
        entityId: clone.id,
        newData: { name, sourceUrl },
      },
    });

    clonePage(clone.id).catch((err) => {
      console.error('Clone failed:', err);
    });

    return NextResponse.json(clone, { status: 201 });
  } catch (error) {
    console.error('Create clone error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}