import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  DEFAULT_CLOAKER_CONFIG,
  DEFAULT_SUSPICION_THRESHOLD,
  toCloakerJson,
  withCloakerDefaults,
  type CloakerConfig,
} from '@/lib/cloaker-engine';
import { readCloakerMetrics } from '@/lib/cloaker-runtime';

export const dynamic = 'force-dynamic';

const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Código de país deve ter exatamente 2 letras');

const configSchema = z
  .object({
    enabled: z.boolean(),
    isExternalOffer: z.boolean().optional(),
    blackPageUrl: z.string().trim().max(2048).optional(),
    blackAction: z.enum(['redirect', 'iframe']).optional(),
    whitePageUrl: z.string().trim().max(2048).optional(),
    whitePageHtml: z.string().max(200_000).optional(),
    filterBots: z.boolean(),
    filterDatacenters: z.boolean(),
    geoFailClosed: z.boolean().optional(),
    reverseDnsCheck: z.boolean().optional(),
    suspicionThreshold: z.number().int().min(20).max(200).optional(),
    allowedCountries: z.array(countryCode).max(50).optional(),
    deviceFilter: z.enum(['all', 'mobile_only', 'desktop_only']),
    action: z.enum(['show_white', 'redirect_white']),
  })
  .superRefine((config, ctx) => {
    if (config.blackPageUrl && !/^https?:\/\//i.test(config.blackPageUrl)) {
      ctx.addIssue({
        code: 'custom',
        path: ['blackPageUrl'],
        message: 'A URL da oferta deve começar com http:// ou https://',
      });
    }
    if (config.whitePageUrl && !/^https?:\/\//i.test(config.whitePageUrl)) {
      ctx.addIssue({
        code: 'custom',
        path: ['whitePageUrl'],
        message: 'A URL da white page deve começar com http:// ou https://',
      });
    }
    if (config.allowedCountries && config.allowedCountries.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['allowedCountries'],
        message: 'Selecione ao menos um país. Para permitir todos, desmarque o filtro geográfico.',
      });
    }
  });

const createExternalSchema = z.object({
  isNewExternal: z.literal(true),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(120).optional(),
  cloaker: configSchema,
});

const updateSchema = z.object({
  pageId: z.string().min(1),
  cloaker: configSchema,
});

/**
 * Discriminated result. `kind` is what narrows `value`, so the two request
 * shapes stay independently typed all the way to their handlers.
 */
