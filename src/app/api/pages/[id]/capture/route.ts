import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Inventory of the API calls captured for a page.
 *
 * Separate from the public replay manifest at `/api/pages/capture/[id]`: that one
 * exposes response bodies to visitors, this one is owner-only and reports counts
 * so the dashboard can say whether a capture exists without exposing its content.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    const captures = await prisma.cloneCapture.findMany({
      where: { pageId: page.id },
      orderBy: { createdAt: 'asc' },
      select: { method: true, resourceKey: true, status: true, contentType: true, hits: true },
    });

    const byStatus = new Map<string, number>();
    for (const capture of captures) {
      // Bucketed by HTTP class so a dashboard can distinguish "everything 200"
      // from "half the calls are errors the replay will faithfully reproduce".
      const bucket = `${Math.floor(capture.status / 100)}xx`;
      byStatus.set(bucket, (byStatus.get(bucket) ?? 0) + 1);
    }

    return NextResponse.json({
      recorded: captures.length,
      totalHits: captures.reduce((sum, capture) => sum + capture.hits, 0),
      byStatus: Array.from(byStatus, ([status, count]) => ({ status, count, bytes: 0 })),
      entries: captures.slice(0, 40).map((capture) => ({
        key: capture.resourceKey,
        status: capture.status,
        contentType: capture.contentType,
        hits: capture.hits,
      })),
    });
  } catch (error) {
    console.error('[clone-capture] erro ao listar:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
