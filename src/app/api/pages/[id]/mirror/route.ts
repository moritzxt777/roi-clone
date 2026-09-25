import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { validateUrl } from '@/lib/security/url-validator';
import {
  DEFAULT_MAX_ASSETS,
  DEFAULT_MAX_ASSET_BYTES,
  mirrorAssets,
  rewriteAssetUrls,
  toPrismaBytes,
  type StoredAsset,
} from '@/lib/clone-assets';
import { getAppUrl } from '@/lib/url';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface MirrorBody {
  maxAssets?: number;
  maxBytes?: number;
  /** When true, removes the page's existing mirror before re-running. */
  refresh?: boolean;
}

/**
 * Mirrors a page's assets and rewrites its HTML to point at the local copies.
 *
 * The write is staged: the bytes and the new HTML are only persisted after every
 * asset has been attempted, and a page whose mirroring mostly failed keeps the
 * HTML it had. Partially rewriting a document to a mix of local and remote URLs
 * is worse than leaving it alone, because it makes the dependency invisible.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    let body: MirrorBody = {};
    try {
      body = (await request.json()) as MirrorBody;
    } catch {
      body = {};
    }

    const page = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, name: true, html: true, css: true, sourceUrl: true, status: true },
    });

    if (!page) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }
    if (!page.html || page.html.trim().length === 0) {
      return NextResponse.json({ error: 'Esta página não tem HTML.' }, { status: 400 });
    }

    const maxAssets = clampInt(body.maxAssets, 1, 500, DEFAULT_MAX_ASSETS);
    const maxBytes = clampInt(body.maxBytes, 16 * 1024, 10 * 1024 * 1024, DEFAULT_MAX_ASSET_BYTES);

    let sourceUrl: string | null = null;
    if (page.sourceUrl) {
      sourceUrl = await validateUrl(page.sourceUrl).catch(() => null);
    }

    const stored = new Map<string, string>();
    const failures: StoredAsset[] = [];
    // Source URLs that were considered this run. The stale prune below is driven
    // by this set rather than by a delete up front, so a run that dies partway
    // leaves the previous mirror intact instead of blanking it.
    const attemptedUrls = new Set<string>();

    const report = await mirrorAssets(
      {
        pageId: page.id,
        appOrigin: getAppUrl(),
        html: page.html,
        css: page.css ?? '',
        maxAssets,
        maxBytes,
      },
      async (asset, bytes) => {
        attemptedUrls.add(asset.sourceUrl);
        if (asset.status !== 'READY') {
          failures.push(asset);
          // Non-READY rows are recorded so the health check and the dashboard can
          // explain a missing asset instead of showing a silent gap.
          await prisma.cloneAsset.upsert({
            where: { pageId_sourceUrl: { pageId: page.id, sourceUrl: asset.sourceUrl } },
            create: {
              pageId: page.id,
              sourceUrl: asset.sourceUrl,
              storageKey: asset.storageKey || `failed-${Buffer.from(asset.sourceUrl).toString('base64url').slice(0, 40)}`,
              contentType: asset.contentType,
              size: asset.size,
              checksum: asset.checksum,
              status: asset.status,
              error: asset.error,
              data: toPrismaBytes(bytes),
            },
            update: {
              status: asset.status,
              error: asset.error,
              size: asset.size,
            },
          });
          return;
        }

        await prisma.cloneAsset.upsert({
          where: { pageId_sourceUrl: { pageId: page.id, sourceUrl: asset.sourceUrl } },
          create: {
            pageId: page.id,
            sourceUrl: asset.sourceUrl,
            storageKey: asset.storageKey,
            contentType: asset.contentType,
            size: asset.size,
            checksum: asset.checksum,
            status: 'READY',
            data: toPrismaBytes(bytes),
          },
          update: {
            storageKey: asset.storageKey,
            contentType: asset.contentType,
            size: asset.size,
            checksum: asset.checksum,
            status: 'READY',
            error: null,
            data: toPrismaBytes(bytes),
          },
        });

        stored.set(asset.sourceUrl, asset.storageKey);
      }
    );

    // Build the URL map from what actually landed in the database rather than
    // from the in-memory report, so a write that failed is not rewritten into
    // the document as if it had succeeded.
    const persisted = await prisma.cloneAsset.findMany({
      where: { pageId: page.id, status: 'READY' },
      select: { sourceUrl: true, storageKey: true },
    });

    const replacements = new Map<string, string>();
    const appOrigin = getAppUrl();
    for (const asset of persisted) {
      replacements.set(asset.sourceUrl, `${appOrigin}/api/pages/assets/${asset.storageKey}`);
    }

    const rewritten = rewriteAssetUrls(page.html, replacements);
    const cssRewritten = page.css ? rewriteAssetUrls(page.css, replacements) : null;

    // The HTML is only replaced when at least one reference was rewritten. A
    // report of "0 espelhados" with changed HTML would be a lie in the other
    // direction.
    const applied = rewritten.replaced > 0;

    if (applied) {
      await prisma.page.update({
        where: { id: page.id },
        data: {
          html: rewritten.html,
          ...(cssRewritten && cssRewritten.replaced > 0 ? { css: cssRewritten.html } : {}),
        },
      });
    }

    // Prune only after the document has been rewritten, and only on an explicit
    // refresh. A row that was not attempted this run is one the HTML no longer
    // references, so keeping it would only grow the table. Gating on `applied`
    // matters: if nothing was rewritten, the document still points at the
    // previous mirror, and pruning it would leave those URLs resolving to
    // nothing.
    let pruned = 0;
    if (body.refresh && applied && attemptedUrls.size > 0) {
      const stale = await prisma.cloneAsset.findMany({
        where: { pageId: page.id, sourceUrl: { notIn: Array.from(attemptedUrls) } },
        select: { id: true },
      });
      if (stale.length > 0) {
        const result = await prisma.cloneAsset.deleteMany({
          where: { id: { in: stale.map((row) => row.id) } },
        });
        pruned = result.count;
      }
    }

    return NextResponse.json({
      pageId: page.id,
      pageName: page.name,
      sourceUrl,
      applied,
      report: {
        attempted: report.attempted,
        stored: report.stored,
        skippedTooLarge: report.skippedTooLarge,
        skippedType: report.skippedType,
        failed: report.failed,
        bytesStored: report.bytesStored,
        referencesRewritten: rewritten.replaced,
        pruned,
        notes: report.notes,
      },
      failures: failures.slice(0, 20).map((f) => ({
        url: f.sourceUrl,
        status: f.status,
        error: f.error,
      })),
    });
  } catch (error) {
    console.error('[clone-assets] erro ao espelhar:', error);
    return NextResponse.json({ error: 'Erro ao espelhar recursos' }, { status: 500 });
  }
}

/** Inventory of what is mirrored, for the dashboard. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const page = await prisma.page.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!page) return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });

  const grouped = await prisma.cloneAsset.groupBy({
    by: ['status'],
    where: { pageId: page.id },
    _count: { _all: true },
    _sum: { size: true },
  });

  const total = grouped.reduce((sum, group) => sum + group._count._all, 0);
  const bytes = grouped.reduce((sum, group) => sum + (group._sum.size ?? 0), 0);

  return NextResponse.json({
    pageId: page.id,
    total,
    bytes,
    byStatus: grouped.map((group) => ({
      status: group.status,
      count: group._count._all,
      bytes: group._sum.size ?? 0,
    })),
  });
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