type ParsedBody =
  | { ok: true; kind: 'create'; value: z.infer<typeof createExternalSchema> }
  | { ok: true; kind: 'update'; value: z.infer<typeof updateSchema> }
  | { ok: false; response: NextResponse };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const pages = await prisma.page.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      domainId: true,
      domain: { select: { name: true } },
      meta: true,
      cloakerMetric: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const metrics = await readCloakerMetrics(pages.map((p) => p.id));

  const result = pages.map((page) => {
    const meta = (page.meta as Record<string, unknown>) ?? {};
    const stored = meta.cloaker as CloakerConfig | undefined;
    const metric = metrics.get(page.id);

    return {
      id: page.id,
      name: page.name,
      slug: page.slug,
      status: page.status,
      domain: page.domain?.name ?? null,
      url: `/p/${page.slug}`,
      isExternal: meta.type === 'external_cloaker' || stored?.isExternalOffer === true,
      // Null, never a defaulted config. Returning DEFAULT here made every
      // un-cloaked page render as "ACTIVE / Protecting" in the dashboard, so a
      // stray save silently switched cloaking on for a page that never had it.
      cloaker: stored ? withCloakerDefaults(stored) : null,
      defaults: toCloakerJson(DEFAULT_CLOAKER_CONFIG),
      metrics: metric
        ? {
            totalHits: metric.totalHits,
            blackHits: metric.blackHits,
            whiteHits: metric.whiteHits,
            lastHitAt: metric.lastHitAt,
            lastBlockedReason: metric.lastBlockedReason,
            lastBlockedVerdict: metric.lastBlockedVerdict,
          }
        : { totalHits: 0, blackHits: 0, whiteHits: 0, lastHitAt: null, lastBlockedReason: null, lastBlockedVerdict: null },
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const raw = await req.json();
    const parsed = parseBody(raw);
    if (!parsed.ok) return parsed.response;
    const { kind, value } = parsed;

    if (kind === 'create') {
      if (!value.cloaker.blackPageUrl) {
        return NextResponse.json(
          { error: 'Informe a URL da oferta externa (Black Page).' },
          { status: 400 }
        );
      }
      return createExternalCampaign(session.user.id, value);
    }

    const existing = await prisma.page.findFirst({
      where: { id: value.pageId, userId: session.user.id },
      select: { id: true, meta: true, domainId: true, slug: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Página não encontrada.' }, { status: 404 });
    }

    const currentMeta = (existing.meta as Record<string, unknown>) ?? {};
    const merged = toCloakerJson({
      ...withCloakerDefaults(currentMeta.cloaker as CloakerConfig | undefined),
      ...value.cloaker,
    });

    // Only `meta.cloaker` is rewritten. The previous implementation spread the
    // whole stored meta and re-sent the stats object, so a crawler hit landing
    // mid-save could restore a stale config over the user's edit.
    await prisma.page.update({
      where: { id: existing.id },
      data: { meta: { ...currentMeta, cloaker: merged } },
    });

    return NextResponse.json({ success: true, cloaker: merged });
  } catch (error) {
    console.error('[cloaker] erro ao salvar:', error);
    return NextResponse.json({ error: 'Erro ao salvar a configuração do cloaker' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const pageId = new URL(req.url).searchParams.get('pageId');
    if (!pageId) {
      return NextResponse.json({ error: 'pageId é obrigatório' }, { status: 400 });
    }

    const owned = await prisma.page.findFirst({
      where: { id: pageId, userId: session.user.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: 'Página não encontrada.' }, { status: 404 });
    }

    await prisma.page.delete({ where: { id: owned.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[cloaker] erro ao remover:', error);
    return NextResponse.json({ error: 'Erro ao remover' }, { status: 500 });
  }
}

async function createExternalCampaign(
  userId: string,
  value: z.infer<typeof createExternalSchema>
) {
  const baseSlug = slugify(value.slug || value.name) || `oferta-${Date.now().toString(36)}`;

  // The unique index is (domainId, slug). On Postgres NULLs do not collide, so
  // an unscoped duplicate is possible and the original check against
  // `domainId: null` alone would happily hand back a slug already in use.
  const clash = await prisma.page.findFirst({
    where: { domainId: null, slug: { startsWith: baseSlug } },
    select: { slug: true },
  });

  let slug = baseSlug;
  if (clash) {
    const existing = new Set([clash.slug]);
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${baseSlug}-${randomSuffix(4)}`;
      if (!existing.has(candidate)) {
        slug = candidate;
        break;
      }
    }
  }

  const config = toCloakerJson({
    ...withCloakerDefaults(value.cloaker),
    enabled: true,
    isExternalOffer: true,
  });

  const page = await prisma.page.create({
    data: {
      name: value.name,
      slug,
      userId,
      html: '',
      css: '',
      js: '',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      meta: { type: 'external_cloaker', cloaker: config },
    },
    select: { id: true, slug: true },
  });

  return NextResponse.json({
    success: true,
    pageId: page.id,
    slug: page.slug,
    url: `/p/${page.slug}`,
    cloaker: config,
  });
}

function parseBody(raw: unknown): ParsedBody {
  if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).isNewExternal === true) {
    const parsed = createExternalSchema.safeParse(raw);
    return parsed.success
      ? { ok: true, kind: 'create', value: parsed.data }
      : { ok: false, response: validationError(parsed.error) };
  }

  const parsed = updateSchema.safeParse(raw);
  return parsed.success
    ? { ok: true, kind: 'update', value: parsed.data }
    : { ok: false, response: validationError(parsed.error) };
}

function validationError(error: z.ZodError) {
  return NextResponse.json(
    {
      error: 'Configuração inválida.',
      fields: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    { status: 400 }
  );
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function randomSuffix(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
