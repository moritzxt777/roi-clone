import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
        { slug: { startsWith: slug } },
        { id: slug },
      ]
    },
    include: {
      domain: true,
      clones: { take: 1 }
    }
  });

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
