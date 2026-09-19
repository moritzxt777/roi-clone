'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Layers, 
  Search, 
  ExternalLink, 
  Calendar, 
  Loader2, 
  Globe, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  User
} from 'lucide-react';

export default function AdminClonesPage() {
  const [clones, setClones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin-master/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data?.recentClones) {
          setClones(data.recentClones);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = clones.filter((c) => 
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.sourceUrl?.toLowerCase().includes(search.toLowerCase()) ||
    c.user?.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded bg-purple-500/10 text-purple-400 text-xs font-mono font-medium border border-purple-500/20">
              INFRAESTRUTURA & CRAWLER
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Clonagens Globais
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Monitoramento de todas as páginas extraídas e processadas pelos usuários.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Buscar por URL, projeto ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#12141c] border border-white/10 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Clones Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0d0e14] overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-3" />
            <p className="text-xs text-neutral-400">Carregando clones do servidor...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-neutral-400 text-xs">
            Nenhuma clonagem encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141620] text-neutral-400 uppercase tracking-wider text-[10px] border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-semibold">Projeto / URL Original</th>
                  <th className="px-6 py-4 font-semibold">Proprietário (Usuário)</th>
                  <th className="px-6 py-4 font-semibold">Status do Processo</th>
                  <th className="px-6 py-4 font-semibold">Data</th>
                  <th className="px-6 py-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 max-w-sm">
                      <div className="font-semibold text-white truncate">{c.name}</div>
                      <div className="text-[11px] text-neutral-400 truncate flex items-center gap-1 mt-0.5">
                        <Globe className="w-3 h-3 text-neutral-500 shrink-0" />
                        <span className="truncate">{c.sourceUrl}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-neutral-300">
                        <User className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{c.user?.email || 'Desconhecido'}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          c.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : c.status === 'FAILED'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                        }`}
                      >
                        {c.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
                        {c.status === 'FAILED' && <AlertCircle className="w-3 h-3" />}
                        {c.status !== 'COMPLETED' && c.status !== 'FAILED' && <Clock className="w-3 h-3" />}
                        {c.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-neutral-400 text-[11px]">
                      {new Date(c.createdAt).toLocaleString('pt-BR')}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {c.page?.slug && (
                        <a
                          href={`/p/${c.page.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs transition-colors"
                        >
                          <span>Ver Página</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
