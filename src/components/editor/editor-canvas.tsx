'use client';

import { useEditorStore } from '@/stores/editor-store';
import { useState, useEffect, useMemo, useRef } from 'react';

interface EditorCanvasProps {
  initialHtml?: string;
  initialSourceUrl?: string;
}

export function EditorCanvas({ initialHtml = '', initialSourceUrl = '' }: EditorCanvasProps) {
  const {
    html,
    css,
    sourceUrl,
    deviceMode,
    editorMode,
    setEditorMode,
    selectElement,
  } = useEditorStore();

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeHtml = html || initialHtml;
  const activeSource = sourceUrl || initialSourceUrl;

  // Injetar script de seleção e estilos de outline dentro do iframe
  const srcDocContent = useMemo(() => {
    if (!activeHtml) {
      return `<!DOCTYPE html><html><body style="background:#0a0a0a;color:#888;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">Carregando página...</body></html>`;
    }

    const scriptInjection = `
      <style>
        [data-roi-hover="true"] {
          outline: 2px dashed #3b82f6 !important;
          outline-offset: 2px !important;
          cursor: pointer !important;
        }
        [data-roi-selected="true"] {
          outline: 2px solid #2563eb !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25) !important;
        }
      </style>
      <script>
        (function() {
          let currentSelected = null;
          let currentHover = null;
          let currentMode = '${editorMode}';

          window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'ROI_SET_MODE') {
              currentMode = event.data.mode;
              if (currentMode !== 'edit') {
                if (currentHover) {
                  currentHover.removeAttribute('data-roi-hover');
                  currentHover = null;
                }
                if (currentSelected) {
                  currentSelected.removeAttribute('data-roi-selected');
                  currentSelected = null;
                }
              }
            }
          });

          function getUniqueSelector(el) {
            if (el.id) return '#' + el.id;
            if (el.getAttribute('data-editor-id')) return '[data-editor-id="' + el.getAttribute('data-editor-id') + '"]';
            let path = [];
            while (el && el.nodeType === Node.ELEMENT_NODE) {
              let selector = el.nodeName.toLowerCase();
              if (el.className && typeof el.className === 'string' && el.className.trim()) {
                selector += '.' + el.className.trim().split(/\\s+/)[0];
              }
              path.unshift(selector);
              el = el.parentNode;
              if (el && el.nodeName.toLowerCase() === 'body') break;
            }
            return path.join(' > ');
          }

          document.addEventListener('mouseover', function(e) {
            if (currentMode !== 'edit') return;
            if (!e.target || e.target === document.body || e.target === document.documentElement) return;
            if (currentHover && currentHover !== e.target) {
              currentHover.removeAttribute('data-roi-hover');
            }
            currentHover = e.target;
            currentHover.setAttribute('data-roi-hover', 'true');
          }, true);

          document.addEventListener('mouseout', function(e) {
            if (currentMode !== 'edit') return;
            if (e.target && e.target.removeAttribute) {
              e.target.removeAttribute('data-roi-hover');
            }
          }, true);

          document.addEventListener('click', function(e) {
            if (currentMode !== 'edit') {
              // Em modo navegação/interação, permite navegação e avisa o editor caso seja um link interno / subpágina
              try {
                const a = e.target && e.target.closest ? e.target.closest('a') : (e.target && e.target.tagName === 'A' ? e.target : null);
                if (a && a.href) {
                  const href = a.href;
                  if (!href.startsWith('javascript:') && !href.startsWith('#') && !href.startsWith('tel:') && !href.startsWith('mailto:')) {
                    window.parent.postMessage({
                      type: 'ROI_LINK_CLICKED_IN_INTERACT',
                      url: href,
                      text: a.innerText ? a.innerText.trim() : ''
                    }, '*');
                  }
                }
              } catch (err) {}
              return;
            }

            const target = e.target;
            if (!target || target === document.body || target === document.documentElement) return;

            e.preventDefault();
            e.stopPropagation();

            if (currentSelected) {
              currentSelected.removeAttribute('data-roi-selected');
            }
            currentSelected = target;
            currentSelected.setAttribute('data-roi-selected', 'true');

            const computed = window.getComputedStyle(target);
            const editorId = target.getAttribute('data-editor-id') || ('el-' + Math.random().toString(36).substring(2, 9));
            target.setAttribute('data-editor-id', editorId);

            const payload = {
              type: 'ROI_ELEMENT_SELECTED',
              data: {
                id: editorId,
                tagName: target.tagName.toUpperCase(),
                text: target.innerText ? target.innerText.trim() : '',
                html: target.innerHTML || '',
                src: target.tagName.toLowerCase() === 'img' ? target.src : '',
                alt: target.tagName.toLowerCase() === 'img' ? target.alt : '',
                href: target.tagName.toLowerCase() === 'a' ? target.href : (target.closest('a') ? target.closest('a').href : ''),
                color: computed.color,
                backgroundColor: computed.backgroundColor,
                fontSize: computed.fontSize,
                selector: getUniqueSelector(target)
              }
            };

            window.parent.postMessage(payload, '*');
          }, true);
        })();
      </script>
    `;

    // Injeta a tag base para carregar todas as imagens e links externos do site original se não existir
    let modifiedHtml = activeHtml;
    const baseTag = activeSource ? `<base href="${activeSource}" />` : '';

    if (!modifiedHtml.includes('<base') && baseTag) {
      if (modifiedHtml.includes('<head>')) {
        modifiedHtml = modifiedHtml.replace('<head>', `<head>${baseTag}`);
      } else {
        modifiedHtml = `<head>${baseTag}</head>` + modifiedHtml;
      }
    }

    // Injeta folha de estilo caso não esteja incorporada
    if (css && !modifiedHtml.includes('id="roi-aggregated-css"') && !modifiedHtml.includes('id="roi-editor-css"')) {
      const cssTag = `<style id="roi-editor-css">\n${css}\n</style>`;
      if (modifiedHtml.includes('</head>')) {
        modifiedHtml = modifiedHtml.replace('</head>', `${cssTag}</head>`);
      } else {
        modifiedHtml = cssTag + modifiedHtml;
      }
    }

    if (modifiedHtml.includes('</body>')) {
      modifiedHtml = modifiedHtml.replace('</body>', `${scriptInjection}</body>`);
    } else {
      modifiedHtml = modifiedHtml + scriptInjection;
    }

    return modifiedHtml;
  }, [activeHtml, activeSource, css]);

  // Atualiza o iframe imediatamente
  useEffect(() => {
    if (iframeRef.current && srcDocContent) {
      iframeRef.current.srcdoc = srcDocContent;
    }
  }, [srcDocContent]);

  // Sincroniza o modo (edição vs navegação) com o iframe via postMessage
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'ROI_SET_MODE',
        mode: editorMode,
      }, '*');
    }
  }, [editorMode]);

  const [subpagePrompt, setSubpagePrompt] = useState<{ url: string; text: string } | null>(null);
  const [cloningSubpage, setCloningSubpage] = useState(false);

  // Escuta os cliques de seleção e navegação do iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'ROI_ELEMENT_SELECTED') {
        selectElement(event.data.data);
      }
      if (event.data && event.data.type === 'ROI_LINK_CLICKED_IN_INTERACT') {
        const clickedUrl = event.data.url;
        if (clickedUrl && !clickedUrl.includes('whatsapp') && !clickedUrl.includes('instagram') && !clickedUrl.includes('t.me')) {
          setSubpagePrompt({
            url: clickedUrl,
            text: event.data.text || '',
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectElement]);

  const handleOpenSubpageInEditor = async () => {
    if (!subpagePrompt) return;
    setCloningSubpage(true);
    try {
      const res = await fetch('/api/pages/subpage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: subpagePrompt.text ? `Página: ${subpagePrompt.text}` : 'Página 2',
          url: subpagePrompt.url,
        }),
      });
      const data = await res.json();
      if (data.pageId) {
        window.location.href = `/dashboard/projeto/${data.pageId}`;
      }
    } catch (err) {
      console.error('Error switching to subpage:', err);
    } finally {
      setCloningSubpage(false);
    }
  };

  const handleIframeLoad = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'ROI_SET_MODE',
        mode: editorMode,
      }, '*');
    }
  };

  return (
    <main className="flex-1 h-full bg-[#07080b] flex items-center justify-center p-2 md:p-4 overflow-hidden relative select-none">
      {/* Banner flutuante no topo quando em Modo Navegação */}
      {editorMode === 'interact' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-medium backdrop-blur-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Modo Navegação Ativo • Você pode clicar em botões, popups e testar o site</span>
          <button
            onClick={() => setEditorMode('edit')}
            className="ml-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-white font-bold text-[11px] transition-colors"
          >
            Voltar para Edição
          </button>
        </div>
      )}

      {/* Floating Prompt ao navegar para uma subpágina */}
      {subpagePrompt && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-3 rounded-2xl bg-[#0e101a]/95 border border-blue-500/50 text-white text-xs backdrop-blur-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 max-w-xl">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block">
              Subpágina / Página 2 Detectada
            </span>
            <p className="truncate text-neutral-300 text-xs">
              {subpagePrompt.text ? `"${subpagePrompt.text}" — ` : ''}{subpagePrompt.url}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSubpagePrompt(null)}
              className="px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10 text-neutral-400 hover:text-white text-xs"
            >
              Dispensar
            </button>
            <button
              disabled={cloningSubpage}
              onClick={handleOpenSubpageInEditor}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all"
            >
              {cloningSubpage ? 'Abrindo...' : 'Editar esta Página'}
            </button>
          </div>
        </div>
      )}

      <div 
        className={`transition-all duration-300 relative shadow-2xl ${
          deviceMode === 'desktop' 
            ? 'w-full h-full rounded-xl overflow-hidden border border-white/10 bg-white' 
            : 'w-[390px] h-[844px] rounded-[44px] border-[10px] border-[#1a1c24] bg-white overflow-hidden shadow-2xl shadow-blue-500/5'
        }`}
      >
        <iframe
          id="canvas-iframe"
          ref={iframeRef}
          srcDoc={srcDocContent}
          onLoad={handleIframeLoad}
          title="ROI Canvas Preview"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
        />
      </div>
    </main>
  );
}
