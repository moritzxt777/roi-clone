'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Layers, 
  FileText, 
  ShieldCheck, 
  Activity, 
  Server, 
  Bot, 
  Database,
  ArrowUpRight,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Globe,
  RefreshCw,
  Clock
} from 'lucide-react';

export default function MoritzAdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/moritzadmin171roi/stats');
      if (!res.ok) throw new Error('Falha ao carregar dados');
      const resData = await res.json();
      setData(resData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-3" />
        <p className="text-xs text-neutral-400 font-mono">Carregando métricas supremas...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentUsers = data?.recentUsers || [];
  const recentClones = data?.recentClones || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 text-[10px] font-mono font-bold border border-red-500/25 tracking-wider">
              PAINEL ADMINISTRATIVO PRIVADO
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Visão Geral do Sistema
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Painel mestre de infraestrutura, banco de dados, usuários e clonagens.
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-red-400' : ''}`} />
          Atualizar Dados
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#0d0e14] border border-white/10 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Total de Usuários</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2 font-mono">{stats.totalUsers || 0}</p>
          <span className="text-[10px] text-neutral-500 mt-1 block">Contas cadastradas</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0d0e14] border border-white/10 hover:border-white/20 transition-all">
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

        <div className="p-5 rounded-2xl bg-[#0d0e14] border border-white/10 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Páginas em Produção</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2 font-mono">{stats.totalPages || 0}</p>
          <span className="text-[10px] text-neutral-500 mt-1 block">Páginas publicadas</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0d0e14] border border-white/10 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Domínios Conectados</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2 font-mono">{stats.totalDomains || 0}</p>
          <span className="text-[10px] text-neutral-500 mt-1 block">Domínios customizados</span>
        </div>
      </div>

      {/* System Infrastructure Status */}
      <div className="p-6 rounded-2xl bg-[#0d0e14] border border-white/10 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-red-400" />
          Status dos Serviços e Infraestrutura
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">PostgreSQL (Neon)</p>
                <p className="text-[10px] text-neutral-500 font-mono">Conexão Prisma Pooler</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Motor ROI IA</p>
                <p className="text-[10px] text-neutral-500 font-mono">NVIDIA / DeepSeek</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              ATIVO
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Segurança & RBAC</p>
                <p className="text-[10px] text-neutral-500 font-mono">Bcrypt + JWT 30d</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <ShieldCheck className="w-3 h-3" />
              BLINDADO
            </span>
          </div>
        </div>
      </div>

      {/* Two columns: Recent Users & Recent Clones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Users Card */}
        <div className="p-6 rounded-2xl bg-[#0d0e14] border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Usuários Recentes</h3>
              </div>
              <Link 
                href="/moritzadmin171roi/users"
                className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                Ver todos ({stats.totalUsers || 0}) <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-white/5">
              {recentUsers.length === 0 ? (
                <p className="text-xs text-neutral-500 py-6 text-center">Nenhum usuário cadastrado.</p>
              ) : (
                recentUsers.map((u: any) => (
                  <div key={u.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-neutral-300 shrink-0">
                        {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{u.name || 'Sem nome'}</p>
                        <p className="text-[10px] text-neutral-500 truncate font-mono">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                        u.role === 'SUPER_ADMIN' 
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30' 
                          : u.role === 'ADMIN'
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          : 'bg-white/5 text-neutral-400 border border-white/10'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recent Clones Card */}
        <div className="p-6 rounded-2xl bg-[#0d0e14] border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Clonagens Recentes</h3>
              </div>
              <Link 
                href="/moritzadmin171roi/clones"
                className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
              >
                Ver todas ({stats.totalClones || 0}) <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-white/5">
              {recentClones.length === 0 ? (
                <p className="text-xs text-neutral-500 py-6 text-center">Nenhuma clonagem realizada ainda.</p>
              ) : (
                recentClones.map((c: any) => (
                  <div key={c.id} className="py-3 flex items-center justify-between">
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-semibold text-white truncate">{c.name || 'Projeto'}</p>
                      <p className="text-[10px] text-neutral-500 truncate font-mono">{c.sourceUrl}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                        c.status === 'COMPLETED'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : c.status === 'FAILED'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
