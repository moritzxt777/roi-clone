'use client';

import { useEditorStore } from '@/stores/editor-store';
import { X, Timer, Check, Sparkles, Flame } from 'lucide-react';
import { useState } from 'react';

export function TimerModal() {
  const { activeModal, setActiveModal, html, updateHtml } = useEditorStore();

  const [message, setMessage] = useState('🔥 PROMOÇÃO EXCLUSIVA: Frete Grátis e 50% OFF expiram em:');
  const [minutes, setMinutes] = useState(15);
  const [barColor, setBarColor] = useState('#dc2626');
  const [success, setSuccess] = useState(false);

  if (activeModal !== 'timer') return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const bannerHtml = `
<!-- ROI Clone: Scarcity Timer Bar -->
<div id="roi-scarcity-bar" style="position:fixed;top:0;left:0;right:0;z-index:999999;background-color:${barColor};color:#ffffff;padding:10px 16px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;gap:8px;">
  <span>${message}</span>
  <span id="roi-countdown-display" style="background:rgba(0,0,0,0.25);padding:3px 8px;border-radius:6px;font-family:monospace;font-size:14px;letter-spacing:1px;">${String(minutes).padStart(2, '0')}:00</span>
</div>
<style>
  body { padding-top: 45px !important; }
</style>
<script>
(function() {
  var duration = ${minutes} * 60;
  var display = document.getElementById('roi-countdown-display');
  if (!display) return;

  var timer = setInterval(function() {
    var m = Math.floor(duration / 60);
    var s = duration % 60;
    display.textContent = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
    if (--duration < 0) {
      clearInterval(timer);
      display.textContent = "00:00";
    }
  }, 1000);
})();
</script>
<!-- /ROI Clone: Scarcity Timer Bar -->
`;

      let updatedHtml = html;
      // Remove previous timer if present
      updatedHtml = updatedHtml.replace(/<!-- ROI Clone: Scarcity Timer Bar -->[\s\S]*?<!-- \/ROI Clone: Scarcity Timer Bar -->/g, '');

      if (updatedHtml.includes('<body')) {
        // Inserir logo no início do body
        const bodyTagMatch = updatedHtml.match(/<body[^>]*>/);
        if (bodyTagMatch) {
          updatedHtml = updatedHtml.replace(bodyTagMatch[0], `${bodyTagMatch[0]}${bannerHtml}`);
        } else {
          updatedHtml = bannerHtml + updatedHtml;
        }
      } else {
        updatedHtml = bannerHtml + updatedHtml;
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
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Barra de Escassez / Timer</h3>
              <p className="text-xs text-neutral-400">Insira uma contagem regressiva fixa no topo do site</p>
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
          <div>
            <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
              Mensagem de Urgência:
            </label>
            <input
              type="text"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-[#151722] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                Tempo (Minutos):
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-full bg-[#151722] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                Cor de Fundo da Barra:
              </label>
              <div className="flex items-center gap-2 bg-[#151722] border border-white/10 rounded-xl px-3 py-2">
                <input
                  type="color"
                  value={barColor}
                  onChange={(e) => setBarColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-xs font-mono text-white">{barColor}</span>
              </div>
            </div>
          </div>

          {/* Preview da barra */}
          <div className="p-2.5 rounded-xl border border-white/10 overflow-hidden text-center text-xs font-bold text-white shadow-inner flex items-center justify-center gap-2" style={{ backgroundColor: barColor }}>
            <span>{message}</span>
            <span className="bg-black/30 px-2 py-0.5 rounded font-mono text-xs">{String(minutes).padStart(2, '0')}:00</span>
          </div>

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Barra de escassez inserida no topo da página!</span>
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
              <span>Inserir Barra no Site</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
