'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Flame, 
  Search, 
  ExternalLink, 
  Copy, 
  Check, 
  RotateCw, 
  Sparkles, 
  Eye, 
  Layers, 
  ShieldCheck, 
  Clock, 
  TrendingUp, 
  Globe, 
  Loader2,
  X,
  Plus,
  Play
} from 'lucide-react';

interface OfferItem {
  id: string;
  title: string;
  url: string;
  domain: string;
  screenshot: string;
  scannedAt: string;
  scannedTimeAgo: string;
  server: string;
  country: string;
  requestsCount: number;
  adEstimate: number;
  scaleLevel: 'ALTA' | 'MEDIA' | 'TESTE';
  platforms: ('Meta Ads' | 'Google Ads' | 'TikTok Ads')[];
  trackingProvider: string;
}

const SOURCES = [
  { id: 'utmify.com.br', name: 'Utmify (Padrão)', badge: 'Principal' },
  { id: 'kiwify.com.br', name: 'Kiwify', badge: 'Infoprodutos' },
  { id: 'hotmart.com', name: 'Hotmart', badge: 'Cursos' },
  { id: 'braip.com', name: 'Braip', badge: 'Físicos/Caps' },
  { id: 'perfectpay.com.br', name: 'PerfectPay', badge: 'Checkout' },
];

const PLATFORMS = [
  { id: 'all', label: '🌐 Todas as Redes' },
  { id: 'meta', label: '🔵 Meta Ads (Face/Insta)' },
  { id: 'google', label: '🔴 Google Ads (YouTube)' },
  { id: 'tiktok', label: '⚫ TikTok Ads' },
];

