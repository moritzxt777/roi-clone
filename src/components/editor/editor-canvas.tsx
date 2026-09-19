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
            if (!e.target || e.target === document.body || e.target === document.documentElement) return;
            if (currentHover && currentHover !== e.target) {
              currentHover.removeAttribute('data-roi-hover');
            }
            currentHover = e.target;
            currentHover.setAttribute('data-roi-hover', 'true');
          }, true);

          document.addEventListener('mouseout', function(e) {
            if (e.target && e.target.removeAttribute) {
              e.target.removeAttribute('data-roi-hover');
            }
          }, true);

          document.addEventListener('click', function(e) {
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

    // Injeta a tag base para carregar todas as imagens e links externos do site original
    let modifiedHtml = activeHtml;
    const baseTag = activeSource ? `<base href="${activeSource}" />` : '';

    if (modifiedHtml.includes('<head>')) {
      modifiedHtml = modifiedHtml.replace('<head>', `<head>${baseTag}`);
    } else {
      modifiedHtml = `<head>${baseTag}</head>` + modifiedHtml;
    }

    if (modifiedHtml.includes('</body>')) {
      modifiedHtml = modifiedHtml.replace('</body>', `${scriptInjection}</body>`);
    } else {
      modifiedHtml = modifiedHtml + scriptInjection;
    }

    return modifiedHtml;
  }, [activeHtml, activeSource]);

  // Atualiza o iframe imediatamente
  useEffect(() => {
    if (iframeRef.current && srcDocContent) {
      iframeRef.current.srcdoc = srcDocContent;
    }
  }, [srcDocContent]);

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

  return (
    <main className="flex-1 h-full bg-[#07080b] flex items-center justify-center p-2 md:p-4 overflow-hidden relative select-none">
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
          title="ROI Canvas Preview"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    </main>
  );
}
