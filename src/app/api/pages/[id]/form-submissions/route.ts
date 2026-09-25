import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { resolveClientIp } from '@/lib/net-fingerprint';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendLeadNotificationEmail } from '@/lib/lead-mail';
import { parseFormEncoded } from '@/lib/clone-forms';
import { toStorableJson, asPrismaJson, type JsonValue } from '@/lib/json-coerce';
import { getAppUrl } from '@/lib/url';

export const dynamic = 'force-dynamic';

const MAX_PAYLOAD_BYTES = 64 * 1024;
const MAX_FIELDS = 120;

const formSubmissionSchema = z.object({
  componentId: z.string().max(120).optional(),
  // zod v4 requires both schemas here; the one-argument form was removed.
  data: z.record(z.string(), z.unknown()),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(Number.parseInt(searchParams.get('limit') || '20', 10) || 20, 100);

    const pageRecord = await prisma.page.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });

    if (!pageRecord) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }

    const where = { pageId: id, ...(status ? { status: status as never } : {}) };

    const [submissions, total] = await Promise.all([
      prisma.formSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Math.max(1, page) - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.formSubmission.count({ where }),
    ]);

    return NextResponse.json({
      submissions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[form-submissions] erro ao listar:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * Public submission endpoint.
 *
 * This is the endpoint a cloned page posts to. The cloner previously left every
 * form pointing at the original site's action, so submissions either went to the
 * original operator or were blocked by CORS before leaving the browser. Nothing
 * downstream of this handler existed: the row was stored and then discarded,
 * because the notification e-mail was a TODO.
 *
 * Three things this handler now does that it did not:
 *   - notifies the page owner by e-mail, with Reply-To set to the lead
 *   - derives the client IP from platform-managed headers only, so the stored
 *     and e-mailed IP is not whatever the caller put in `X-Forwarded-For`
 *   - rate limits per IP, because an uncapped public collector is a spam target
 *
 * Deliberately unauthenticated: the visitor of a published page is not logged in.
 * Auth is enforced by `page.status === 'PUBLISHED'` plus the rate limit, and
 * honeypot plus timing are checked before anything is stored.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Cheap rejection before any body parsing.
    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (declaredLength > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: 'Payload muito grande' }, { status: 413 });
    }

    const { ip } = resolveClientIp(request.headers);
    const rateKey = `form_${id}_${ip ?? 'unknown'}`;

    // 12 submissions per 5 minutes per page per IP. A real visitor submits once
    // or twice; a collector doing thousands is stopped here.
    const limit = checkRateLimit(rateKey, 12, 5 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Muitas submissões. Aguarde alguns instantes.' },
        { status: 429, headers: { 'Retry-After': String(limit.resetTime) } }
      );
    }

    const page = await prisma.page.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        domain: { select: { name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!page || page.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Página não encontrada ou não publicada' },
        { status: 404 }
      );
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: 'Payload muito grande' }, { status: 413 });
    }

    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    const isMultipart = contentType.startsWith('multipart/form-data');
    const isUrlEncoded = contentType.startsWith('application/x-www-form-urlencoded');

    // The cloner rewrites the form's action, so a visitor without JavaScript
    // reaches this endpoint with a native form-encoded body. Both shapes are
    // accepted rather than only the JSON one, because a lead submitted by a
    // visitor who disabled scripts is still a lead.
    let fields: Record<string, unknown>;
    let componentId: string | undefined;

    if (isMultipart) {
      fields = parseMultipart(rawBody, contentType);
    } else if (isUrlEncoded) {
      fields = parseFormEncoded(rawBody);
    } else {
      let payload: unknown;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
      }

      const parsed = formSubmissionSchema.safeParse(payload);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }
      fields = parsed.data.data;
      componentId = parsed.data.componentId;
    }

    const entries = Object.entries(fields);
    if (entries.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo enviado' }, { status: 400 });
    }
    if (entries.length > MAX_FIELDS) {
      return NextResponse.json({ error: 'Campos em excesso' }, { status: 400 });
    }

    // Honeypot: the cloner injects a field no human can see and no real form
    // uses. A filled honeypot is the cheapest spam signal available.
    const honeypotHit = HONEYPOT_FIELDS.some((key) => {
      const value = fields[key];
      return typeof value === 'string' && value.trim().length > 0;
    });

    if (honeypotHit) {
      // Answer as if it succeeded. Telling a bot it was detected only teaches it
      // the next field name.
      console.warn(`[form-submissions] honeypot acionado na página ${id} (ip ${ip ?? 'desconhecido'})`);
      return nativeOrJson(isMultipart || isUrlEncoded, { ok: true }, request);
    }

    // A page that renders instantly cannot have been filled by a human. The
    // header is only present on the JavaScript path, so the native path is not
    // penalised for the absence of it.
    const renderedAtHeader = Number(request.headers.get('x-roi-rendered-at') ?? '0');
    const elapsedMs = renderedAtHeader > 0 ? Date.now() - renderedAtHeader : 0;
    if (elapsedMs > 0 && elapsedMs < 1200) {
      return NextResponse.json({ error: 'Submissão rápida demais' }, { status: 429 });
    }

    const cleanData: Record<string, unknown> = {};
    for (const [key, value] of entries) {
      if (HONEYPOT_FIELDS.includes(key)) continue;
      cleanData[key] = typeof value === 'string' ? value.slice(0, 2000) : value;
    }
    // Walked rather than cast: this value is going into a Postgres `Json`
    // column from a public endpoint, and Prisma rejects a payload holding
    // undefined, a function or a circular reference at the driver level.
    const storableData = toStorableJson(cleanData);

    const userAgent = (request.headers.get('user-agent') || 'desconhecido').slice(0, 400);
    const referrer = (request.headers.get('referer') || 'direto').slice(0, 600);

    const submission = await prisma.formSubmission.create({
      data: {
        pageId: page.id,
        componentId,
        data: asPrismaJson(storableData),
        ip: ip ?? 'unknown',
        userAgent,
        referrer,
        status: 'NEW',
      },
      select: { id: true, createdAt: true },
    });

    // Notification runs after the row exists and never blocks the response. A
    // lead that reached the database must not be lost because a mail provider
    // had a bad minute, and the visitor must not wait on SMTP.
    void notifyOwner(page, storableData, submission.id, { ip, userAgent, referrer });

    return nativeOrJson(
      isMultipart || isUrlEncoded,
      { ok: true, id: submission.id, receivedAt: submission.createdAt.toISOString() },
      request
    );
  } catch (error) {
    console.error('[form-submissions] erro ao registrar:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

const HONEYPOT_FIELDS = ['_roi_hp', 'website_confirm', 'contact_website'];

/**
 * A native form post has to end in a redirect, otherwise the visitor is left
 * staring at raw JSON with their submission already recorded. 303 keeps the
 * method GET on the follow-up, so a refresh does not resubmit.
 */
function nativeOrJson(
  isNative: boolean,
  body: Record<string, unknown>,
  request: NextRequest
): NextResponse {
  if (!isNative) {
    return NextResponse.json(body, { status: body.id ? 201 : 202 });
  }

  const referer = request.headers.get('referer');
  let target = '/';
  if (referer) {
    try {
      const url = new URL(referer);
      target = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      target = '/';
    }
  }
  const separator = target.includes('?') ? '&' : '?';
  const destination = `${target}${separator}roi_enviado=1#roi-form`;
  return NextResponse.redirect(new URL(destination, request.url), { status: 303 });
}

/**
 * Minimal multipart reader for the native form path.
 *
 * A full parser is not warranted: cloned lead forms carry text fields, not file
 * uploads, so the boundary is located directly and each part's name and value
 * are read. A part that is not simple text is skipped rather than guessed at.
 */
function parseMultipart(body: string, contentType: string): Record<string, string> {
  const out: Record<string, string> = {};
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = (boundaryMatch?.[1] ?? boundaryMatch?.[2])?.trim();
  if (!boundary) return out;

  const delimiter = `--${boundary}`;
  const segments = body.split(delimiter);

  for (const segment of segments) {
    if (!segment || segment === '--' || segment === '--\r\n' || segment.trim() === '--') continue;

    const headerEnd = segment.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headers = segment.slice(0, headerEnd);
    // `filename` in the content-disposition means a file part, which this
    // endpoint does not accept; skipping avoids reading megabytes of binary
    // into a string field.
    if (/filename=/i.test(headers)) continue;

    const nameMatch = /name="([^"]*)"/i.exec(headers);
    if (!nameMatch?.[1]) continue;

    let value = segment.slice(headerEnd + 4);
    value = value.replace(/\r\n$/, '');

    const key = nameMatch[1];
    out[key] = key in out ? `${out[key]}, ${value}` : value;
  }

  return out;
}

