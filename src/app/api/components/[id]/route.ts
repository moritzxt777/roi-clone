import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const updateComponentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(['HERO', 'FEATURES', 'PRICING', 'TESTIMONIALS', 'FAQ', 'FORMS', 'NAVIGATION', 'FOOTER', 'CTA', 'MEDIA', 'CONTENT', 'LAYOUT', 'CUSTOM']).optional(),
  description: z.string().optional(),
  thumbnail: z.string().url().optional().or(z.literal('')),
  html: z.string().optional(),
  css: z.string().optional(),
  js: z.string().optional(),
  props: z.record(z.unknown()).optional(),
  isGlobal: z.boolean().optional(),
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

    const component = await prisma.component.findFirst({
      where: {
        id,
        OR: [
          { userId: session.user.id },
          { isGlobal: true },
        ],
      },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!component) {
      return NextResponse.json({ error: 'Componente não encontrado' }, { status: 404 });
    }

    return NextResponse.json(component);
  } catch (error) {
    console.error('Get component error:', error);
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
    const parsed = updateComponentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const component = await prisma.component.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!component) {
      return NextResponse.json({ error: 'Componente não encontrado ou sem permissão' }, { status: 404 });
    }

    const updated = await prisma.component.update({
      where: { id },
      data: parsed.data,
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update component error:', error);
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

    const component = await prisma.component.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!component) {
      return NextResponse.json({ error: 'Componente não encontrado ou sem permissão' }, { status: 404 });
    }

    await prisma.component.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete component error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}