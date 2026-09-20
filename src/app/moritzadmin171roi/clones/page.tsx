'use client';

import { useState, useEffect } from 'react';
import { 
  Layers, 
  Search, 
  ExternalLink, 
  Loader2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Globe
} from 'lucide-react';

export default function MoritzAdminClonesPage() {
  const [clones, setClones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchClones = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/moritzadmin171roi/clones?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar clonagens');
      const data = await res.json();
      setClones(data.clones || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClones();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-purple-400" />
            Clonagens Globais
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Auditoria e acompanhamento de todas as páginas clonadas na plataforma.
          </p>
        </div>

        <button
          onClick={fetchClones}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-all self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar Lista
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Buscar por nome do projeto, URL ou usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0d0e14] border border-white/10 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-red-500/50 transition-colors"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl bg-[#0d0e14] border border-white/10 text-xs text-white focus:outline-none focus:border-red-500/50 cursor-pointer"
        >
          <option value="">Todos os Status</option>
          <option value="COMPLETED">COMPLETED (Sucesso)</option>
          <option value="FAILED">FAILED (Falha)</option>
          <option value="FETCHING">FETCHING (Em andamento)</option>
          <option value="PENDING">PENDING (Pendente)</option>
        </select>
      </div>

      {/* Clones Table */}
      <div className="rounded-2xl bg-[#0d0e14] border border-white/10 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-purple-500 mb-2" />
            <p className="text-xs text-neutral-400 font-mono">Buscando clonagens...</p>
          </div>
        ) : clones.length === 0 ? (
          <div className="py-16 text-center text-xs text-neutral-500">
            Nenhuma clonagem encontrada com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Projeto</th>
                  <th className="py-3 px-4">Usuário</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {clones.map((c) => {
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Project Name & Source */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-semibold text-white truncate">{c.name || 'Sem título'}</p>
                        <a
                          href={c.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-400 hover:text-blue-300 truncate block font-mono hover:underline"
                        >
                          {c.sourceUrl}
                        </a>
                      </td>

                      {/* User */}
                      <td className="py-3.5 px-4">
                        <p className="text-white font-medium truncate">{c.user?.name || 'Usuário'}</p>
                        <p className="text-[10px] text-neutral-500 font-mono truncate">{c.user?.email || '-'}</p>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono inline-flex items-center gap-1 ${
                          c.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : c.status === 'FAILED'
                            ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}>
                          {c.status === 'COMPLETED' && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {c.status === 'FAILED' && <XCircle className="w-2.5 h-2.5" />}
                          {c.status}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-neutral-400 text-[11px] font-mono">
                        {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                      </td>

                      {/* View Link */}
                      <td className="py-3.5 px-4 text-right">
                        {c.page?.slug ? (
                          <a
                            href={`/p/${c.page.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-[11px] font-medium transition-colors border border-white/5"
                          >
                            Ver <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-neutral-600 text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
