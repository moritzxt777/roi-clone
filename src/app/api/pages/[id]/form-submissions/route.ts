import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const formSubmissionSchema = z.object({
  componentId: z.string().optional(),
  data: z.record(z.unknown()),
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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const pageRecord = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!pageRecord) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    const where: any = { pageId: id };
    if (status) where.status = status;

    const [submissions, total] = await Promise.all([
      prisma.formSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.formSubmission.count({ where }),
    ]);

    return NextResponse.json({
      submissions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get form submissions error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = formSubmissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const page = await prisma.page.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!page || page.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Página não encontrada ou não publicada' }, { status: 404 });
    }

    const submission = await prisma.formSubmission.create({
      data: {
        pageId: id,
        componentId: parsed.data.componentId,
        data: parsed.data.data,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        referrer: request.headers.get('referer') || 'unknown',
        status: 'NEW',
      },
    });

    // TODO: Send notification email/webhook

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    console.error('Create form submission error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}