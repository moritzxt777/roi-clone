'use client';

import { useEditorStore } from '@/stores/editor-store';
import { X, Type, Search, Sparkles, Check } from 'lucide-react';
import { useState, useMemo } from 'react';

export function TextsModal() {
  const { activeModal, setActiveModal, html, updateHtml } = useEditorStore();
  const [search, setSearch] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedText, setEditedText] = useState('');
  const [success, setSuccess] = useState(false);

  // Extract all text elements from HTML
  const textItems = useMemo(() => {
    if (!html) return [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const items: { tag: string; text: string; selector: string }[] = [];

      doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p').forEach((el, index) => {
        const text = el.textContent?.trim();
        if (text && text.length > 2 && text.length < 250) {
          items.push({
            tag: el.tagName.toUpperCase(),
            text,
            selector: el.tagName.toLowerCase() + ':nth-of-type(' + (index + 1) + ')',
          });
        }
      });

      return items;
    } catch {
      return [];
    }
  }, [html]);

  if (activeModal !== 'texts') return null;

  const filtered = textItems.filter((i) =>
    i.text.toLowerCase().includes(search.toLowerCase()) || i.tag.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveText = (originalText: string, newText: string) => {
    if (!originalText || !newText || originalText === newText) {
      setEditingIndex(null);
      return;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p').forEach((el) => {
        if (el.textContent?.trim() === originalText) {
          el.textContent = newText;
        }
      });

      updateHtml(doc.documentElement.outerHTML);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      setEditingIndex(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#0d0e14] border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Type className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Gerenciador de Textos</h3>
              <p className="text-xs text-neutral-400">Edite todos os títulos e parágrafos da página em lote</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('none')}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar texto na página..."
            className="w-full bg-[#151722] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>

        {/* Table of Texts */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-xs text-neutral-500">Nenhum texto encontrado.</div>
          ) : (
            filtered.map((item, idx) => {
              const isEditing = editingIndex === idx;

              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all flex items-start gap-3"
                >
                  <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono font-bold shrink-0 mt-0.5">
                    {item.tag}
                  </span>

                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          rows={2}
                          className="w-full bg-[#151722] border border-blue-500 rounded-lg p-2 text-xs text-white focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="px-3 py-1 rounded-md text-[11px] text-neutral-400 hover:text-white"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSaveText(item.text, editedText)}
                            className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px]"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-200 leading-relaxed">{item.text}</p>
                    )}
                  </div>

                  {!isEditing && (
                    <button
                      onClick={() => {
                        setEditingIndex(idx);
                        setEditedText(item.text);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-[11px] font-medium text-neutral-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    >
                      Editar
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {success && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Texto atualizado no Canvas com sucesso!</span>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-white/5 mt-3">
          <button
            onClick={() => setActiveModal('none')}
            className="px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
