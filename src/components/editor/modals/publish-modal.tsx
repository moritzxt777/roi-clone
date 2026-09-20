'use client';

import { useEditorStore } from '@/stores/editor-store';
import { 
  X, 
  Rocket, 
  Globe, 
  Check, 
  Copy, 
  ExternalLink, 
  ShieldCheck, 
  Loader2,
  Sparkles
} from 'lucide-react';
import { useState, useEffect } from 'react';

export function PublishModal() {
  const { activeModal, setActiveModal, cloneId, pageId, projectName, html, css } = useEditorStore();

  const [domains, setDomains] = useState<{ id: string; name: string; status: string }[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('platform');
  const [subdomain, setSubdomain] = useState(
    projectName ? projectName.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'oferta'
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [previewLocalUrl, setPreviewLocalUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeModal === 'publish') {
      fetch('/api/domains')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setDomains(data.filter((d) => d.status === 'VERIFIED'));
          }
        })
        .catch(console.error);
    }
  }, [activeModal]);

  if (activeModal !== 'publish') return null;

  const selectedCustomDomain = domains.find((d) => d.id === selectedDomainId);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      // 1. Salvar alterações pendentes
      await fetch(`/api/clones/${cloneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          html, 
          css,
          slug: subdomain.trim(),
          domainId: selectedDomainId 
        }),
      });

      // 2. Determinar URL final
      let finalUrl = '';
      let localUrl = '';
      const origin = window.location.origin;

      if (selectedDomainId === 'platform') {
        // Formato oficial: a pessoa escolhe o começo e o final é .roi-clone.site
        const cleanSub = subdomain.trim() || 'oferta';
        finalUrl = `https://${cleanSub}.roi-clone.site`;
        localUrl = `${origin}/p/${cleanSub}`;
      } else if (selectedCustomDomain) {
        // Domínio Próprio: sem o slug no final, exatamente na raiz do domínio!
        finalUrl = `https://${selectedCustomDomain.name}/`;
        localUrl = `${origin}/p/${subdomain}`;
      }

      setPublishedUrl(finalUrl);
      setPreviewLocalUrl(localUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPublishing(false);
    }
  };

  const copyLink = () => {
    if (!publishedUrl) return;
    navigator.clipboard.writeText(publishedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0d0e14] border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Publicar Página</h3>
              <p className="text-xs text-neutral-400">Escolha o subdomínio ou use seu próprio domínio</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('none')}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {publishedUrl ? (
          /* Estado de Publicação Concluída com Sucesso */
          <div className="mt-6 space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <Check className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-bold text-white">Sua página está no ar! 🎉</h4>
              <p className="text-xs text-neutral-400">
                A página clonada e customizada já está pronta para receber tráfego.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#141722] border border-white/10 flex items-center justify-between gap-3 text-left">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-0.5">Link Oficial:</span>
                <span className="text-xs font-mono font-bold text-blue-400 truncate block">{publishedUrl}</span>
              </div>
              <button
                onClick={copyLink}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <a
                href={previewLocalUrl || publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs flex items-center gap-2 shadow-lg transition-all"
              >
                <span>Testar Página</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setActiveModal('none')}
                className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-neutral-400 hover:text-white text-xs transition-colors"
              >
                Voltar ao Editor
              </button>
            </div>
          </div>
        ) : (
          /* Formulário de Configuração de Publicação */
          <div className="mt-5 space-y-4">
            {/* Escolha do Domínio */}
            <div>
              <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                Destino da Publicação:
              </label>
              <select
                value={selectedDomainId}
                onChange={(e) => setSelectedDomainId(e.target.value)}
                className="w-full bg-[#151722] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
              >
                <option value="platform">🌐 Subdomínio Gratuito (escolha o nome + .roi-clone.site)</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    🔒 Meu Domínio Próprio: https://{d.name}/ (Na raiz, sem barra no final)
                  </option>
                ))}
              </select>

              {domains.length === 0 && (
                <p className="mt-1.5 text-[11px] text-neutral-500 flex items-center gap-1">
                  <span>Quer usar seu próprio domínio? Configure em</span>
                  <a href="/dashboard/domains" target="_blank" className="text-blue-400 hover:underline">
                    Domínios Customizados
                  </a>
                </p>
              )}
            </div>

            {/* Se for Subdomínio da plataforma: A pessoa escolhe o começo e o final é .roi-clone.site */}
            {selectedDomainId === 'platform' ? (
              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                  Escolha o seu subdomínio:
                </label>
                <div className="flex items-center rounded-xl bg-[#151722] border border-white/10 px-3.5 py-2.5 text-xs font-mono">
                  <span className="text-neutral-500 select-none">https://</span>
                  <input
                    type="text"
                    required
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="meu-produto"
                    className="bg-transparent text-blue-400 font-bold focus:outline-none px-1 text-center min-w-[120px] flex-1"
                  />
                  <span className="text-neutral-400 font-semibold select-none">.roi-clone.site</span>
                </div>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Exemplo: <code>https://{subdomain || 'meu-produto'}.roi-clone.site</code>
                </p>
              </div>
            ) : (
              /* Se for Domínio Próprio: Mostra claramente que vai ficar na raiz sem o slug no final! */
              <div className="p-3.5 rounded-xl bg-[#151722] border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-neutral-500 block">Sua página será publicada na raiz:</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    https://{selectedCustomDomain?.name}/
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold">
                  Sem barra no final
                </span>
              </div>
            )}

            {/* Informações de infraestrutura */}
            <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-500/20 text-xs text-neutral-300 space-y-1.5">
              <div className="flex items-center gap-2 text-blue-400 font-semibold text-[11px]">
                <ShieldCheck className="w-4 h-4" />
                <span>Pronto para Conversão:</span>
              </div>
              <ul className="text-[11px] text-neutral-400 space-y-1 list-disc list-inside">
                <li>Certificado SSL HTTPS Ativado</li>
                <li>Back-Redirect e Pixels prontos para rodar</li>
                <li>Carregamento rápido em nuvem</li>
              </ul>
            </div>

            {/* Botão de Publicar */}
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
                onClick={handlePublish}
                disabled={isPublishing}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publicando...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-3.5 h-3.5" />
                    <span>Publicar Página Agora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
