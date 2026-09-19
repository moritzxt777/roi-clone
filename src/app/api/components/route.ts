import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const componentSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['HERO', 'FEATURES', 'PRICING', 'TESTIMONIALS', 'FAQ', 'FORMS', 'NAVIGATION', 'FOOTER', 'CTA', 'MEDIA', 'CONTENT', 'LAYOUT', 'CUSTOM']),
  description: z.string().optional(),
  thumbnail: z.string().url().optional().or(z.literal('')),
  html: z.string().min(1),
  css: z.string().optional(),
  js: z.string().optional(),
  props: z.record(z.unknown()).optional(),
  isGlobal: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isGlobal = searchParams.get('isGlobal');

    const where: any = {
      OR: [
        { userId: session.user.id },
        { isGlobal: true },
      ],
    };

    if (category) where.category = category;
    if (isGlobal === 'true') where.isGlobal = true;

    const components = await prisma.component.findMany({
      where,
      orderBy: [{ isGlobal: 'desc' }, { category: 'asc' }, { name: 'asc' }],
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(components);
  } catch (error) {
    console.error('Get components error:', error);
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
    const parsed = componentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const component = await prisma.component.create({
      data: {
        ...parsed.data,
        userId: parsed.data.isGlobal ? null : session.user.id,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json(component, { status: 201 });
  } catch (error) {
    console.error('Create component error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}