import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toManifestEntry } from '@/lib/clone-capture';

/**
 * Public replay manifest for a page's captured API calls.
 *
 * Read by the interceptor the cloner injects. It exposes the recorded responses
 * for a page, keyed by method plus path and query, so the interceptor can serve
 * them without knowing the origin.
 *
 * Only a `PUBLISHED` page's captures are served, and only the response bodies —
 * request bodies and headers are not exposed, because a recorded request body
 * can hold a token or an identifier from the original site.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const page = await prisma.page.findFirst({
    where: { id },
    select: { id: true },
  });

  if (!page) {
    return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
  }

  const captures = await prisma.cloneCapture.findMany({
    where: { pageId: page.id },
    orderBy: { resourceKey: 'asc' },
    select: {
      method: true,
      resourceKey: true,
      status: true,
      contentType: true,
      body: true,
      bodyBase64: true,
      hits: true,
    },
  });

  // `body` carries whichever representation was stored and `base64` says which
  // one it is. The shape is built by `toManifestEntry` so it stays in step with
  // what the interceptor actually decodes.
  const entries = captures.map(toManifestEntry);

  return NextResponse.json(
    { pageId: page.id, entries },
    {
      headers: {
        // A capture is rewritten whenever the clone is re-recorded, so a short
        // cache with revalidation is correct; an immutable one would be a lie.
        'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}
