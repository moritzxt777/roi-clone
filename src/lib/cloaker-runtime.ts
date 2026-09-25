/**
 * Cloaker runtime glue: network enrichment and metric persistence.
 *
 * The decision itself lives in `cloaker-engine` and stays pure. This module owns
 * the two impure concerns around it — resolving who the caller actually is, and
 * recording what happened — so the request handler reads as a straight line.
 */

import type { NextRequest } from 'next/server';
import prisma from './prisma';
import { lookupReverseDns, resolveClientIp } from './net-fingerprint';
import type { CloakerConfig, NetworkSignals } from './cloaker-engine';

/**
 * Resolves the network identity of a request.
 *
 * Reverse DNS is opt-in per campaign and bounded to 250ms by
 * `lookupReverseDns`, so a slow or unreachable resolver degrades the verdict to
 * "unknown" instead of stalling the response.
 */
export async function collectNetworkSignals(
  req: NextRequest,
  config: CloakerConfig
): Promise<NetworkSignals> {
  const { ip, source } = resolveClientIp(req.headers);

  if (!ip || config.reverseDnsCheck === false) {
    return { clientIp: ip, ipSource: source, ptr: null, ptrKind: 'unknown' };
  }

  const { ptr, kind } = await lookupReverseDns(ip);
  return { clientIp: ip, ipSource: source, ptr, ptrKind: kind };
}

/**
 * Tracks whether the metrics table is reachable.
 *
 * `CloakerMetric` was added to the schema but the target database only gains the
 * table on `prisma db push`. Until that runs, every write throws, and because the
 * Prisma client raises its own unhandled rejection while formatting the error,
 * the request can fail with a 500 even though the call site is wrapped in
 * try/catch. That took `/p/[slug]` down entirely.
 *
 * So the failure is latched: the first error disables metrics for the life of the
 * process, logs once with the migration instruction, and every later request
 * serves the page without touching the metrics table. Delivery never depends on
 * observability being wired up.
 */
let metricsAvailable = true;
let metricsDisabledReason: string | null = null;

/** Re-enables metric writes. Exported for tests and for post-migration warmups. */
export function __resetMetricsAvailability() {
  metricsAvailable = true;
  metricsDisabledReason = null;
}

export function metricsAreAvailable(): boolean {
  return metricsAvailable;
}

export interface HitRecord {
  pageId: string;
  blocked: boolean;
  verdict: string;
  reason?: string;
}

/**
 * Records a hit as a single atomic upsert.
 *
 * `increment` is evaluated by PostgreSQL, so N simultaneous crawlers produce N
 * increments with no lost updates and no read of the row first. This replaces
 * the previous fire-and-forget update that rewrote the full `meta` JSON and could
 * restore a stale config over a user's just-saved edit.
 */
export async function recordCloakerHit(hit: HitRecord): Promise<void> {
  if (!metricsAvailable) return;

  const blocked = hit.blocked;
  const now = new Date();
  const blockedReason = blocked ? (hit.reason ?? hit.verdict).slice(0, 500) : null;
  const blockedVerdict = blocked ? hit.verdict.slice(0, 64) : null;

  try {
    await prisma.cloakerMetric.upsert({
      where: { pageId: hit.pageId },
      create: {
        pageId: hit.pageId,
        totalHits: 1,
        blackHits: blocked ? 0 : 1,
        whiteHits: blocked ? 1 : 0,
        lastHitAt: now,
        lastBlockedReason: blockedReason,
        lastBlockedVerdict: blockedVerdict,
      },
      update: {
        totalHits: { increment: 1 },
        blackHits: { increment: blocked ? 0 : 1 },
        whiteHits: { increment: blocked ? 1 : 0 },
        lastHitAt: now,
        lastBlockedReason: blockedReason,
        lastBlockedVerdict: blockedVerdict,
      },
    });
  } catch (error) {
    metricsAvailable = false;
    const message = error instanceof Error ? error.message : String(error);
    metricsDisabledReason = message;
    console.error(
      '[cloaker] métricas desativadas neste processo: a tabela CloakerMetric ainda não existe no banco. ' +
        'Rode `npx prisma db push` para criar a tabela e restaurar a contagem. Detalhe:',
      message.split('\n')[0]
    );
  }
}

export interface CloakerMetrics {
  totalHits: number;
  blackHits: number;
  whiteHits: number;
  lastHitAt: string | null;
  lastBlockedReason: string | null;
  lastBlockedVerdict: string | null;
}

export async function readCloakerMetrics(pageIds: string[]): Promise<Map<string, CloakerMetrics>> {
  const empty = new Map<string, CloakerMetrics>();
  if (pageIds.length === 0 || !metricsAvailable) return empty;

  const rows = await prisma.cloakerMetric.findMany({
    where: { pageId: { in: pageIds } },
    select: {
      pageId: true,
      totalHits: true,
      blackHits: true,
      whiteHits: true,
      lastHitAt: true,
      lastBlockedReason: true,
      lastBlockedVerdict: true,
    },
  });

  const byPage = new Map<string, CloakerMetrics>();
  for (const row of rows) {
    byPage.set(row.pageId, {
      totalHits: row.totalHits,
      blackHits: row.blackHits,
      whiteHits: row.whiteHits,
      lastHitAt: row.lastHitAt ? row.lastHitAt.toISOString() : null,
      lastBlockedReason: row.lastBlockedReason,
      lastBlockedVerdict: row.lastBlockedVerdict,
    });
  }
  return byPage;
}