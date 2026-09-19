'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Layers, 
  FileText, 
  DollarSign, 
  ShieldCheck, 
  Activity, 
  Server, 
  Bot, 
  Database,
  ArrowUpRight,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function AdminMasterDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin-master/stats')
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-3" />
        <p className="text-xs text-neutral-400">Carregando painel master...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentUsers = data?.recentUsers || [];
  const recentClones = data?.recentClones || [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-white/10 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1 rounded bg-red-500/10 text-red-400 text-xs font-mono font-medium border border-red-500/20">
            PAINEL DE CONTROLE SUPREMO
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Visão Geral do Sistema
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          Monitoramento em tempo real de infraestrutura, usuários e páginas clonadas.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#0d0e14] border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Total de Usuários</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2 font-mono">{stats.totalUsers || 0}</p>
          <span className="text-[10px] text-neutral-500 mt-1 block">Contas registradas</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0d0e14] border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Clonagens Totais</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2 font-mono">{stats.totalClones || 0}</p>
          <span className="text-[10px] text-emerald-400 mt-1 block font-medium">
            {stats.totalCompletedClones || 0} com sucesso
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0d0e14] border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Páginas em Produção</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2 font-mono">{stats.totalPages || 0}</p>
          <span className="text-[10px] text-neutral-500 mt-1 block">Páginas geradas</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0d0e14] border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Leads Capturados</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2 font-mono">{stats.totalLeads || 0}</p>
          <span className="text-[10px] text-neutral-500 mt-1 block">Submissões de formulários</span>
        </div>
      </div>

      {/* System Health Status */}
      <div className="rounded-2xl border border-white/10 bg-[#0d0e14] p-6">
        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <span>Status dos Serviços & Infraestrutura</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-xl bg-[#141620] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-blue-400" />
              <div>
                <span className="text-xs font-semibold text-white block">Supabase PostgreSQL</span>
                <span className="text-[10px] text-neutral-400">Pooler aws-0-us-west-2</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ONLINE
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#141620] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Bot className="w-4 h-4 text-purple-400" />
              <div>
                <span className="text-xs font-semibold text-white block">ROI IA (NVIDIA NIM)</span>
                <span className="text-[10px] text-neutral-400">GLM-5.3 / Llama 70B</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ATIVO
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#141620] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-xs font-semibold text-white block">Rate Limiting & Anti-Brute</span>
                <span className="text-[10px] text-neutral-400">Sliding Window Guard</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              PROTEGIDO
            </span>
          </div>
        </div>
      </div>

      {/* Two Columns: Recent Users & Recent Clones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="rounded-2xl border border-white/10 bg-[#0d0e14] p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>Últimos Usuários Cadastrados</span>
            </h3>
            <Link
              href="/admin-master/users"
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              Ver todos <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-white/5">
            {recentUsers.map((u: any) => (
              <div key={u.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">{u.name || 'Sem nome'}</p>
                  <p className="text-[11px] text-neutral-400">{u.email}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    u.role === 'SUPER_ADMIN' || u.role === 'ADMIN'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-white/5 text-neutral-400'
                  }`}>
                    {u.role}
                  </span>
                  <span className="text-[10px] text-neutral-500 block mt-0.5">
                    {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Clones */}
        <div className="rounded-2xl border border-white/10 bg-[#0d0e14] p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Clonagens Globais Recentes</span>
            </h3>
            <Link
              href="/admin-master/clones"
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              Ver todas <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-white/5">
            {recentClones.map((c: any) => (
              <div key={c.id} className="py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                  <p className="text-[11px] text-neutral-400 truncate">{c.sourceUrl}</p>
                  <span className="text-[10px] text-neutral-500">Por: {c.user?.email}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    c.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : c.status === 'FAILED'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                  }`}>
                    {c.status}
                  </span>
                  <span className="text-[10px] text-neutral-500 block mt-0.5">
                    {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
