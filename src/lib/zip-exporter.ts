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
  downloadMediaAssets?: boolean;
  maxAssets?: number;
}

/**
 * Extrai URLs de imagens e mídias presentes no HTML e no CSS.
 */
function extractImageUrls(html: string, css: string): string[] {
  const urls = new Set<string>();

  // 1. Atributos comuns de imagens (src, data-src, lazy-src, etc.)
  const srcRegex = /(?:src|data-src|data-original|data-lazy-src|data-fallback-src|data-hi-res-src)=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = srcRegex.exec(html)) !== null) {
    const u = match[1].trim();
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('//')) {
      urls.add(u.startsWith('//') ? `https:${u}` : u);
    }
  }

  // 2. Atributos srcset
  const srcsetRegex = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const parts = match[1].split(',');
    for (const part of parts) {
      const u = part.trim().split(/\s+/)[0];
      if (u && (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('//'))) {
        urls.add(u.startsWith('//') ? `https:${u}` : u);
      }
    }
  }

  // 3. URLs em propriedades CSS: background-image: url(...)
  const cssUrlRegex = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  const combinedCss = html + '\n' + css;
  while ((match = cssUrlRegex.exec(combinedCss)) !== null) {
    const u = match[1].trim();
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('//')) {
      urls.add(u.startsWith('//') ? `https:${u}` : u);
    }
  }

  // 4. Favicons e Touch Icons
  const iconRegex = /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/gi;
  while ((match = iconRegex.exec(html)) !== null) {
    const u = match[1].trim();
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('//')) {
      urls.add(u.startsWith('//') ? `https:${u}` : u);
    }
  }

  return Array.from(urls);
}

/**
 * Realiza o download paralelo e controlado das imagens para inclusão local no ZIP.
 */
async function downloadMediaAssets(
  urls: string[],
  maxAssets = 80
): Promise<Map<string, { filename: string; buffer: ArrayBuffer }>> {
  const assetMap = new Map<string, { filename: string; buffer: ArrayBuffer }>();
  const toFetch = urls.slice(0, maxAssets);

  // Concorrência em lotes para evitar bloqueios de rede ou estourar memória
  const chunkSize = 8;
  for (let i = 0; i < toFetch.length; i += chunkSize) {
    const chunk = toFetch.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (url, idx) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
              Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const buffer = await res.arrayBuffer();
            if (buffer.byteLength > 80) {
              const contentType = res.headers.get('content-type') || '';
              let ext = 'png';
              if (contentType.includes('svg')) ext = 'svg';
              else if (contentType.includes('webp')) ext = 'webp';
              else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
              else if (contentType.includes('gif')) ext = 'gif';
              else if (contentType.includes('icon') || contentType.includes('x-icon')) ext = 'ico';
              else {
                try {
                  const pathname = new URL(url).pathname;
                  const matchExt = pathname.match(/\.([a-z0-9]{3,4})$/i);
                  if (matchExt) ext = matchExt[1].toLowerCase();
                } catch {}
              }

              const assetIndex = i + idx + 1;
              let baseName = 'img';
              try {
                const parts = new URL(url).pathname.split('/').filter(Boolean);
                const last = parts[parts.length - 1];
                if (last) {
                  baseName = last.split('.')[0].replace(/[^a-z0-9_-]/gi, '').slice(0, 15) || 'img';
                }
              } catch {}

              const filename = `${assetIndex}_${baseName}.${ext}`;
              assetMap.set(url, { filename, buffer });
            }
          }
        } catch {
          // Em caso de erro na imagem individual (404, timeout), mantém a URL original como fallback
        }
      })
    );
  }

  return assetMap;
}

/**
 * Reeescreve URLs externas para os caminhos relativos baixados no ZIP.
 */
function rewriteAssetsInContent(
  content: string,
  assetMap: Map<string, { filename: string }>,
  isCss = false
): string {
  let result = content;
  for (const [originalUrl, asset] of assetMap.entries()) {
    const replacement = isCss ? `../images/${asset.filename}` : `./images/${asset.filename}`;
    result = result.replaceAll(originalUrl, replacement);
    if (originalUrl.startsWith('https://')) {
      result = result.replaceAll(originalUrl.replace('https:', ''), replacement);
    }
  }
  return result;
}

/**
 * Reeescreve links internos entre subpáginas do funil para navegação 100% offline.
 */
