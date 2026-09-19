import { create } from 'zustand';

export type ElementType = 'TEXT' | 'IMAGE' | 'BUTTON' | 'LINK' | 'FORM' | 'CONTAINER' | 'VIDEO' | 'IFRAME' | 'CUSTOM';

export interface EditorElement {
  id: string;
  pageId: string;
  tagName: string;
  selector: string;
  type: ElementType;
  content: Record<string, any>;
  styles: Record<string, any>;
  attrs: Record<string, any>;
  position: number;
  parentId: string | null;
  children: EditorElement[];
}

export type ModalType = 'none' | 'replace-url' | 'scripts' | 'texts' | 'images' | 'buttons' | 'seo' | 'publish' | 'back-redirect' | 'timer';

export interface SelectedElementData {
  id: string;
  tagName: string;
  text?: string;
  html?: string;
  src?: string;
  alt?: string;
  href?: string;
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  selector?: string;
}

interface EditorState {
  pageId: string;
  cloneId: string;
  projectName: string;
  sourceUrl: string;
  elements: EditorElement[];
  css: string;
  html: string;
  deviceMode: 'desktop' | 'mobile';
  isSidebarOpen: boolean;
  selectedElement: SelectedElementData | null;
  activeModal: ModalType;
  isAiChatOpen: boolean;
  isSaving: boolean;
  saveStatus: 'saved' | 'saving' | 'unsaved';

  // Actions
  initEditor: (data: {
    pageId: string;
    cloneId: string;
    projectName: string;
    sourceUrl: string;
    elements: EditorElement[];
    css: string;
    html: string;
  }) => void;
  setDeviceMode: (mode: 'desktop' | 'mobile') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleAiChat: () => void;
  setAiChatOpen: (open: boolean) => void;
  setActiveModal: (modal: ModalType) => void;
  selectElement: (data: SelectedElementData | null) => void;
  updateHtml: (newHtml: string) => void;
  updateCss: (newCss: string) => void;
  updateElementInHtml: (elementId: string, updates: Partial<SelectedElementData>) => void;
  replaceUrlsInHtml: (oldUrl: string, newUrl: string) => number;
  replaceCheckoutLinks: (newCheckoutUrl: string) => number;
  injectPixModal: (config: { pixKey: string; recipientName?: string; price?: string }) => { success: boolean; buttonsUpdated: number };
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved') => void;
  setIsSaving: (isSaving: boolean) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  pageId: '',
  cloneId: '',
  projectName: 'Projeto Clonado',
  sourceUrl: '',
  elements: [],
  css: '',
  html: '',
  deviceMode: 'desktop',
  isSidebarOpen: true,
  selectedElement: null,
  activeModal: 'none',
  isSaving: false,
  saveStatus: 'saved',

  initEditor: (data) => set({
    pageId: data.pageId,
    cloneId: data.cloneId,
    projectName: data.projectName,
    sourceUrl: data.sourceUrl,
    elements: data.elements,
    css: data.css,
    html: data.html,
    saveStatus: 'saved',
  }),

  setDeviceMode: (deviceMode) => set({ deviceMode }),
  isAiChatOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  toggleAiChat: () => set((state) => ({ isAiChatOpen: !state.isAiChatOpen })),
  setAiChatOpen: (isAiChatOpen) => set({ isAiChatOpen }),
  setActiveModal: (activeModal) => set({ activeModal }),
  selectElement: (selectedElement) => set({ selectedElement }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setIsSaving: (isSaving) => set({ isSaving }),

  updateHtml: (newHtml) => set({ html: newHtml, saveStatus: 'unsaved' }),
  updateCss: (newCss) => set({ css: newCss, saveStatus: 'unsaved' }),

  updateElementInHtml: (elementId, updates) => {
    const currentHtml = get().html;
    if (!currentHtml) return;

    // Use DOMParser in browser to surgically update the exact element by data-editor-id or selector
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(currentHtml, 'text/html');
      
      const el = doc.querySelector(`[data-editor-id="${elementId}"]`) || 
                 (updates.selector ? doc.querySelector(updates.selector) : null);

      if (el) {
        if (updates.text !== undefined) el.textContent = updates.text;
        if (updates.src !== undefined && el.tagName.toLowerCase() === 'img') (el as HTMLImageElement).src = updates.src;
        if (updates.href !== undefined && el.tagName.toLowerCase() === 'a') (el as HTMLAnchorElement).href = updates.href;
        
        if (updates.color) (el as HTMLElement).style.color = updates.color;
        if (updates.backgroundColor) (el as HTMLElement).style.backgroundColor = updates.backgroundColor;
        if (updates.fontSize) (el as HTMLElement).style.fontSize = updates.fontSize;

        const updatedHtml = doc.documentElement.outerHTML;
        set({ html: updatedHtml, saveStatus: 'unsaved' });
      }
    } catch (e) {
      console.error('Error updating HTML:', e);
    }
  },

