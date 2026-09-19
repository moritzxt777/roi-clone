'use client';

import { useEditorStore } from '@/stores/editor-store';
import { X, Image as ImageIcon, Check, Upload, ExternalLink } from 'lucide-react';
import { useState, useMemo } from 'react';

export function ImagesModal() {
  const { activeModal, setActiveModal, html, updateHtml, sourceUrl } = useEditorStore();
  const [selectedImg, setSelectedImg] = useState<{ src: string; alt: string } | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [success, setSuccess] = useState(false);

  const images = useMemo(() => {
    if (!html) return [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const list: { src: string; alt: string }[] = [];

      doc.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src');
        if (src) {
          list.push({ src, alt: img.getAttribute('alt') || 'Imagem' });
        }
      });

      return list;
    } catch {
      return [];
    }
  }, [html]);

  if (activeModal !== 'images') return null;

  const handleReplaceImage = () => {
    if (!selectedImg || !newUrl) return;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      doc.querySelectorAll('img').forEach((img) => {
        if (img.getAttribute('src') === selectedImg.src) {
          img.setAttribute('src', newUrl);
        }
      });

      updateHtml(doc.documentElement.outerHTML);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      setSelectedImg(null);
      setNewUrl('');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#0d0e14] border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Galeria de Imagens da Página</h3>
              <p className="text-xs text-neutral-400">Substitua imagens da página com um clique</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('none')}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Image Editor */}
        {selectedImg && (
          <div className="mt-4 p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-300">Substituir Imagem Selecionada</span>
              <button
                onClick={() => setSelectedImg(null)}
                className="text-[11px] text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>
            <div className="flex gap-4 items-center">
              <div className="w-20 h-20 rounded-lg bg-black/40 border border-white/10 p-1 flex items-center justify-center shrink-0">
                <img src={selectedImg.src} alt="Original" className="max-h-full max-w-full object-contain rounded" />
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="Cole a nova URL da imagem (https://...)"
                  className="w-full bg-[#151722] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  onClick={handleReplaceImage}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Aplicar Nova Imagem</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Grid de Imagens */}
        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setSelectedImg(img);
                  setNewUrl(img.src);
                }}
                className="group relative rounded-xl border border-white/5 bg-white/[0.02] hover:border-blue-500/50 hover:bg-blue-500/5 p-2 flex flex-col items-center justify-center aspect-square cursor-pointer transition-all overflow-hidden"
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  className="max-h-[75%] max-w-[85%] object-contain group-hover:scale-105 transition-transform"
                />
                <span className="mt-2 text-[10px] font-mono text-neutral-400 group-hover:text-white truncate w-full text-center px-1">
                  {img.alt || 'Imagem ' + (idx + 1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {success && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Imagem substituída na página com sucesso!</span>
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
