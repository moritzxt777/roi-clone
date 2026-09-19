import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const updateSubmissionSchema = z.object({
  status: z.enum(['NEW', 'READ', 'REPLIED', 'SPAM', 'ARCHIVED']).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, submissionId } = await params;

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    const submission = await prisma.formSubmission.findFirst({
      where: { id: submissionId, pageId: id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submissão não encontrada' }, { status: 404 });
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error('Get form submission error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, submissionId } = await params;
    const body = await request.json();
    const parsed = updateSubmissionSchema.safeParse(body);

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

    const submission = await prisma.formSubmission.findFirst({
      where: { id: submissionId, pageId: id },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submissão não encontrada' }, { status: 404 });
    }

    const updated = await prisma.formSubmission.update({
      where: { id: submissionId },
      data: {
        ...parsed.data,
        processedAt: parsed.data.status !== 'NEW' ? new Date() : null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update form submission error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id, submissionId } = await params;

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    await prisma.formSubmission.delete({
      where: { id: submissionId, pageId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete form submission error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}