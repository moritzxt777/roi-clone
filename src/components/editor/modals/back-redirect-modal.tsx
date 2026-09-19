'use client';

import { useEditorStore } from '@/stores/editor-store';
import { X, Undo2, Check, Sparkles, ShieldCheck, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export function BackRedirectModal() {
  const { activeModal, setActiveModal, html, updateHtml } = useEditorStore();

  const [enabled, setEnabled] = useState(true);
  const [redirectUrl, setRedirectUrl] = useState('');
  const [success, setSuccess] = useState(false);

  if (activeModal !== 'back-redirect') return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!redirectUrl && enabled) return;

    try {
      const scriptCode = `
<!-- ROI Clone: Back-Redirect Script -->
<script>
(function() {
  var redirectTarget = "${redirectUrl.trim()}";
  if (!redirectTarget) return;

  window.history.pushState({ page: 1 }, "", "");
  window.history.pushState({ page: 2 }, "", "");

  window.addEventListener("popstate", function(event) {
    window.location.replace(redirectTarget);
  });
})();
</script>
<!-- /ROI Clone: Back-Redirect Script -->
`;

      let updatedHtml = html;
      // Remove previous back-redirect script if existing
      updatedHtml = updatedHtml.replace(/<!-- ROI Clone: Back-Redirect Script -->[\s\S]*?<!-- \/ROI Clone: Back-Redirect Script -->/g, '');

      if (enabled) {
        if (updatedHtml.includes('</body>')) {
          updatedHtml = updatedHtml.replace('</body>', `${scriptCode}</body>`);
        } else {
          updatedHtml += scriptCode;
        }
      }

      updateHtml(updatedHtml);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setActiveModal('none');
      }, 1500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0d0e14] border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Undo2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Back-Redirect (Anti-Abandono)</h3>
              <p className="text-xs text-neutral-400">Recupere até 35% das vendas quando o cliente tentar sair</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('none')}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleApply} className="mt-5 space-y-4">
          {/* Toggle Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#141722] border border-white/5">
            <div>
              <span className="text-xs font-semibold text-white block">Ativar Redirecionamento no Botão Voltar</span>
              <span className="text-[11px] text-neutral-400 block">Captura o clique no "Voltar" do navegador ou celular</span>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                enabled ? 'bg-blue-600' : 'bg-neutral-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {enabled && (
            <div>
              <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                URL de Destino do Redirecionamento:
              </label>
              <input
                type="url"
                required
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="Ex: https://checkout.com/desconto-especial ou link do WhatsApp"
                className="w-full bg-[#151722] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          )}

          <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 text-blue-300 text-[11px] flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Dica de Alta Conversão:</strong> Redirecione o cliente que tenta sair para uma página de downsell com 50% de desconto ou para o WhatsApp com suporte!
            </span>
          </div>

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Back-Redirect configurado com sucesso!</span>
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
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-500/25"
            >
              <span>Aplicar Configuração</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
