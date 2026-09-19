import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const aiSuggestionSchema = z.object({
  elementId: z.string().optional(),
  type: z.enum(['REWRITE', 'SHORTEN', 'EXPAND', 'TRANSLATE', 'TONE_CHANGE', 'SEO_OPTIMIZE', 'CTA_IMPROVE', 'HEADLINE', 'GENERATE']),
  original: z.string().min(1),
  context: z.record(z.unknown()).optional(),
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

    const suggestions = await prisma.aISuggestion.findMany({
      where: { pageId: id },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Get AI suggestions error:', error);
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
    const parsed = aiSuggestionSchema.safeParse(body);

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

    // Generate AI suggestion (mock implementation - replace with real AI)
    const suggested = await generateAISuggestion(
      parsed.data.type,
      parsed.data.original,
      parsed.data.context
    );

    const suggestion = await prisma.aISuggestion.create({
      data: {
        pageId: id,
        elementId: parsed.data.elementId,
        type: parsed.data.type,
        original: parsed.data.original,
        suggested,
        context: parsed.data.context,
        userId: session.user.id,
        status: 'PENDING',
      },
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json(suggestion, { status: 201 });
  } catch (error) {
    console.error('Create AI suggestion error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

async function generateAISuggestion(
  type: string,
  original: string,
  context?: Record<string, unknown>
): Promise<string> {
  // Mock AI - replace with real OpenAI/Anthropic integration
  const prompts: Record<string, string> = {
    REWRITE: `Rewrite this text to be more engaging and clear: "${original}"`,
    SHORTEN: `Shorten this text while keeping the key message: "${original}"`,
    EXPAND: `Expand this text with more detail and examples: "${original}"`,
    TRANSLATE: `Translate to Portuguese: "${original}"`,
    TONE_CHANGE: `Change tone to be more professional: "${original}"`,
    SEO_OPTIMIZE: `Optimize for SEO with keywords: "${original}"`,
    CTA_IMPROVE: `Improve this call-to-action: "${original}"`,
    HEADLINE: `Create a compelling headline for: "${original}"`,
    GENERATE: `Generate compelling copy for: "${original}"`,
  };

  // Simulate AI response
  return `[AI ${type}] ${prompts[type] || original} → Enhanced version would appear here with real AI integration`;
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
    const { suggestionId, status, applyToElement } = body;

    const suggestion = await prisma.aISuggestion.findFirst({
      where: { id: suggestionId, pageId: id },
    });

    if (!suggestion) {
      return NextResponse.json({ error: 'Sugestão não encontrada' }, { status: 404 });
    }

    const updated = await prisma.aISuggestion.update({
      where: { id: suggestionId },
      data: {
        status,
        appliedAt: status === 'APPLIED' ? new Date() : null,
      },
    });

    // If applying to element, update the element content
    if (applyToElement && suggestion.elementId) {
      await prisma.pageElement.update({
        where: { id: suggestion.elementId },
        data: { content: { ...suggestion.content as any, text: suggestion.suggested } },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update AI suggestion error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}