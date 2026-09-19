'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Search, 
  Download, 
  ExternalLink, 
  Copy, 
  Check, 
  MessageSquare, 
  Mail, 
  Phone, 
  Calendar,
  Loader2,
  FileText,
  Filter
} from 'lucide-react';

interface Submission {
  id: string;
  data: Record<string, any>;
  status: string;
  createdAt: string;
  page: { 
    name: string; 
    domain: { name: string } | null;
  };
}

export default function LeadsDashboardPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubmissions() {
      try {
        const res = await fetch('/api/forms');
        if (res.ok) {
          const data = await res.json();
          setSubmissions(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Failed to fetch submissions', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSubmissions();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    if (submissions.length === 0) return;

    // Extrair cabeçalhos únicos dos dados
    const allKeys = Array.from(
      new Set(submissions.flatMap((s) => Object.keys(s.data || {})))
    );
    const headers = ['ID', 'Data', 'Página', ...allKeys];

    const rows = submissions.map((s) => {
      const row = [
        s.id,
        new Date(s.createdAt).toLocaleString('pt-BR'),
        s.page?.name || 'Página',
        ...allKeys.map((key) => {
          const val = s.data?.[key];
          return `"${String(val ?? '').replace(/"/g, '""')}"`;
        }),
      ];
      return row.join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leads_roi_clone_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = submissions.filter((sub) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const pageMatch = sub.page?.name?.toLowerCase().includes(term);
    const dataMatch = Object.values(sub.data || {}).some((v) =>
      String(v).toLowerCase().includes(term)
    );
    return pageMatch || dataMatch;
  });

  // Métricas dinâmicas reais
  const todayStr = new Date().toDateString();
  const leadsToday = submissions.filter(
    (s) => new Date(s.createdAt).toDateString() === todayStr
  ).length;

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
                LEADS & CONVERSÕES
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
              Leads & Formulários
            </h1>
            <p className="text-xs lg:text-sm text-neutral-400 mt-1">
              Acompanhe todos os contatos e conversões capturados pelos formulários das suas páginas.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={submissions.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-white/20 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Dynamic Real Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-[#0d0e14] border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">Total de Leads</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-2 font-mono">{submissions.length}</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0d0e14] border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">Leads Hoje</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-400 mt-2 font-mono">{leadsToday}</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0d0e14] border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">Páginas com Captura</span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-2 font-mono">
              {new Set(submissions.map((s) => s.page?.name)).size}
            </p>
          </div>
        </div>

        {/* Filter and Search */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar por lead, e-mail, telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#0e1017] border border-white/10 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Leads Table */}
        <div className="rounded-2xl border border-white/10 bg-[#0d0e14] overflow-hidden shadow-xl">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <p className="text-xs text-neutral-400">Carregando leads capturados...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-3">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-white">Nenhum lead encontrado</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                {search ? 'Nenhum lead corresponde à sua busca.' : 'Assim que os visitantes preencherem formulários nas suas páginas clonadas, eles aparecerão aqui instantaneamente.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#13151f] text-neutral-400 uppercase tracking-wider text-[10px] border-b border-white/10">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Data / Horário</th>
                    <th className="px-5 py-3.5 font-semibold">Página</th>
                    <th className="px-5 py-3.5 font-semibold">Dados do Lead</th>
                    <th className="px-5 py-3.5 font-semibold">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((sub) => {
                    const entries = Object.entries(sub.data || {});
                    const phoneEntry = entries.find(([k]) =>
                      /tel|phone|cel|whats|fone/i.test(k)
                    );
                    const emailEntry = entries.find(([k]) =>
                      /email|e-mail|mail/i.test(k)
                    );

                    return (
                      <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap text-neutral-400">
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                            {new Date(sub.createdAt).toLocaleString('pt-BR')}
                          </div>
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="font-semibold text-white block">
                            {sub.page?.name || 'Página Clonada'}
                          </span>
                          {sub.page?.domain && (
                            <span className="text-[10px] text-blue-400 font-mono">
                              {sub.page.domain.name}
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="space-y-1 max-w-md">
                            {entries.map(([k, v]) => (
                              <div key={k} className="flex items-baseline gap-2 text-xs">
                                <span className="font-medium text-neutral-400 capitalize text-[11px]">
                                  {k}:
                                </span>
                                <span className="font-semibold text-white break-all">
                                  {String(v)}
                                </span>
                              </div>
                            ))}
                            {entries.length === 0 && (
                              <span className="text-neutral-500 italic">Sem campos preenchidos</span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {phoneEntry && (
                              <a
                                href={`https://wa.me/${String(phoneEntry[1]).replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium transition-colors"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </a>
                            )}

                            {emailEntry && (
                              <button
                                onClick={() => handleCopy(String(emailEntry[1]), sub.id + '-email')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[11px] font-medium transition-colors"
                              >
                                {copiedId === sub.id + '-email' ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Mail className="w-3 h-3" />
                                )}
                                <span>{copiedId === sub.id + '-email' ? 'Copiado' : 'E-mail'}</span>
                              </button>
                            )}
                          </div>
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
    </div>
  );
}