  replaceUrlsInHtml: (oldUrl, newUrl) => {
    const currentHtml = get().html;
    if (!currentHtml || !oldUrl) return 0;

    let count = 0;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(currentHtml, 'text/html');

      doc.querySelectorAll('a').forEach((link) => {
        const href = link.getAttribute('href');
        if (href && (href === oldUrl || href.includes(oldUrl))) {
          link.setAttribute('href', newUrl);
          count++;
        }
      });

      if (count > 0) {
        set({ html: doc.documentElement.outerHTML, saveStatus: 'unsaved' });
      }
    } catch (e) {
      console.error('Error replacing URLs in HTML:', e);
    }
    return count;
  },

  replaceCheckoutLinks: (newCheckoutUrl: string) => {
    const currentHtml = get().html;
    if (!currentHtml || !newCheckoutUrl) return 0;

    let count = 0;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(currentHtml, 'text/html');

      const checkoutKeywords = [
        'checkout', 'pay', 'hotmart', 'kiwify', 'eduzz', 'monetizze', 
        'cartpanda', 'perfectpay', 'stripe', 'comprar', 'adquirir', 
        'oferta', 'carrinho', 'order', 'compra', 'quero', 'garantir'
      ];

      doc.querySelectorAll('a').forEach((link) => {
        const href = (link.getAttribute('href') || '').toLowerCase();
        const text = (link.textContent || '').toLowerCase();
        const classes = (link.className || '').toLowerCase();

        const isCheckoutLike = 
          checkoutKeywords.some(k => href.includes(k) || text.includes(k) || classes.includes(k)) ||
          (href.startsWith('http') && !href.includes('facebook') && !href.includes('instagram'));

        const isActionLink = !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:');

        if (isCheckoutLike && isActionLink) {
          link.setAttribute('href', newCheckoutUrl);
          link.setAttribute('target', '_blank');
          count++;
        }
      });

      // Fallback: se nenhum achado por keyword, atualizar botões externos
      if (count === 0) {
        doc.querySelectorAll('a').forEach((link) => {
          const href = link.getAttribute('href') || '';
          if (href && !href.startsWith('#')) {
            link.setAttribute('href', newCheckoutUrl);
            link.setAttribute('target', '_blank');
            count++;
          }
        });
      }

      if (count > 0) {
        set({ html: doc.documentElement.outerHTML, saveStatus: 'unsaved' });
      }
    } catch (e) {
      console.error('Error replacing checkout links:', e);
    }
    return count;
  },

  injectPixModal: (config) => {
    const currentHtml = get().html;
    if (!currentHtml) return { success: false, buttonsUpdated: 0 };

    let buttonsUpdated = 0;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(currentHtml, 'text/html');

      const pixKey = config.pixKey || 'suachavepix@email.com';
      const recipientName = config.recipientName || 'Recebedor Oficial';
      const price = config.price || 'R$ 97,00';
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(pixKey)}`;

      // Remover modal prévio se já inserido
      doc.getElementById('roi-pix-checkout-modal')?.remove();
      doc.getElementById('roi-pix-checkout-style')?.remove();
      doc.getElementById('roi-pix-checkout-script')?.remove();

      // CSS do Modal Pix
      const styleTag = doc.createElement('style');
      styleTag.id = 'roi-pix-checkout-style';
      styleTag.textContent = `
        #roi-pix-checkout-modal {
          position: fixed;
          inset: 0;
          z-index: 9999999;
          display: none;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 16px;
        }
        #roi-pix-checkout-modal.roi-pix-open {
          display: flex !important;
        }
        .roi-pix-card {
          background: #0d0e14;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 24px;
          max-width: 440px;
          width: 100%;
          padding: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(50, 186, 163, 0.15);
          text-align: center;
          position: relative;
        }
        .roi-pix-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 12px;
          margin-bottom: 14px;
        }
        .roi-pix-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(50, 186, 163, 0.15);
          color: #32baa3;
          border: 1px solid rgba(50, 186, 163, 0.3);
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
        }
        .roi-pix-x {
          background: rgba(255, 255, 255, 0.08);
          border: none;
          color: #888;
          font-size: 20px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          line-height: 1;
        }
        .roi-pix-x:hover { background: rgba(255, 255, 255, 0.2); color: #fff; }
        .roi-pix-qr {
          background: #fff;
          padding: 10px;
          border-radius: 16px;
          display: inline-block;
          margin: 12px auto;
        }
        .roi-pix-qr img {
          width: 170px;
          height: 170px;
          display: block;
        }
        .roi-pix-copybox {
          background: #151722;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin: 12px 0;
        }
        .roi-pix-val {
          font-family: monospace;
          font-size: 12px;
          color: #38bdf8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .roi-pix-copybtn {
          background: #2563eb;
          color: #fff;
          border: none;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .roi-pix-copybtn:hover { background: #1d4ed8; }
      `;
      doc.head.appendChild(styleTag);

      // HTML do Modal Pix
      const modalEl = doc.createElement('div');
      modalEl.id = 'roi-pix-checkout-modal';
      modalEl.innerHTML = `
        <div class="roi-pix-card">
          <div class="roi-pix-head">
            <div class="roi-pix-tag">
              <span>❖ PIX Instantâneo</span>
            </div>
            <button type="button" class="roi-pix-x" onclick="window.closeRoiPixModal()">&times;</button>
          </div>
          <h3 style="margin: 0; font-size: 17px; font-weight: 700; color: #fff;">Pagamento via PIX</h3>
          <p style="margin: 4px 0 0; font-size: 12px; color: #8e95a5;">Escaneie o QR Code no seu banco ou copie o código Pix abaixo:</p>
          
          <div style="margin: 10px 0;">
            <div style="font-size: 22px; font-weight: 800; color: #32baa3;">${price}</div>
            <div style="font-size: 11px; color: #8e95a5;">Beneficiário: ${recipientName}</div>
          </div>

          <div class="roi-pix-qr">
            <img src="${qrCodeUrl}" alt="QR Code Pix" />
          </div>

          <div class="roi-pix-copybox">
            <span class="roi-pix-val" id="roi-pix-str">${pixKey}</span>
            <button type="button" class="roi-pix-copybtn" id="roi-pix-copybtn" onclick="window.copyRoiPix()">Copiar Código</button>
          </div>

          <div style="font-size: 11px; color: #f59e0b; margin-top: 8px;">
            ⏱ Aguardando pagamento: <strong id="roi-pix-counter">14:59</strong>
          </div>

          <button type="button" onclick="alert('Assim que o pagamento for detectado, você receberá a confirmação!')" style="width: 100%; margin-top: 14px; background: #32baa3; color: #000; font-weight: 700; font-size: 13px; border: none; padding: 12px; border-radius: 12px; cursor: pointer;">
            Já realizei o pagamento Pix
          </button>
        </div>
      `;
      doc.body.appendChild(modalEl);

      // Script do Modal Pix
      const scriptEl = doc.createElement('script');
      scriptEl.id = 'roi-pix-checkout-script';
      scriptEl.textContent = `
        window.openRoiPixModal = function(e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          var m = document.getElementById('roi-pix-checkout-modal');
          if (m) m.classList.add('roi-pix-open');
        };
        window.closeRoiPixModal = function() {
          var m = document.getElementById('roi-pix-checkout-modal');
          if (m) m.classList.remove('roi-pix-open');
        };
        window.copyRoiPix = function() {
          var s = document.getElementById('roi-pix-str');
          var b = document.getElementById('roi-pix-copybtn');
          if (s) {
            navigator.clipboard.writeText(s.innerText);
            if (b) {
              b.innerText = 'Copiado!';
              setTimeout(function(){ b.innerText = 'Copiar Código'; }, 2500);
            }
          }
        };
        var s = 899;
        setInterval(function() {
          var el = document.getElementById('roi-pix-counter');
          if (el && s > 0) {
            var min = Math.floor(s / 60);
            var sec = s % 60;
            el.innerText = (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;
            s--;
          }
        }, 1000);
      `;
      doc.body.appendChild(scriptEl);

      // Vincular todos os botões de compra/checkout da página
      const buyKeywords = ['comprar', 'adquirir', 'garantir', 'checkout', 'oferta', 'quero', 'acesso', 'pagar', 'inscri', 'order', 'pay'];
      doc.querySelectorAll('a, button').forEach((el) => {
        const text = (el.textContent || '').toLowerCase();
        const href = (el.getAttribute('href') || '').toLowerCase();
        const isBuyButton = buyKeywords.some((k) => text.includes(k) || href.includes(k));

        if (isBuyButton) {
          el.setAttribute('onclick', 'window.openRoiPixModal(event); return false;');
          if (el.tagName.toLowerCase() === 'a') {
            el.setAttribute('href', '#pix');
          }
          buttonsUpdated++;
        }
      });

      set({ html: doc.documentElement.outerHTML, saveStatus: 'unsaved' });
      return { success: true, buttonsUpdated };
    } catch (e) {
      console.error('Error injecting Pix modal:', e);
      return { success: false, buttonsUpdated: 0 };
    }
  },
}));
