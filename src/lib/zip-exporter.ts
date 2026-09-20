import JSZip from 'jszip';

export interface SubpageZipData {
  name: string;
  slug?: string;
  html: string;
  css?: string;
}

export interface SiteZipOptions {
  projectName: string;
  html: string;
  css?: string;
  subpages?: SubpageZipData[];
}

export async function generateSiteZip(options: SiteZipOptions): Promise<JSZip> {
  const zip = new JSZip();
  const { projectName, html, css = '', subpages = [] } = options;

  // 1. Processar CSS consolidado
  if (css && css.trim()) {
    zip.file('css/style.css', css);
  }

  // 2. Processar index.html principal
  let mainHtml = html.trim();
  if (!mainHtml.toLowerCase().includes('<!doctype html>')) {
    mainHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${projectName || 'Oferta Clonada'}</title>
  ${css ? '<link rel="stylesheet" href="css/style.css">' : ''}
</head>
<body>
${mainHtml}
</body>
</html>`;
  } else if (css && !mainHtml.includes('css/style.css') && mainHtml.includes('</head>')) {
    mainHtml = mainHtml.replace('</head>', '  <link rel="stylesheet" href="css/style.css">\n</head>');
  }

  zip.file('index.html', mainHtml);

  // 3. Processar subpáginas (Página 2, Checkout, Upsell, Obrigado)
  subpages.forEach((sub, idx) => {
    const safeSlug = (sub.slug || sub.name || `pagina-${idx + 2}`)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');

    let subHtml = sub.html.trim();
    if (!subHtml.toLowerCase().includes('<!doctype html>')) {
      subHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${sub.name}</title>
  ${css || sub.css ? '<link rel="stylesheet" href="css/style.css">' : ''}
</head>
<body>
${subHtml}
</body>
</html>`;
    }

    zip.file(`${safeSlug}.html`, subHtml);
  });

  // 4. Arquivo de configuração .htaccess para servidores Apache / cPanel / Hostgator
  const htaccess = `# Configuração de Cache e Compressão GZIP gerada pela ROI Clone
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ index.html [L]
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css application/javascript application/json
</IfModule>
`;
  zip.file('.htaccess', htaccess);

  // 5. README com instruções completas de hospedagem e uso
  const readme = `========================================================================
   SITE E OFERTA CLONADOS COM SUCESSO PELA ROI CLONE
========================================================================

Projeto: ${projectName || 'Oferta Clonada'}
Data de Exportação: ${new Date().toLocaleString('pt-BR')}

ARQUIVOS INCLUSOS NESTE ZIP:
- index.html        -> Página Principal / VSL / Landing Page de Vendas
${subpages.map((s, i) => `- ${(s.slug || s.name || `pagina-${i + 2}`).toLowerCase().replace(/[^a-z0-9]/g, '-')}.html -> ${s.name}`).join('\n')}
- css/style.css     -> Folha de estilos consolidada do site
- .htaccess         -> Configurações de servidor para cPanel / Apache

COMO HOSPEDAR ESTE SITE:
1. cPanel / Hostgator / Locaweb:
   - Extraia este arquivo .zip dentro da pasta "public_html".
   - Acesse o seu domínio e sua oferta já estará 100% no ar!

2. Vercel / Netlify / Cloudflare Pages:
   - Arraste a pasta extraída diretamente para o painel da Netlify ou Cloudflare Pages ("Deploy manually").
   - O site será publicado em segundos com certificado SSL grátis.

3. Servidor VPS (Nginx / Apache):
   - Copie os arquivos para a pasta raiz web (ex: /var/www/html).

========================================================================
`;
  zip.file('README.txt', readme);

  return zip;
}

export async function downloadSiteZip(options: SiteZipOptions): Promise<void> {
  const zip = await generateSiteZip(options);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (options.projectName || 'oferta-clonada')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-');
  a.download = `${safeName}-site-completo.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
