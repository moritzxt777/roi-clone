import prisma from '@/lib/prisma';
import { sanitizeHtml } from '@/lib/validations';
import { validateUrl } from './security/url-validator';
import { wireCloneForms } from './clone-forms';
import { mirrorAssets, rewriteAssetUrls, toPrismaBytes } from './clone-assets';
import { buildReplayScript } from './clone-capture';
import { installCaptureRecorder, manifestUrlFor } from './clone-capture-runtime';
import { getAppUrl } from './url';
import * as cheerio from 'cheerio';
import axios from 'axios';

interface ElementNode {
  id: string;
  type: string;
  tagName: string;
  selector: string;
  content: Record<string, any>;
  styles: Record<string, any>;
  attrs: Record<string, any>;
  children: ElementNode[];
}

export interface CloneOptions {
  newCheckoutUrl?: string;
  pixKey?: string;
  optimizeWithAi?: boolean;
  crawlFullSite?: boolean;
  maxPages?: number;
}

/**
 * Mirrors a page's assets and returns the document with local URLs in place.
 *
 * Shared by both engines so the storage decision, the caps and the rewrite
 * behave identically regardless of which one produced the page.
 */
async function mirrorPageAssets(
  pageId: string,
  input: { appOrigin: string; html: string; css: string }
): Promise<{
  html: string;
  stored: number;
  bytesStored: number;
  notes: string[];
}> {
  try {
    const report = await mirrorAssets(
      { pageId, appOrigin: input.appOrigin, html: input.html, css: input.css },
      async (asset, bytes) => {
        try {
          if (asset.status !== 'READY') {
            await prisma.cloneAsset.upsert({
              where: { pageId_sourceUrl: { pageId, sourceUrl: asset.sourceUrl } },
              create: {
                pageId,
                sourceUrl: asset.sourceUrl,
                storageKey: asset.storageKey || `failed-${Buffer.from(asset.sourceUrl).toString('base64url').slice(0, 40)}`,
                contentType: asset.contentType,
                size: asset.size,
                checksum: asset.checksum,
                status: asset.status,
                error: asset.error,
                data: toPrismaBytes(bytes),
              },
              update: { status: asset.status, error: asset.error, size: asset.size },
            });
            return;
          }

          try {
            await prisma.cloneAsset.upsert({
              where: { pageId_sourceUrl: { pageId, sourceUrl: asset.sourceUrl } },
              create: {
                pageId,
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
          } catch (upsertErr: any) {
            // Se storageKey já foi gravado por outra sourceUrl com mesmo conteúdo exato,
            // gera uma storageKey com hash da sourceUrl para garantir unicidade
            if (upsertErr?.code === 'P2002') {
              const ext = asset.storageKey.split('.').pop() || 'bin';
              const uniqueKey = `${asset.checksum.slice(0, 20)}-${Buffer.from(asset.sourceUrl).toString('hex').slice(0, 10)}.${ext}`;
              await prisma.cloneAsset.upsert({
                where: { pageId_sourceUrl: { pageId, sourceUrl: asset.sourceUrl } },
                create: {
                  pageId,
                  sourceUrl: asset.sourceUrl,
                  storageKey: uniqueKey,
                  contentType: asset.contentType,
                  size: asset.size,
                  checksum: asset.checksum,
                  status: 'READY',
                  data: toPrismaBytes(bytes),
                },
                update: {
                  storageKey: uniqueKey,
                  contentType: asset.contentType,
                  size: asset.size,
                  checksum: asset.checksum,
                  status: 'READY',
                  error: null,
                  data: toPrismaBytes(bytes),
                },
              }).catch(() => {});
            }
          }
        } catch (err: any) {
          // If the unique constraint on (pageId, storageKey) triggers, the asset is already saved
          if (err?.code === 'P2002') return;
          console.warn('[Cloner] Asset store notice:', err?.message || err);
        }
      }
    );

    // Built from what is actually in the database, not from the in-memory report,
    // so a write that failed is never rewritten into the document as if it had
    // succeeded.
    const persisted = await prisma.cloneAsset.findMany({
      where: { pageId, status: 'READY' },
      select: { sourceUrl: true, storageKey: true },
    });

    const replacements = new Map<string, string>();
    for (const asset of persisted) {
      replacements.set(asset.sourceUrl, `${input.appOrigin}/api/pages/assets/${asset.storageKey}`);
    }

    const rewritten = rewriteAssetUrls(input.html, replacements);
    return {
      html: rewritten.html,
      stored: report.stored,
      bytesStored: report.bytesStored,
      notes: report.notes,
    };
  } catch (error) {
    // A mirror failure must not fail the clone. The page is already usable with
    // remote assets, and the health check will report the dependency.
    console.warn('[Cloner] Espelhamento de recursos falhou:', (error as Error).message);
    return { html: input.html, stored: 0, bytesStored: 0, notes: ['Espelhamento falhou.'] };
  }
}

export async function clonePage(cloneId: string, options?: CloneOptions): Promise<void> {
  const clone = await prisma.clone.findUnique({
    where: { id: cloneId },
    include: { user: true },
  });

  if (!clone) throw new Error('Clone não encontrado');

  try {
    await prisma.clone.update({
      where: { id: cloneId },
      data: { status: 'FETCHING', progress: 10 },
    });

    const targetUrl = await validateUrl(clone.sourceUrl);

    const wsEndpoint =
      process.env.PLAYWRIGHT_WS_ENDPOINT ||
      (process.env.BROWSERLESS_API_KEY
        ? `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_API_KEY}`
        : null);

    // Se não tiver WebSocket remoto (ex: Browserless), usa diretamente o motor HTTP Cheerio
    // de altíssima performance e baixíssimo consumo de memória (vital para a VPS não estourar RAM com Chromium local)
    if (!wsEndpoint) {
      console.log('[Cloner] Utilizando motor Cheerio Multi-Tier de alta performance e fidelidade.');
      await cloneWithCheerio(cloneId, clone, targetUrl, options);
      return;
    }

    // Se tiver WebSocket configurado, usa Playwright remoto
    try {
      await cloneWithPlaywright(cloneId, clone, targetUrl, wsEndpoint, options);
    } catch (playwrightErr: any) {
      console.warn('[Cloner] Falha no Playwright remoto, executando fallback para Cheerio:', playwrightErr?.message || playwrightErr);
      await cloneWithCheerio(cloneId, clone, targetUrl, options);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    await prisma.clone.update({
      where: { id: cloneId },
      data: { status: 'FAILED', error: errorMessage },
    });
    throw error;
  }
}

/**
 * Per-UA header variations.
 *
 * The previous implementation also sent a hardcoded list of six "residential"
 * IPs in `X-Forwarded-For`, `CF-Connecting-IP`, `X-Real-IP` and `Client-IP`. That
 * was not a proxy: those are just header values, and any site that resolves the
 * real socket peer — which is every Cloudflare-fronted host and every WAF — sees
 * the datacenter IP this process is actually running from. It only worked against
 * hosts that trust a client-supplied header blindly, and a fixed pool of six
 * addresses is trivially fingerprinted and blocked within minutes.
 *
 * What remains is the part that is actually legitimate: a coherent browser
 * fingerprint. A User-Agent has to agree with its own `Sec-Ch-Ua` value, its
 * `Sec-Fetch-*` set and its `Accept` header, because inconsistency is a stronger
 * bot signal than any single header.
 *
 * If residential egress is actually needed, set `CLONE_PROXY_URL` and the
 * request goes through a real proxy — which is the only thing that changes the
 * address the origin observes.
 */
const REFERER = 'https://www.google.com.br/';
const ACCEPT_LANGUAGE = 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7';

function browserHeaders(): Record<string, string> {
  return {
    Referer: REFERER,
    'Accept-Language': ACCEPT_LANGUAGE,
  };
}

/**
 * Routes the request through a configured proxy, when one exists.
 *
 * Read per call rather than at module load so the env var can be set in a test
 * or a one-off script without a restart.
 */
function proxyConfig(): { proxy: false | { host: string; port: number; auth?: { username: string; password: string } } } {
  const raw = process.env.CLONE_PROXY_URL;
  if (!raw) return { proxy: false };

  try {
    const url = new URL(raw.includes('://') ? raw : `http://${raw}`);
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    return {
      proxy: {
        host: url.hostname,
        port,
        ...(url.username
          ? { auth: { username: decodeURIComponent(url.username), password: decodeURIComponent(url.password) } }
          : {}),
      },
    };
  } catch (error) {
    console.warn(`[Cloner] CLONE_PROXY_URL inválido, ignorando: ${(error as Error).message}`);
    return { proxy: false };
  }
}

/**
 * 1. Fetch Multi-Tier de Alta Fidelidade (Anti-Bloqueio / Anti-Bot)
 */
async function fetchWithMultiTier(targetUrl: string): Promise<{ html: string; finalUrl: string }> {
  const { proxy } = proxyConfig();

  const tiers = [
    {
      name: 'Chrome Desktop Moderno',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        // Must agree with the User-Agent: Chrome 128 on Windows. A mismatch here
        // is a stronger bot signal than any header on its own.
        'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        ...browserHeaders(),
      },
    },
    {
      name: 'Mobile iPhone Safari (Cloaker Bypass)',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        // Safari does not send Sec-Ch-Ua at all, so none are set here.
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        ...browserHeaders(),
      },
    },
    {
      name: 'Social Media Crawler (Facebook/WhatsApp)',
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        Accept: '*/*',
      },
    },
  ];

  let lastError: any = null;

  for (const tier of tiers) {
    try {
      console.log(`[Cloner] Tentando download com: ${tier.name}${proxy ? ' (via proxy)' : ''}`);
      const res = await axios.get(targetUrl, {
        timeout: 18000,
        headers: tier.headers,
        maxRedirects: 8,
        validateStatus: (status) => status < 400,
        ...(proxy ? { proxy } : {}),
      });

      if (res.data && typeof res.data === 'string' && res.data.length > 500) {
        const isCfBlock =
          res.data.includes('cf-browser-verification') ||
          res.data.includes('Just a moment...') ||
          res.data.includes('Attention Required! | Cloudflare') ||
          res.data.includes('403 - Forbidden') ||
          res.data.includes('Access to this page is forbidden');
        if (!isCfBlock) {
          const finalUrl = res.request?.res?.responseUrl || targetUrl;
          return { html: res.data, finalUrl };
        }
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Cloner] Tier '${tier.name}' falhou:`, err.message || err);
    }
  }

  // Tier 4: Serverless Proxy Fallback (AllOrigins)
  try {
    console.log('[Cloner] Acionando Tier 4: Serverless Proxy Fallback...');
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const proxyRes = await axios.get(proxyUrl, {
      timeout: 20000,
      validateStatus: (status) => status < 400,
    });

    if (proxyRes.data && typeof proxyRes.data === 'string' && proxyRes.data.length > 200) {
      return { html: proxyRes.data, finalUrl: targetUrl };
    }
  } catch (proxyErr: any) {
    console.warn('[Cloner] Tier 4 Proxy falhou:', proxyErr.message || proxyErr);
  }

  if (lastError) throw lastError;
  throw new Error('Não foi possível obter o conteúdo HTML da página.');
}

/**
 * 2. Reescrita de URLs relativas em CSS para absolutas
 */
function rewriteCssUrls(css: string, baseUrl: URL): string {
  if (!css || typeof css !== 'string') return '';
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, rawUrl) => {
    const trimmed = rawUrl.trim();
    if (
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('//')
    ) {
      return match;
    }
    try {
      const abs = new URL(trimmed, baseUrl.href).href;
      return `url("${abs}")`;
    } catch {
      return match;
    }
  });
}

/**
 * 3. Detecção e acompanhamento de redirecionamentos HTML / JS
 */
function checkHtmlRedirect(html: string, currentUrl: URL): string | null {
  const metaMatch = html.match(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"'>]+)["']/i);
  if (metaMatch && metaMatch[1]) {
    try {
      const dest = new URL(metaMatch[1].trim(), currentUrl.href).href;
      if (dest !== currentUrl.href) return dest;
    } catch {}
  }

  if (html.length < 3000) {
    const jsMatch =
      html.match(/(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i) ||
      html.match(/location\.replace\(['"]([^'"]+)['"]\)/i) ||
      html.match(/location\.assign\(['"]([^'"]+)['"]\)/i);
    if (jsMatch && jsMatch[1]) {
      try {
        const dest = new URL(jsMatch[1].trim(), currentUrl.href).href;
        if (dest !== currentUrl.href) return dest;
      } catch {}
    }
  }
  return null;
}

/**
 * 4. Auto-Descoberta Profunda de Páginas de Vendas (Cloaker Bypass)
 */
async function discoverRealSalesPage(initialHtml: string, baseUrl: URL): Promise<{ html: string; finalUrl: URL }> {
  const hasStrongOfferMarkers =
    initialHtml.length > 45000 &&
    /kiwify|hotmart|monetizze|eduzz|braip|perfectpay|cakto|kirvano|pepper|checkout|comprar|adquirir|pagar|garantir|vsl|oferta/i.test(
      initialHtml
    );

  const isDefaultEmptyWp =
    initialHtml.includes('Welcome to WordPress. This is your first post') ||
    (initialHtml.includes('Welcome to WordPress') && initialHtml.includes('Hello world!')) ||
    (initialHtml.includes('wp-content') && initialHtml.includes('Hello world!') && initialHtml.length < 50000) ||
    initialHtml.includes('Just another WordPress site') ||
    initialHtml.includes('Welcome to your new site') ||
    ((baseUrl.pathname === '/' || baseUrl.pathname === '') && initialHtml.length < 20000);

  // Redirecionamento explícito
  const redirectTarget = checkHtmlRedirect(initialHtml, baseUrl);
  if (redirectTarget) {
    try {
      console.log(`[Cloner] Redirecionamento detectado para: ${redirectTarget}`);
      const redirected = await fetchWithMultiTier(redirectTarget);
      if (redirected.html && redirected.html.length > 1000) {
        return { html: redirected.html, finalUrl: new URL(redirectTarget) };
      }
    } catch {}
  }

  if (!isDefaultEmptyWp && hasStrongOfferMarkers) {
    return { html: initialHtml, finalUrl: baseUrl };
  }

  console.log('[Cloner] Página inicial com indício de cloaker ou raiz vazia. Iniciando auto-descoberta profunda da oferta real...');
  const priorityKeywords = /segura|principal|vendas|oferta|pv|vsl|app|cdd|lp|checkout|produto|curso|metodo|oficial|home/i;

  // Método A: API REST WordPress (/wp-json/wp/v2/pages)
  try {
    const wpApiUrl = new URL('/wp-json/wp/v2/pages?per_page=50', baseUrl.origin).href;
    const wpRes = await axios.get(wpApiUrl, {
      timeout: 7000,
      headers: browserHeaders(),
      validateStatus: () => true,
    });
    if (Array.isArray(wpRes.data) && wpRes.data.length > 0) {
      const bestPage =
        wpRes.data.find(
          (p: any) => priorityKeywords.test(p.slug || '') || priorityKeywords.test(p.title?.rendered || '')
        ) || wpRes.data[0];

      if (bestPage?.link) {
        console.log(`[Cloner] Auto-descoberta via WP API encontrou: ${bestPage.link}`);
        const fetched = await fetchWithMultiTier(bestPage.link);
        if (fetched.html && fetched.html.length > 10000) {
          return { html: fetched.html, finalUrl: new URL(bestPage.link) };
        }
      }
    }
  } catch (wpErr) {
    console.warn('[Cloner] WP API indisponível:', wpErr);
  }

  // Método B: Sitemap XML (/wp-sitemap-posts-page-1.xml ou /sitemap.xml)
  const sitemapCandidates = ['/wp-sitemap-posts-page-1.xml', '/sitemap.xml', '/sitemap_index.xml'];
  for (const smPath of sitemapCandidates) {
    try {
      const smUrl = new URL(smPath, baseUrl.origin).href;
      const smRes = await axios.get(smUrl, {
        timeout: 6000,
        headers: browserHeaders(),
        validateStatus: () => true,
      });
      if (typeof smRes.data === 'string' && smRes.data.includes('<loc>')) {
        const matches = Array.from(smRes.data.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/gi)).map((m) => m[1]);
        const bestUrl = matches.find((u) => priorityKeywords.test(u) && u !== baseUrl.href && u !== `${baseUrl.origin}/`);
        if (bestUrl) {
          console.log(`[Cloner] Auto-descoberta via Sitemap XML encontrou: ${bestUrl}`);
          const fetched = await fetchWithMultiTier(bestUrl);
          if (fetched.html && fetched.html.length > 10000) {
            return { html: fetched.html, finalUrl: new URL(bestUrl) };
          }
        }
      }
    } catch {}
  }

  // Método C: Links internos na home
  try {
    const $ = cheerio.load(initialHtml);
    const internalLinks: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try {
          const resolved = new URL(href, baseUrl.href).href;
          if (resolved.startsWith(baseUrl.origin) && resolved !== baseUrl.href && resolved !== `${baseUrl.origin}/`) {
            internalLinks.push(resolved);
          }
        } catch {}
      }
    });

    const bestInternal = internalLinks.find((u) => priorityKeywords.test(u));
    if (bestInternal) {
      console.log(`[Cloner] Auto-descoberta via Links Internos encontrou: ${bestInternal}`);
      const fetched = await fetchWithMultiTier(bestInternal);
      if (fetched.html && fetched.html.length > 10000) {
        return { html: fetched.html, finalUrl: new URL(bestInternal) };
      }
    }
  } catch {}

  // Método D: Sonda Concorrente de Slugs Universais de Páginas de Vendas
  const COMMON_SALES_SLUGS = [
    '/pagina-segura/',
    '/pagina-segura',
    '/pv/',
    '/pv',
    '/pv-oficial/',
    '/vsl/',
    '/vsl',
    '/oferta/',
    '/oferta',
    '/lp/',
    '/lp',
    '/vendas/',
    '/vendas',
    '/oficial/',
    '/oficial',
    '/metodo/',
    '/curso/',
    '/checkout/',
    '/app/',
  ];

  try {
    console.log('[Cloner] Executando sonda concorrente de slugs universais de oferta...');
    const probePromises = COMMON_SALES_SLUGS.map(async (slug) => {
      const probeUrl = new URL(slug, baseUrl.origin).href;
      try {
        const res = await axios.get(probeUrl, {
          timeout: 6000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
            ...browserHeaders(),
          },
          maxRedirects: 3,
          validateStatus: (s) => s === 200,
        });
        if (typeof res.data === 'string' && res.data.length > 20000) {
          return { html: res.data, url: probeUrl };
        }
      } catch {}
      return null;
    });

    const probeResults = await Promise.all(probePromises);
    const validProbe = probeResults.find((r) => r !== null);
    if (validProbe) {
      console.log(`[Cloner] Sonda de slug universal encontrou a página da oferta: ${validProbe.url}`);
      return { html: validProbe.html, finalUrl: new URL(validProbe.url) };
    }
  } catch (probeErr) {
    console.warn('[Cloner] Sonda de slugs finalizada sem novos achados:', probeErr);
  }

  return { html: initialHtml, finalUrl: baseUrl };
}

/**
 * Motor Cheerio de Alta Fidelidade: 100% Serverless, sem necessidade de Chromium binário.
 * Baixa o HTML, auto-descobre páginas reais, reescreve links/mídias/CSS, injeta escudo anti-tela branca e gera a árvore de elementos.
 */
async function cloneWithCheerio(
  cloneId: string,
  clone: any,
  targetUrl: string,
  options?: CloneOptions
): Promise<void> {
  await prisma.clone.update({
    where: { id: cloneId },
    data: { status: 'FETCHING', progress: 30 },
  });

  // 1. Download Multi-Tier à  prova de bloqueios
  const initialFetch = await fetchWithMultiTier(targetUrl);
  let baseUrl = new URL(initialFetch.finalUrl || targetUrl);

  // 2. Auto-descoberta de página de vendas caso seja cloaker ou raiz vazia
  const resolvedPage = await discoverRealSalesPage(initialFetch.html, baseUrl);
  let rawHtml = resolvedPage.html;
  baseUrl = resolvedPage.finalUrl;

  await prisma.clone.update({
    where: { id: cloneId },
    data: { status: 'ANALYZING', progress: 50 },
  });

  const $ = cheerio.load(rawHtml);

  // Endpoint absoluto para onde os formulários do clone vão submeter. Precisa ser
  // absoluto porque o clone é servido em um subpath ou subdomínio, não no host
  // original — um action relativo resolveria no lugar errado.
  const appOrigin = getAppUrl();

  // Função auxiliar para resolver URLs relativas para absolutas
  function resolveUrl(relativeUrl: string | undefined): string {
    if (!relativeUrl) return '';
    try {
      const trimmed = relativeUrl.trim();
      if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('javascript:')) {
        return trimmed;
      }
      return new URL(trimmed, baseUrl.href).href;
    } catch {
      return relativeUrl;
    }
  }

  // 3. Garantir tag <base> para resolução imediata de links e requisições dinà¢micas
  if ($('head').length > 0) {
    if ($('base').length === 0) {
      $('head').prepend(`<base href="${baseUrl.origin}/">`);
    }
  } else {
    $('html').prepend(`<head><base href="${baseUrl.origin}/"></head>`);
  }

  // 4. Neutralizar Preloaders e Bloqueadores de Tela Branca no DOM
  $(
    '#preloader, .preloader, #loading, .loading-screen, .elementor-loader, .elementor-loading, .page-loader, .preloader-wrapper, #page-preloader, [class*="preloader"], [id*="preloader"], [class*="loader-wrapper"], [class*="loading-overlay"]'
  ).remove();

  // Injetar Escudo Anti-Tela Branca (Garante 100% de visibilidade e anula telas brancas de temas/plugins)
  const antiBlankShield = `
<style id="roi-anti-blank-shield">
  html, body {
    opacity: 1 !important;
    visibility: visible !important;
    display: block !important;
    min-height: 100vh !important;
  }
  #preloader, .preloader, #loading, .loading-screen, .elementor-loader, .elementor-loading, .page-loader, [class*="preloader"], [id*="preloader"], [class*="loader-wrapper"] {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
</style>
`;
  if ($('head').length > 0) {
    $('head').append(antiBlankShield);
  } else {
    $('body').prepend(antiBlankShield);
  }

  // 5. Converter URLs relativas em absolutas (stylesheets, links, scripts)
  $('link').each((_, el) => {
    const href = $(el).attr('href');
    if (href) $(el).attr('href', resolveUrl(href));
  });

  // 6. Neutralizar framebusters, loops de debugger, travas de hostname e scripts invasivos de tracking/redirect
  $('script').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (
      src.includes('utmify') ||
      src.includes('pixel-google') ||
      src.includes('fbevents') ||
      src.includes('~flock') ||
      src.includes('analytics') ||
      src.includes('taboola') ||
      src.includes('clarity') ||
      src.includes('hotjar') ||
      src.includes('tiktok') ||
      src.includes('_next/static/chunks/main-app') ||
      src.includes('_next/static/chunks/webpack') ||
      src.includes('_next/static/chunks/app/error') ||
      src.includes('_next/static/chunks/app/not-found')
    ) {
      $(el).remove();
      return;
    }

    if (src) {
      $(el).attr('src', resolveUrl(src));
    } else {
      let scriptContent = $(el).html() || '';

      // Neutralizar scripts invasivos de tracking externos inline,
      // MAS NUNCA remover scripts com timers, funis, lógica de quiz ou verificação!
      if (
        (scriptContent.includes('googlePixelId') && !scriptContent.includes('function') && scriptContent.length < 300) ||
        (scriptContent.includes('fbevents.js') && !scriptContent.includes('setInterval') && scriptContent.length < 500)
      ) {
        $(el).remove();
        return;
      }

      // Neutralizar travas anti-desktop e anti-automation que congelam barras de carregamento/verificação no PC
      if (scriptContent.includes('isMobileDevice') || scriptContent.includes('hasAutomationSignals')) {
        scriptContent = scriptContent
          .replace(/function\s+isMobileDevice\s*\([^)]*\)\s*\{[\s\S]*?\}/gi, 'function isMobileDevice() { return true; }')
          .replace(/function\s+hasAutomationSignals\s*\([^)]*\)\s*\{[\s\S]*?\}/gi, 'function hasAutomationSignals() { return false; }');
      }

      // Neutralizar framebusters e travas de hostname sem quebrar o restante da lógica
      if (
        scriptContent.includes('top.location') ||
        scriptContent.includes('window.top') ||
        scriptContent.includes('parent.location') ||
        scriptContent.includes('location.hostname') ||
        scriptContent.includes('location.host') ||
        scriptContent.includes('debugger') ||
        scriptContent.includes('top !== self') ||
        scriptContent.includes('self !== top')
      ) {
        scriptContent = scriptContent
          .replace(/top\.location\s*=/gi, '// top.location =')
          .replace(/top\.location\.replace/gi, '// top.location.replace')
          .replace(/window\.top\.location\s*=/gi, '// window.top.location =')
          .replace(/window\.top\.location\.replace/gi, '// window.top.location.replace')
          .replace(/parent\.location\s*=/gi, '// parent.location =')
          .replace(/window\.top\s*!==\s*window\.self/gi, 'false')
          .replace(/top\s*!==\s*self/gi, 'false')
          .replace(/self\s*!==\s*top/gi, 'false')
          .replace(/debugger;/gi, '/* debugger */')
          .replace(/location\.hostname\s*!==/gi, 'false &&')
          .replace(/location\.host\s*!==/gi, 'false &&');
      }

      // Resolver URLs relativas de redirecionamento (ex: destinationUrl = '/01/index.html')
      // para evitar 404 quando o usuário clica no botão continuar da oferta
      if (options?.newCheckoutUrl) {
        scriptContent = scriptContent.replace(
          /(var\s+destinationUrl\s*=\s*['"])([^'"]+)(['"])/gi,
          `$1${options.newCheckoutUrl}$3`
        );
      } else {
        scriptContent = scriptContent.replace(
          /(var\s+destinationUrl\s*=\s*['"])([^'"]+)(['"])/gi,
          (_, p1, p2, p3) => {
            if (p2.startsWith('http://') || p2.startsWith('https://')) return `${p1}${p2}${p3}`;
            const abs = resolveUrl(p2);
            return `${p1}${abs}${p3}`;
          }
        );
      }

      $(el).html(scriptContent);
    }
  });

  // 6.5. Auto-Reconstrução de Conteúdo para SPAs / Next.js / XQuiz / Client-Side Funnels
  const mainChildrenCount = $('main *').length;
  if (mainChildrenCount < 3) {
    const contentMatch = rawHtml.match(/"content":\s*(\[\s*\{[\s\S]*?\}\s*\])\s*,\s*"icon"/);
    if (contentMatch) {
      try {
        const contentItems = JSON.parse(contentMatch[1]);
        let generatedHtml = '';
        for (const item of contentItems) {
          if (item.type === 'imageV3' && item.data?.image?.uuid) {
            const imgUrl = `https://cdn.xquiz.co/images/${item.data.image.uuid}`;
            generatedHtml += `
              <div class="flex flex-auto justify-center mb-6">
                <img src="${imgUrl}" alt="${item.title || ''}" class="max-w-xs h-auto rounded-lg shadow-md" style="width: 256px; height: auto;" />
              </div>
            `;
          } else if (item.type === 'heading' || item.type === 'text' || item.data?.content) {
            const txt = item.data?.text || item.data?.content || item.title || '';
            generatedHtml += `
              <div class="text-center my-4">
                <h2 class="text-xl font-bold text-gray-900">${txt}</h2>
              </div>
            `;
          } else if (item.type === 'button' || item.type === 'buttonV3' || item.title === 'Botão') {
            const btnText = item.data?.text || item.data?.label || 'Continuar';
            const btnUrl = item.data?.url || item.data?.link || '#';
            generatedHtml += `
              <div class="flex justify-center my-6">
                <a href="${btnUrl}" class="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg rounded-xl shadow-lg transition-transform hover:scale-105 inline-block text-center">
                  ${btnText}
                </a>
              </div>
            `;
          }
        }

        if (generatedHtml) {
          if ($('main').length > 0) {
            $('main').html(generatedHtml);
          } else {
            $('body').prepend(`<main class="max-w-lg mx-auto px-4 py-8">${generatedHtml}</main>`);
          }
        }
      } catch (parseErr) {
        console.warn('[Cloner] Notice on SPA reconstruction:', parseErr);
      }
    }
  }

  // 7. Imagens: Desativar lazy-loading e converter para eager loading com caminhos absolutos
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (src) $(el).attr('src', resolveUrl(src));

    const dataSrc =
      $(el).attr('data-src') ||
      $(el).attr('data-original') ||
      $(el).attr('data-lazy-src') ||
      $(el).attr('data-hi-res-src') ||
      $(el).attr('data-fallback-src');
    if (dataSrc) {
      const absDataSrc = resolveUrl(dataSrc);
      $(el).attr('data-src', absDataSrc);
      $(el).attr('src', absDataSrc);
    }

    $(el).attr('loading', 'eager');

    const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');
    if (srcset) {
      const parts = srcset
        .split(',')
        .map((p) => {
          const [u, size] = p.trim().split(/\s+/);
          return size ? `${resolveUrl(u)} ${size}` : resolveUrl(u);
        })
        .join(', ');
      $(el).attr('srcset', parts);
    }
  });

  // 8. Reeescrever caminhos de imagens em background inline
  $('[style]').each((_, el) => {
    const styleVal = $(el).attr('style');
    if (styleVal && styleVal.includes('url(')) {
      $(el).attr('style', rewriteCssUrls(styleVal, baseUrl));
    }
  });

  // 9. IA Assistente: Substituição inteligente de Checkout próprio
  const checkoutKeywords = /checkout|pay|kiwify|hotmart|monetizze|eduzz|braip|perfectpay|cakto|kirvano|pepper|cart|comprar|adquirir|pagar|assinar|matricul|inscric|inscreva|garantir|vendas/i;
  
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text() || '';
    const classes = $(el).attr('class') || '';

    if (options?.newCheckoutUrl && (checkoutKeywords.test(href || '') || checkoutKeywords.test(text) || checkoutKeywords.test(classes))) {
      $(el).attr('href', options.newCheckoutUrl);
      $(el).attr('target', '_blank');
      $(el).attr('data-roi-ai-checkout', 'replaced');
    } else if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('tel:') && !href.startsWith('mailto:')) {
      $(el).attr('href', resolveUrl(href));
    }
  });

  $('video, audio, source').each((_, el) => {
    const src = $(el).attr('src');
    if (src) $(el).attr('src', resolveUrl(src));
  });

  // 10. IA Assistente: Injeção de Checkout PIX se configurado
  if (options?.pixKey) {
    const safePixKey = options.pixKey.replace(/[^a-zA-Z0-9@._-]/g, '');
    const pixModalHtml = `
    <div id="roi-pix-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:999999;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;">
      <div style="background:#0d0e14;border:1px solid rgba(255,255,255,0.15);border-radius:24px;padding:32px;max-width:400px;width:90%;text-align:center;color:#fff;box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);position:relative;">
        <button onclick="document.getElementById('roi-pix-modal').style.display='none'" style="position:absolute;top:16px;right:16px;background:none;border:none;color:#888;font-size:18px;cursor:pointer;">✕</button>
        <div style="width:48px;height:48px;border-radius:12px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#10b981;font-weight:bold;font-size:22px;">⚡</div>
        <h3 style="margin:0 0 8px;font-size:18px;font-weight:bold;">Pagamento Instantâneo PIX</h3>
        <p style="margin:0 0 16px;color:#aaa;font-size:12px;">Escaneie o QR Code ou copie a chave abaixo para liberação imediata:</p>
        <div style="background:#fff;padding:12px;border-radius:16px;display:inline-block;margin-bottom:16px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(safePixKey)}" alt="QR Code Pix" style="display:block;width:180px;height:180px;" />
        </div>
        <div style="background:#151722;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;text-align:left;">
          <span style="font-size:11px;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px;">${safePixKey}</span>
          <button onclick="navigator.clipboard.writeText('${safePixKey}');alert('Chave Pix copiada!')" style="background:#2563eb;color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:bold;cursor:pointer;margin-left:8px;">Copiar</button>
        </div>
        <p style="margin:0;color:#666;font-size:11px;">Acesso liberado instantaneamente após o pagamento</p>
      </div>
    </div>
    <script>
      (function(){
        document.addEventListener('DOMContentLoaded', function() {
          var btns = document.querySelectorAll('a, button');
          btns.forEach(function(b) {
            var txt = (b.innerText || '').toLowerCase();
            if (txt.includes('comprar') || txt.includes('garantir') || txt.includes('quero') || txt.includes('adquirir') || txt.includes('pagar') || txt.includes('pix')) {
              b.addEventListener('click', function(e) {
                e.preventDefault();
                var m = document.getElementById('roi-pix-modal');
                if (m) m.style.display = 'flex';
              });
            }
          });
        });
      })();
    </script>
    `;
    $('body').append(pixModalHtml);
  }

  // 11. Extrair CSS inline e folhas de estilo externas com reescrita de URLs
  let aggregatedCss = '';

  $('style').each((_, el) => {
    const rawStyle = $(el).html() || '';
    const rewritten = rewriteCssUrls(rawStyle, baseUrl);
    $(el).html(rewritten);
    aggregatedCss += rewritten + '\n';
  });

  const stylesheetHrefs: string[] = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const absHref = resolveUrl(href);
      $(el).attr('href', absHref);
      stylesheetHrefs.push(absHref);
    }
  });

  // Baixa até 20 arquivos CSS externos em paralelo com timeout generoso
  const cssFetches = stylesheetHrefs.slice(0, 20).map(async (href) => {
    try {
      const cssRes = await axios.get(href, {
        timeout: 6000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          ...browserHeaders(),
        },
      });
      if (typeof cssRes.data === 'string') {
        const rewritten = rewriteCssUrls(cssRes.data, baseUrl);
        return `/* Stylesheet: ${href} */\n` + rewritten;
      }
    } catch {
      return '';
    }
    return '';
  });

  const settledCss = await Promise.allSettled(cssFetches);
  settledCss.forEach((res) => {
    if (res.status === 'fulfilled' && res.value) {
      aggregatedCss += '\n' + res.value;
    }
  });

  // 12. Extração Avançada de Metadados, OpenGraph (WhatsApp/Redes Sociais), Favicons e Fontes
  const extractedTitle = $('title').first().text()?.trim() || clone.name || 'Página Clonada';
  const metaDescription =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    '';
  const ogTitle = $('meta[property="og:title"]').attr('content') || extractedTitle;
  const ogDescription = $('meta[property="og:description"]').attr('content') || metaDescription;
  
  // Imagem OpenGraph (Crucial para card de pré-visualização no WhatsApp / Instagram)
  let ogImageRaw =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    $('meta[property="og:image:secure_url"]').attr('content') ||
    '';
  if (!ogImageRaw) {
    // Fallback: primeira imagem relevante ou logo do site
    const firstImg = $('img[src]').first().attr('src');
    if (firstImg && !firstImg.includes('pixel') && !firstImg.includes('svg')) {
      ogImageRaw = firstImg;
    }
  }
  const ogImage = resolveUrl(ogImageRaw);
  const ogUrl = $('meta[property="og:url"]').attr('content') || baseUrl.href;

  // Favicon do Navegador
  let faviconRaw =
    $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href') ||
    $('link[rel="apple-touch-icon"]').attr('href') ||
    '/favicon.ico';
  const favicon = resolveUrl(faviconRaw);

  // Canonical
  const canonical = $('link[rel="canonical"]').attr('href') || baseUrl.href;

  // Atualiza ou injeta as tags no <head> com URLs absolutas
  if ($('head').length > 0) {
    // Garante que o og:image esteja com URL absoluta para WhatsApp
    if ($('meta[property="og:image"]').length > 0) {
      $('meta[property="og:image"]').attr('content', ogImage);
    } else if (ogImage) {
      $('head').append(`<meta property="og:image" content="${ogImage}">`);
    }

    if ($('meta[property="og:title"]').length > 0) {
      $('meta[property="og:title"]').attr('content', ogTitle);
    } else {
      $('head').append(`<meta property="og:title" content="${ogTitle}">`);
    }

    if ($('meta[property="og:description"]').length > 0) {
      $('meta[property="og:description"]').attr('content', ogDescription);
    } else if (ogDescription) {
      $('head').append(`<meta property="og:description" content="${ogDescription}">`);
    }

    // Favicon com URL absoluta
    if ($('link[rel*="icon"]').length > 0) {
      $('link[rel*="icon"]').attr('href', favicon);
    } else if (favicon) {
      $('head').append(`<link rel="icon" href="${favicon}">`);
    }

    // Preservar Google Fonts Preconnect
    if (!$('link[href*="fonts.googleapis.com"]').length) {
      $('head').prepend(`
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      `);
    }
  }

  // 13. Auto-Descoberta e Priorização de Subpáginas do Funil (Estilo HTTrack / Cyotek)
  const funnelKeywords = /checkout|pay|carrinho|cart|comprar|pedido|order|oferta|upsell|downsell|obrigado|sucesso|thank-you|cardapio|produtos|catalogo|planos|precos|sobre|about|contato|contact|termos|politica|privacidade/i;
  const ignoreKeywords = /wp-admin|wp-login|login|logout|cadastrar|register|admin|feed|xmlrpc|\.(pdf|zip|png|jpg|jpeg|webp|svg|mp4|mp3)$/i;

  const subpagesMap = new Map<string, { title: string; url: string; slug: string; priority: number }>();

  // Descobrir links em tags <a href>
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text()?.trim() || '';
    if (
      href &&
      !href.startsWith('#') &&
      !href.startsWith('javascript:') &&
      !href.startsWith('tel:') &&
      !href.startsWith('mailto:')
    ) {
      try {
        const full = new URL(href, baseUrl.href);
        if (
          full.origin === baseUrl.origin &&
          full.pathname !== '/' &&
          full.pathname !== baseUrl.pathname &&
          !ignoreKeywords.test(full.pathname)
        ) {
          const cleanPath = full.pathname.replace(/^\/|\/$/g, '');
          const isAsset = /\.(?:png|jpe?g|gif|webp|svg|css|js|woff2?|ttf|eot|ico|mp4|mp3|pdf|zip)$/i.test(cleanPath);
          if (cleanPath && !isAsset && !subpagesMap.has(full.href)) {
            let pageTitle = text || `Página /${cleanPath}`;
            if (pageTitle.length > 40) pageTitle = `Página /${cleanPath}`;
            const priority = funnelKeywords.test(full.pathname) || funnelKeywords.test(text) ? 100 : 10;
            subpagesMap.set(full.href, {
              title: pageTitle,
              url: full.href,
              slug: cleanPath.replace(/[^a-zA-Z0-9_-]/g, '-'),
              priority,
            });
          }
        }
      } catch {}
    }
  });

  // Descobrir também links e rotas de funil escondidas dentro de scripts (como destinationUrl = '/01/index.html')
  const scriptRegex = /(?:destinationUrl|redirectUrl|nextUrl|window\.location(?:\.replace|\.href)?)\s*[:=]\s*['"]([^'"]+)['"]/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(rawHtml)) !== null) {
    const foundPath = match[1];
    if (foundPath && !foundPath.startsWith('#') && !foundPath.startsWith('javascript:')) {
      try {
        const full = new URL(foundPath, baseUrl.href);
        if (
          full.origin === baseUrl.origin &&
          full.pathname !== '/' &&
          full.pathname !== baseUrl.pathname &&
          !ignoreKeywords.test(full.pathname)
        ) {
          const cleanPath = full.pathname.replace(/^\/|\/$/g, '');
          const isAsset = /\.(?:png|jpe?g|gif|webp|svg|css|js|woff2?|ttf|eot|ico|mp4|mp3|pdf|zip)$/i.test(cleanPath);
          if (cleanPath && !isAsset && !subpagesMap.has(full.href)) {
            const pageTitle = `Passo do Funil /${cleanPath}`;
            subpagesMap.set(full.href, {
              title: pageTitle,
              url: full.href,
              slug: cleanPath.replace(/[^a-zA-Z0-9_-]/g, '-'),
              priority: 150,
            });
          }
        }
      } catch {}
    }
  }

  const sortedDiscoveredSubpages = Array.from(subpagesMap.values()).sort((a, b) => b.priority - a.priority);
  const discoveredSubpages = sortedDiscoveredSubpages.slice(0, 15).map(({ title, url, slug }) => ({ title, url, slug }));

  // 14. Auto-Descoberta de Pixels e Códigos de Rastreamento
  const pageHtmlString = rawHtml;
  const detectedPixels: Record<string, any> = {};
  
  const fbPixelMatch = pageHtmlString.match(/fbq\(['"]init['"],\s*['"]([0-9]{10,20})['"]\)/);
  if (fbPixelMatch) detectedPixels.facebook = fbPixelMatch[1];

  const gtmMatch = pageHtmlString.match(/(GTM-[A-Z0-9]{4,10}|G-[A-Z0-9]{6,12}|AW-[0-9]{6,12})/);
  if (gtmMatch) detectedPixels.google = gtmMatch[1];

  const tiktokMatch = pageHtmlString.match(/ttq\.load\(['"]([A-Z0-9]{10,25})['"]\)/);
  if (tiktokMatch) detectedPixels.tiktok = tiktokMatch[1];

  if (pageHtmlString.includes('utmify.com.br') || pageHtmlString.includes('utmify')) {
    detectedPixels.utmify = true;
  }

  // 15. Preservar Vídeos, VSLs e Players Interativos
  $('video').each((_, el) => {
    const poster = $(el).attr('poster');
    if (poster) $(el).attr('poster', resolveUrl(poster));
  });

  $('iframe').each((_, el) => {
    const src = $(el).attr('src');
    if (src) $(el).attr('src', resolveUrl(src));
  });

  await prisma.clone.update({
    where: { id: cloneId },
    data: { status: 'RECONSTRUCTING', progress: 75 },
  });

  // 16. Monta a árvore de ElementNodes compatível com o Editor Visual
  function getElementType(tagName: string): string {
    const t = tagName.toLowerCase();
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'b', 'strong', 'i', 'em', 'small'].includes(t))
      return 'TEXT';
    if (t === 'img') return 'IMAGE';
    if (t === 'a') return 'LINK';
    if (t === 'button') return 'BUTTON';
    if (t === 'form') return 'FORM';
    if (t === 'video') return 'VIDEO';
    if (t === 'iframe') return 'IFRAME';
    if (['div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside'].includes(t)) return 'CONTAINER';
    return 'CUSTOM';
  }

  function parseCheerioNode(elem: any, path: string): ElementNode | null {
    if (!elem || elem.type !== 'tag') return null;
    const tagName = elem.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'meta', 'link'].includes(tagName)) return null;

    const $elem = $(elem);
    const id = 'el-' + Math.random().toString(36).substring(2, 9);
    $elem.attr('data-editor-id', id);

    const type = getElementType(tagName);
    const attrs: Record<string, string> = { ...(elem.attribs || {}) };

    const content: Record<string, any> = {};
    if (type === 'TEXT' || type === 'BUTTON') {
      content.text = $elem.text()?.trim();
    }
    if (type === 'IMAGE') {
      content.src = $elem.attr('src') || '';
      content.alt = $elem.attr('alt') || '';
    }
    if (type === 'LINK') {
      content.href = $elem.attr('href') || '';
    }
    if (type === 'VIDEO') {
      content.src = $elem.attr('src') || '';
    }

    const styles: Record<string, string> = {};
    const styleAttr = $elem.attr('style');
    if (styleAttr) {
      styleAttr.split(';').forEach((rule) => {
        const [prop, val] = rule.split(':');
        if (prop && val) styles[prop.trim()] = val.trim();
      });
    }

    const children: ElementNode[] = [];
    $elem.children().each((idx, child) => {
      const parsedChild = parseCheerioNode(child, `${path}>${tagName}:nth-child(${idx + 1})`);
      if (parsedChild) children.push(parsedChild);
    });

    return {
      id,
      type,
      tagName,
      selector: path,
      content,
      styles,
      attrs,
      children,
    };
  }

  // Injeta todo o CSS consolidado dentro do <head> para garantir estilização mesmo offline ou com CDN instável
  if (aggregatedCss && !$('style#roi-aggregated-css').length) {
    if ($('head').length > 0) {
      $('head').append(`<style id="roi-aggregated-css">\n${aggregatedCss}\n</style>`);
    } else {
      $('body').prepend(`<style id="roi-aggregated-css">\n${aggregatedCss}\n</style>`);
    }
  }

  const bodyElem = $('body').get(0);
  const domTree = bodyElem ? parseCheerioNode(bodyElem, 'body') : null;
  let cleanFinalHtml = $.html();

  // 17. Cria o registro de Page no banco de dados com metadados enriquecidos
  const slug =
    (clone.name || 'projeto')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-') +
    '-' +
    Math.random().toString(36).substring(2, 6);

  const pageMeta = {
    title: extractedTitle,
    description: metaDescription,
    og: {
      title: ogTitle,
      description: ogDescription,
      image: ogImage,
      url: ogUrl,
    },
    favicon,
    canonical,
    subpages: discoveredSubpages,
    detectedPixels,
  };

  const pageRecord = await prisma.page.create({
    data: {
      name: clone.name || 'Projeto Clonado',
      slug,
      userId: clone.userId,
      sourceUrl: clone.sourceUrl,
      html: cleanFinalHtml,
      css: aggregatedCss,
      js: '',
      meta: pageMeta,
      status: 'DRAFT',
    },
  });

  // 17.2 Rewire forms to this platform.
  //
  // Until this step the clone shipped the original site's form action, so a
  // submission went to the original operator or was blocked by CORS before
  // leaving the browser. The page id only exists now, so this runs after the
  // create rather than during the DOM pass.
  const wiring = wireCloneForms(cleanFinalHtml, {
    endpoint: `${appOrigin}/api/pages/${pageRecord.id}/form-submissions`,
    sourceUrl: clone.sourceUrl,
    successRedirect: `${appOrigin}/p/${slug}`,
  });

  if (wiring.formCount > 0) {
    cleanFinalHtml = wiring.html;
    await prisma.page.update({
      where: { id: pageRecord.id },
      data: { html: cleanFinalHtml },
    });
    console.log(
      `[Cloner] ${wiring.formCount} formulário(s) ligado(s) à  captura de lead desta plataforma` +
        (wiring.skipped > 0 ? `; ${wiring.skipped} sem campos foram preservados como estão` : '')
    );
  } else {
    console.log('[Cloner] Nenhum formulário encontrado nesta página');
  }

  // Salva a hierarquia estrutural essencial no banco de dados de forma ágil
  async function saveNode(node: ElementNode, parentId: string | null = null, position: number = 0, depth: number = 0) {
    if (depth > 2) return;
    try {
      const element = await prisma.pageElement.create({
        data: {
          pageId: pageRecord.id,
          selector: node.selector || node.tagName,
          type: node.type as any,
          content: node.content,
          styles: node.styles,
          attrs: { ...(node.attrs || {}), tagName: node.tagName },
          position,
          parentId,
        },
      });

      for (let i = 0; i < Math.min((node.children || []).length, 12); i++) {
        await saveNode(node.children[i], element.id, i, depth + 1);
      }
    } catch (e) {
      console.warn('[Cloner] Element node save notice:', e);
    }
  }

  if (domTree) {
    await saveNode(domTree);
  }

  // 17.5. Modo Site Completo & Funil com IA (Estilo HTTrack / Cyotek WebCopy)
  if (options?.crawlFullSite && sortedDiscoveredSubpages.length > 0) {
    const maxPagesToCrawl = Math.min(options.maxPages || 6, sortedDiscoveredSubpages.length);
    const pagesToCrawl = sortedDiscoveredSubpages.slice(0, maxPagesToCrawl);

    console.log(`[Cloner] Modo HTTrack ativado: Rastreando recursivamente ${pagesToCrawl.length} páginas do funil...`);

    const subpageDocs: Array<{
      recordId: string;
      $: cheerio.CheerioAPI;
      url: string;
      path: string;
      slug: string;
      name: string;
    }> = [];

    const clonedSubpagesList: Array<{
      id: string;
      name: string;
      slug: string;
      url: string;
      cloned: boolean;
    }> = [];

    for (let i = 0; i < pagesToCrawl.length; i++) {
      const subItem = pagesToCrawl[i];
      const crawlProgress = 75 + Math.round(((i + 1) / pagesToCrawl.length) * 18);
      try {
        await prisma.clone.update({
          where: { id: cloneId },
          data: { progress: crawlProgress },
        });

        console.log(`[Cloner] Baixando subpágina (${i + 1}/${pagesToCrawl.length}): ${subItem.title} -> ${subItem.url}`);
        const subFetch = await fetchWithMultiTier(subItem.url);
        if (subFetch.html && subFetch.html.length > 200) {
          const $sub = cheerio.load(subFetch.html);
          const subBaseUrl = new URL(subFetch.finalUrl || subItem.url);

          // Injetar base tag
          if ($sub('head').length > 0) {
            $sub('head').prepend(`<base href="${subBaseUrl.origin}/">`);
          } else {
            $sub('html').prepend(`<head><base href="${subBaseUrl.origin}/"></head>`);
          }

          // Neutralizar preloaders
          $sub('#preloader, .preloader, #loading, .loading-screen, .elementor-loader, .elementor-loading, .page-loader').remove();
          $sub('head').append(antiBlankShield);

          // Resolver links, imagens, CSS
          $sub('link').each((_, el) => {
            const h = $sub(el).attr('href');
            if (h) {
              try { $sub(el).attr('href', new URL(h, subBaseUrl.href).href); } catch {}
            }
          });

          $sub('img').each((_, el) => {
            const s = $sub(el).attr('src');
            if (s) {
              try { $sub(el).attr('src', new URL(s, subBaseUrl.href).href); } catch {}
            }
            const ds = $sub(el).attr('data-src') || $sub(el).attr('data-original');
            if (ds) {
              try {
                const absDs = new URL(ds, subBaseUrl.href).href;
                $sub(el).attr('data-src', absDs);
                $sub(el).attr('src', absDs);
              } catch {}
            }
            $sub(el).attr('loading', 'eager');
          });

          // Neutralizar scripts invasivos e de hidratação que causam travamento/tela branca
          $sub('script').each((_, el) => {
            const s = $sub(el).attr('src') || '';
            const c = $sub(el).html() || '';
            if (
              s.includes('utmify') ||
              s.includes('fbevents') ||
              s.includes('pixel-google') ||
              s.includes('taboola') ||
              s.includes('clarity') ||
              s.includes('hotjar') ||
              s.includes('tiktok') ||
              s.includes('_next/static/chunks/main-app') ||
              s.includes('_next/static/chunks/webpack') ||
              s.includes('_next/static/chunks/app/error') ||
              s.includes('_next/static/chunks/app/not-found') ||
              c.includes('top.location') ||
              c.includes('debugger') ||
              c.includes('self.__next_f') ||
              c.includes('clarity') ||
              c.includes('taboola')
            ) {
              $sub(el).remove();
            }
          });

          // Substituir Checkout se configurado
          if (options?.newCheckoutUrl) {
            $sub('a').each((_, el) => {
              const h = $sub(el).attr('href') || '';
              const txt = $sub(el).text() || '';
              if (checkoutKeywords.test(h) || checkoutKeywords.test(txt)) {
                $sub(el).attr('href', options.newCheckoutUrl!);
                $sub(el).attr('target', '_blank');
              }
            });
          }

          // Injetar modal PIX se configurado
          if (options?.pixKey) {
            const safePixKey = options.pixKey.replace(/[^a-zA-Z0-9@._-]/g, '');
            const pixModalHtml = `
            <div id="roi-pix-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:999999;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;">
              <div style="background:#0d0e14;border:1px solid rgba(255,255,255,0.15);border-radius:24px;padding:32px;max-width:400px;width:90%;text-align:center;color:#fff;box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);position:relative;">
                <button onclick="document.getElementById('roi-pix-modal').style.display='none'" style="position:absolute;top:16px;right:16px;background:none;border:none;color:#888;font-size:18px;cursor:pointer;">✕</button>
                <div style="width:48px;height:48px;border-radius:12px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#10b981;font-weight:bold;font-size:22px;">⚡</div>
                <h3 style="margin:0 0 8px;font-size:18px;font-weight:bold;">Pagamento Instantâneo PIX</h3>
                <p style="margin:0 0 16px;color:#aaa;font-size:12px;">Escaneie o QR Code ou copie a chave abaixo para liberação imediata:</p>
                <div style="background:#fff;padding:12px;border-radius:16px;display:inline-block;margin-bottom:16px;">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(safePixKey)}" alt="QR Code Pix" style="display:block;width:180px;height:180px;" />
                </div>
                <div style="background:#151722;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;text-align:left;">
                  <span style="font-size:11px;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px;">${safePixKey}</span>
                  <button onclick="navigator.clipboard.writeText('${safePixKey}');alert('Chave Pix copiada!')" style="background:#2563eb;color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:bold;cursor:pointer;margin-left:8px;">Copiar</button>
                </div>
                <p style="margin:0;color:#666;font-size:11px;">Acesso liberado instantaneamente após o pagamento</p>
              </div>
            </div>
            `;
            $sub('body').append(pixModalHtml);
          }

          // Extrair estilos CSS da subpágina
          let subCss = '';
          $sub('style').each((_, el) => {
            const st = $sub(el).html() || '';
            subCss += rewriteCssUrls(st, subBaseUrl) + '\n';
          });

          // Gerar slug seguro para a subpágina
          const subSlug = `${slug}-${subItem.slug}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 60);

          const subRecord = await prisma.page.create({
            data: {
              name: subItem.title,
              slug: subSlug,
              userId: clone.userId,
              sourceUrl: subItem.url,
              html: $sub.html(),
              css: subCss,
              js: '',
              meta: {
                parentCloneId: clone.id,
                parentPageId: pageRecord.id,
                isSubpage: true,
                sourceUrl: subItem.url,
              },
              status: 'DRAFT',
            },
          });

          subpageDocs.push({
            recordId: subRecord.id,
            $: $sub,
            url: subItem.url,
            path: new URL(subItem.url).pathname,
            slug: subSlug,
            name: subItem.title,
          });

          clonedSubpagesList.push({
            id: subRecord.id,
            name: subItem.title,
            slug: subSlug,
            url: subItem.url,
            cloned: true,
          });
        }
      } catch (subErr: any) {
        console.warn(`[Cloner] Falha ao clonar subpágina ${subItem.url}:`, subErr?.message || subErr);
      }
    }

    // Reescrita de Links Internos entre a Página Principal e todas as Subpáginas
    if (subpageDocs.length > 0) {
      console.log(`[Cloner] Reeescrevendo links internos entre as ${subpageDocs.length + 1} páginas do funil...`);

      const rewriteLinksInCheerio = ($doc: cheerio.CheerioAPI) => {
        $doc('a[href]').each((_, el) => {
          const href = $doc(el).attr('href');
          if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('tel:') || href.startsWith('mailto:')) {
            return;
          }

          // Verifica se aponta para uma das subpáginas clonadas
          for (const sub of subpageDocs) {
            const cleanSubPath = sub.path.replace(/\/$/, '');
            if (
              href === sub.url ||
              href === sub.path ||
              href === cleanSubPath ||
              href.endsWith(sub.path) ||
              href.endsWith(cleanSubPath)
            ) {
              $doc(el).attr('href', `/p/${sub.slug}`);
              $doc(el).attr('data-roi-subpage-slug', sub.slug);
              $doc(el).attr('data-roi-original-url', sub.url);
              break;
            }
          }

          // Se aponta para a raiz/home
          if (href === '/' || href === baseUrl.origin || href === `${baseUrl.origin}/` || href === baseUrl.href) {
            $doc(el).attr('href', `/p/${slug}`);
            $doc(el).attr('data-roi-subpage-slug', slug);
          }
        });
      };

      // 1. Reescreve na página principal
      rewriteLinksInCheerio($);
      cleanFinalHtml = $.html();

      // Também reescreve destinationUrl dentro dos scripts da página principal para apontar para as subpáginas
      for (const sub of subpageDocs) {
        const escapedSubPath = sub.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const cleanEscapedSubPath = sub.path.replace(/^\//, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleanFinalHtml = cleanFinalHtml.replace(
          new RegExp(`(destinationUrl\\s*=\\s*['"])(?:${escapedSubPath}|${cleanEscapedSubPath}|${sub.url})(['"])`, 'gi'),
          `$1/p/${sub.slug}$2`
        );
      }

      // 2. Reescreve em cada subpágina e atualiza no banco de dados
      let subpageFormsWired = 0;
      for (const sub of subpageDocs) {
        rewriteLinksInCheerio(sub.$);
        // Each subpage has its own row, so each gets its own endpoint. Sharing
        // the parent's would file the lead under the wrong page.
        const subWiring = wireCloneForms(sub.$.html(), {
          endpoint: `${appOrigin}/api/pages/${sub.recordId}/form-submissions`,
          sourceUrl: sub.url,
          successRedirect: `${appOrigin}/p/${sub.slug}`,
        });
        if (subWiring.formCount > 0) subpageFormsWired += subWiring.formCount;
        await prisma.page.update({
          where: { id: sub.recordId },
          data: { html: subWiring.html },
        });
      }
      if (subpageFormsWired > 0) {
        console.log(`[Cloner] ${subpageFormsWired} formulário(s) ligado(s) em subpáginas`);
      }

      // 3. Atualiza os metadados e HTML da página principal
      await prisma.page.update({
        where: { id: pageRecord.id },
        data: {
          html: cleanFinalHtml,
          meta: {
            ...pageMeta,
            subpages: clonedSubpagesList,
            formWiring: { formCount: wiring.formCount, skipped: wiring.skipped },
          },
        },
      });
    }
  }

  // 17.3 Espelhamento de recursos.
  //
  // Runs after the optional subpage crawl, so the HTML rewritten is the final one,
  // and after the form wiring, so the submission endpoint is already local.
  const mirrorSummary = await mirrorPageAssets(pageRecord.id, {
    appOrigin,
    html: cleanFinalHtml,
    css: aggregatedCss,
  });

  const existingMeta = ((await prisma.page.findUnique({
    where: { id: pageRecord.id },
    select: { meta: true },
  }))?.meta as Record<string, unknown>) ?? {};

  await prisma.page.update({
    where: { id: pageRecord.id },
    data: {
      ...(mirrorSummary.stored > 0 ? { html: mirrorSummary.html } : {}),
      meta: {
        // The crawl pass may already have stored a richer meta object; it wins
        // over the pre-crawl snapshot so `subpages` is not rolled back.
        ...pageMeta,
        ...existingMeta,
        assetMirror: {
          stored: mirrorSummary.stored,
          bytes: mirrorSummary.bytesStored,
          notes: mirrorSummary.notes,
        },
      },
    },
  });

  if (mirrorSummary.stored > 0) {
    cleanFinalHtml = mirrorSummary.html;
    console.log(
      `[Cloner] ${mirrorSummary.stored} recurso(s) espelhado(s), ${(mirrorSummary.bytesStored / 1024 / 1024).toFixed(1)}MB — a página não depende mais da origem para esses arquivos`
    );
  } else {
    console.log(`[Cloner] Nenhum recurso espelhado. ${mirrorSummary.notes.join(' ')}`);
  }

  // 18. IA Assistente: Gerar sugestão inicial automática de alta conversão
  try {
    const detectedH1 = $('h1').first().text()?.trim();
    if (detectedH1 && detectedH1.length > 5) {
      await prisma.aISuggestion.create({
        data: {
          pageId: pageRecord.id,
          userId: clone.userId,
          type: 'HEADLINE',
          original: detectedH1,
          suggested: `[ROI IA] ${detectedH1} — Método Validado com Garantia Total`,
          context: { reason: 'Otimização automática gerada pela ROI IA para aumentar conversão da oferta' },
        },
      });
    }
  } catch (e) {
    console.warn('[Cloner] Auto AI suggestion notice:', e);
  }

  // 19. Finaliza com status COMPLETED
  await prisma.clone.update({
    where: { id: cloneId },
    data: {
      status: 'COMPLETED',
      progress: 100,
      pageId: pageRecord.id,
      resultHtml: cleanFinalHtml,
      resultCss: aggregatedCss,
      resultJs: domTree ? JSON.stringify(domTree) : '{}',
      completedAt: new Date(),
    },
  });
}

/**
 * Motor Playwright: Utilizado quando há Chromium local ou WebSocket Browserless configurado.
 */
async function cloneWithPlaywright(
  cloneId: string,
  clone: any,
  targetUrl: string,
  wsEndpoint: string | null,
  options?: CloneOptions
): Promise<void> {
  const { chromium } = await import('playwright');

  const browser = wsEndpoint
    ? await chromium.connect(wsEndpoint)
    : await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

  try {
    const extraHeaders = browserHeaders();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      extraHTTPHeaders: extraHeaders,
    });
    const page = await context.newPage();

    // Installed before navigation: the calls a single-page funnel makes on load
    // are precisely the ones worth capturing, and they fire during first paint.
    const recorder = installCaptureRecorder(page, { appOrigin: getAppUrl() });

    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['media'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
    const status = response?.status() || 200;
    const bodyText = (await page.textContent('body')) || '';
    const isBlocked =
      status === 403 ||
      status === 401 ||
      bodyText.includes('403 - Forbidden') ||
      bodyText.includes('Access to this page is forbidden') ||
      bodyText.includes('Attention Required! | Cloudflare') ||
      bodyText.includes('cf-browser-verification');

    if (isBlocked) {
      console.warn(`[Cloner] Playwright detectou bloqueio/cloaker (status ${status}). Tentando perfil alternativo iPhone...`);
      await page.setExtraHTTPHeaders({
        ...browserHeaders(),
        Referer: 'https://www.google.com.br/',
      });
      const retryResponse = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const retryStatus = retryResponse?.status() || 200;
      const retryBody = (await page.textContent('body')) || '';
      if (
        retryStatus === 403 ||
        retryStatus === 401 ||
        retryBody.includes('403 - Forbidden') ||
        retryBody.includes('Access to this page is forbidden')
      ) {
        throw new Error(`Página de destino bloqueou acesso anti-bot/datacenter (${retryStatus}). Acionando motor Cheerio Multi-Tier.`);
      }
    }

    await prisma.clone.update({
      where: { id: cloneId },
      data: { status: 'ANALYZING', progress: 50 },
    });

    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 250;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight || totalHeight > 10000) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 100);
      });
    });

    await page.waitForTimeout(1500);

    // Se o usuário passou link de checkout para substituição automática
    if (options?.newCheckoutUrl) {
      await page.evaluate((newUrl) => {
        const keywords = /checkout|pay|kiwify|hotmart|monetizze|eduzz|braip|perfectpay|cakto|cart|comprar|adquirir|pagar/i;
        document.querySelectorAll('a').forEach((a) => {
          if (keywords.test(a.href) || keywords.test(a.innerText || '')) {
            a.href = newUrl;
            a.target = '_blank';
          }
        });
      }, options.newCheckoutUrl);
    }

    const cssRules = await page.evaluate(() => {
      return Array.from(document.styleSheets)
        .map((sheet) => {
          try {
            return Array.from(sheet.cssRules || [])
              .map((rule) => rule.cssText)
              .join('\n');
          } catch (e) {
            if (sheet.href) return `/* External: ${sheet.href} */`;
            return '';
          }
        })
        .join('\n');
    });

    await prisma.clone.update({
      where: { id: cloneId },
      data: { status: 'RECONSTRUCTING', progress: 70 },
    });

    const domTree = await page.evaluate(() => {
      function getElementType(tagName: string, el: HTMLElement): string {
        const t = tagName.toLowerCase();
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label'].includes(t)) return 'TEXT';
        if (t === 'img') return 'IMAGE';
        if (t === 'a') return 'LINK';
        if (t === 'button' || el.getAttribute('role') === 'button') return 'BUTTON';
        if (t === 'form') return 'FORM';
        if (t === 'video') return 'VIDEO';
        if (t === 'iframe') return 'IFRAME';
        if (['div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside'].includes(t)) return 'CONTAINER';
        return 'CUSTOM';
      }

      function extractNodeData(node: HTMLElement, path: string): ElementNode | null {
        if (node.nodeType !== Node.ELEMENT_NODE) return null;
        if (['script', 'style', 'noscript', 'meta', 'link'].includes(node.tagName.toLowerCase())) return null;

        const tagName = node.tagName.toLowerCase();
        const type = getElementType(tagName, node);
        const computed = window.getComputedStyle(node);

        if (computed.display === 'none') return null;

        const attrs: Record<string, string> = {};
        Array.from(node.attributes).forEach((attr) => {
          attrs[attr.name] = attr.value;
        });

        const content: Record<string, any> = {};
        if (type === 'TEXT' || type === 'BUTTON') content.text = node.innerText?.trim();
        if (type === 'IMAGE') {
          content.src = (node as HTMLImageElement).src;
          content.alt = (node as HTMLImageElement).alt;
        }
        if (type === 'LINK') content.href = (node as HTMLAnchorElement).href;
        if (type === 'VIDEO') content.src = (node as HTMLVideoElement).src;

        const styles: Record<string, string> = {
          display: computed.display,
          flexDirection: computed.flexDirection,
          width: computed.width,
          height: computed.height,
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          padding: computed.padding,
          margin: computed.margin,
        };

        const id = 'el-' + Math.random().toString(36).substring(2, 9);
        node.setAttribute('data-editor-id', id);

        const children: ElementNode[] = [];
        Array.from(node.childNodes).forEach((child, idx) => {
          const childData = extractNodeData(child as HTMLElement, `${path}>${tagName}:nth-child(${idx + 1})`);
          if (childData) children.push(childData);
        });

        return {
          id,
          type,
          tagName,
          selector: path,
          content,
          styles,
          attrs,
          children,
        };
      }

      return extractNodeData(document.body, 'body');
    });

    let finalHtml = await page.content();

    const playwrightMeta = await page.evaluate(() => {
      const title = document.title || '';
      const desc = document.querySelector('meta[name="description"]')?.getAttribute('content') || 
                   document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || title;
      const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || desc;
      const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || 
                    document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || '';
      const fav = document.querySelector('link[rel*="icon"]')?.getAttribute('href') || '/favicon.ico';
      return { title, description: desc, og: { title: ogTitle, description: ogDesc, image: ogImg }, favicon: fav };
    });

    const slug =
      (clone.name || 'projeto')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-') +
      '-' +
      Math.random().toString(36).substring(2, 6);

    const pageRecord = await prisma.page.create({
      data: {
        name: clone.name || 'Projeto Clonado',
        slug,
        userId: clone.userId,
        sourceUrl: clone.sourceUrl,
        html: finalHtml,
        css: cssRules,
        js: '',
        meta: playwrightMeta,
        status: 'DRAFT',
      },
    });

    // Same lead-capture wiring as the Cheerio path. Without it, anyone running
    // local Chromium got a clone whose forms still posted to the original site.
    const pwOrigin = getAppUrl();
    const pwWiring = wireCloneForms(finalHtml, {
      endpoint: `${pwOrigin}/api/pages/${pageRecord.id}/form-submissions`,
      sourceUrl: clone.sourceUrl,
      successRedirect: `${pwOrigin}/p/${slug}`,
    });

    if (pwWiring.formCount > 0) {
      finalHtml = pwWiring.html;
      console.log(`[Cloner/Playwright] ${pwWiring.formCount} formulário(s) ligado(s) à captura de lead`);
    }

    // 17.2b Replay das chamadas de API.
    //
    // Only available here, and only in this engine: observing the requests needs
    // a real browser, which the Cheerio path does not have. When nothing was
    // observed the page still ships, and the report says so rather than implying
    // a capture happened.
    const captureSummary = await recorder.persist(pageRecord.id);
    if (captureSummary.recorded > 0) {
      finalHtml = finalHtml.replace(
        /<\/body>/i,
        `${buildReplayScript(manifestUrlFor(pageRecord.id), pwOrigin)}</body>`
      );
      console.log(
        `[Cloner/Playwright] ${captureSummary.recorded} chamada(s) de API gravada(s) para replay`
      );
    } else {
      console.log(
        '[Cloner/Playwright] Nenhuma chamada de API observada durante a clonagem; replay não aplicado'
      );
    }

    // 17.2c Espelhamento dos recursos.
    const mirrorSummary = await mirrorPageAssets(pageRecord.id, {
      appOrigin: pwOrigin,
      html: finalHtml,
      css: cssRules,
    });
    if (mirrorSummary.stored > 0) {
      finalHtml = mirrorSummary.html;
      console.log(
        `[Cloner/Playwright] ${mirrorSummary.stored} recurso(s) espelhado(s), ${(mirrorSummary.bytesStored / 1024 / 1024).toFixed(1)}MB`
      );
    }

    await prisma.page.update({
      where: { id: pageRecord.id },
      data: {
        html: finalHtml,
        meta: {
          ...playwrightMeta,
          ...(pwWiring.formCount > 0
            ? { formWiring: { formCount: pwWiring.formCount, skipped: pwWiring.skipped } }
            : {}),
          ...(captureSummary.recorded > 0
            ? { apiCapture: { recorded: captureSummary.recorded, notes: captureSummary.notes } }
            : {}),
          ...(mirrorSummary.stored > 0
            ? {
                assetMirror: {
                  stored: mirrorSummary.stored,
                  bytes: mirrorSummary.bytesStored,
                  notes: mirrorSummary.notes,
                },
              }
            : {}),
        },
      },
    });

    async function saveNode(node: ElementNode, parentId: string | null = null, position: number = 0, depth: number = 0) {
      if (depth > 2) return;
      try {
        const element = await prisma.pageElement.create({
          data: {
            pageId: pageRecord.id,
            selector: node.selector || node.tagName,
            type: node.type as any,
            content: node.content,
            styles: node.styles,
            attrs: { ...(node.attrs || {}), tagName: node.tagName },
            position,
            parentId,
          },
        });

        for (let i = 0; i < Math.min((node.children || []).length, 12); i++) {
          await saveNode(node.children[i], element.id, i, depth + 1);
        }
      } catch (e) {
        console.warn('[Cloner] Element save warning:', e);
      }
    }

    if (domTree) {
      await saveNode(domTree);
    }

    await prisma.clone.update({
      where: { id: cloneId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        pageId: pageRecord.id,
        resultHtml: finalHtml,
        resultCss: cssRules,
        resultJs: JSON.stringify(domTree),
        completedAt: new Date(),
      },
    });

    await browser.close();
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

