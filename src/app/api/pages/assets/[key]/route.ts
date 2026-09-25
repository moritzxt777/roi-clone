import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Serves a mirrored asset.
 *
 * The key is content-addressed, so the bytes behind a given URL never change.
 * That is what makes an immutable cache header honest: a re-mirror of modified
 * bytes lands on a different key, so a client holding the old one is not served
 * a stale copy and nothing has to be invalidated.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  // The key is generated server-side as `<hex32>.<ext>`, so anything else did not
  // come from this system. Rejecting it here keeps a malformed key from becoming
  // a full-table scan on an unindexed lookup.
  if (!/^[a-f0-9]{32}\.[a-z0-9]{2,5}$/i.test(key)) {
    return NextResponse.json({ error: 'Chave de recurso inválida' }, { status: 400 });
  }

  // `storageKey` is unique per page, not across the table: two clones of
  // different sites routinely mirror byte-identical logos, and content
  // addressing gives them the same key. `findUnique` is only valid on a unique
  // field and throws at runtime for this one, so this is deliberately a
  // `findFirst` — any matching row holds the same bytes by construction.
  const asset = await prisma.cloneAsset.findFirst({
    where: { storageKey: key },
    select: { contentType: true, size: true, data: true, status: true },
  });

  if (!asset || asset.status !== 'READY') {
    return NextResponse.json({ error: 'Recurso não encontrado' }, { status: 404 });
  }

  // Prisma types `Bytes` as a Uint8Array, and a Buffer is one, so this covers
  // both without a cast. It copies, which is what we want anyway: the response
  // body must not alias the driver's view of the column.
  const bytes = new Uint8Array(asset.data);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': asset.contentType,
      'Content-Length': String(asset.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