interface NotifyContext {
  ip: string | null;
  userAgent: string;
  referrer: string;
}

async function notifyOwner(
  page: { id: string; name: string; slug: string; user: { name: string | null; email: string } | null },
  data: Record<string, JsonValue>,
  submissionId: string,
  context: NotifyContext
) {
  if (!page.user?.email) {
    console.warn(`[form-submissions] página ${page.id} sem e-mail de destino; lead ${submissionId} salvo sem notificar`);
    return;
  }

  const origin = getAppUrl();
  const host = page.slug ? `${origin}/p/${page.slug}` : null;

  const result = await sendLeadNotificationEmail({
    to: page.user.email,
    ownerName: page.user.name,
    pageName: page.name,
    pageUrl: host,
    fields: data,
    submittedAt: new Date(),
    ip: context.ip,
    userAgent: context.userAgent,
    referrer: context.referrer,
    // Reply-To lets the owner hit reply and reach the lead directly. It is set
    // only from a value that passed full email validation.
    allowReplyTo: true,
  });

  if (result.success) {
    await prisma.formSubmission.update({
      where: { id: submissionId },
      data: { processedAt: new Date() },
    });
  } else {
    console.error(
      `[form-submissions] lead ${submissionId} salvo, e-mail não enviado: ${result.error ?? 'erro desconhecido'}`
    );
  }
}