export async function generatePageFromClone(cloneId: string, pageId: string): Promise<void> {
  const clone = await prisma.clone.findUnique({
    where: { id: cloneId },
  });

  if (!clone || clone.status !== 'COMPLETED' || !clone.resultJs) {
    throw new Error('Clone não concluído ou sem estrutura extraída');
  }

  const domTree: ElementNode = JSON.parse(clone.resultJs);

  await prisma.page.update({
    where: { id: pageId },
    data: {
      html: clone.resultHtml || '',
      css: clone.resultCss || '',
      js: '',
      status: 'DRAFT',
    },
  });

  async function saveNode(node: ElementNode, parentId: string | null = null, position: number = 0, depth: number = 0) {
    if (depth > 4) return;
    try {
      const element = await prisma.pageElement.create({
        data: {
          pageId,
          selector: node.selector || node.tagName,
          type: node.type as any,
          content: node.content,
          styles: node.styles,
          attrs: { ...(node.attrs || {}), tagName: node.tagName },
          position,
          parentId,
        },
      });

      for (let i = 0; i < Math.min(node.children.length, 30); i++) {
        await saveNode(node.children[i], element.id, i, depth + 1);
      }
    } catch (e) {
      console.warn('[Cloner] Page generation element save notice:', e);
    }
  }

  if (domTree) {
    await saveNode(domTree);
  }
}