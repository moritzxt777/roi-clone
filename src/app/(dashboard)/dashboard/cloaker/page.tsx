'use client';

import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Layers, 
  Globe, 
  Smartphone, 
  Bot, 
  Server, 
  ExternalLink, 
  Save, 
  CheckCircle2, 
  RefreshCw, 
  Eye, 
  Copy,
  AlertTriangle,
  Play,
  Plus,
  Trash2,
  X,
  Link as LinkIcon,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { CloakerConfig, DEFAULT_CLOAKER_CONFIG } from '@/lib/cloaker-engine';

interface PageItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  domain?: string;
  url: string;
  isExternal?: boolean;
  cloaker: CloakerConfig;
}

export default function CloakerDashboardPage() {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [cloaker, setCloaker] = useState<CloakerConfig>(DEFAULT_CLOAKER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ isBlocked: boolean; message: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modal para Nova Oferta Externa
  const [showModal, setShowModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newBlackUrl, setNewBlackUrl] = useState('');
  const [newWhiteUrl, setNewWhiteUrl] = useState('https://g1.globo.com/');
  const [newBlackAction, setNewBlackAction] = useState<'redirect' | 'iframe'>('redirect');
  const [newCustomSlug, setNewCustomSlug] = useState('');
  const [creatingExternal, setCreatingExternal] = useState(false);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cloaker');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPages(data);
        if (data.length > 0) {
          const defaultPage = data.find((p) => p.id === selectedPageId) || data[0];
          setSelectedPageId(defaultPage.id);
          setCloaker(defaultPage.cloaker || DEFAULT_CLOAKER_CONFIG);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPage = (pageId: string) => {
    setSelectedPageId(pageId);
    setTestResult(null);
    const found = pages.find((p) => p.id === pageId);
    if (found) {
      setCloaker(found.cloaker || DEFAULT_CLOAKER_CONFIG);
    }
  };

  const handleSave = async () => {
    if (!selectedPageId) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/cloaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: selectedPageId,
          cloaker,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        setPages((prev) =>
          prev.map((p) => (p.id === selectedPageId ? { ...p, cloaker } : p))
        );
      } else {
        alert('Erro ao salvar configurações do cloaker.');
      }
    } catch (e) {
      alert('Erro de conexão ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName || !newBlackUrl) {
      alert('Por favor, informe o Nome da Campanha e a URL da Oferta Externa.');
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

      const data = await res.json();
      if (res.ok && data.pageId) {
        setShowModal(false);
        setNewCampaignName('');
        setNewBlackUrl('');
        setNewCustomSlug('');
        await fetchPages();
        setSelectedPageId(data.pageId);
        setCloaker(data.cloaker);
      } else {
        alert(data.error || 'Erro ao criar oferta cloakeada.');
      }
    } catch (err) {
      alert('Erro ao conectar com o servidor.');
    } finally {
      setCreatingExternal(false);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta campanha de Cloaker?')) return;
    try {
      const res = await fetch(`/api/cloaker?pageId=${pageId}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = pages.filter((p) => p.id !== pageId);
        setPages(remaining);
        if (remaining.length > 0) {
          setSelectedPageId(remaining[0].id);
          setCloaker(remaining[0].cloaker || DEFAULT_CLOAKER_CONFIG);
        } else {
          setSelectedPageId('');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  const copyCloakerLink = () => {
    if (!selectedPage) return;
    const fullUrl = `${window.location.origin}${selectedPage.url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const runSimulation = (asBot: boolean) => {
    if (!cloaker.enabled) {
      setTestResult({
        isBlocked: false,
        message: 'O Cloaker está DESATIVADO. Todo o tráfego acessa a Black Page normalmente.',
      });
      return;
    }

    if (asBot && cloaker.filterBots) {
      setTestResult({
        isBlocked: true,
        message: `Robô detectado (facebookexternalhit/1.1)! Tráfego direcionado para a White Page (${
          cloaker.action === 'redirect_white' ? 'Redirecionamento 302' : 'Renderizado na Mesma URL'
        }).`,
      });
    } else {
      const targetOffer = cloaker.blackPageUrl || 'Página Clonada no ROI Clone';
      setTestResult({
        isBlocked: false,
        message: `Lead Limpo Aprovado! Usuário direcionado para a Oferta Real: ${targetOffer}`,
      });
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-neutral-400">
          <RefreshCw className="w-5 h-5 animate-spin text-purple-500" />
          <span>Carregando módulos de Cloaker...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Módulo de Cloaker Nativo
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
              Universal & Externo
            </span>
          </div>
          <p className="text-sm text-neutral-400">
            Cloakeie qualquer oferta externa (Kiwify, Hotmart, Monetizze, PerfectPay, Shopify) ou página do ROI Clone. Entregue uma White Page limpa para robôs e a Black Page para leads reais.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-purple-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            + Nova Oferta Externa
          </button>

          {selectedPage && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-bold transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          Configurações do Cloaker salvas e ativas com sucesso!
        </div>
      )}

      {/* Modal Criar Nova Oferta Externa */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0e1117] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Criar Link de Cloaker para Oferta Externa</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExternal} className="space-y-4">
              <div>
                <label className="text-xs text-neutral-300 font-semibold block mb-1.5">
                  Nome da Campanha
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Método Emagrecimento Kiwify"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-300 font-semibold block mb-1.5">
                  URL da Oferta Externa (Black Page) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://checkout.kiwify.com.br/... ou link da sua oferta"
                  value={newBlackUrl}
                  onChange={(e) => setNewBlackUrl(e.target.value)}
                  className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <span className="text-[10px] text-neutral-500 mt-1 block">
                  Link de checkout, VSL externa ou página que os leads reais verão.
                </span>
              </div>

              <div>
                <label className="text-xs text-neutral-300 font-semibold block mb-1.5">
                  URL da Página Limpa (White Page) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://g1.globo.com/saude ou advertorial seguro"
                  value={newWhiteUrl}
                  onChange={(e) => setNewWhiteUrl(e.target.value)}
                  className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <span className="text-[10px] text-neutral-500 mt-1 block">
                  Página que os robôs e revisores do Facebook/TikTok verão.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-300 font-semibold block mb-1.5">
                    Modo de Entrega Black
                  </label>
                  <select
                    value={newBlackAction}
                    onChange={(e) => setNewBlackAction(e.target.value as any)}
                    className="w-full bg-[#141822] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="redirect">Redirecionamento 302</option>
                    <option value="iframe">Iframe Transparente</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-neutral-300 font-semibold block mb-1.5">
                    Slug / Link Personalizado
                  </label>
                  <input
                    type="text"
                    placeholder="minha-oferta"
                    value={newCustomSlug}
                    onChange={(e) => setNewCustomSlug(e.target.value)}
                    className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

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
          <h3 className="text-base font-semibold text-white">Nenhuma oferta ou link cloakeado ainda</h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Você pode criar um link de cloaker para <b>qualquer oferta externa</b> (Kiwify, Hotmart, etc.) ou usar páginas já clonadas no ROI Clone.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-600/20 hover:from-purple-500 hover:to-indigo-500"
            >
              + Criar Link para Oferta Externa
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
          {/* Seletor de Campanha / Link */}
          <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Campanha / Link de Cloaker Ativo
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
                className="w-full bg-[#141822] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
              >
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.slug}) • {p.isExternal ? '🌐 [OFERTA EXTERNA]' : '📄 [CLONE ROI]'} {p.cloaker?.enabled ? '🟢 [ATIVO]' : '⚪ [DESATIVADO]'}
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
                  {copiedLink ? 'Copiado!' : 'Copiar Link'}
                </button>

                <a
                  href={selectedPage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir Link
                </a>
              </div>
            )}
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-neutral-400 uppercase font-semibold">Status do Cloaker</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${cloaker.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
                  <span className="text-base font-bold text-white">
                    {cloaker.enabled ? 'Protegendo' : 'Desativado'}
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

            <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5">
              <span className="text-[11px] text-neutral-400 uppercase font-semibold">Total de Cliques</span>
              <div className="text-xl font-bold text-white mt-1">
                {cloaker.stats?.totalHits || 0}
              </div>
            </div>

            <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5">
              <span className="text-[11px] text-emerald-400 uppercase font-semibold">Leads Reais (Black)</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {cloaker.stats?.blackHits || 0}
              </div>
            </div>

            <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5">
              <span className="text-[11px] text-purple-400 uppercase font-semibold">Robôs Filtrados (White)</span>
              <div className="text-xl font-bold text-purple-400 mt-1">
                {cloaker.stats?.whiteHits || 0}
              </div>
            </div>
          </div>

          {/* Configurações da Black Page e White Page */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Black Page (Oferta Real) */}
            <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Black Page (Oferta Real / Destino dos Leads)
                </h3>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1.5">
                  URL da Oferta Externa
                </label>
                <input
                  type="url"
                  placeholder="https://kiwify.com.br/... ou deixe em branco se for página clonada"
                  value={cloaker.blackPageUrl || ''}
                  onChange={(e) => setCloaker((prev) => ({ ...prev, blackPageUrl: e.target.value }))}
                  className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <span className="text-[11px] text-neutral-500 mt-1 block">
                  {cloaker.blackPageUrl 
                    ? '✓ Oferta externa configurada. O lead limpo será enviado para este link.' 
                    : 'ℹ️ Usando a página clonada hospedada no ROI Clone.'}
                </span>
              </div>

              {cloaker.blackPageUrl && (
                <div>
                  <label className="text-xs text-neutral-400 block mb-1.5">
                    Modo de Abertura da Black Page
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCloaker((prev) => ({ ...prev, blackAction: 'redirect' }))}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                        (cloaker.blackAction || 'redirect') === 'redirect'
                          ? 'border-emerald-500 bg-emerald-500/10 text-white font-semibold'
                          : 'border-white/5 bg-white/[0.02] text-neutral-400'
                      }`}
                    >
                      <div className="font-bold text-white">Redirecionar 302</div>
                      <div className="text-[10px] text-neutral-400">Direto ao checkout</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCloaker((prev) => ({ ...prev, blackAction: 'iframe' }))}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                        cloaker.blackAction === 'iframe'
                          ? 'border-emerald-500 bg-emerald-500/10 text-white font-semibold'
                          : 'border-white/5 bg-white/[0.02] text-neutral-400'
                      }`}
                    >
                      <div className="font-bold text-white">Iframe Integrado</div>
                      <div className="text-[10px] text-neutral-400">Sem mudar a URL</div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* White Page (Página Segura para Robôs) */}
            <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  White Page (Página Segura para os Robôs)
                </h3>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1.5">
                  URL da White Page
                </label>
                <input
                  type="url"
                  placeholder="https://g1.globo.com/ ou URL de um advertorial"
                  value={cloaker.whitePageUrl || ''}
                  onChange={(e) => setCloaker((prev) => ({ ...prev, whitePageUrl: e.target.value }))}
                  className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1.5">
                  Comportamento para o Robô/Revisor
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCloaker((prev) => ({ ...prev, action: 'show_white' }))}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                      cloaker.action === 'show_white'
                        ? 'border-purple-500 bg-purple-500/10 text-white font-semibold'
                        : 'border-white/5 bg-white/[0.02] text-neutral-400'
                    }`}
                  >
                    <div className="font-bold text-white">Renderizar Direto</div>
                    <div className="text-[10px] text-neutral-400">Mesma URL</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCloaker((prev) => ({ ...prev, action: 'redirect_white' }))}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                      cloaker.action === 'redirect_white'
                        ? 'border-purple-500 bg-purple-500/10 text-white font-semibold'
                        : 'border-white/5 bg-white/[0.02] text-neutral-400'
                    }`}
                  >
                    <div className="font-bold text-white">Redirecionar 302</div>
                    <div className="text-[10px] text-neutral-400">Envia para a White</div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros Ativos */}
          <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Filtros e Escudos de Tráfego
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2.5">
                  <Bot className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">Robôs de Anúncio</div>
                    <div className="text-[10px] text-neutral-500">Facebook, TikTok, Google</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={cloaker.filterBots}
                  onChange={(e) => setCloaker((prev) => ({ ...prev, filterBots: e.target.checked }))}
                  className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2.5">
                  <Server className="w-4 h-4 text-indigo-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">Datacenters / Nuvem</div>
                    <div className="text-[10px] text-neutral-500">AWS, Google Cloud, Azure</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={cloaker.filterDatacenters}
                  onChange={(e) => setCloaker((prev) => ({ ...prev, filterDatacenters: e.target.checked }))}
                  className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">Filtro Dispositivo</div>
                    <div className="text-[10px] text-neutral-500">
                      {cloaker.deviceFilter === 'mobile_only' ? 'Apenas Celular' : 'Todos os Dispositivos'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCloaker((prev) => ({
                      ...prev,
                      deviceFilter: prev.deviceFilter === 'mobile_only' ? 'all' : 'mobile_only',
                    }))
                  }
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                    cloaker.deviceFilter === 'mobile_only'
                      ? 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                      : 'bg-white/5 text-neutral-400 border-white/10'
                  }`}
                >
                  {cloaker.deviceFilter === 'mobile_only' ? 'MOBILE ONLY' : 'TODOS'}
                </button>
              </div>
            </div>
          </div>

          {/* Simulador */}
          <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Simulador de Teste em Tempo Real
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Verifique como o Cloaker reage antes de injetar orçamento na sua campanha.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => runSimulation(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  Simular Lead Comum
                </button>

                <button
                  type="button"
                  onClick={() => runSimulation(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold hover:bg-purple-500/20 transition-colors"
                >
                  <Bot className="w-3 h-3" />
                  Simular Robô do Facebook
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-3 animate-in fade-in ${
                  testResult.isBlocked
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {testResult.isBlocked ? (
                  <ShieldAlert className="w-5 h-5 shrink-0 text-purple-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