export default function OfertasPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSource, setSelectedSource] = useState('utmify.com.br');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal de preview da imagem expandida
  const [previewOffer, setPreviewOffer] = useState<OfferItem | null>(null);

  // Modal de clonagem rápida
  const [cloneModalOffer, setCloneModalOffer] = useState<OfferItem | null>(null);
  const [cloneProjectName, setCloneProjectName] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  const fetchOffers = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({
        source: selectedSource,
        platform: selectedPlatform,
        search: searchQuery,
      });

      if (isRefresh) params.set('refresh', 'true');

      const res = await fetch(`/api/ofertas?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOffers(data.offers || []);
      }
    } catch (e) {
      console.error('Falha ao carregar ofertas:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [selectedSource, selectedPlatform]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOffers();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Disparar clonagem automática da oferta
  const handleStartClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneModalOffer || isCloning) return;

    setIsCloning(true);
    setCloneError(null);

    try {
      const res = await fetch('/api/clones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: cloneModalOffer.url,
          name: cloneProjectName.trim() || cloneModalOffer.title || 'Oferta Clonada',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao iniciar clonagem');
      }

      // Redireciona direto para a tela de progresso / editor do clone criado
      if (data.id) {
        router.push(`/dashboard/clones/${data.id}/progress`);
      } else {
        router.push('/dashboard/clones');
      }
    } catch (err: any) {
      setCloneError(err.message || 'Erro ao clonar a oferta.');
      setIsCloning(false);
    }
  };

  const openCloneModal = (offer: OfferItem) => {
    setCloneModalOffer(offer);
    setCloneProjectName(offer.title);
    setCloneError(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-7 text-white font-sans">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-500/20 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Espião de Ofertas em Tempo Real</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Ofertas em Alta no Tráfego Pago 🔥
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl leading-relaxed">
              Monitore as landing pages, VSLs e páginas de vendas que os maiores players estão rodando no Meta Ads, Google Ads e TikTok Ads via <strong className="text-white">Utmify</strong> e checkouts ativos. Clone qualquer uma com 1 clique.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => fetchOffers(true)}
              disabled={refreshing || loading}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold text-white flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
              title="Sincronizar ofertas com o Urlscan.io"
            >
              <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
              <span>{refreshing ? 'Atualizando...' : 'Atualizar Ofertas'}</span>
            </button>
            <a
              href="https://urlscan.io/search/#utmify.com.br"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-xs font-semibold text-blue-300 flex items-center gap-1.5 transition-all"
            >
              <span>Ver no Urlscan</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Barra de Filtros: Plataformas & Tracking & Busca */}
      <div className="space-y-4">
        {/* Linha 1: Seleção de Fonte / Plataforma de Tracking */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-neutral-400 shrink-0 mr-1">Rastreador:</span>
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSource(s.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                selectedSource === s.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 border border-blue-400'
                  : 'bg-[#12141c] hover:bg-white/10 text-neutral-400 hover:text-white border border-white/5'
              }`}
            >
              <span>{s.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedSource === s.id ? 'bg-blue-800 text-blue-200' : 'bg-white/5 text-neutral-400'
              }`}>
                {s.badge}
              </span>
            </button>
          ))}
        </div>

        {/* Linha 2: Redes de Anúncios e Input de Busca */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Tabs de Redes de Anúncios */}
          <div className="flex items-center gap-1.5 bg-[#0e1017] p-1.5 rounded-2xl border border-white/10 w-full sm:w-auto overflow-x-auto">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlatform(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  selectedPlatform === p.id
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Form de Busca de Texto */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por nicho, título ou domínio..."
              className="w-full bg-[#12141c] border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </form>
        </div>
      </div>

      {/* Grid de Ofertas */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-xs text-neutral-400 font-medium">
            Escaneando ofertas recentes no Urlscan.io ({selectedSource})...
          </p>
        </div>
      ) : offers.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-[#0d0e14]/60 p-12 text-center backdrop-blur-sm space-y-3">
          <Globe className="w-10 h-10 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhuma oferta encontrada</h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Não encontramos páginas escaneadas para os filtros atuais. Experimente trocar a fonte de tracking ou buscar outros termos.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedPlatform('all');
              setSelectedSource('utmify.com.br');
            }}
            className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
          >
            Limpar Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer) => {
            const isScaleAlta = offer.scaleLevel === 'ALTA';
            const isScaleMedia = offer.scaleLevel === 'MEDIA';

            return (
              <div
                key={offer.id}
                className="group flex flex-col justify-between rounded-3xl border border-white/10 bg-[#0d0e14] hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 overflow-hidden"
              >
                {/* Imagem Preview do Urlscan */}
                <div className="relative aspect-video w-full bg-[#161822] overflow-hidden border-b border-white/10">
                  {offer.screenshot ? (
                    <img
                      src={offer.screenshot}
                      alt={offer.title}
                      loading="lazy"
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        // Fallback se a imagem demorar a processar no urlscan
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : null}

                  {/* Fallback elegante caso a imagem não carregue */}
                  <div className="absolute inset-0 flex items-center justify-center -z-10 text-neutral-600 text-xs">
                    <span>Pré-visualização gerando...</span>
                  </div>

                  {/* Overlay gradiente suave */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e14] via-transparent to-black/30 pointer-events-none" />

                  {/* Badges Flutuantes no Topo do Card */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {offer.platforms.map((plat) => (
                        <span
                          key={plat}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight bg-black/70 backdrop-blur-md text-white border border-white/20"
                        >
                          {plat === 'Meta Ads' ? '🔵 Meta' : plat === 'Google Ads' ? '🔴 Google' : '⚫ TikTok'}
                        </span>
                      ))}
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border backdrop-blur-md ${
                        isScaleAlta
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : isScaleMedia
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      }`}
                    >
                      {isScaleAlta ? '🔥 Alta Escala' : isScaleMedia ? '⚡ Escala Ativa' : '🚀 Teste'}
                    </span>
                  </div>

                  {/* Botão Hover para Abrir Preview Completo */}
                  <button
                    onClick={() => setPreviewOffer(offer)}
                    className="absolute bottom-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/90 border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-semibold backdrop-blur-md"
                    title="Ampliar captura da página"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Expandir</span>
                  </button>
                </div>

                {/* Conteúdo da Oferta */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    {/* Título */}
                    <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">
                      {offer.title}
                    </h3>

                    {/* Domínio & Tempo de Escaneamento */}
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span className="font-mono text-blue-300 truncate max-w-[180px]">
                        {offer.domain}
                      </span>
                      <span className="flex items-center gap-1 shrink-0 text-neutral-500">
                        <Clock className="w-3 h-3" />
                        <span>{offer.scannedTimeAgo}</span>
                      </span>
                    </div>

                    {/* Estatísticas de Tráfego / Anúncios */}
                    <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block">Anúncios Estimados:</span>
                        <span className="font-extrabold text-emerald-400 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          <span>~{offer.adEstimate} anúncios</span>
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 space-y-0.5">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold block">Tags & Assets:</span>
                        <span className="font-semibold text-neutral-300">
                          {offer.requestsCount} requisições
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações: Clonar e Acessar */}
                  <div className="pt-2 flex items-center gap-2">
                    {/* Botão de Clonar */}
                    <button
                      onClick={() => openCloneModal(offer)}
                      className="flex-1 py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-500/20"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Clonar Esta Oferta</span>
                    </button>

                    {/* Link direto para a oferta original */}
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-colors"
                      title="Abrir página de vendas original do anunciante"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    {/* Copiar Link */}
                    <button
                      onClick={() => copyToClipboard(offer.url, offer.id)}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-colors"
                      title="Copiar link da oferta"
                    >
                      {copiedId === offer.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Preview Grande da Imagem */}
      {previewOffer && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-[#0e1017] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-4">
                <h4 className="text-sm font-bold text-white truncate">{previewOffer.title}</h4>
                <span className="text-xs font-mono text-blue-400">{previewOffer.url}</span>
              </div>
              <button
                onClick={() => setPreviewOffer(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#07080b]">
              {previewOffer.screenshot && (
                <img
                  src={previewOffer.screenshot}
                  alt={previewOffer.title}
                  className="w-full rounded-2xl border border-white/10 shadow-lg object-contain"
                />
              )}
            </div>

            <div className="p-4 border-t border-white/10 flex items-center justify-between bg-[#0e1017]">
              <span className="text-xs text-neutral-400">
                Escaneado no Urlscan • {previewOffer.requestsCount} requisições • {previewOffer.platforms.join(', ')}
              </span>
              <div className="flex items-center gap-3">
                <a
                  href={previewOffer.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <span>Abrir Oferta</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => {
                    const o = previewOffer;
                    setPreviewOffer(null);
                    openCloneModal(o);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Clonar no ROI</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Clonagem Rápida */}
      {cloneModalOffer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95 duration-150">
          <div className="w-full max-w-lg bg-[#0e1017] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Clonar Oferta Selecionada</h3>
                  <p className="text-xs text-neutral-400">A página será baixada e aberta no editor visual</p>
                </div>
              </div>
              <button
                onClick={() => setCloneModalOffer(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartClone} className="space-y-4">
              {/* URL da Oferta (Fixa) */}
              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                  URL da Oferta:
                </label>
                <input
                  type="text"
                  readOnly
                  value={cloneModalOffer.url}
                  className="w-full bg-[#151722] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-blue-400 font-mono select-all focus:outline-none"
                />
              </div>

              {/* Nome do Projeto */}
              <div>
                <label className="text-xs font-medium text-neutral-300 mb-1.5 block">
                  Nome do Projeto:
                </label>
                <input
                  type="text"
                  required
                  value={cloneProjectName}
                  onChange={(e) => setCloneProjectName(e.target.value)}
                  placeholder="Nome da sua página clonada..."
                  className="w-full bg-[#151722] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {cloneError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-red-400 text-xs">
                  {cloneError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCloneModalOffer(null)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-neutral-300 hover:text-white text-xs font-medium hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCloning}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {isCloning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Iniciando Clonagem...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Clonar Agora</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
