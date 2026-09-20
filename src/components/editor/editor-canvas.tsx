'use client';

import { useEditorStore } from '@/stores/editor-store';
import { useEffect, useMemo, useRef } from 'react';

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
              // Em modo navegação/interação, permite que cliques em botões, links,
              // selects, formulários e modais funcionem 100% naturalmente!
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

  // Escuta os cliques de seleção do iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'ROI_ELEMENT_SELECTED') {
        selectElement(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectElement]);

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
