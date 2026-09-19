'use client';

import { useEditorStore } from '@/stores/editor-store';
import { X, MousePointerClick, Check, ExternalLink } from 'lucide-react';
import { useState, useMemo } from 'react';

export function ButtonsModal() {
  const { activeModal, setActiveModal, html, updateHtml } = useEditorStore();
  const [editingBtn, setEditingBtn] = useState<{ text: string; href: string } | null>(null);
  const [newText, setNewText] = useState('');
  const [newHref, setNewHref] = useState('');
  const [success, setSuccess] = useState(false);

  // Extract all buttons and CTA links
  const buttons = useMemo(() => {
    if (!html) return [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const list: { text: string; href: string; tag: string }[] = [];

      doc.querySelectorAll('button, a[class*="btn"], a[class*="button"], a[role="button"]').forEach((el) => {
        const text = el.textContent?.trim();
        const href = (el as HTMLAnchorElement).href || el.getAttribute('href') || '';
        if (text && text.length < 100) {
          list.push({ text, href, tag: el.tagName.toUpperCase() });
        }
      });

      return list;
    } catch {
      return [];
    }
  }, [html]);

  if (activeModal !== 'buttons') return null;

  const handleSaveButton = () => {
    if (!editingBtn) return;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      doc.querySelectorAll('button, a[class*="btn"], a[class*="button"], a[role="button"]').forEach((el) => {
        if (el.textContent?.trim() === editingBtn.text) {
          if (newText) el.textContent = newText;
          if (newHref && el.tagName.toLowerCase() === 'a') el.setAttribute('href', newHref);
        }
      });

      updateHtml(doc.documentElement.outerHTML);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      setEditingBtn(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#0d0e14] border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <MousePointerClick className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Botões e Chamadas de Ação (CTAs)</h3>
              <p className="text-xs text-neutral-400">Edite os textos e links dos botões de compra da página</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('none')}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Button Editor */}
        {editingBtn && (
          <div className="mt-4 p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-300">Editando Botão: "{editingBtn.text}"</span>
              <button
                onClick={() => setEditingBtn(null)}
                className="text-[11px] text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-neutral-400 mb-1 block">Texto do Botão</label>
                <input
                  type="text"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  className="w-full bg-[#151722] border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-neutral-400 mb-1 block">Link de Destino</label>
                <input
                  type="text"
                  value={newHref}
                  onChange={(e) => setNewHref(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#151722] border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
            <button
              onClick={handleSaveButton}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all"
            >
              Salvar Alterações
            </button>
          </div>
        )}

        {/* Lista de Botões */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
          {buttons.length === 0 ? (
            <div className="text-center py-10 text-xs text-neutral-500">Nenhum botão detectado na página.</div>
          ) : (
            buttons.map((btn, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-mono font-bold">
                    {btn.tag}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-white block">{btn.text}</span>
                    {btn.href && <span className="text-[11px] font-mono text-neutral-500 truncate max-w-md block">{btn.href}</span>}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setEditingBtn(btn);
                    setNewText(btn.text);
                    setNewHref(btn.href);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-[11px] font-medium text-neutral-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                >
                  Editar
                </button>
              </div>
            ))
          )}
        </div>

        {success && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Botão atualizado com sucesso!</span>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-white/5 mt-3">
          <button
            onClick={() => setActiveModal('none')}
            className="px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