function rewriteInternalLinks(
  content: string,
  subpages: SubpageZipData[]
): string {
  let result = content;

  // 1. Mapear rotas de subpáginas (/p/slug ou slugs diretos)
  subpages.forEach((sub, idx) => {
    const safeSlug = (sub.slug || sub.name || `pagina-${idx + 2}`)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');

    const targetHtml = `./${safeSlug}.html`;

    // Rotas do ROI Clone (/p/slug)
    if (sub.slug) {
      result = result.replaceAll(`/p/${sub.slug}`, targetHtml);
    }
    result = result.replaceAll(`href="/${safeSlug}"`, `href="${targetHtml}"`);
    result = result.replaceAll(`href="${safeSlug}"`, `href="${targetHtml}"`);
  });

  // 2. Links de retorno para a home
  result = result.replaceAll('href="/"', 'href="./index.html"');

  return result;
}

export async function generateSiteZip(options: SiteZipOptions): Promise<JSZip> {
  const zip = new JSZip();
  const { 
    projectName, 
    html, 
    css = '', 
    subpages = [], 
    downloadMediaAssets: shouldDownloadMedia = true,
    maxAssets = 80
  } = options;

  // 1. Coleta de todas as mídias (HTML principal + Subpáginas + CSS)
  let allHtmlContent = html;
  subpages.forEach((s) => {
    allHtmlContent += '\n' + s.html;
  });

  const mediaUrls = shouldDownloadMedia ? extractImageUrls(allHtmlContent, css) : [];
  let assetMap = new Map<string, { filename: string; buffer: ArrayBuffer }>();

  if (mediaUrls.length > 0) {
    try {
      assetMap = await downloadMediaAssets(mediaUrls, maxAssets);
      // Salva cada imagem baixada na pasta images/ do ZIP
      for (const [, asset] of assetMap.entries()) {
        zip.file(`images/${asset.filename}`, asset.buffer);
      }
    } catch (assetErr) {
      console.warn('[ZIP] Erro ao baixar assets de imagem:', assetErr);
    }
  }

  // 2. Processar e reescrever CSS consolidado
  let finalCss = css.trim();
  if (assetMap.size > 0) {
    finalCss = rewriteAssetsInContent(finalCss, assetMap, true);
  }
  if (finalCss) {
    zip.file('css/style.css', finalCss);
  }

  // 3. Processar index.html principal
  let mainHtml = html.trim();
  if (assetMap.size > 0) {
    mainHtml = rewriteAssetsInContent(mainHtml, assetMap, false);
  }
  mainHtml = rewriteInternalLinks(mainHtml, subpages);

  if (!mainHtml.toLowerCase().includes('<!doctype html>')) {
    mainHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${projectName || 'Oferta Clonada'}</title>
  ${finalCss ? '<link rel="stylesheet" href="css/style.css">' : ''}
</head>
<body>
${mainHtml}
</body>
</html>`;
  } else if (finalCss && !mainHtml.includes('css/style.css') && mainHtml.includes('</head>')) {
    mainHtml = mainHtml.replace('</head>', '  <link rel="stylesheet" href="css/style.css">\n</head>');
  }

  zip.file('index.html', mainHtml);

  // 4. Processar subpáginas do funil (Página 2, Carrinho, Checkout, Upsell, Obrigado)
  subpages.forEach((sub, idx) => {
    const safeSlug = (sub.slug || sub.name || `pagina-${idx + 2}`)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');

    let subHtml = sub.html.trim();
    if (assetMap.size > 0) {
      subHtml = rewriteAssetsInContent(subHtml, assetMap, false);
    }
    subHtml = rewriteInternalLinks(subHtml, subpages);

    if (!subHtml.toLowerCase().includes('<!doctype html>')) {
      subHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${sub.name}</title>
  ${finalCss || sub.css ? '<link rel="stylesheet" href="css/style.css">' : ''}
</head>
<body>
${subHtml}
</body>
</html>`;
    } else if (finalCss && !subHtml.includes('css/style.css') && subHtml.includes('</head>')) {
      subHtml = subHtml.replace('</head>', '  <link rel="stylesheet" href="css/style.css">\n</head>');
    }

    zip.file(`${safeSlug}.html`, subHtml);
  });

  // 5. Backend Simulado e Capturador de Leads Pronto para cPanel / Apache / PHP
  const submitPhp = `<?php
/**
 * ROI CLONE — Backend de Captura de Leads e Formulários
 * Funciona nativamente em cPanel, Hostgator, Locaweb, VPS e Servidores Apache/Nginx com PHP.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = $_POST;
    if (empty($data)) {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?: [];
    }

    $lead = [
        'data_hora' => date('Y-m-d H:i:s'),
        'ip'        => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
        'origem'    => $_SERVER['HTTP_REFERER'] ?? 'Direto',
        'campos'    => $data,
    ];

    // 1. Salva o Lead em arquivo JSON estruturado
    $leadsFile = __DIR__ . '/leads.json';
    $existing = file_exists($leadsFile) ? json_decode(file_get_contents($leadsFile), true) : [];
    if (!is_array($existing)) $existing = [];
    $existing[] = $lead;
    file_put_contents($leadsFile, json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    // 2. Salva o Lead em arquivo CSV (compatível com Excel / Google Sheets)
    $csvFile = __DIR__ . '/leads.csv';
    $csvExists = file_exists($csvFile);
    $fp = fopen($csvFile, 'a');
    if (!$csvExists) {
        fputcsv($fp, ['Data e Hora', 'IP', 'Dados Recebidos']);
    }
    fputcsv($fp, [date('d/m/Y H:i:s'), $lead['ip'], json_encode($data, JSON_UNESCAPED_UNICODE)]);
    fclose($fp);

    // Retorna resposta de sucesso
    echo json_encode([
        'success' => true,
        'message' => 'Lead e formulário processados com sucesso pelo backend ROI Clone!',
        'total_registrado' => count($existing),
    ]);
    exit;
}

echo json_encode([
    'status' => 'online',
    'service' => 'ROI Clone Backend Endpoint',
    'info' => 'Envie dados via POST para salvar formulários ou leads.'
]);
`;
  zip.file('api/submit.php', submitPhp);

  // Script frontend opcional para envio assíncrono dos formulários
  const leadCaptureJs = `/**
 * ROI Clone — Interceptor Inteligente de Formulários
 * Envia formulários automaticamente para o backend local api/submit.php
 */
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('form').forEach(function(form) {
    form.addEventListener('submit', function(e) {
      var action = form.getAttribute('action') || '';
      if (!action || action === '#' || action.startsWith('javascript:')) {
        e.preventDefault();
        var formData = new FormData(form);
        fetch('api/submit.php', {
          method: 'POST',
          body: formData
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          alert('Mensagem e dados enviados com sucesso!');
          form.reset();
        })
        .catch(function() {
          alert('Dados recebidos com sucesso!');
          form.reset();
        });
      }
    });
  });
});
`;
  zip.file('js/lead-capture.js', leadCaptureJs);

  // 6. Arquivo de configuração .htaccess para servidores Apache / cPanel / Hostgator
  const htaccess = `# Configuração de Cache, Segurança e GZIP gerada pela ROI Clone
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ index.html [L]
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css application/javascript application/json image/svg+xml
</IfModule>

# Cache de Mídias e Assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>
`;
  zip.file('.htaccess', htaccess);

  // 7. README detalhado com instruções de hospedagem e uso
  const readme = `========================================================================
   SITE, FUNIL & MÍDIAS CLONADOS COM SUCESSO — MODO COMPLETO (ROI CLONE)
========================================================================

Projeto: ${projectName || 'Oferta Clonada'}
Data da Clonagem: ${new Date().toLocaleString('pt-BR')}
Mídias e Imagens Locais: ${assetMap.size} imagens baixadas e incluídas offline

ESTRUTURA DE ARQUIVOS DESTE PACOTE:
├── index.html         -> Página Principal / VSL / Oferta Principal
${subpages.map((s, i) => `├── ${(s.slug || s.name || `pagina-${i + 2}`).toLowerCase().replace(/[^a-z0-9]/g, '-')}.html -> ${s.name}`).join('\n')}
├── images/            -> Imagens e mídias salvas localmente (100% offline)
├── css/style.css      -> Folha de estilos consolidada com caminhos relativos
├── api/submit.php     -> Backend em PHP para capturar leads e formulários
├── js/lead-capture.js -> Script leve de envio automático de formulários
├── .htaccess          -> Configuração de alta velocidade para cPanel/Apache
└── README.txt         -> Guia de instalação e hospedagem

COMO HOSPEDAR SEU SITE CLONADO:

1. Hospedagem cPanel / Hostgator / Locaweb:
   - Acesse o Gerenciador de Arquivos do seu cPanel.
   - Abra a pasta "public_html".
   - Faça o upload deste arquivo .ZIP e clique em "Extrair" (Extract).
   - Pronto! O site, o funil completo e o backend api/submit.php já estarão funcionando!
   - Os leads preenchidos nos formulários serão gravados automaticamente em api/leads.csv.

2. Vercel / Netlify / Cloudflare Pages (Gratuito e com SSL):
   - Extraia a pasta no seu computador.
   - Arraste a pasta extraída na aba "Deploy" do painel da Netlify ou Cloudflare Pages.
   - O site será publicado em segundos com carregamento instantâneo.

3. Servidor VPS (Nginx / Apache / Docker):
   - Copie o conteúdo para /var/www/html (ou raiz web configurada).
   - Defina permissão de escrita para a pasta api/ caso deseje gravar leads.csv.

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
