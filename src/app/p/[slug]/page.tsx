import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';

export default async function PublishedPage(props: { params: Promise<{ slug: string }> }) {
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

  if (!htmlContent) notFound();

  // Injeta base tag se existir sourceUrl
  let finalHtml = htmlContent;
  if (sourceUrl && !finalHtml.includes('<base')) {
    const baseTag = `<base href="${sourceUrl}" />`;
    if (finalHtml.includes('<head>')) {
      finalHtml = finalHtml.replace('<head>', `<head>${baseTag}`);
    } else {
      finalHtml = baseTag + finalHtml;
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

  return (
    <div className="w-screen min-h-screen m-0 p-0 overflow-x-hidden bg-white">
      <iframe
        srcDoc={finalHtml}
        title={page?.name || 'Página Publicada'}
        className="w-full min-h-screen border-0 block"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
      />
    </div>
  );
}
