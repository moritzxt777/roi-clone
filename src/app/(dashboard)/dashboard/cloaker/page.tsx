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
  Play
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
        if (data.length > 0 && !selectedPageId) {
          setSelectedPageId(data[0].id);
          setCloaker(data[0].cloaker || DEFAULT_CLOAKER_CONFIG);
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
        // Atualiza estado local
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

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  // Simular teste
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
      setTestResult({
        isBlocked: false,
        message: 'Lead Limpo e Aprovado! Usuário acessa diretamente a página de vendas real (Black Page).',
      });
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-neutral-400">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
          <span>Carregando páginas e configurações do Cloaker...</span>
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
              Escudo Anti-Ban
            </span>
          </div>
          <p className="text-sm text-neutral-400">
            Separe o tráfego de robôs do Facebook, TikTok e Google dos seus clientes reais. Mostre uma White Page inofensiva para a aprovação do anúncio e a Black Page para os leads compradores.
          </p>
        </div>

        {selectedPage && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        )}
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          Configurações do Cloaker salvas e ativas com sucesso!
        </div>
      )}

      {pages.length === 0 ? (
        <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/5 flex items-center justify-center text-neutral-400">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">Nenhuma página encontrada</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Você precisa ter pelo menos um projeto clonado ou um advertorial criado para ativar o cloaker.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard/clones"
              className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-neutral-200"
            >
              Criar Novo Clone
            </Link>
            <Link
              href="/dashboard/advertoriais"
              className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20"
            >
              Criar Advertorial
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Seletor de Página / Oferta */}
          <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                Página / Oferta Selecionada (Black Page)
              </label>
              <select
                value={selectedPageId}
                onChange={(e) => handleSelectPage(e.target.value)}
                className="w-full bg-[#141822] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
              >
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.slug}) {p.cloaker?.enabled ? '🟢 [Cloaker Ativo]' : '⚪ [Cloaker Desativado]'}
                  </option>
                ))}
              </select>
            </div>

            {selectedPage && (
              <div className="flex items-center gap-3 pt-2 md:pt-6">
                <a
                  href={selectedPage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Testar Link Direto
                </a>
              </div>
            )}
          </div>

          {/* Status e Métrica do Cloaker */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-neutral-400 uppercase font-semibold">Estado do Cloaker</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${cloaker.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
                  <span className="text-base font-bold text-white">
                    {cloaker.enabled ? 'Ativo & Protegendo' : 'Desativado'}
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

          {/* Configurações da White Page e Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna 1: White Page */}
            <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  White Page (Página de Segurança para os Robôs)
                </h3>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1.5">
                  URL da White Page
                </label>
                <input
                  type="url"
                  placeholder="https://g1.globo.com/ ou URL de um advertorial neutro"
                  value={cloaker.whitePageUrl || ''}
                  onChange={(e) => setCloaker((prev) => ({ ...prev, whitePageUrl: e.target.value }))}
                  className="w-full bg-[#141822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <span className="text-[11px] text-neutral-500 mt-1 block">
                  Você pode usar a URL de um Advertorial criado no ROI Clone ou qualquer matéria informativa neutra.
                </span>
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1.5">
                  Ação quando o Robô/Revisor Acessar
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCloaker((prev) => ({ ...prev, action: 'show_white' }))}
                    className={`p-3 rounded-xl border text-left text-xs transition-colors ${
                      cloaker.action === 'show_white'
                        ? 'border-purple-500 bg-purple-500/10 text-white font-semibold'
                        : 'border-white/5 bg-white/[0.02] text-neutral-400 hover:border-white/15'
                    }`}
                  >
                    <div className="font-bold text-white mb-0.5">Renderizar Direto</div>
                    <div className="text-[10px] text-neutral-400">Mantém a URL idêntica sem redirecionar</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCloaker((prev) => ({ ...prev, action: 'redirect_white' }))}
                    className={`p-3 rounded-xl border text-left text-xs transition-colors ${
                      cloaker.action === 'redirect_white'
                        ? 'border-purple-500 bg-purple-500/10 text-white font-semibold'
                        : 'border-white/5 bg-white/[0.02] text-neutral-400 hover:border-white/15'
                    }`}
                  >
                    <div className="font-bold text-white mb-0.5">Redirecionar 302</div>
                    <div className="text-[10px] text-neutral-400">Envia o robô para o link da White Page</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Coluna 2: Regras e Filtros Ativos */}
            <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Filtros e Proteções Ativas
                </h3>
              </div>

              <div className="space-y-3">
                {/* Filtro Bots */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <Bot className="w-4 h-4 text-blue-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Bloqueio de Bots de ADS</div>
                      <div className="text-[10px] text-neutral-500">Facebook Crawler, Googlebot, TikTokBot, ByteSpider</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={cloaker.filterBots}
                    onChange={(e) => setCloaker((prev) => ({ ...prev, filterBots: e.target.checked }))}
                    className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                  />
                </div>

                {/* Filtro Datacenters */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <Server className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Bloquear Datacenters & VPS</div>
                      <div className="text-[10px] text-neutral-500">AWS, Google Cloud, Azure, DigitalOcean</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={cloaker.filterDatacenters}
                    onChange={(e) => setCloaker((prev) => ({ ...prev, filterDatacenters: e.target.checked }))}
                    className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                  />
                </div>

                {/* Filtro de Dispositivo */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    Filtro por Dispositivo
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { id: 'all', label: 'Todos' },
                      { id: 'mobile_only', label: 'Apenas Celular' },
                      { id: 'desktop_only', label: 'Apenas Desktop' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setCloaker((prev) => ({ ...prev, deviceFilter: d.id as any }))}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors ${
                          cloaker.deviceFilter === d.id
                            ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                            : 'bg-white/5 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Simulador de Tráfego */}
          <div className="bg-[#0e1117] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Simulador de Teste do Cloaker
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Valide o comportamento do link antes de ativar sua campanha de tráfego pago.
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
