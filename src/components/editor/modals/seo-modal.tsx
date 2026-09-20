'use client';

import { useEditorStore } from '@/stores/editor-store';
import { useState, useEffect } from 'react';
import { X, Globe, Image as ImageIcon, Share2, Check, ExternalLink } from 'lucide-react';

export function SeoModal() {
  const { activeModal, setActiveModal, html, updateHtml, sourceUrl, projectName } = useEditorStore();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [favicon, setFavicon] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!html) return;

    // Extrair do HTML atual
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const parsedTitle = doc.querySelector('title')?.innerText || 
                        doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || 
                        projectName || '';
    const parsedDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || 
                       doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
    const parsedImg = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || 
                      doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || '';
    const parsedFav = doc.querySelector('link[rel*="icon"]')?.getAttribute('href') || '/favicon.ico';

    setTitle(parsedTitle);
    setDescription(parsedDesc);
    setOgImage(parsedImg);
    setFavicon(parsedFav);
  }, [html, projectName]);

  if (activeModal !== 'seo') return null;

  const handleSaveSeo = () => {
    let newHtml = html;

    // Atualizar title
    if (newHtml.includes('<title>')) {
      newHtml = newHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
    } else if (newHtml.includes('<head>')) {
      newHtml = newHtml.replace('<head>', `<head>\n  <title>${title}</title>`);
    }

    // Atualizar og:title
    if (newHtml.includes('property="og:title"')) {
      newHtml = newHtml.replace(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${title}">`);
    } else if (newHtml.includes('</head>')) {
      newHtml = newHtml.replace('</head>', `  <meta property="og:title" content="${title}">\n</head>`);
    }

    // Atualizar description
    if (newHtml.includes('name="description"')) {
      newHtml = newHtml.replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${description}">`);
    } else if (newHtml.includes('</head>')) {
      newHtml = newHtml.replace('</head>', `  <meta name="description" content="${description}">\n</head>`);
    }

    // Atualizar og:description
    if (newHtml.includes('property="og:description"')) {
      newHtml = newHtml.replace(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${description}">`);
    } else if (newHtml.includes('</head>')) {
      newHtml = newHtml.replace('</head>', `  <meta property="og:description" content="${description}">\n</head>`);
    }

    // Atualizar og:image
    if (ogImage) {
      if (newHtml.includes('property="og:image"')) {
        newHtml = newHtml.replace(/<meta property="og:image"[^>]*>/i, `<meta property="og:image" content="${ogImage}">`);
      } else if (newHtml.includes('</head>')) {
        newHtml = newHtml.replace('</head>', `  <meta property="og:image" content="${ogImage}">\n</head>`);
      }
    }

    // Atualizar favicon
    if (favicon) {
      if (newHtml.includes('rel="icon"') || newHtml.includes("rel='icon'")) {
        newHtml = newHtml.replace(/<link rel=["']icon["'][^>]*>/i, `<link rel="icon" href="${favicon}">`);
      } else if (newHtml.includes('</head>')) {
        newHtml = newHtml.replace('</head>', `  <link rel="icon" href="${favicon}">\n</head>`);
      }
    }

    updateHtml(newHtml);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setActiveModal('none');
    }, 800);
  };

  const domainDisplay = sourceUrl ? new URL(sourceUrl).hostname : 'seusite.com.br';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d0e15] p-6 text-white shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">SEO & Card de Compartilhamento (WhatsApp)</h2>
              <p className="text-xs text-neutral-400">
                Personalize os dados clonados da página para gerar previews atraentes nas redes sociais.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('none')}
            className="p-1.5 rounded-lg border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Preview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Título da Página (Aba & Compartilhamento)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Método Cozinha de Domingo — Oferta Exclusiva"
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#141622] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Descrição da Oferta
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição que aparece abaixo do link compartilhado no WhatsApp..."
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#141622] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                URL da Imagem de Pré-visualização (Thumbnail)
              </label>
              <input
                type="text"
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                placeholder="https://seusite.com/imagem-preview.jpg"
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#141622] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Favicon (Ícone da Aba)
              </label>
              <input
                type="text"
                value={favicon}
                onChange={(e) => setFavicon(e.target.value)}
                placeholder="https://seusite.com/favicon.ico"
                className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#141622] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Live WhatsApp / Social Card Preview */}
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-neutral-400 mb-2 flex items-center gap-1.5">
              <span>Prévia no WhatsApp</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Ao Vivo
              </span>
            </span>

            <div className="flex-1 rounded-2xl bg-[#054640] p-3 border border-emerald-500/20 shadow-inner flex flex-col justify-end">
              <div className="rounded-xl overflow-hidden bg-[#0c1f1c] border border-emerald-500/30 shadow-lg">
                {ogImage ? (
                  <div className="w-full h-36 bg-neutral-900 relative overflow-hidden">
                    <img
                      src={ogImage}
                      alt="Thumbnail Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/600x315/1e293b/ffffff?text=Card+Preview';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-32 bg-neutral-900/80 flex flex-col items-center justify-center text-neutral-500 gap-2">
                    <ImageIcon className="w-8 h-8 opacity-40" />
                    <span className="text-[11px]">Nenhuma imagem definida</span>
                  </div>
                )}
                <div className="p-3 bg-[#081816]">
                  <span className="text-[10px] text-emerald-400 font-mono block uppercase tracking-wider mb-0.5">
                    {domainDisplay}
                  </span>
                  <h4 className="text-xs font-bold text-white line-clamp-1">
                    {title || 'Título da Página'}
                  </h4>
                  <p className="text-[11px] text-neutral-300 line-clamp-2 mt-0.5">
                    {description || 'Descrição da página ao compartilhar o link.'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-emerald-300/60 self-end mt-1 font-mono">14:20 ✓✓</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-[11px] text-neutral-400">
            As tags OpenGraph serão atualizadas no HTML da página.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveModal('none')}
              className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-neutral-300 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveSeo}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : null}
              <span>{copied ? 'Salvo!' : 'Aplicar Alterações'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
