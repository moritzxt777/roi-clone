import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { evaluateCloaker, CloakerConfig } from '@/lib/cloaker-engine';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  const params = await props.params;
  const slug = params.slug;

  // Busca por slug da página ou por id do clone
  const page = await prisma.page.findFirst({
    where: {
      OR: [
        { slug: slug },
        { id: slug },
      ]
    },
    include: {
      domain: true,
      clones: { take: 1 }
    }
  });

  // Verificação de Cloaker Nativo
  const pageMeta = (page?.meta as any) || {};
  const cloakerConfig: CloakerConfig | undefined = pageMeta?.cloaker;

  if (page && cloakerConfig && cloakerConfig.enabled) {
    const evaluation = evaluateCloaker(req, cloakerConfig);

    if (evaluation.isBlocked) {
      // Registrar incremento nos stats da White Page de forma assíncrona
      prisma.page.update({
        where: { id: page.id },
        data: {
          meta: {
            ...pageMeta,
            cloaker: {
              ...cloakerConfig,
              stats: {
                totalHits: (cloakerConfig.stats?.totalHits || 0) + 1,
                whiteHits: (cloakerConfig.stats?.whiteHits || 0) + 1,
                blackHits: cloakerConfig.stats?.blackHits || 0,
                lastHitAt: new Date().toISOString(),
                lastBlockedReason: evaluation.reason,
              },
            },
          },
        },
      }).catch(() => {});

      // Ação 1: Redirecionamento 302 para White Page
      if (cloakerConfig.action === 'redirect_white' && cloakerConfig.whitePageUrl) {
        return NextResponse.redirect(cloakerConfig.whitePageUrl, 302);
      }

      // Ação 2: Renderizar White Page diretamente na mesma URL (sem redirecionamento)
      if (cloakerConfig.whitePageHtml) {
        return new NextResponse(cloakerConfig.whitePageHtml, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, max-age=0',
          },
        });
      }

      if (cloakerConfig.whitePageUrl) {
        try {
          const whiteRes = await fetch(cloakerConfig.whitePageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(5000),
          });
          if (whiteRes.ok) {
            const whiteHtml = await whiteRes.text();
            return new NextResponse(whiteHtml, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store, max-age=0',
              },
            });
          }
        } catch (fetchErr) {
          return NextResponse.redirect(cloakerConfig.whitePageUrl, 302);
        }
      }

      // Fallback White Page institucional
      const fallbackWhiteHtml = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Portal Oficial - Artigo Informativo</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:sans-serif;background:#f9fafb;color:#111;padding:40px 20px;max-width:700px;margin:0 auto;line-height:1.6;"><h2>Conteúdo Informativo e Educacional</h2><p>Esta página é dedicada à publicação de artigos, comunicados de imprensa e novidades do setor de forma transparente e em conformidade com as diretrizes de publicidade online.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"><p style="font-size:12px;color:#6b7280;">© ${new Date().getFullYear()} - Todos os direitos reservados.</p></body></html>`;
      return new NextResponse(fallbackWhiteHtml, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    } else {
      // Tráfego limpo liberado para a Black Page
      prisma.page.update({
        where: { id: page.id },
        data: {
          meta: {
            ...pageMeta,
            cloaker: {
              ...cloakerConfig,
              stats: {
                totalHits: (cloakerConfig.stats?.totalHits || 0) + 1,
                blackHits: (cloakerConfig.stats?.blackHits || 0) + 1,
                whiteHits: cloakerConfig.stats?.whiteHits || 0,
                lastHitAt: new Date().toISOString(),
              },
            },
          },
        },
      }).catch(() => {});
    }
  }

  let htmlContent = page?.html;
  let cssContent = page?.css;
  let sourceUrl = page?.sourceUrl || page?.clones[0]?.sourceUrl;

  if (!htmlContent) {
    // Tenta achar direto no clone
    const clone = await prisma.clone.findFirst({
      where: {
        OR: [
          { id: slug },
          { name: slug }
        ]
      }
    });

    if (clone) {
      htmlContent = clone.resultHtml || '';
      cssContent = clone.resultCss || '';
      sourceUrl = clone.sourceUrl;
    }
  }

  if (!htmlContent) {
    return new NextResponse(
      '<!DOCTYPE html><html><head><title>Página não encontrada</title><meta charset="utf-8"></head><body style="background:#07080b;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>404 - Página Não Encontrada</h2><p style="color:#888;">Esta página ainda não foi publicada ou foi removida.</p></div></body></html>',
      {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  // Injeta base tag se existir sourceUrl
  let finalHtml = htmlContent;
  if (sourceUrl && !finalHtml.includes('<base')) {
    const baseTag = `<base href="${sourceUrl}" />`;
    if (finalHtml.includes('<head>')) {
      finalHtml = finalHtml.replace('<head>', `<head>${baseTag}`);
    } else {
      finalHtml = baseTag + finalHtml;
    }
  }

  // Injeta folha de estilos consolidada se não estiver incorporada
  if (cssContent && !finalHtml.includes('id="roi-aggregated-css"') && !finalHtml.includes('id="roi-published-css"')) {
    const cssTag = `<style id="roi-published-css">\n${cssContent}\n</style>`;
    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', `${cssTag}</head>`);
    } else {
      finalHtml = cssTag + finalHtml;
    }
  }

  // Injeta Escudo Anti-Tela Branca definitivo para assegurar visibilidade 100%
  if (!finalHtml.includes('id="roi-anti-blank-shield"')) {
    const shieldTag = `<style id="roi-anti-blank-shield">\n  html, body { opacity: 1 !important; visibility: visible !important; display: block !important; min-height: 100vh !important; }\n  #preloader, .preloader, #loading, .loading-screen, .elementor-loader, .elementor-loading, .page-loader, [class*="preloader"], [id*="preloader"], [class*="loader-wrapper"] { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }\n</style>`;
    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', `${shieldTag}</head>`);
    } else {
      finalHtml = shieldTag + finalHtml;
    }
  }

  return new NextResponse(finalHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  });
}
