import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { generateSlug } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, url, cloneId, parentPageId, html: providedHtml, css: providedCss } = body;

    const pageName = name?.trim() || 'Página 2';
    const slugBase = generateSlug(pageName) || 'pagina-2';
    const slug = `${slugBase}-${Math.random().toString(36).substring(2, 6)}`;

    let finalHtml = providedHtml || '';
    let finalCss = providedCss || '';
    let finalSourceUrl = url?.trim() || '';

    // Se uma URL foi informada para clonar a subpágina
    if (finalSourceUrl && !finalHtml) {
      try {
        const headers = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        };

        const res = await axios.get(finalSourceUrl, {
          timeout: 15000,
          headers,
          maxRedirects: 5,
        });

        if (typeof res.data === 'string') {
          const baseUrl = new URL(res.request?.res?.responseUrl || finalSourceUrl);
          const $ = cheerio.load(res.data);

          // Injetar base tag
          if ($('head').length > 0) {
            $('head').prepend(`<base href="${baseUrl.origin}/">`);
          } else {
            $('html').prepend(`<head><base href="${baseUrl.origin}/"></head>`);
          }

          // Resolver links e imagens
          $('link[rel="stylesheet"]').each((_, el) => {
            const href = $(el).attr('href');
            if (href) {
              try {
                $(el).attr('href', new URL(href, baseUrl.href).href);
              } catch {}
            }
          });

          $('img').each((_, el) => {
            const src = $(el).attr('src');
            if (src) {
              try {
                $(el).attr('src', new URL(src, baseUrl.href).href);
              } catch {}
            }
            $(el).attr('loading', 'eager');
          });

          // Remover scripts maliciosos de redirecionamento ou bloqueio
          $('script').each((_, el) => {
            const content = $(el).html() || '';
            if (content.includes('top.location') || content.includes('debugger')) {
              $(el).remove();
            }
          });

          // Escudo anti-tela branca
          const antiBlank = `<style id="roi-anti-blank-shield">html,body{opacity:1!important;visibility:visible!important;display:block!important;min-height:100vh!important;}</style>`;
          $('head').append(antiBlank);

          finalHtml = $.html();
        }
      } catch (fetchErr: any) {
        console.warn('Erro ao baixar subpágina:', fetchErr.message || fetchErr);
        finalHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${pageName}</title><style>body{font-family:sans-serif;background:#090a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style></head><body><div style="text-align:center;"><h1>${pageName}</h1><p>Esta página foi criada e está pronta para edição.</p></div></body></html>`;
      }
    } else if (!finalHtml) {
      finalHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${pageName}</title><style>body{font-family:sans-serif;background:#090a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style></head><body><div style="text-align:center;"><h1>${pageName}</h1><p>Esta página foi criada e está pronta para edição.</p></div></body></html>`;
    }

    const newPage = await prisma.page.create({
      data: {
        name: pageName,
        slug,
        userId: session.user.id,
        sourceUrl: finalSourceUrl || null,
        html: finalHtml,
        css: finalCss,
        js: '',
        status: 'DRAFT',
      },
    });

    return NextResponse.json({
      success: true,
      pageId: newPage.id,
      page: newPage,
    });
  } catch (error) {
    console.error('Create subpage error:', error);
    return NextResponse.json({ error: 'Erro interno ao criar subpágina' }, { status: 500 });
  }
}
