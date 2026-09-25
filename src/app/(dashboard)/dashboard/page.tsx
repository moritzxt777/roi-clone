'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Globe, 
  Sparkles, 
  ArrowRight, 
  Loader2, 
  ExternalLink, 
  FolderPlus,
  Trash2,
  Edit3,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Zap,
  Layers
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface CloneItem {
  id: string;
  name: string;
  sourceUrl: string;
  status: string;
  progress: number;
  createdAt: string;
  page?: {
    id: string;
    slug: string;
  };
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crawlFullSite, setCrawlFullSite] = useState(false);
  const [maxPages, setMaxPages] = useState(6);
  
  const [clones, setClones] = useState<CloneItem[]>([]);
  const [loadingClones, setLoadingClones] = useState(true);

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

  // Fetch real user clones from API
  useEffect(() => {
    let active = true;
    const fetchClones = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch('/api/clones', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setClones(Array.isArray(data) ? data : []);
          }
        } else {
          if (active) setClones([]);
        }
      } catch (err) {
        console.error('Error fetching clones:', err);
        if (active) setClones([]);
      } finally {
        if (active) setLoadingClones(false);
      }
    };

    fetchClones();

    // Fallback de segurança: assegura que o spinner nunca trave por mais de 3.5 segundos
    const fallbackTimer = setTimeout(() => {
      if (active) setLoadingClones(false);
    }, 3500);

    return () => {
      active = false;
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setError(null);

    try {
      let hostname = 'projeto';
      try {
        hostname = new URL(url).hostname;
      } catch {
        hostname = 'pagina-clonada';
      }

      const res = await fetch('/api/clones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: url,
          name: hostname,
          crawlFullSite,
          maxPages: crawlFullSite ? Number(maxPages) : undefined,
        }),
      });

      let clone: any = {};
      try {
        clone = await res.json();
      } catch {
        throw new Error(`Falha na resposta do servidor (${res.status}). O clone pode ter sido iniciado.`);
      }

      if (!res.ok) {
        throw new Error(clone.error || 'Erro ao criar clone');
      }

      router.push(`/dashboard/clones/${clone.id}/progress`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const promptDeleteClone = (clone: { id: string; name: string }, e: React.MouseEvent) => {
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

  const filteredClones = clones;

  return (
    <div className="relative min-h-screen bg-[#07080b] text-white font-sans overflow-x-hidden selection:bg-blue-600/30">
      {/* Imagem de Fundo Oficial do Dashboard enviada pelo Usuário */}
      <div 
        className="absolute inset-x-0 top-0 h-[480px] bg-cover bg-top bg-no-repeat opacity-25 pointer-events-none"
        style={{ backgroundImage: 'url(/bg-dashboard.jpg)' }}
      />
      {/* Degradê para fundir com o fundo preto */}
      <div className="absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b from-transparent via-[#07080b]/70 to-[#07080b] pointer-events-none" />

      {/* Conteúdo Central */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-12 pb-24 space-y-10">
        
        {/* Banner Exclusivo do Moritz Admin */}
        {(session?.user?.email?.toLowerCase() === 'moritzadmin777roi@gmail.com' || (session?.user as any)?.role === 'SUPER_ADMIN' || (session?.user as any)?.role === 'ADMIN') && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-950/50 via-[#160c10] to-[#0d0e14] border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-red-950/25">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-white uppercase tracking-wide">
                    Acesso Administrador Supremo Ativo
                  </p>
                  <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-mono font-bold border border-red-500/30">
                    MORITZ ADMIN
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Você está conectado com privilégios master. Acesse o painel restrito para gerenciar usuários, inspecionar clonagens globais e monitorar a infraestrutura.
                </p>
              </div>
            </div>
            <Link
              href="/moritzadmin171roi"
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              Abrir Painel Admin <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Hero Section com Input de Clonagem */}
        <div className="text-center space-y-3 max-w-3xl mx-auto pt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Motor Playwright 2.0 • Clonagem em Tempo Real</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Transforme qualquer página em um <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">projeto editável</span>
          </h1>
          <p className="text-sm md:text-base text-neutral-400 max-w-2xl mx-auto">
            Cole a URL de uma página pública, recrie a estrutura completa e edite tudo visualmente no canvas.
          </p>

          {/* Barra de Entrada Principal de URL */}
          <form onSubmit={handleClone} className="mt-8 relative max-w-2xl mx-auto space-y-3">
            <div className="relative flex items-center rounded-2xl border border-white/15 bg-[#10121a]/90 p-1.5 shadow-2xl backdrop-blur-xl focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <div className="pl-4 text-neutral-500">
                <Globe className="w-5 h-5 text-blue-400" />
              </div>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                placeholder="Cole o link da página aqui (ex: https://site.com)"
                className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading}
                className="shrink-0 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs tracking-tight flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Iniciando...</span>
                  </>
                ) : (
                  <>
                    <span>{crawlFullSite ? 'Clonar com HTTrack' : 'Clonar Página'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Seletor de Modo: Página Única vs HTTrack Funil Completo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left pt-1">
              <button
                type="button"
                onClick={() => setCrawlFullSite(false)}
                className={`p-3 rounded-xl border transition-all text-left relative ${
                  !crawlFullSite
                    ? 'bg-blue-600/10 border-blue-500/50 shadow-sm shadow-blue-500/10'
                    : 'bg-[#10121a]/60 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className={`w-4 h-4 ${!crawlFullSite ? 'text-blue-400' : 'text-neutral-400'}`} />
                  <span className="text-xs font-bold text-white">Página Única (Rápido)</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Clona apenas a Landing Page em ~5s. Ideal para testes rápidos.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCrawlFullSite(true)}
                className={`p-3 rounded-xl border transition-all text-left relative ${
                  crawlFullSite
                    ? 'bg-blue-600/10 border-blue-500/50 shadow-sm shadow-blue-500/10'
                    : 'bg-[#10121a]/60 border-white/10 hover:border-white/20'
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
                  Rastreia e clona subpáginas, checkout, links do funil e imagens offline.
                </p>
              </button>
            </div>

            {crawlFullSite && (
              <div className="p-3 rounded-xl bg-blue-950/25 border border-blue-500/20 text-left space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-300 font-medium flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    Limite de páginas a clonar no funil:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[4, 6, 8, 12].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setMaxPages(num)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
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
                  💡 Modo HTTrack ativo: As páginas do funil serão interligadas para você navegar passo-a-passo mesmo offline ou ao hospedar o arquivo ZIP.
                </p>
              </div>
            )}
          </form>
          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-500/20 p-2 rounded-lg max-w-md mx-auto mt-2">
              {error}
            </p>
          )}
        </div>

        {/* Seção Meus Projetos */}
        <div className="space-y-4 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Meus Projetos</h2>
              <p className="text-xs text-neutral-400">Gerencie e acesse os sites que você clonou</p>
            </div>
          </div>

          {/* Cards de Projetos */}
          {loadingClones ? (
            <div className="py-16 text-center text-neutral-500 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="text-xs">Carregando projetos...</span>
            </div>
          ) : filteredClones.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                <FolderPlus className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">Nenhum projeto encontrado</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Cole a URL de um site acima e clique em "Clonar Página" para ver seu primeiro projeto aparecer aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredClones.map((clone) => {
                const isCompleted = clone.status === 'COMPLETED';

                return (
                  <div
                    key={clone.id}
                    onClick={() => router.push(`/dashboard/projeto/${clone.id}`)}
                    className="group rounded-2xl border border-white/10 bg-[#0e1017]/90 hover:border-blue-500/50 hover:bg-[#12151f] p-4 transition-all duration-200 cursor-pointer shadow-xl flex flex-col justify-between"
                  >
                    <div>
                      {/* Top status */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isCompleted 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {isCompleted ? 'Concluído' : 'Processando'}
                        </span>

                        <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(clone.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      {/* Nome e URL */}
                      <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                        {clone.name}
                      </h3>
                      <p className="text-xs text-neutral-400 truncate mt-1 flex items-center gap-1 font-mono">
                        <Globe className="w-3 h-3 text-neutral-500 shrink-0" />
                        <span>{clone.sourceUrl}</span>
                      </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                      <Link
                        href={`/dashboard/projeto/${clone.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </Link>

                      <Link
                        href={`/preview/${clone.id}`}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                        title="Visualizar em nova aba"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        onClick={(e) => promptDeleteClone(clone, e)}
                        title="Excluir projeto"
                        className="p-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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