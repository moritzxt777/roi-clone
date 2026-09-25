'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Globe,
  Bot,
  Server,
  ExternalLink,
  Save,
  CheckCircle2,
  Copy,
  AlertTriangle,
  Play,
  Plus,
  Trash2,
  X,
  Link as LinkIcon,
  Sparkles,
  Network,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import {
  DEFAULT_CLOAKER_CONFIG,
  DEFAULT_SUSPICION_THRESHOLD,
  evaluateCloaker,
  type CloakerConfig,
  type DeviceFilter,
} from '@/lib/cloaker-engine';

interface PageMetrics {
  totalHits: number;
  blackHits: number;
  whiteHits: number;
  lastHitAt: string | null;
  lastBlockedReason: string | null;
  lastBlockedVerdict: string | null;
}

interface PageItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  domain: string | null;
  url: string;
  isExternal: boolean;
  /** null means "never configured". Distinct from "configured and disabled". */
  cloaker: CloakerConfig | null;
  metrics: PageMetrics;
}

const EMPTY_METRICS: PageMetrics = {
  totalHits: 0,
  blackHits: 0,
  whiteHits: 0,
  lastHitAt: null,
  lastBlockedReason: null,
  lastBlockedVerdict: null,
};

const COUNTRY_PRESETS: Array<{ label: string; codes: string[] }> = [
  { label: 'Brasil', codes: ['BR'] },
  { label: 'Brasil + Portugal', codes: ['BR', 'PT'] },
  { label: 'LATAM', codes: ['BR', 'MX', 'AR', 'CL', 'CO', 'PE'] },
  { label: 'Iberoamérica', codes: ['BR', 'ES', 'MX', 'AR', 'CL', 'CO', 'PE', 'VE', 'UY', 'PY', 'BO', 'EC'] },
];

