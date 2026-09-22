'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Globe, 
  Sparkles, 
  Plus, 
  Search, 
  Edit3, 
  ExternalLink, 
  Trash2, 
  Loader2, 
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Bot,
  Zap,
  Wand2,
  Check,
  Archive,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface CloneItem {
  id: string;
  name: string;
  sourceUrl: string;
  status: 'PENDING' | 'FETCHING' | 'ANALYZING' | 'RECONSTRUCTING' | 'COMPLETED' | 'FAILED';
  progress: number;
  createdAt: string;
  page?: {
    id: string;
    slug: string;
  };
}

export default function ClonesManagementPage() {
  const router = useRouter();
  const [clones, setClones] = useState<CloneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PROCESSING'>('ALL');
  
  // Modal de novo clone rápido
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [newCheckoutUrl, setNewCheckoutUrl] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [crawlFullSite, setCrawlFullSite] = useState(false);
  const [maxPages, setMaxPages] = useState(6);
  const [isAnalyzingUrl, setIsAnalyzingUrl] = useState(false);
  const [aiSuggestionMsg, setAiSuggestionMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal de exclusão personalizado
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    cloneId: string | null;
    cloneName: string;
    isDeleting: boolean;
  }>({
    isOpen: false,
    cloneId: null,
    cloneName: '',
    isDeleting: false,
  });

  const fetchClones = async () => {
    try {
      const res = await fetch('/api/clones');
      if (res.ok) {
        const data = await res.json();
        setClones(data);
      }
    } catch (err) {
      console.error('Error fetching clones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClones();
    const interval = setInterval(() => {
      setClones((prev) => {
        const hasPending = prev.some((c) => !['COMPLETED', 'FAILED'].includes(c.status));
        if (hasPending) fetchClones();
        return prev;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleAnalyzeWithAi = async () => {
    if (!targetUrl.trim()) {
      setErrorMsg('Cole a URL da página antes de analisar com a IA.');
      return;
    }
    setIsAnalyzingUrl(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/suggest-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.suggestedName) setProjectName(data.suggestedName);
        setAiSuggestionMsg(`✨ Nicho detectado: ${data.productType || 'Vendas'} | Nome sugerido preenchido!`);
        setTimeout(() => setAiSuggestionMsg(null), 6000);
      } else {
        setErrorMsg('Não foi possível analisar a URL automaticamente.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao conectar com a ROI IA.');
    } finally {
      setIsAnalyzingUrl(false);
    }
  };

  const handleCreateClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let finalName = projectName.trim();
      if (!finalName) {
        try {
          finalName = new URL(targetUrl).hostname;
        } catch {
          finalName = 'novo-projeto';
        }
      }

      const res = await fetch('/api/clones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: targetUrl,
          name: finalName,
          newCheckoutUrl: newCheckoutUrl.trim() || undefined,
          pixKey: pixKey.trim() || undefined,
          optimizeWithAi: isAiEnabled,
          crawlFullSite,
          maxPages: crawlFullSite ? Number(maxPages) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao iniciar clonagem');
      }

      const clone = await res.json();
      setIsModalOpen(false);
      setTargetUrl('');
      setProjectName('');
      setNewCheckoutUrl('');
      setPixKey('');
      router.push(`/dashboard/clones/${clone.id}/progress`);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const promptDelete = (clone: CloneItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialog({
      isOpen: true,
      cloneId: clone.id,
      cloneName: clone.name,
      isDeleting: false,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.cloneId) return;
    setDeleteDialog((prev) => ({ ...prev, isDeleting: true }));

    try {
      const res = await fetch(`/api/clones/${deleteDialog.cloneId}`, { method: 'DELETE' });
      if (res.ok) {
        setClones((prev) => prev.filter((c) => c.id !== deleteDialog.cloneId));
      }
      setDeleteDialog({ isOpen: false, cloneId: null, cloneName: '', isDeleting: false });
    } catch (err) {
      console.error(err);
      setDeleteDialog((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const filteredClones = clones.filter((c) => {
    const matchesSearch = 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.sourceUrl.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    if (statusFilter === 'COMPLETED') return c.status === 'COMPLETED';
    if (statusFilter === 'PROCESSING') return !['COMPLETED', 'FAILED'].includes(c.status);
    return true;
  });

  return (
    <div className="relative min-h-screen bg-[#07080b] text-white p-6 lg:p-10 selection:bg-blue-600/30">
      {/* Background Glow */}
      <div 
        className="absolute inset-x-0 top-0 h-[380px] bg-cover bg-top bg-no-repeat opacity-20 pointer-events-none"
        style={{ backgroundImage: 'url(/bg-dashboard.jpg)' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 rounded bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20 font-mono font-medium">
                PROJETOS & CLONES
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
              Gestão de Projetos
            </h1>
            <p className="text-xs lg:text-sm text-neutral-400 mt-1">
              Gerencie, edite e acompanhe todas as suas páginas clonadas e ativas.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition-all hover:bg-neutral-200 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Projeto</span>
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar por nome ou URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#0e1017] border border-white/10 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-[#0e1017] p-1 rounded-xl border border-white/10 self-stretch sm:self-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-white/15 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todos ({clones.length})
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === 'COMPLETED'
                  ? 'bg-white/15 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Prontos ({clones.filter((c) => c.status === 'COMPLETED').length})
            </button>
            <button
              onClick={() => setStatusFilter('PROCESSING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === 'PROCESSING'
                  ? 'bg-white/15 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Em Fila ({clones.filter((c) => !['COMPLETED', 'FAILED'].includes(c.status)).length})
            </button>
          </div>
        </div>

        {/* Project Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <p className="text-xs text-neutral-400">Carregando seus projetos...</p>
          </div>
        ) : filteredClones.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#0d0e14]/50 p-12 text-center backdrop-blur-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4">
              <Layers className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">Nenhum projeto encontrado</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1.5">
              {search ? 'Nenhum resultado corresponde aos termos pesquisados.' : 'Você ainda não clonou nenhuma página. Comece agora mesmo inserindo a URL de uma landing page.'}
            </p>
            {!search && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                Criar Primeiro Projeto
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredClones.map((clone) => {
              const isDone = clone.status === 'COMPLETED';
              const isFailed = clone.status === 'FAILED';
              const isPending = !isDone && !isFailed;

              return (
                <div
                  key={clone.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0d0e14] p-5 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-200"
                >
                  <div>
                    {/* Header: Title & Status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                          {clone.name}
                        </h3>
                        <p className="text-[11px] text-neutral-400 truncate flex items-center gap-1.5 mt-0.5">
                          <Globe className="w-3 h-3 text-neutral-500 shrink-0" />
                          <span className="truncate">{clone.sourceUrl}</span>
                        </p>
                      </div>

                      {isDone && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          Pronto
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0 animate-pulse">
                          <Clock className="w-3 h-3" />
                          {clone.progress}%
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                          <AlertCircle className="w-3 h-3" />
                          Falha
                        </span>
                      )}
                    </div>

                    {/* Progress Bar for active clones */}
                    {isPending && (
                      <div className="my-3">
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300 rounded-full"
                            style={{ width: `${clone.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Date */}
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-2">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(clone.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isDone ? (
                        <>
                          <Link
                            href={`/dashboard/projeto/${clone.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-sm"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </Link>
                          <a
                            href={`/api/clones/${clone.id}/zip`}
                            download
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 hover:text-white border border-blue-500/20 text-xs font-semibold transition-colors shadow-sm"
                            title="Baixar Site Todo em ZIP (HTML, CSS e Subpáginas)"
                          >
                            <Archive className="w-3.5 h-3.5 text-blue-400" />
                            <span>Baixar ZIP</span>
                          </a>
                        </>
                      ) : (
                        <Link
                          href={`/dashboard/clones/${clone.id}/progress`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 text-xs font-medium transition-colors"
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          <span>Ver Progresso</span>
                        </Link>
                      )}

                      {clone.page?.slug && (
                        <a
                          href={`/p/${clone.page.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Visualizar Página Publicada"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    <button
                      onClick={(e) => promptDelete(clone, e)}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Excluir Projeto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Novo Projeto / Clonar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d0e14] p-6 shadow-2xl animate-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Clonagem Inteligente
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      ROI IA ATIVA
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-400">Extraia a página e adapte o checkout automaticamente</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-500 hover:text-white text-xs px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClone} className="mt-4 space-y-4">
              {/* URL Alvo + Botão Sugerir IA */}
              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                  URL da Página Alvo *
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    placeholder="https://exemplo.com/pagina-de-vendas"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#151722] border border-white/10 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAnalyzeWithAi}
                    disabled={isAnalyzingUrl || !targetUrl.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-colors shrink-0 disabled:opacity-40"
                    title="Analisar URL e sugerir nome e nicho com a ROI IA"
                  >
                    {isAnalyzingUrl ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Preencher com IA</span>
                  </button>
                </div>
                {aiSuggestionMsg && (
                  <p className="text-[11px] text-emerald-400 mt-1.5 animate-in fade-in duration-200">
                    {aiSuggestionMsg}
                  </p>
                )}
              </div>

              {/* Seletor de Modo de Clonagem: Rápido vs HTTrack Completo */}
              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-2">
                  Modo de Clonagem do Projeto
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCrawlFullSite(false)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      !crawlFullSite
                        ? 'bg-blue-600/10 border-blue-500/50 shadow-sm shadow-blue-500/10'
                        : 'bg-[#151722] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className={`w-4 h-4 ${!crawlFullSite ? 'text-blue-400' : 'text-neutral-400'}`} />
                      <span className="text-xs font-bold text-white">Página Única (Rápido)</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Clona a Landing Page em ~5s. Ideal para testar ofertas e criar cópias imediatas.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCrawlFullSite(true)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      crawlFullSite
                        ? 'bg-blue-600/10 border-blue-500/50 shadow-sm shadow-blue-500/10'
                        : 'bg-[#151722] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Globe className={`w-4 h-4 ${crawlFullSite ? 'text-blue-400' : 'text-neutral-400'}`} />
                        <span className="text-xs font-bold text-white">Site Completo & Funil com IA</span>
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold uppercase">HTTrack</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Rastreia e clona subpáginas, checkout, carrinho, políticas, mídias locais e rotas internas.
                    </p>
                  </button>
                </div>

                {crawlFullSite && (
                  <div className="mt-2.5 p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-300 font-medium flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        Limite de páginas a clonar:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {[4, 6, 8, 12].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setMaxPages(num)}
                            className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors ${
                              maxPages === num
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white/5 hover:bg-white/10 text-neutral-400'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-relaxed">
                      💡 As páginas descobertas serão interligadas para navegação offline e empacotadas no arquivo ZIP com download de todas as imagens e backend de leads em PHP.
                    </p>
                  </div>
                )}
              </div>

              {/* Nome do Projeto */}
              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                  Nome do Projeto (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Landing Page Curso Afiliado"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#151722] border border-white/10 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Seção da ROI IA: Adaptação de Checkout e Conversão */}
              <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-b from-blue-950/20 to-transparent p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-white">Assistente ROI IA na Clonagem</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAiEnabled}
                      onChange={(e) => setIsAiEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {isAiEnabled && (
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    {/* Link de Checkout Próprio */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-neutral-300">
                          Substituir Botões pelo Meu Checkout (Opcional)
                        </label>
                        <span className="text-[10px] text-blue-400 font-mono">Kiwify, Hotmart, etc.</span>
                      </div>
                      <input
                        type="url"
                        placeholder="https://pay.kiwify.com.br/meu-checkout"
                        value={newCheckoutUrl}
                        onChange={(e) => setNewCheckoutUrl(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#151722] border border-white/10 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[10px] text-neutral-400 mt-1">
                        ⚡ A IA trocará todos os botões de compra da página diretamente para seu link.
                      </p>
                    </div>

                    {/* Ou Chave Pix */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-neutral-300">
                          Ou Chave PIX para Checkout Direto (Opcional)
                        </label>
                        <span className="text-[10px] text-emerald-400 font-mono">QR Code Instantâneo</span>
                      </div>
                      <input
                        type="text"
                        placeholder="meupix@email.com ou CPF / Telefone"
                        value={pixKey}
                        onChange={(e) => setPixKey(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#151722] border border-white/10 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
                      />
                      <p className="text-[10px] text-neutral-400 mt-1">
                        💳 A IA injetará automaticamente um popup com QR Code e Copia-e-Cola nos botões.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/90 pt-1">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>Otimização automática de headlines e gatilhos ativada</span>
                    </div>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{crawlFullSite ? 'Clonando Site Completo & Funil...' : 'Clonando & Otimizando com IA...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{crawlFullSite ? 'Iniciar Clonagem Completa (HTTrack)' : 'Iniciar Clonagem'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão Moderno */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => !deleteDialog.isDeleting && setDeleteDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        isLoading={deleteDialog.isDeleting}
        title="Excluir Projeto"
        description="Tem certeza que deseja excluir este projeto? Esta ação é irreversível e todos os arquivos, páginas clonadas e métricas serão apagados permanentemente."
        itemName={deleteDialog.cloneName}
        confirmText="Excluir Projeto"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
}
