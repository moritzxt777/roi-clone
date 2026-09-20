'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  Loader2, 
  Check, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

const ADMIN_AUTHORIZED_EMAIL = 'moritzadmin777roi@gmail.com';

export default function MoritzAdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (roleFilter) params.append('role', roleFilter);

      const res = await fetch(`/api/moritzadmin171roi/users?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar usuários');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, roleFilter]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setActionLoading(userId);
      const res = await fetch('/api/moritzadmin171roi/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        const error = await res.json();
        alert(error.error || 'Erro ao alterar cargo');
      }
    } catch (err) {
      console.error(err);
      alert('Falha na comunicação com o servidor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setActionLoading(userId);
      const res = await fetch(`/api/moritzadmin171roi/users?id=${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
        setDeleteConfirm(null);
      } else {
        const error = await res.json();
        alert(error.error || 'Erro ao excluir usuário');
      }
    } catch (err) {
      console.error(err);
      alert('Falha ao excluir usuário');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-red-400" />
            Gestão de Usuários
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Controle de acessos, permissões e auditoria de contas cadastradas.
          </p>
        </div>

        <button
          onClick={fetchUsers}
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
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0d0e14] border border-white/10 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-red-500/50 transition-colors"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl bg-[#0d0e14] border border-white/10 text-xs text-white focus:outline-none focus:border-red-500/50 cursor-pointer"
        >
          <option value="">Todos os Cargos</option>
          <option value="USER">Apenas Usuários</option>
          <option value="ADMIN">Apenas Admins</option>
          <option value="SUPER_ADMIN">Apenas Super Admins</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-[#0d0e14] border border-white/10 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-red-500 mb-2" />
            <p className="text-xs text-neutral-400 font-mono">Buscando usuários...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-xs text-neutral-500">
            Nenhum usuário encontrado com os filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Usuário</th>
                  <th className="py-3 px-4">Cargo / Permissão</th>
                  <th className="py-3 px-4 text-center">Clones</th>
                  <th className="py-3 px-4 text-center">Páginas</th>
                  <th className="py-3 px-4">Criado em</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {users.map((u) => {
                  const isMaster = u.email.toLowerCase() === ADMIN_AUTHORIZED_EMAIL;
                  const isDeleting = deleteConfirm === u.id;
                  const isBusy = actionLoading === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isMaster 
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                              : 'bg-white/5 text-neutral-300 border border-white/10'
                          }`}>
                            {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate flex items-center gap-1.5">
                              {u.name || 'Sem nome'}
                              {isMaster && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                  ADMIN OFICIAL
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-neutral-500 truncate font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role Selector */}
                      <td className="py-3.5 px-4">
                        {isMaster ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30 inline-flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" />
                            SUPER ADMIN
                          </span>
                        ) : (
                          <select
                            disabled={isBusy}
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="px-2 py-1 rounded-lg bg-[#141620] border border-white/10 text-xs text-white focus:outline-none focus:border-red-500/50 cursor-pointer disabled:opacity-50"
                          >
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                          </select>
                        )}
                      </td>

                      {/* Clones Count */}
                      <td className="py-3.5 px-4 text-center font-mono text-neutral-300">
                        {u._count?.clones || 0}
                      </td>

                      {/* Pages Count */}
                      <td className="py-3.5 px-4 text-center font-mono text-neutral-300">
                        {u._count?.pages || 0}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-neutral-400 text-[11px] font-mono">
                        {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isMaster ? (
                          <span className="text-[10px] text-neutral-600 italic">Protegido</span>
                        ) : isDeleting ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              disabled={isBusy}
                              onClick={() => handleDeleteUser(u.id)}
                              className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-[10px] font-bold text-white transition-colors"
                            >
                              Confirmar
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-[10px] text-neutral-300 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={isBusy}
                            onClick={() => setDeleteConfirm(u.id)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Excluir Usuário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
