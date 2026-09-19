'use client';

import { useEditorStore } from '@/stores/editor-store';
import { X, Sparkles, Check, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';

export function EditorInspector() {
  const { selectedElement, selectElement, updateElementInHtml } = useEditorStore();

  const [text, setText] = useState('');
  const [src, setSrc] = useState('');
  const [href, setHref] = useState('');
  const [color, setColor] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('');
  const [fontSize, setFontSize] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (selectedElement) {
      setText(selectedElement.text || '');
      setSrc(selectedElement.src || '');
      setHref(selectedElement.href || '');
      setColor(selectedElement.color || '');
      setBackgroundColor(selectedElement.backgroundColor || '');
      setFontSize(selectedElement.fontSize || '');
      setAiSuggestions([]);
      setApplied(false);
    }
  }, [selectedElement]);

  if (!selectedElement) return null;

  const isTextElement = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'BUTTON', 'A', 'LABEL'].includes(selectedElement.tagName);
  const isImageElement = selectedElement.tagName === 'IMG';
  const isLinkElement = selectedElement.tagName === 'A' || selectedElement.href;

  const handleApply = () => {
    updateElementInHtml(selectedElement.id, {
      text,
      src,
      href,
      color,
      backgroundColor,
      fontSize,
      selector: selectedElement.selector,
    });
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const handleGenerateAiCopy = async () => {
    if (!text) return;
    setAiLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Reescreva o texto a seguir em 3 variações persuasivas de copywriting para vendas: "${text}". Retorne apenas as 3 opções, uma por linha.`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const lines = (data.reply || '')
          .split('\n')
          .map((l: string) => l.replace(/^[\d.-]+\s*/, '').replace(/[*_"`]/g, '').trim())
          .filter((l: string) => l.length > 3)
          .slice(0, 3);

        if (lines.length > 0) {
          setAiSuggestions(lines);
        } else {
          setAiSuggestions([
            `🔥 ${text} — Garanta com desconto exclusivo hoje!`,
            `Compre agora e tenha acesso imediato a ${text}.`,
            `Transforme seus resultados com ${text}. Clique aqui!`,
          ]);
        }
      }
    } catch {
      setAiSuggestions([
        `🔥 ${text} — Garanta com desconto exclusivo hoje!`,
        `Compre agora e tenha acesso imediato a ${text}.`,
        `Transforme seus resultados com ${text}. Clique aqui!`,
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <aside className="w-[340px] bg-[#090a0f] border-l border-white/10 flex flex-col h-full z-20 shrink-0 select-none shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-xs font-bold">
            {selectedElement.tagName}
          </span>
          <span className="text-xs text-neutral-400 truncate max-w-[170px]">
            Propriedades
          </span>
        </div>
        <button
          onClick={() => selectElement(null)}
          className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Conteúdo do Inspector */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Editor de Texto */}
        {isTextElement && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-300">Conteúdo do Texto</label>
              <button
                onClick={handleGenerateAiCopy}
                disabled={aiLoading}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                <span>{aiLoading ? 'Gerando...' : 'ROI IA'}</span>
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full bg-[#12141c] border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
              placeholder="Digite o texto do elemento..."
            />

            {/* Sugestões de IA */}
            {aiSuggestions.length > 0 && (
              <div className="mt-2 space-y-1.5 p-2 rounded-lg bg-blue-950/20 border border-blue-500/20">
                <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider block">
                  Sugestões da IA:
                </span>
                {aiSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setText(suggestion)}
                    className="w-full text-left text-xs text-neutral-300 hover:text-white p-1.5 rounded bg-white/5 hover:bg-blue-600/20 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Editor de Imagem */}
        {isImageElement && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">URL da Imagem</label>
            <input
              type="text"
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              className="w-full bg-[#12141c] border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
              placeholder="https://..."
            />
            {src && (
              <div className="mt-2 rounded-lg border border-white/10 overflow-hidden bg-black/40 p-1 flex items-center justify-center max-h-32">
                <img src={src} alt="Preview" className="max-h-28 object-contain rounded" />
              </div>
            )}
          </div>
        )}

        {/* Editor de Link */}
        {isLinkElement && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">Destino do Link (Href)</label>
            <input
              type="text"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              className="w-full bg-[#12141c] border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
              placeholder="https://seulinkdecheckout.com"
            />
          </div>
        )}

        {/* Cores e Estilos */}
        <div className="pt-2 border-t border-white/5 space-y-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
            Estilos Visuais
          </span>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] text-neutral-400 mb-1 block">Cor do Texto</label>
              <div className="flex items-center gap-1.5 bg-[#12141c] border border-white/10 rounded-lg p-1.5">
                <input
                  type="color"
                  value={color && color.startsWith('#') ? color : '#ffffff'}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full bg-transparent text-[11px] text-white focus:outline-none font-mono"
                  placeholder="#fff"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-neutral-400 mb-1 block">Cor de Fundo</label>
              <div className="flex items-center gap-1.5 bg-[#12141c] border border-white/10 rounded-lg p-1.5">
                <input
                  type="color"
                  value={backgroundColor && backgroundColor.startsWith('#') ? backgroundColor : '#000000'}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-full bg-transparent text-[11px] text-white focus:outline-none font-mono"
                  placeholder="#000"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer do Inspector */}
      <div className="p-3 border-t border-white/10 bg-[#07080b]">
        <button
          onClick={handleApply}
          className="w-full h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
        >
          {applied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Aplicado na Página!</span>
            </>
          ) : (
            <>
              <span>Aplicar Alteração</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
