import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  evaluateCloaker,
  withCloakerDefaults,
  type CloakerConfig,
} from '@/lib/cloaker-engine';
import { collectNetworkSignals, recordCloakerHit } from '@/lib/cloaker-runtime';

export const dynamic = 'force-dynamic';

/**
 * Every response from this route varies by User-Agent and by origin country, so
 * none of them may be stored by a shared cache.
 *
 * The black-page path used to answer with `public, s-maxage=300` while the
 * white page answered `no-store`. A CDN in front of the app would cache the
 * human version of the offer and hand it to the crawler that came to review it
 * — the single most reliable way to get a campaign killed. Both variants are
 * now uncacheable, and the Vary header documents why for anything that overrides
 * it downstream.
 */
const CLOAKED_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
  Vary: 'User-Agent, Accept-Language, X-Forwarded-For',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const;

function htmlResponse(body: string, init: { status?: number; headers?: HeadersInit } = {}) {
  return new NextResponse(body, {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...CLOAKED_HEADERS,
      ...(init.headers ?? {}),
    },
  });
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  const { slug } = await props.params;

  const page = await prisma.page.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: { domain: true, clones: { take: 1 } },
  });

  if (!page) return notFound();

  const pageMeta = (page.meta as Record<string, unknown>) ?? {};
  const storedConfig = pageMeta.cloaker as CloakerConfig | undefined;
  const config = withCloakerDefaults(storedConfig);

  if (config.enabled) {
    const signals = await collectNetworkSignals(req, config);
    const evaluation = evaluateCloaker(req.headers, config, signals);

    await recordCloakerHit({
      pageId: page.id,
      blocked: evaluation.isBlocked,
      verdict: evaluation.verdict,
      reason: evaluation.reason,
    });

    if (evaluation.isBlocked) {
      return serveWhitePage(evaluation.reason ?? evaluation.verdict, config);
    }
    return serveBlackPage(req, page, config);
  }

  return servePageHtml(page, {
    css: page.css,
    sourceUrl: page.sourceUrl || page.clones[0]?.sourceUrl,
  });
}

async function serveWhitePage(reason: string, config: CloakerConfig) {
  // Inline HTML wins: it is served from this origin, so every asset in it
  // resolves and there is no cross-origin fetch on the reviewer's hot path.
  if (config.whitePageHtml && config.whitePageHtml.trim().length > 0) {
    return htmlResponse(config.whitePageHtml);
  }

  if (config.whitePageUrl) {
    if (config.action === 'redirect_white') {
      return NextResponse.redirect(config.whitePageUrl, {
        status: 302,
        headers: CLOAKED_HEADERS,
      });
    }

    // Proxy mode. The fetched document's relative URLs would otherwise resolve
    // against this origin and 404, so a <base> is injected to point them at the
    // white page's real host. Without this the reviewer received an unstyled
    // page, which is itself a rejection signal.
    try {
      const upstream = await fetch(config.whitePageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(6000),
        redirect: 'follow',
      });

      if (upstream.ok) {
        const upstreamHtml = await upstream.text();
        const finalUrl = upstream.url || config.whitePageUrl;
        return htmlResponse(injectBaseHref(upstreamHtml, finalUrl));
      }
    } catch (error) {
      console.error('[cloaker] white page upstream falhou:', error);
    }

    // A dead white page must never expose the offer, so fall through to the
    // built-in neutral page rather than to the black page.
    return htmlResponse(FALLBACK_WHITE_HTML);
  }

  return htmlResponse(FALLBACK_WHITE_HTML);
}

async function serveBlackPage(
  req: NextRequest,
  page: { name: string; html: string; css: string; sourceUrl: string | null; clones: Array<{ sourceUrl: string }> },
  config: CloakerConfig
) {
  if (config.blackPageUrl) {
    if (config.blackAction === 'iframe') {
      return htmlResponse(renderIframeShell(page.name, config.blackPageUrl));
    }
    return NextResponse.redirect(config.blackPageUrl, {
      status: 302,
      headers: { ...CLOAKED_HEADERS, 'Referrer-Policy': 'no-referrer-when-downgrade' },
    });
  }

  // No external offer configured: this campaign serves the page cloned here.
  void req;
  return servePageHtml(page, {
    css: page.css,
    sourceUrl: page.sourceUrl || page.clones[0]?.sourceUrl,
  });
}

function servePageHtml(
  page: { html: string },
  options: { css: string | null; sourceUrl: string | null }
) {
  let output = page.html;
  if (!output) return notFound();

  if (options.sourceUrl && !output.includes('<base')) {
    output = injectIntoHead(output, `<base href="${options.sourceUrl}" />`);
  }

  if (options.css && !output.includes('id="roi-aggregated-css"') && !output.includes('id="roi-published-css"')) {
    output = injectIntoHead(output, `<style id="roi-published-css">\n${options.css}\n</style>`);
  }

  if (!output.includes('id="roi-anti-blank-shield"')) {
    output = injectIntoHead(output, ANTI_BLANK_SHIELD);
  }

  return htmlResponse(output);
}

function injectBaseHref(documentHtml: string, baseHref: string): string {
  const tag = `<base href="${escapeAttribute(baseHref)}" />`;
  if (documentHtml.includes('<base')) return documentHtml;
  return injectIntoHead(documentHtml, tag);
}

/** Inserts markup as the first child of <head>, or prepends it when absent. */
function injectIntoHead(documentHtml: string, markup: string): string {
  const headOpen = documentHtml.match(/<head[^>]*>/i);
  if (headOpen && headOpen.index !== undefined) {
    const at = headOpen.index + headOpen[0].length;
    return documentHtml.slice(0, at) + markup + documentHtml.slice(at);
  }
  return markup + documentHtml;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function renderIframeShell(title: string, src: string): string {
  const safeTitle = escapeAttribute(title);
  const safeSrc = escapeAttribute(src);
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>${safeTitle}</title><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#fff}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe src="${safeSrc}" title="${safeTitle}" allow="payment *; autoplay; fullscreen; clipboard-write" referrerpolicy="no-referrer" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"></iframe></body></html>`;
}

function notFound() {
  return htmlResponse(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Página não encontrada</title></head><body style="background:#07080b;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>404</h2><p style="color:#8a8f98">Esta página não está disponível.</p></div></body></html>',
    { status: 404 }
  );
}

const ANTI_BLANK_SHIELD = `<style id="roi-anti-blank-shield">
  html, body { opacity: 1 !important; visibility: visible !important; display: block !important; min-height: 100vh !important; }
  #preloader, .preloader, #loading, .loading-screen, .elementor-loader, .elementor-loading, .page-loader, [class*="preloader"], [id*="preloader"], [class*="loader-wrapper"] { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
</style>`;

const FALLBACK_WHITE_HTML = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Portal deConteúdos</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f8fa;color:#14181f;margin:0;padding:48px 20px;line-height:1.65}.w{max-width:720px;margin:0 auto}h1{font-size:1.6rem;margin:0 0 16px}p{color:#3d4552}hr{border:0;border-top:1px solid #e3e6ea;margin:32px 0}.f{font-size:12px;color:#6b7280}</style></head><body><div class="w"><h1>Conteúdo Informativo</h1><p>Este espaço Hospeda artigos, comunicados e materiais de referência sobre o setor. Não há formulários, ofertas ou coleta de dados nesta página.</p><hr><p class="f">Todos os direitos reservados.</p></div></body></html>`;