export default function CloakerDashboardPage() {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [cloaker, setCloaker] = useState<CloakerConfig>(DEFAULT_CLOAKER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [countryInput, setCountryInput] = useState('');
  const [simulation, setSimulation] = useState<ReturnType<typeof simulate> | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newBlackUrl, setNewBlackUrl] = useState('');
  const [newWhiteUrl, setNewWhiteUrl] = useState('');
  const [newBlackAction, setNewBlackAction] = useState<'redirect' | 'iframe'>('redirect');
  const [newCustomSlug, setNewCustomSlug] = useState('');
  const [creatingExternal, setCreatingExternal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchPages = useCallback(async (keepSelection = true) => {
    setLoading(true);
    try {
      const res = await fetch('/api/cloaker');
      const data = await res.json();
      if (!Array.isArray(data)) {
        setSaveError('Resposta inesperada do servidor.');
        return;
      }
      setPages(data);
      if (data.length > 0) {
        const keep = keepSelection ? data.find((p: PageItem) => p.id === selectedPageId) : null;
        const chosen = keep ?? data[0];
        setSelectedPageId(chosen.id);
        setCloaker(chosen.cloaker ?? DEFAULT_CLOAKER_CONFIG);
        setCountryInput((chosen.cloaker?.allowedCountries ?? ['BR']).join(', '));
      }
    } catch {
      setSaveError('Não foi possível carregar as campanhas.');
    } finally {
      setLoading(false);
    }
  }, [selectedPageId]);

  useEffect(() => {
    void fetchPages(false);
    // Only on mount: later refreshes are driven by the user actions above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPage = pages.find((p) => p.id === selectedPageId);
  const wasNeverConfigured = selectedPage ? selectedPage.cloaker === null : false;

  const handleSelectPage = (pageId: string) => {
    setSelectedPageId(pageId);
    setSaveError(null);
    const found = pages.find((p) => p.id === pageId);
    const next = found?.cloaker ?? DEFAULT_CLOAKER_CONFIG;
    setCloaker(next);
    setCountryInput((next.allowedCountries ?? ['BR']).join(', '));
  };

  const applyCountries = (raw: string) => {
    const parsed = raw
      .split(/[,\s]+/)
      .map((code) => code.trim().toUpperCase())
      .filter((code) => /^[A-Z]{2}$/.test(code));
    setCountryInput(raw);
    setCloaker((prev) => ({
      ...prev,
      allowedCountries: Array.from(new Set(parsed)),
    }));
  };

  const handleSave = async () => {
    if (!selectedPageId) return;
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const res = await fetch('/api/cloaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: selectedPageId, cloaker }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const detail = data?.fields?.map((f: { path: string; message: string }) => `${f.path}: ${f.message}`).join(' | ');
        setSaveError(detail || data?.error || 'Erro ao salvar a configuração.');
        return;
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await fetchPages();
    } catch {
      setSaveError('Erro de conexão ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newCampaignName || !newBlackUrl) {
      setCreateError('Informe o nome da campanha e a URL da oferta externa.');
      return;
    }

    setCreatingExternal(true);
    try {
      const res = await fetch('/api/cloaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isNewExternal: true,
          name: newCampaignName,
          slug: newCustomSlug,
          cloaker: {
            ...DEFAULT_CLOAKER_CONFIG,
            isExternalOffer: true,
            blackPageUrl: newBlackUrl,
            blackAction: newBlackAction,
            whitePageUrl: newWhiteUrl,
          },
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = data?.fields?.map((f: { path: string; message: string }) => `${f.path}: ${f.message}`).join(' | ');
        setCreateError(detail || data?.error || 'Erro ao criar a campanha.');
        return;
      }

      setShowModal(false);
      setNewCampaignName('');
      setNewBlackUrl('');
      setNewCustomSlug('');
      await fetchPages(false);
      if (data?.pageId) {
        setSelectedPageId(data.pageId);
        setCloaker(data.cloaker);
        setCountryInput((data.cloaker.allowedCountries ?? ['BR']).join(', '));
      }
    } catch {
      setCreateError('Erro de conexão com o servidor.');
    } finally {
      setCreatingExternal(false);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!confirm('Excluir esta página de cloaker? A ação não pode ser desfeita.')) return;
    try {
      const res = await fetch(`/api/cloaker?pageId=${pageId}`, { method: 'DELETE' });
      if (!res.ok) return;
      const remaining = pages.filter((p) => p.id !== pageId);
      setPages(remaining);
      if (remaining.length > 0) {
        setSelectedPageId(remaining[0].id);
        const next = remaining[0].cloaker ?? DEFAULT_CLOAKER_CONFIG;
        setCloaker(next);
        setCountryInput((next.allowedCountries ?? ['BR']).join(', '));
      } else {
        setSelectedPageId('');
      }
    } catch {
      setSaveError('Erro ao excluir a campanha.');
    }
  };

  const copyCloakerLink = () => {
    if (!selectedPage) return;
    navigator.clipboard.writeText(`${window.location.origin}${selectedPage.url}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
          <span>Carregando campanhas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Cloaker
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
              Sinal de rede
            </span>
          </div>
          <p className="text-sm text-neutral-400">
            Entrega a oferta para leads reais e uma página limpa para crawlers e revisores. O filtro
            decide por IP, User-Agent, PTR e sinais de navegador — não só por texto no User-Agent.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-purple-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nova Oferta Externa
          </button>
          {selectedPage && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-bold transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Configuração salva e já em vigor neste link.
        </div>
      )}
      {saveError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1117] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Cloaker para Oferta Externa</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExternal} className="space-y-4">
              <Field label="Nome da campanha" required>
                <input
                  type="text"
                  required
                  placeholder="Ex: Método Emagrecimento Kiwify"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="URL da oferta externa (Black Page)" required>
                <input
                  type="url"
                  required
                  placeholder="https://checkout.kiwify.com.br/..."
                  value={newBlackUrl}
                  onChange={(e) => setNewBlackUrl(e.target.value)}
                  className={inputClass}
                />
                <Hint>Para onde o lead aprovado vai. Deixe vazio se a oferta estiver clonada aqui.</Hint>
              </Field>

              <Field
                label="URL da página limpa (White Page)"
                hint="Opcional se você colar o HTML abaixo. Uma URL é servida com tag base para os assets carregarem."
              >
                <input
                  type="url"
                  placeholder="https://exemplo.com/artigo"
                  value={newWhiteUrl}
                  onChange={(e) => setNewWhiteUrl(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Abertura da Black Page">
                  <select
                    value={newBlackAction}
                    onChange={(e) => setNewBlackAction(e.target.value as 'redirect' | 'iframe')}
                    className={inputClass}
                  >
                    <option value="redirect">Redirecionar 302 (recomendado)</option>
                    <option value="iframe">Iframe (veja o aviso)</option>
                  </select>
                  {newBlackAction === 'iframe' && (
                    <Hint tone="warning">
                      Kiwify, Hotmart, Shopify e a maioria dos checkouts enviam X-Frame-Options: DENY
                      ou CSP frame-ancestors. Com iframe a oferta aparece em branco para o lead.
                    </Hint>
                  )}
                </Field>

                <Field label="Slug do link">
                  <input
                    type="text"
                    placeholder="minha-oferta"
                    value={newCustomSlug}
                    onChange={(e) => setNewCustomSlug(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              {createError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                  {createError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-neutral-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingExternal}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-md disabled:opacity-50"
                >
                  {creatingExternal ? 'Criando...' : 'Gerar Link Cloakeado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pages.length === 0 ? (
        <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-white">Nenhuma campanha cadastrada</h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Crie um link cloaker para qualquer oferta externa, ou ative o cloaker numa página já
            clonada aqui.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold"
            >
              + Nova Oferta Externa
            </button>
            <Link
              href="/dashboard/clones"
              className="px-4 py-2.5 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/15"
            >
              Clonar uma Página
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Campanha
                </label>
                {selectedPage && (
                  <button
                    onClick={() => handleDeletePage(selectedPage.id)}
                    className="text-neutral-500 hover:text-red-400 text-xs flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                )}
              </div>
              <select
                value={selectedPageId}
                onChange={(e) => handleSelectPage(e.target.value)}
                className={`${inputClass} font-medium`}
              >
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.slug}) — {p.isExternal ? 'oferta externa' : 'clone interno'}
                    {' · '}
                    {p.cloaker === null ? 'não configurado' : p.cloaker.enabled ? 'ativo' : 'desativado'}
                  </option>
                ))}
              </select>
            </div>

            {selectedPage && (
              <div className="flex items-center gap-2 pt-2 md:pt-6">
                <button
                  onClick={copyCloakerLink}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 transition-colors"
                >
                  {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Copiado' : 'Copiar Link'}
                </button>
                <a
                  href={selectedPage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir
                </a>
              </div>
            )}
          </div>

          {wasNeverConfigured && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Esta página nunca teve cloaker configurado — o Cloaker está{' '}
                <b>inativo</b> e todo o tráfego recebe a oferta normalmente. As opções abaixo são o
                estado inicial; salve para ativar.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-neutral-400 uppercase font-semibold">Estado</span>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      wasNeverConfigured
                        ? 'bg-neutral-600'
                        : cloaker.enabled
                          ? 'bg-emerald-400'
                          : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-base font-bold text-white">
                    {wasNeverConfigured ? 'Inativo' : cloaker.enabled ? 'Protegendo' : 'Desativado'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCloaker((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  cloaker.enabled ? 'bg-purple-600' : 'bg-neutral-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    cloaker.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <Metric label="Requisições" value={selectedPage?.metrics.totalHits ?? 0} />
            <Metric label="Leads liberados" value={selectedPage?.metrics.blackHits ?? 0} tone="text-emerald-400" />
            <Metric label="Bloqueados" value={selectedPage?.metrics.whiteHits ?? 0} tone="text-purple-400" />
          </div>

          {selectedPage?.metrics.lastBlockedReason && (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-xs">
              <div className="flex items-center gap-2 text-neutral-400 mb-1">
                <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                Último bloqueio
                {selectedPage.metrics.lastBlockedVerdict && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-500">
                    {selectedPage.metrics.lastBlockedVerdict}
                  </span>
                )}
                {selectedPage.metrics.lastHitAt && (
                  <span className="text-neutral-600 ml-auto">
                    {new Date(selectedPage.metrics.lastHitAt).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
              <p className="text-neutral-300">{selectedPage.metrics.lastBlockedReason}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Panel icon={LinkIcon} tone="text-emerald-400" title="Black Page — destino do lead">
              <Field label="URL da oferta externa">
                <input
                  type="url"
                  placeholder="https://checkout.kiwify.com.br/... (vazio = página clonada aqui)"
                  value={cloaker.blackPageUrl ?? ''}
                  onChange={(e) => setCloaker((prev) => ({ ...prev, blackPageUrl: e.target.value }))}
                  className={`${inputClass} font-mono`}
                />
                <Hint>
                  {cloaker.blackPageUrl
                    ? 'Lead aprovado é enviado para este link.'
                    : 'Sem URL, o lead vê a página clonada hospedada nesta plataforma.'}
                </Hint>
              </Field>

              {cloaker.blackPageUrl && (
                <Field label="Como abrir a oferta">
                  <div className="grid grid-cols-2 gap-2">
                    <ChoiceButton
                      active={cloaker.blackAction !== 'iframe'}
                      onClick={() => setCloaker((prev) => ({ ...prev, blackAction: 'redirect' }))}
                      title="Redirecionar 302"
                      subtitle="Recomendado para checkout"
                    />
                    <ChoiceButton
                      active={cloaker.blackAction === 'iframe'}
                      onClick={() => setCloaker((prev) => ({ ...prev, blackAction: 'iframe' }))}
                      title="Iframe"
                      subtitle="Sem trocar a URL"
                    />
                  </div>
                  {cloaker.blackAction === 'iframe' && (
                    <Hint tone="warning">
                      A maioria dos checkouts bloqueia exibição em iframe com X-Frame-Options: DENY
                      ou CSP frame-ancestors. Nesse modo o lead pode ver uma área em branco — que é
                      pior que um redirecionamento. Use apenas se você já confirmou que a oferta
                      permite embed.
                    </Hint>
                  )}
                </Field>
              )}
            </Panel>

            <Panel icon={Globe} tone="text-purple-400" title="White Page — o que o robô vê">
              <Field label="HTML da página limpa">
                <textarea
                  rows={5}
                  placeholder="Cole aqui o HTML completo da página que o revisor deve ver"
                  value={cloaker.whitePageHtml ?? ''}
                  onChange={(e) => setCloaker((prev) => ({ ...prev, whitePageHtml: e.target.value }))}
                  className={`${inputClass} font-mono text-[11px] resize-y`}
                />
                <Hint>
                  Preferível a uma URL: servido no seu domínio, todos os assets resolvem e o
                  revisor não recebe uma página quebrada.
                </Hint>
              </Field>

              <Field label="URL alternativa">
                <input
                  type="url"
                  placeholder="https://exemplo.com/artigo (usado se o HTML acima estiver vazio)"
                  value={cloaker.whitePageUrl ?? ''}
                  onChange={(e) => setCloaker((prev) => ({ ...prev, whitePageUrl: e.target.value }))}
                  className={`${inputClass} font-mono`}
                />
              </Field>

              <Field label="Entrega para o revisor">
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceButton
                    active={cloaker.action !== 'redirect_white'}
                    onClick={() => setCloaker((prev) => ({ ...prev, action: 'show_white' }))}
                    title="Servir aqui"
                    subtitle="Mesma URL, sem redirect"
                  />
                  <ChoiceButton
                    active={cloaker.action === 'redirect_white'}
                    onClick={() => setCloaker((prev) => ({ ...prev, action: 'redirect_white' }))}
                    title="Redirecionar 302"
                    subtitle="Leva para a white page"
                  />
                </div>
              </Field>
            </Panel>
          </div>

          <Panel icon={ShieldAlert} tone="text-purple-400" title="Filtros de tráfego">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Toggle
                icon={Bot}
                tone="text-blue-400"
                title="Crawlers e automação"
                subtitle="Facebook, TikTok, Google, curl, Playwright"
                checked={cloaker.filterBots}
                onChange={(v) => setCloaker((prev) => ({ ...prev, filterBots: v }))}
              />
              <Toggle
                icon={Server}
                tone="text-indigo-400"
                title="Datacenter / nuvem"
                subtitle="Só bloqueia com sinal corroborado"
                checked={cloaker.filterDatacenters}
                onChange={(v) => setCloaker((prev) => ({ ...prev, filterDatacenters: v }))}
              />
              <Toggle
                icon={Network}
                tone="text-cyan-400"
                title="Verificar PTR"
                subtitle="Confere o DNS reverso do IP"
                checked={cloaker.reverseDnsCheck !== false}
                onChange={(v) => setCloaker((prev) => ({ ...prev, reverseDnsCheck: v }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <Field label="Países permitidos" hint="Vazio desativa o filtro geográfico. Ex.: BR, PT">
                <input
                  type="text"
                  value={countryInput}
                  onChange={(e) => applyCountries(e.target.value)}
                  placeholder="BR"
                  className={`${inputClass} font-mono uppercase`}
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {COUNTRY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyCountries(preset.codes.join(', '))}
                      className="px-2 py-1 rounded-md text-[10px] font-semibold bg-white/5 border border-white/10 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field
                label="Quando o país não pode ser verificado"
                hint="O header de país só existe atrás de Cloudflare ou Vercel. Fail-closed bloqueia o tráfego em vez de liberá-lo."
              >
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceButton
                    active={cloaker.geoFailClosed !== false}
                    onClick={() => setCloaker((prev) => ({ ...prev, geoFailClosed: true }))}
                    title="Bloquear (fail-closed)"
                    subtitle="Recomendado"
                  />
                  <ChoiceButton
                    active={cloaker.geoFailClosed === false}
                    onClick={() => setCloaker((prev) => ({ ...prev, geoFailClosed: false }))}
                    title="Liberar (fail-open)"
                    subtitle="Só com proxy de país"
                  />
                </div>
              </Field>

              <Field label="Dispositivo">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['all', 'Todos'],
                      ['mobile_only', 'Só celular'],
                      ['desktop_only', 'Só desktop'],
                    ] as Array<[DeviceFilter, string]>
                  ).map(([value, label]) => (
                    <ChoiceButton
                      key={value}
                      active={cloaker.deviceFilter === value}
                      onClick={() => setCloaker((prev) => ({ ...prev, deviceFilter: value }))}
                      title={label}
                    />
                  ))}
                </div>
              </Field>

              <Field
                label={`Limiar de suspeita (${cloaker.suspicionThreshold ?? DEFAULT_SUSPICION_THRESHOLD})`}
                hint="Pontos acumulados pelos sinais de rede. Menor = mais agressivo."
              >
                <input
                  type="range"
                  min={20}
                  max={160}
                  step={5}
                  value={cloaker.suspicionThreshold ?? DEFAULT_SUSPICION_THRESHOLD}
                  onChange={(e) =>
                    setCloaker((prev) => ({ ...prev, suspicionThreshold: Number(e.target.value) }))
                  }
                  className="w-full accent-purple-600"
                />
              </Field>
            </div>
          </Panel>

          <Panel icon={Play} tone="text-emerald-400" title="Simulador — roda o motor real">
            <p className="text-xs text-neutral-400">
              Cada botão monta uma requisição de exemplo e a passa pelo mesmo
              <code className="text-neutral-300"> evaluateCloaker</code> que o link usa em produção.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <SimButton
                tone="emerald"
                onClick={() =>
                  setSimulation(
                    simulate(cloaker, {
                      label: 'Lead real no celular',
                      userAgent:
                        'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                      clientIp: '189.45.20.10',
                      country: 'BR',
                      browser: true,
                    })
                  )
                }
              >
                Lead comum
              </SimButton>
              <SimButton
                tone="emerald"
                onClick={() =>
                  setSimulation(
                    simulate(cloaker, {
                      label: 'Lead no desktop',
                      userAgent:
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                      clientIp: '200.160.2.3',
                      country: 'BR',
                      browser: true,
                    })
                  )
                }
              >
                Lead no desktop
              </SimButton>
              <SimButton
                tone="purple"
                onClick={() =>
                  setSimulation(
                    simulate(cloaker, {
                      label: 'Crawler do Facebook',
                      userAgent: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                      clientIp: '157.240.1.1',
                      country: 'BR',
                      browser: false,
                    })
                  )
                }
              >
                Crawler do Facebook
              </SimButton>
              <SimButton
                tone="purple"
                onClick={() =>
                  setSimulation(
                    simulate(cloaker, {
                      label: 'Revisor com IP de nuvem e UA de navegador',
                      userAgent:
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                      clientIp: '52.95.1.1',
                      country: 'BR',
                      browser: true,
                      ptr: 'ec2-1-2-3-4.compute-1.amazonaws.com',
                      ptrKind: 'datacenter',
                    })
                  )
                }
              >
                Revisor em nuvem
              </SimButton>
              <SimButton
                tone="amber"
                onClick={() =>
                  setSimulation(
                    simulate(cloaker, {
                      label: 'Robô com User-Agent falsificado',
                      userAgent:
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                      clientIp: '189.45.20.10',
                      country: 'BR',
                      browser: false,
                    })
                  )
                }
              >
                UA falsificado
              </SimButton>
              <SimButton
                tone="red"
                onClick={() =>
                  setSimulation(
                    simulate(cloaker, {
                      label: 'Lead fora do país permitido',
                      userAgent:
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                      clientIp: '8.8.8.8',
                      country: 'US',
                      browser: true,
                    })
                  )
                }
              >
                Lead fora do país
              </SimButton>
            </div>

            {simulation && (
              <div
                className={`p-4 rounded-xl border text-xs font-medium ${
                  simulation.blocked
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold mb-1">
                  {simulation.blocked ? (
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  {simulation.label}: {simulation.blocked ? 'BLOQUEADO' : 'liberado para a oferta'}
                </div>
                <p className="opacity-90">{simulation.detail}</p>
                <p className="mt-1 font-mono text-[10px] opacity-60">
                  verdict={simulation.verdict}
                  {simulation.score > 0 ? ` score=${simulation.score}` : ''}
                </p>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

interface SimulationInput {
  label: string;
  userAgent: string;
  clientIp: string;
  country: string;
  browser: boolean;
  ptr?: string;
  ptrKind?: 'verified-crawler' | 'datacenter' | 'residential' | 'unknown';
}

function simulate(config: CloakerConfig, input: SimulationInput) {
  const headers = new Headers({
    'user-agent': input.userAgent,
    'cf-ipcountry': input.country,
  });
  if (input.browser) {
    headers.set('sec-ch-ua', '"Chromium";v="124"');
    headers.set('sec-fetch-dest', 'document');
    headers.set('sec-fetch-mode', 'navigate');
    headers.set('accept', 'text/html,application/xhtml+xml,*/*;q=0.8');
    headers.set('accept-language', 'pt-BR,pt;q=0.9');
  }

  const result = evaluateCloaker(headers, config, {
    clientIp: input.clientIp,
    ipSource: 'cf-connecting-ip',
    ptr: input.ptr ?? null,
    ptrKind: input.ptrKind ?? 'unknown',
  });

  const detail = result.isBlocked
    ? (result.reason ?? 'Bloqueado por regra padrão.')
    : config.blackPageUrl
      ? `Segue para ${config.blackPageUrl}`
      : 'Segue para a página clonada nesta plataforma.';

  return {
    label: input.label,
    blocked: result.isBlocked,
    detail,
    verdict: result.verdict,
    score: result.signals.suspicionScore,
  };
}

// --- presentation helpers -------------------------------------------------

const inputClass =
  'w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 placeholder:text-neutral-600';

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-neutral-300 font-semibold block mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

function Hint({ children, tone }: { children: React.ReactNode; tone?: 'warning' }) {
  return (
    <span
      className={`text-[10px] mt-1 block ${
        tone === 'warning' ? 'text-amber-400' : 'text-neutral-500'
      }`}
    >
      {children}
    </span>
  );
}

function Panel({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  tone: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${tone}`} />
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'text-white',
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5">
      <span className="text-[11px] text-neutral-400 uppercase font-semibold">{label}</span>
      <div className={`text-xl font-bold mt-1 ${tone}`}>{value.toLocaleString('pt-BR')}</div>
    </div>
  );
}

function Toggle({
  icon: Icon,
  tone,
  title,
  subtitle,
  checked,
  onChange,
}: {
  icon: typeof Bot;
  tone: string;
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
      <div className="flex items-center gap-2.5">
        <Icon className={`w-4 h-4 ${tone}`} />
        <div>
          <div className="text-xs font-semibold text-white">{title}</div>
          <div className="text-[10px] text-neutral-500">{subtitle}</div>
        </div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
      />
    </label>
  );
}

function ChoiceButton({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
        active
          ? 'border-purple-500 bg-purple-500/10 text-white'
          : 'border-white/5 bg-white/[0.02] text-neutral-400 hover:border-white/15'
      }`}
    >
      <div className="font-bold">{title}</div>
      {subtitle && <div className="text-[10px] opacity-70 mt-0.5">{subtitle}</div>}
    </button>
  );
}

function SimButton({
  tone,
  onClick,
  children,
}: {
  tone: 'emerald' | 'purple' | 'amber' | 'red';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const tones = {
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20',
    red: 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
