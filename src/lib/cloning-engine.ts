import prisma from '@/lib/prisma';
import { sanitizeHtml } from '@/lib/validations';
import { validateUrl } from './security/url-validator';
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

    const isVercel = !!process.env.VERCEL;

    // Se estiver na Vercel e não tiver WebSocket remoto configurado, usa diretamente o motor HTTP Cheerio
    if (isVercel && !wsEndpoint) {
      console.log('[Cloner] Ambiente Vercel sem WS remoto detectado. Utilizando motor HTTP Cheerio de alta performance.');
      await cloneWithCheerio(cloneId, clone, targetUrl, options);
      return;
    }

    // Tenta clonagem com Playwright (se tiver WS ou se estiver em ambiente local/VPS com Chromium instalado)
    try {
      await cloneWithPlaywright(cloneId, clone, targetUrl, wsEndpoint, options);
    } catch (playwrightErr: any) {
      console.warn('[Cloner] Falha ao iniciar Playwright:', playwrightErr?.message || playwrightErr);
      console.log('[Cloner] Executando fallback automático para o motor HTTP Cheerio...');
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
 * Motor Cheerio: 100% Serverless, sem necessidade de Chromium binário.
 * Baixa o HTML, reescreve links/mídias relativas para absolutas, junta CSS e gera a árvore de elementos.
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

  const baseUrl = new URL(targetUrl);

  const response = await axios.get(targetUrl, {
    timeout: 25000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Ch-Ua': '"Chromium";v="124", "Not-A.Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Upgrade-Insecure-Requests': '1',
    },
    maxRedirects: 5,
    validateStatus: (status) => status < 400,
  });

  const rawHtml = response.data;
  if (!rawHtml || typeof rawHtml !== 'string') {
    throw new Error('Não foi possível obter o conteúdo HTML da página.');
  }

  await prisma.clone.update({
    where: { id: cloneId },
    data: { status: 'ANALYZING', progress: 50 },
  });

  const $ = cheerio.load(rawHtml);

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

  // 1. Garantir tag <base> para resolução imediata de links e requisições dinâmicas
  if ($('head').length > 0) {
    if ($('base').length === 0) {
      $('head').prepend(`<base href="${baseUrl.origin}/">`);
    }
  } else {
    $('html').prepend(`<head><base href="${baseUrl.origin}/"></head>`);
  }

  // 2. Converter URLs relativas em absolutas (imagens, links, mídia, stylesheets)
  $('link').each((_, el) => {
    const href = $(el).attr('href');
    if (href) $(el).attr('href', resolveUrl(href));
  });

  $('script').each((_, el) => {
    const src = $(el).attr('src');
    if (src) {
      $(el).attr('src', resolveUrl(src));
    } else {
      let scriptContent = $(el).html() || '';
      if (
        scriptContent.includes('top.location') ||
        scriptContent.includes('window.top') ||
        scriptContent.includes('top !== self') ||
        scriptContent.includes('self !== top')
      ) {
        scriptContent = scriptContent
          .replace(/top\.location\s*=/gi, '// top.location =')
          .replace(/window\.top\s*!==\s*window\.self/gi, 'false')
          .replace(/top\s*!==\s*self/gi, 'false')
          .replace(/self\s*!==\s*top/gi, 'false');
        $(el).html(scriptContent);
      }
    }
  });

  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (src) $(el).attr('src', resolveUrl(src));

    const dataSrc = $(el).attr('data-src') || $(el).attr('data-original') || $(el).attr('data-lazy-src') || $(el).attr('data-srcset');
    if (dataSrc) {
      const absDataSrc = resolveUrl(dataSrc);
      $(el).attr('data-src', absDataSrc);
      if (!src || src.startsWith('data:image/gif') || src.startsWith('data:image/svg') || src.includes('placeholder')) {
        $(el).attr('src', absDataSrc);
      }
    }

    const srcset = $(el).attr('srcset');
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

  // 3. IA Assistente: Substituição inteligente de Checkout próprio
  const checkoutKeywords = /checkout|pay|kiwify|hotmart|monetizze|eduzz|braip|perfectpay|cakto|kirvano|pepper|cart|comprar|adquirir|pagar|assinar|matricul|inscric|inscreva|garantir|vendas/i;
  
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text() || '';
    const classes = $(el).attr('class') || '';

    // Se o usuário forneceu seu próprio link de checkout no assistente da IA
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

  // 3. IA Assistente: Injeção de Checkout PIX se configurado
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

  // 4. Extrair CSS inline e folhas de estilo externas
  let aggregatedCss = '';

  $('style').each((_, el) => {
    aggregatedCss += $(el).html() + '\n';
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

  // Baixa os primeiros 8 arquivos CSS externos em paralelo
  const cssFetches = stylesheetHrefs.slice(0, 8).map(async (href) => {
    try {
      const cssRes = await axios.get(href, {
        timeout: 4000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (typeof cssRes.data === 'string') {
        return `/* Stylesheet: ${href} */\n` + cssRes.data;
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

  await prisma.clone.update({
    where: { id: cloneId },
    data: { status: 'RECONSTRUCTING', progress: 75 },
  });

  // 5. Monta a árvore de ElementNodes compatível com o Editor Visual
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
  const cleanFinalHtml = $.html();

  // 6. Cria o registro de Page no banco de dados
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
      html: cleanFinalHtml,
      css: aggregatedCss,
      js: '',
      status: 'DRAFT',
    },
  });

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

  // 7. IA Assistente: Gerar sugestão inicial automática de alta conversão
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

  // 8. Finaliza com status COMPLETED
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
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['media', 'font'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto(targetUrl, { waitUntil: 'load', timeout: 20000 });

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

    const finalHtml = await page.content();

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
        status: 'DRAFT',
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