'use client';

import { useEditorStore } from '@/stores/editor-store';
import { X, Link2, Check, ArrowRight } from 'lucide-react';
import { useState, useMemo } from 'react';

export function ReplaceUrlModal() {
  const { activeModal, setActiveModal, html, replaceUrlsInHtml } = useEditorStore();

  const [oldUrl, setOldUrl] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [replacedCount, setReplacedCount] = useState<number | null>(null);

  // Scan all links present in HTML
  const detectedLinks = useMemo(() => {
    if (!html) return [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const linkMap = new Map<string, number>();

      doc.querySelectorAll('a').forEach((a) => {
        const href = a.getAttribute('href');
        if (href && href.startsWith('http')) {
          linkMap.set(href, (linkMap.get(href) || 0) + 1);
        }
      });

      return Array.from(linkMap.entries()).map(([href, count]) => ({ href, count }));
    } catch {
      return [];
    }
  }, [html]);

  if (activeModal !== 'replace-url') return null;

  const handleReplace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldUrl || !newUrl) return;

    const count = replaceUrlsInHtml(oldUrl, newUrl);
    setReplacedCount(count);
    setTimeout(() => setReplacedCount(null), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0d0e14] border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Substituir URL / Links</h3>
              <p className="text-xs text-neutral-400">Troque os links de checkout e destinos de uma só vez</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('none')}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleReplace} className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
              URL Original (que você quer substituir):
            </label>
            <input
              type="text"
              required
              value={oldUrl}
              onChange={(e) => setOldUrl(e.target.value)}
              placeholder="Ex: https://checkout-original.com/produto"
              className="w-full bg-[#151722] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-all font-mono"
            />
          </div>

          {detectedLinks.length > 0 && (
            <div>
              <label className="text-[11px] font-medium text-neutral-400 mb-1.5 block">
                Ou selecione um dos links detectados na página:
              </label>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {detectedLinks.map(({ href, count }) => (
                  <button
                    type="button"
                    key={href}
                    onClick={() => setOldUrl(href)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs truncate flex items-center justify-between transition-colors ${
                      oldUrl === href ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate font-mono text-[11px]">{href}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-neutral-400 shrink-0 ml-2">
                      {count}x
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
              Nova URL de Destino (seu link de afiliado / checkout):
            </label>
            <input
              type="text"
              required
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Ex: https://meucheckout.com/pay"
              className="w-full bg-[#151722] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-all font-mono"
            />
          </div>

          {replacedCount !== null && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{replacedCount} link(s) substituído(s) com sucesso na página!</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Fechar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
            >
              <span>Substituir em Todos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
