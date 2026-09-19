'use client';

import { useEditorStore } from '@/stores/editor-store';
import { X, Code2, Check, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

export function ScriptsModal() {
  const { activeModal, setActiveModal, cloneId } = useEditorStore();

  const [activeTab, setActiveTab] = useState<'pixels' | 'custom'>('pixels');
  const [fbPixel, setFbPixel] = useState('');
  const [tiktokPixel, setTiktokPixel] = useState('');
  const [gtmId, setGtmId] = useState('');
  const [customHead, setCustomHead] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [saved, setSaved] = useState(false);

  if (activeModal !== 'scripts') return null;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setActiveModal('none');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#0d0e14] border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Scripts e Pixels de Rastreamento</h3>
              <p className="text-xs text-neutral-400">Configure pixels de conversão e tags para a versão publicada</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('none')}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4 p-1 bg-white/5 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('pixels')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'pixels' ? 'bg-blue-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Pixels Rápidos (Facebook / TikTok / GTM)
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'custom' ? 'bg-blue-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Scripts Customizados (Head / Body)
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {activeTab === 'pixels' ? (
            <>
              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                  Facebook Pixel ID
                </label>
                <input
                  type="text"
                  value={fbPixel}
                  onChange={(e) => setFbPixel(e.target.value)}
                  placeholder="Ex: 123456789012345"
                  className="w-full bg-[#151722] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                  TikTok Pixel ID
                </label>
                <input
                  type="text"
                  value={tiktokPixel}
                  onChange={(e) => setTiktokPixel(e.target.value)}
                  placeholder="Ex: C1234567890ABCDEF"
                  className="w-full bg-[#151722] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                  Google Tag Manager ID
                </label>
                <input
                  type="text"
                  value={gtmId}
                  onChange={(e) => setGtmId(e.target.value)}
                  placeholder="Ex: GTM-XXXXXXX"
                  className="w-full bg-[#151722] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                  Script no Head (&lt;head&gt;)
                </label>
                <textarea
                  value={customHead}
                  onChange={(e) => setCustomHead(e.target.value)}
                  rows={3}
                  placeholder="<script>/* Seu código aqui */</script>"
                  className="w-full bg-[#151722] border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 font-mono resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                  Script no Body (&lt;body&gt;)
                </label>
                <textarea
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  rows={3}
                  placeholder="<noscript>...</noscript>"
                  className="w-full bg-[#151722] border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 font-mono resize-none"
                />
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Por segurança, scripts só rodam na versão final publicada da página, nunca dentro do editor.</span>
              </div>
            </>
          )}

          {saved && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Configurações salvas com sucesso!</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
            >
              <span>Salvar Pixels</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
